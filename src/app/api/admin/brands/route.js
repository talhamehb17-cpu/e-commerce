import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit, slugify } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  logo: z.string().trim().max(700).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(700).optional().or(z.literal('')),
  website: z.string().trim().max(200).optional().or(z.literal('')),
  isFeatured: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const rows = await sql`
    select b.*, (select count(*)::int from products p where p.brand_id = b.id) as product_count
    from brands b order by b.position, b.name`;
  return json({ brands: rows });
}

export async function POST(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  let slug = d.slug ? slugify(d.slug) : slugify(d.name);
  const clash = await sql`select id from brands where slug = ${slug}`;
  if (clash[0]) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  const rows = await sql`
    insert into brands (slug, name, description, logo_url, website, is_featured, position, is_active)
    values (${slug}, ${d.name}, ${d.description || null}, ${d.logo || d.logoUrl || null}, ${d.website || null}, ${d.isFeatured}, ${d.position}, ${d.isActive})
    returning *`;
  invalidate('');
  await audit(admin, 'brand_created', 'brand', rows[0].id, { name: d.name });
  return json({ ok: true, brand: rows[0] });
}
