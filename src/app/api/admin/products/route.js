import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit, slugify } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  optionName: z.string().trim().max(40).optional().or(z.literal('')),
  priceDelta: z.number().int().min(-100000000).max(100000000).default(0),
  stock: z.number().int().min(0).max(100000).default(0),
  sku: z.string().trim().max(60).optional().or(z.literal('')),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  subtitle: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(6000).optional().or(z.literal('')),
  story: z.string().trim().max(3000).optional().or(z.literal('')),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  price: z.number().min(0).max(100000000),          // major units of base currency
  compareAtPrice: z.number().min(0).max(100000000).nullable().optional(),
  costPrice: z.number().min(0).max(100000000).nullable().optional(),
  stock: z.number().int().min(0).max(1000000),
  lowStockThreshold: z.number().int().min(0).max(10000).default(5),
  sku: z.string().trim().max(60).optional().or(z.literal('')),
  material: z.string().trim().max(160).optional().or(z.literal('')),
  badge: z.enum(['new', 'bestseller', 'limited', 'featured', '']).optional().or(z.literal('')),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  images: z.array(z.string().trim().max(700)).max(8).default([]),
  variants: z.array(variantSchema).max(20).default([]),
  tags: z.array(z.string().trim().max(30)).max(12).default([]),
});

export async function GET(request) {
  const { admin, error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const offset = Number(searchParams.get('offset') || 0);

  const where = [];
  if (q) where.push(sql`(p.name ilike ${'%' + q + '%'} or p.sku ilike ${'%' + q + '%'})`);
  if (statusFilter === 'active') where.push(sql`p.is_active`);
  if (statusFilter === 'inactive') where.push(sql`not p.is_active`);
  if (statusFilter === 'low') where.push(sql`p.stock <= p.low_stock_threshold`);
  if (statusFilter === 'out') where.push(sql`p.stock = 0`);
  if (category) where.push(sql`c.slug = ${category}`);
  const filter = where.length ? sql`where ${where.reduce((a, b) => sql`${a} and ${b}`)}` : sql``;

  const rows = await sql`
    select p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name,
      (select count(*)::int from product_images pi where pi.product_id = p.id) as image_count,
      (select count(*)::int from product_variants v where v.product_id = p.id) as variant_count,
      (select coalesce(json_agg(json_build_object('url', pi.url, 'position', pi.position) order by pi.position), '[]'::json)
        from product_images pi where pi.product_id = p.id) as images,
      (select count(*)::int from order_items oi where oi.product_id = p.id) as orders_count
    from products p
    left join categories c on c.id = p.category_id
    left join brands b on b.id = p.brand_id
    ${filter}
    order by p.created_at desc limit ${limit} offset ${offset}
  `;
  const total = await sql`select count(*)::int n from products p left join categories c on c.id = p.category_id ${filter}`;
  return json({ products: rows, total: total[0].n });
}

export async function POST(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].path.join('.') + ': ' + parsed.error.issues[0].message, 422);
  const d = parsed.data;

  let slug = d.slug ? slugify(d.slug) : slugify(d.name);
  const clash = await sql`select id from products where slug = ${slug}`;
  if (clash[0]) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  const rows = await sql.begin(async (tx) => {
    const [product] = await tx`
      insert into products (slug, name, subtitle, description, story, category_id, brand_id, price,
        compare_at_price, cost_price, stock, low_stock_threshold, sku, material, badge, is_featured,
        is_active, tags)
      values (${slug}, ${d.name}, ${d.subtitle || null}, ${d.description || null}, ${d.story || null},
        ${d.categoryId || null}, ${d.brandId || null}, ${Math.round(d.price * 100)},
        ${d.compareAtPrice ? Math.round(d.compareAtPrice * 100) : null},
        ${d.costPrice ? Math.round(d.costPrice * 100) : null}, ${d.stock}, ${d.lowStockThreshold},
        ${d.sku || null}, ${d.material || null}, ${d.badge || null}, ${d.isFeatured}, ${d.isActive},
        ${d.tags})
      returning *
    `;
    for (let i = 0; i < d.images.length; i++) {
      await tx`insert into product_images (product_id, url, alt, position) values (${product.id}, ${d.images[i]}, ${d.name}, ${i})`;
    }
    for (let i = 0; i < d.variants.length; i++) {
      const v = d.variants[i];
      await tx`insert into product_variants (product_id, name, option_name, price_delta, stock, sku, position)
        values (${product.id}, ${v.name}, ${v.optionName || null}, ${Math.round(v.priceDelta * 100)}, ${v.stock}, ${v.sku || null}, ${i})`;
    }
    await tx`insert into stock_adjustments (product_id, delta, reason, actor) values (${product.id}, ${d.stock}, 'initial', ${admin.email})`;
    return product;
  });

  invalidate('');
  await audit(admin, 'product_created', 'product', rows.id, { name: d.name });
  return json({ ok: true, product: rows });
}
