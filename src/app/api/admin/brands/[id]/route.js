import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const patch = {};
  if (body.name !== undefined) patch.name = String(body.name).slice(0, 80);
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.logo !== undefined) patch.logo_url = body.logo || null;
  if (body.website !== undefined) patch.website = body.website || null;
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (body.isFeatured !== undefined) patch.is_featured = Boolean(body.isFeatured);
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  await sql`update brands set ${sql(patch)} where id = ${id}`;
  invalidate('');
  await audit(admin, 'brand_updated', 'brand', id, patch);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  await sql`delete from brands where id = ${id}`;
  invalidate('');
  await audit(admin, 'brand_deleted', 'brand', id);
  return json({ ok: true, deleted: true });
}
