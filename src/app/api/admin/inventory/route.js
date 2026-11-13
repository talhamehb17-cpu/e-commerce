import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await guard('products:read');
  if (error) return fail(error, status);
  const rows = await sql`
    select p.id, p.name, p.slug, p.sku, p.stock, p.low_stock_threshold, c.name as category_name,
      (select count(*)::int from product_variants v where v.product_id = p.id) as variants
    from products p left join categories c on c.id = p.category_id
    where p.is_active order by (p.stock <= p.low_stock_threshold) desc, p.stock asc limit 200`;
  const moves = await sql`
    select s.id, s.delta, s.reason, s.actor, s.created_at, p.name
    from stock_adjustments s left join products p on p.id = s.product_id
    order by s.created_at desc limit 30`;
  return json({ inventory: rows, moves });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body.productId || body.delta === undefined) return fail('Missing product or delta', 422);
  const delta = Math.trunc(Number(body.delta));
  const rows = await sql`
    update products set stock = greatest(0, stock + ${delta}), updated_at = now()
    where id = ${body.productId} returning stock`;
  if (!rows[0]) return fail('Product not found', 404);
  await sql`insert into stock_adjustments (product_id, delta, reason, actor) values (${body.productId}, ${delta}, ${body.reason || 'manual'}, ${admin.email})`;
  invalidate('');
  await audit(admin, 'stock_adjusted', 'product', body.productId, { delta });
  return json({ ok: true, stock: rows[0].stock });
}
