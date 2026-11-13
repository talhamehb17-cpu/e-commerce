import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit, slugify } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  image: z.string().trim().max(700).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(700).optional().or(z.literal('')),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const rows = await sql`
    select c.*, (select count(*)::int from products p where p.category_id = c.id) as product_count
    from categories c order by c.position, c.name`;
  return json({ categories: rows });
}

export async function POST(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  let slug = d.slug ? slugify(d.slug) : slugify(d.name);
  const clash = await sql`select id from categories where slug = ${slug}`;
  if (clash[0]) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  const rows = await sql`
    insert into categories (slug, name, description, image_url, position, is_active, parent_id)
    values (${slug}, ${d.name}, ${d.description || null}, ${d.image || d.imageUrl || null}, ${d.position}, ${d.isActive}, ${d.parentId || null})
    returning *`;
  invalidate('');
  await audit(admin, 'category_created', 'category', rows[0].id, { name: d.name });
  return json({ ok: true, category: rows[0] });
}
