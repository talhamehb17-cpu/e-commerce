import { sql } from '@/lib/db';
import { json } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { fulfillOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const number = searchParams.get('number');
  const customer = await getCurrentCustomer();
  if (!number) {
    if (!customer) return json({ error: 'Sign in to view your orders.' }, { status: 401 });
    const rows = await sql`
      select o.id, o.order_number, o.status, o.grand_total, o.currency, o.display_total, o.placed_at, o.payment_method,
        (select count(*)::int from order_items oi where oi.order_id = o.id) as item_count
      from orders o where o.customer_id = ${customer.id} order by o.placed_at desc limit 50`;
    return json({ orders: rows });
  }
  const order = await fulfillOrder(number);
  if (!order) return json({ error: 'Order not found' }, { status: 404 });
  const isOwner = customer && order.customer_id === customer.id;
  const email = searchParams.get('email');
  if (!isOwner && !(email && email.toLowerCase() === order.email.toLowerCase())) {
    return json({ error: 'Order not found' }, { status: 404 });
  }
  const events = await sql`select status, note, created_at from order_events where order_id = ${order.id} order by created_at`;
  return json({ order: { ...order, email: undefined }, events });
}
