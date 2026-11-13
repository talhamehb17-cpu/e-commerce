import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit, slugify } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  optionName: z.string().trim().max(40).optional().or(z.literal('')),
  priceDelta: z.number().min(-100000000).max(100000000).default(0),
  stock: z.number().int().min(0).max(100000).default(0),
  sku: z.string().trim().max(60).optional().or(z.literal('')),
});

const schema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  slug: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(6000).nullable().optional(),
  story: z.string().trim().max(3000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  price: z.number().min(0).max(100000000).optional(),
  compareAtPrice: z.number().min(0).max(100000000).nullable().optional(),
  costPrice: z.number().min(0).max(100000000).nullable().optional(),
  stock: z.number().int().min(0).max(1000000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10000).optional(),
  sku: z.string().trim().max(60).nullable().optional(),
  material: z.string().trim().max(160).nullable().optional(),
  badge: z.string().trim().max(20).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  images: z.array(z.string().trim().max(700)).max(8).optional(),
  variants: z.array(variantSchema).max(20).optional(),
  tags: z.array(z.string().trim().max(30)).max(12).optional(),
});

export async function GET(_request, { params }) {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const { id } = await params;
  const rows = await sql`select * from products where id = ${id}`;
  if (!rows[0]) return fail('Product not found', 404);
  const [images, variants] = await Promise.all([
    sql`select id, url, alt, position from product_images where product_id = ${id} order by position`,
    sql`select id, name, option_name, price_delta, stock, sku, position from product_variants where product_id = ${id} order by position`,
  ]);
  const [cat] = rows[0].category_id ? await sql`select name, slug from categories where id = ${rows[0].category_id}` : [null];
  const [brand] = rows[0].brand_id ? await sql`select name from brands where id = ${rows[0].brand_id}` : [null];
  return json({
    product: { ...rows[0], images, variants, category_name: cat?.name || null, category_slug: cat?.slug || null, brand_name: brand?.name || null },
    images, variants,
  });
}

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;

  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;

  const existing = await sql`select * from products where id = ${id}`;
  if (!existing[0]) return fail('Product not found', 404);

  const patch = {};
  if (d.name !== undefined) patch.name = d.name;
  if (d.slug !== undefined) patch.slug = slugify(d.slug || d.name || existing[0].name);
  if (d.subtitle !== undefined) patch.subtitle = d.subtitle || null;
  if (d.description !== undefined) patch.description = d.description || null;
  if (d.story !== undefined) patch.story = d.story || null;
  if (d.categoryId !== undefined) patch.category_id = d.categoryId || null;
  if (d.brandId !== undefined) patch.brand_id = d.brandId || null;
  if (d.price !== undefined) patch.price = Math.round(d.price * 100);
  if (d.compareAtPrice !== undefined) patch.compare_at_price = d.compareAtPrice ? Math.round(d.compareAtPrice * 100) : null;
  if (d.costPrice !== undefined) patch.cost_price = d.costPrice ? Math.round(d.costPrice * 100) : null;
  if (d.lowStockThreshold !== undefined) patch.low_stock_threshold = d.lowStockThreshold;
  if (d.sku !== undefined) patch.sku = d.sku || null;
  if (d.material !== undefined) patch.material = d.material || null;
  if (d.badge !== undefined) patch.badge = d.badge || null;
  if (d.isFeatured !== undefined) patch.is_featured = d.isFeatured;
  if (d.isActive !== undefined) patch.is_active = d.isActive;
  if (d.tags !== undefined) patch.tags = d.tags;

  await sql.begin(async (tx) => {
    if (Object.keys(patch).length) {
      await tx`update products set ${tx(patch)}, updated_at = now() where id = ${id}`;
    }
    if (d.stock !== undefined && d.stock !== existing[0].stock) {
      const delta = d.stock - existing[0].stock;
      await tx`update products set stock = ${d.stock} where id = ${id}`;
      await tx`insert into stock_adjustments (product_id, delta, reason, actor) values (${id}, ${delta}, 'admin_adjust', ${admin.email})`;
    }
    if (d.images !== undefined) {
      await tx`delete from product_images where product_id = ${id}`;
      for (let i = 0; i < d.images.length; i++) {
        await tx`insert into product_images (product_id, url, alt, position) values (${id}, ${d.images[i]}, ${patch.name || existing[0].name}, ${i})`;
      }
    }
    if (d.variants !== undefined) {
      await tx`delete from product_variants where product_id = ${id}`;
      for (let i = 0; i < d.variants.length; i++) {
        const v = d.variants[i];
        await tx`insert into product_variants (product_id, name, option_name, price_delta, stock, sku, position)
          values (${id}, ${v.name}, ${v.optionName || null}, ${Math.round(v.priceDelta * 100)}, ${v.stock}, ${v.sku || null}, ${i})`;
      }
    }
  });

  invalidate('');
  await audit(admin, 'product_updated', 'product', id, { name: patch.name });
  return json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  await sql`update products set is_active = false, updated_at = now() where id = ${id}`;
  invalidate('');
  await audit(admin, 'product_archived', 'product', id);
  return json({ ok: true, archived: true });
}

export async function PUT(request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body?.hard) {
    await sql`delete from products where id = ${id}`;
    invalidate('');
    await audit(admin, 'product_deleted', 'product', id);
    return json({ ok: true, deleted: true });
  }
  return fail('Nothing to do', 400);
}
