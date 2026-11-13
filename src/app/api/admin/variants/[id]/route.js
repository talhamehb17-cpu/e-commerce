import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body.stock === undefined) return fail('Nothing to update', 400);
  const rows = await sql`update product_variants set stock = ${Math.max(0, Number(body.stock))} where id = ${id} returning stock`;
  invalidate('');
  await audit(admin, 'variant_stock', 'variant', id, body);
  return json({ ok: true, stock: rows[0]?.stock });
}
