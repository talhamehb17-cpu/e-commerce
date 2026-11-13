import { sql } from '@/lib/db';
import { fail, json, ok } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return json({ ids: [] });
  const rows = await sql`select product_id from wishlists where customer_id = ${customer.id}`;
  return json({ ids: rows.map((r) => r.product_id) });
}

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to save items to your wishlist.', 401);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const productId = body.productId;
  if (!/^[0-9a-f-]{36}$/i.test(String(productId))) return fail('Invalid product', 422);

  const exists = await sql`select id from wishlists where customer_id = ${customer.id} and product_id = ${productId}`;
  if (exists[0]) {
    await sql`delete from wishlists where id = ${exists[0].id}`;
    const n = await sql`select count(*)::int n from wishlists where customer_id = ${customer.id}`;
    return ok({ saved: false, count: n[0].n });
  }
  await sql`insert into wishlists (customer_id, product_id) values (${customer.id}, ${productId})`;
  const n = await sql`select count(*)::int n from wishlists where customer_id = ${customer.id}`;
  return ok({ saved: true, count: n[0].n });
}
