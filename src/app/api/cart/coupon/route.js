import { sql } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer, getCart } from '@/lib/auth';
import { loadCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const code = String(body.code || '').trim();
  const customer = await getCurrentCustomer();
  const cart = await getCart(customer?.id || null);
  if (!cart) return fail('Your cart is empty.', 400);

  if (!code) {
    await sql`update carts set coupon_code = null, updated_at = now() where id = ${cart.id}`;
    const fresh = await loadCart(customer?.id || null);
    return ok({ removed: true, totals: fresh.totals });
  }

  await sql`update carts set coupon_code = ${code.toUpperCase()}, updated_at = now() where id = ${cart.id}`;
  const fresh = await loadCart(customer?.id || null);
  if (fresh.totals.couponError) {
    await sql`update carts set coupon_code = null where id = ${cart.id}`;
    return fail(fresh.totals.couponError, 422);
  }
  return ok({ totals: fresh.totals, coupon: fresh.totals.coupon?.code || code });
}
