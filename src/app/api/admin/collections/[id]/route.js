import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function GET(_req, { params }) {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const { id } = await params;
  const rows = await sql`select * from collections where id = ${id}`;
  if (!rows[0]) return fail('Collection not found', 404);
  const items = await sql`select product_id from collection_products where collection_id = ${id} order by position`;
  return json({ collection: rows[0], productIds: items.map((r) => r.product_id) });
}

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const patch = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.image !== undefined) patch.image_url = body.image || null;
  if (body.isFeatured !== undefined) patch.is_featured = Boolean(body.isFeatured);
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  await sql.begin(async (tx) => {
    if (Object.keys(patch).length) await tx`update collections set ${tx(patch)} where id = ${id}`;
    if (Array.isArray(body.productIds)) {
      await tx`delete from collection_products where collection_id = ${id}`;
      for (let i = 0; i < body.productIds.length; i++) {
        await tx`insert into collection_products (collection_id, product_id, position) values (${id}, ${body.productIds[i]}, ${i}) on conflict do nothing`;
      }
    }
  });
  invalidate('');
  await audit(admin, 'collection_updated', 'collection', id);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  await sql`delete from collections where id = ${id}`;
  invalidate('');
  await audit(admin, 'collection_deleted', 'collection', id);
  return json({ ok: true });
}
