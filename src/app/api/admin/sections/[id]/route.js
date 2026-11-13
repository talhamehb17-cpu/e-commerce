import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('content:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const patch = {};
  for (const [k, col] of Object.entries({ title: 'title', subtitle: 'subtitle', eyebrow: 'eyebrow', image: 'image_url', ctaLabel: 'cta_label', ctaHref: 'cta_href' })) {
    if (body[k] !== undefined) patch[col] = body[k] || null;
  }
  if (body.config !== undefined) patch.config = body.config;
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  await sql`update homepage_sections set ${sql(patch)}, updated_at = now() where id = ${id}`;
  invalidate('');
  await audit(admin, 'section_updated', 'homepage_section', id, Object.keys(patch));
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('content:write');
  if (error) return fail(error, status);
  const { id } = await params;
  await sql`delete from homepage_sections where id = ${id}`;
  invalidate('');
  await audit(admin, 'section_deleted', 'homepage_section', id);
  return json({ ok: true });
}
