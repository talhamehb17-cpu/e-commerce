import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('reviews:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const patch = {};
  if (body.isApproved !== undefined) patch.is_approved = Boolean(body.isApproved);
  if (body.isFeatured !== undefined) patch.is_featured = Boolean(body.isFeatured);
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  const rows = await sql`update reviews set ${sql(patch)} where id = ${id} returning product_id`;
  if (rows[0]) {
    const agg = await sql`select coalesce(avg(rating),0)::numeric(3,2) a, count(*)::int n from reviews where product_id = ${rows[0].product_id} and is_approved`;
    await sql`update products set rating_avg = ${agg[0].a}, rating_count = ${agg[0].n} where id = ${rows[0].product_id}`;
  }
  invalidate('');
  await audit(admin, 'review_moderated', 'review', id, patch);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('reviews:write');
  if (error) return fail(error, status);
  const { id } = await params;
  const rows = await sql`delete from reviews where id = ${id} returning product_id`;
  if (rows[0]) {
    const agg = await sql`select coalesce(avg(rating),0)::numeric(3,2) a, count(*)::int n from reviews where product_id = ${rows[0].product_id} and is_approved`;
    await sql`update products set rating_avg = ${agg[0].a}, rating_count = ${agg[0].n} where id = ${rows[0].product_id}`;
  }
  invalidate('');
  await audit(admin, 'review_deleted', 'review', id);
  return json({ ok: true });
}
