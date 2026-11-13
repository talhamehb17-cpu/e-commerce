import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const patch = {};
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  if (body.value !== undefined) patch.value = Math.round(Number(body.value));
  if (body.usageLimit !== undefined) patch.usage_limit = body.usageLimit ? Number(body.usageLimit) : null;
  if (body.endsAt !== undefined) patch.ends_at = body.endsAt || null;
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  await sql`update coupons set ${sql(patch)} where id = ${id}`;
  await audit(admin, 'coupon_updated', 'coupon', id, patch);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  const { id } = await params;
  await sql`delete from coupons where id = ${id}`;
  await audit(admin, 'coupon_deleted', 'coupon', id);
  return json({ ok: true });
}
