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
  if (body.image !== undefined) patch.image_url = body.image || null;
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  await sql`update categories set ${sql(patch)} where id = ${id}`;
  invalidate('');
  await audit(admin, 'category_updated', 'category', id, patch);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  const used = await sql`select count(*)::int n from products where category_id = ${id}`;
  if (used[0].n > 0) {
    await sql`update categories set is_active = false where id = ${id}`;
    invalidate('');
    return json({ ok: true, archived: true, note: `Category had ${used[0].n} products — archived instead of deleted.` });
  }
  await sql`delete from categories where id = ${id}`;
  invalidate('');
  await audit(admin, 'category_deleted', 'category', id);
  return json({ ok: true, deleted: true });
}
