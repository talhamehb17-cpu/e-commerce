import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  key: z.string().trim().min(2).max(40),
  type: z.enum(['hero', 'marquee', 'categories', 'collections', 'brands', 'products', 'banner', 'story', 'values', 'reviews', 'instagram', 'newsletter', 'rich']),
  title: z.string().trim().max(160).optional().or(z.literal('')),
  subtitle: z.string().trim().max(600).optional().or(z.literal('')),
  eyebrow: z.string().trim().max(80).optional().or(z.literal('')),
  image: z.string().trim().max(700).optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal('')),
  ctaHref: z.string().trim().max(200).optional().or(z.literal('')),
  config: z.record(z.string(), z.any()).default({}),
  position: z.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const { error, status } = await guard('content:read');
  if (error) return fail(error, status);
  const rows = await sql`select * from homepage_sections order by position`;
  return json({ sections: rows });
}

export async function POST(request) {
  const { admin, error, status } = await guard('content:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  const key = d.key.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const exists = await sql`select id from homepage_sections where key = ${key}`;
  if (exists[0]) return fail('A section with that key already exists.', 409);
  const rows = await sql`
    insert into homepage_sections (key, type, title, subtitle, eyebrow, image_url, cta_label, cta_href, config, position, is_active)
    values (${key}, ${d.type}, ${d.title || null}, ${d.subtitle || null}, ${d.eyebrow || null}, ${d.image || null},
      ${d.ctaLabel || null}, ${d.ctaHref || null}, ${sql.json(d.config)}, ${d.position}, ${d.isActive})
    returning *`;
  invalidate('');
  await audit(admin, 'section_created', 'homepage_section', rows[0].id, { key });
  return json({ ok: true, section: rows[0] });
}
