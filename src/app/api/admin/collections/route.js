import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit, slugify } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const schema = z.object({
  name: z.string().trim().min(2).max(90),
  slug: z.string().trim().max(90).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  image: z.string().trim().max(700).optional().or(z.literal('')),
  isFeatured: z.boolean().default(false),
  position: z.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string().uuid()).max(60).default([]),
});

export async function GET() {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const rows = await sql`
    select co.*, (select count(*)::int from collection_products cp where cp.collection_id = co.id) as product_count
    from collections co order by co.position, co.name`;
  return json({ collections: rows });
}

export async function POST(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  let slug = d.slug ? slugify(d.slug) : slugify(d.name);
  const clash = await sql`select id from collections where slug = ${slug}`;
  if (clash[0]) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  const rows = await sql.begin(async (tx) => {
    const [c] = await tx`
      insert into collections (slug, name, description, image_url, is_featured, position, is_active)
      values (${slug}, ${d.name}, ${d.description || null}, ${d.image || null}, ${d.isFeatured}, ${d.position}, ${d.isActive})
      returning *`;
    for (let i = 0; i < d.productIds.length; i++) {
      await tx`insert into collection_products (collection_id, product_id, position) values (${c.id}, ${d.productIds[i]}, ${i}) on conflict do nothing`;
    }
    return [c];
  });
  invalidate('');
  await audit(admin, 'collection_created', 'collection', rows[0].id, { name: d.name });
  return json({ ok: true, collection: rows[0] });
}
