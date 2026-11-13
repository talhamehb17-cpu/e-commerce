import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { sendMail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function ownedOrder(number, customer) {
  const rows = await sql`select * from orders where order_number=${number} and customer_id=${customer.id} limit 1`;
  return rows[0] || null;
}

export async function GET(_request, { params }) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to confirm delivery.', 401);
  const { number } = await params;
  const order = await ownedOrder(number, customer);
  if (!order) return fail('Order not found.', 404);
  if (order.status !== 'out_for_delivery') return json({ show: false, state: 'inactive' });
  const d = await getSetting('delivery');
  const minutes = Math.max(1, Math.min(1440, Number(d.reminder_minutes) || 5));
  const claimed = await sql`update delivery_confirmations
    set last_reminder_at=now(), next_reminder_at=now()+(${minutes} * interval '1 minute'), reminder_count=reminder_count+1
    where order_id=${order.id} and customer_id=${customer.id} and state='pending' and next_reminder_at<=now()
    returning order_id, state, reminder_count, response_at`;
  if (claimed[0]) return json({ show: true, state: 'pending', reminder: claimed[0].reminder_count > 1, reminderCount: claimed[0].reminder_count, intervalMinutes: minutes, orderNumber: order.order_number });
  const state = await sql`select state, response_at, next_reminder_at, reminder_count from delivery_confirmations where order_id=${order.id} and customer_id=${customer.id} limit 1`;
  return json({ show: false, ...(state[0] || { state: 'inactive' }), intervalMinutes: minutes });
}

export async function POST(request, { params }) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to confirm delivery.', 401);
  const { number } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid request.', 400); }
  if (!['received','not_received'].includes(body.response)) return fail('Choose a delivery response.', 422);
  const order = await ownedOrder(number, customer);
  if (!order) return fail('Order not found.', 404);
  if (order.status !== 'out_for_delivery') return fail('This order is no longer out for delivery.', 409);
  const changed = await sql`update delivery_confirmations set state=${body.response}, response_at=now(), next_reminder_at='infinity'
    where order_id=${order.id} and customer_id=${customer.id} and state='pending'
    returning response_at`;
  if (!changed[0]) return fail('A response has already been recorded.', 409);

  const items = await sql`select name, qty from order_items where order_id=${order.id} order by name`;
  const address = order.shipping_address || {};
  const stamp = changed[0].response_at.toISOString();
  const details = { orderNumber: order.order_number, customerName: customer.name, email: order.email, phone: order.phone,
    products: items, address, status: order.status, response: body.response, responseAt: stamp };

  if (body.response === 'not_received') {
    await sql`insert into admin_notifications (type,title,body,details) values
      ('delivery_not_received','Customer reports missing delivery',${`${customer.name} says order ${order.order_number} has not arrived.`},${sql.json(details)})`;
    const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
    if (to) {
      const productText = items.map((i) => `${i.name} × ${i.qty}`).join(', ');
      const addressText = [address.full_name,address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ');
      await sendMail({ to, subject: `Delivery issue — ${order.order_number}`, template: 'delivery_complaint', orderId: order.id,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#211c16"><h2>Customer reported that their order has not been received.</h2><p><b>Order:</b> ${escapeHtml(order.order_number)}<br><b>Customer:</b> ${escapeHtml(customer.name)}<br><b>Contact:</b> ${escapeHtml(order.email)} · ${escapeHtml(order.phone || 'no phone')}<br><b>Products:</b> ${escapeHtml(productText)}<br><b>Address:</b> ${escapeHtml(addressText)}<br><b>Status:</b> ${escapeHtml(order.status)}<br><b>Response time:</b> ${escapeHtml(stamp)}</p><p>Please contact the customer and courier to investigate.</p></div>` });
    }
  } else {
    await sql`insert into admin_notifications (type,title,body,details) values
      ('delivery_received','Customer confirmed delivery',${`${customer.name} confirmed receipt for order ${order.order_number}.`},${sql.json(details)})`;
    await sql`insert into order_events (order_id,status,note,actor) values (${order.id},'delivery_customer_confirmed','Customer confirmed receipt of the package.','customer')`;
  }
  return json({ ok: true, response: body.response, responseAt: stamp, orderStatus: order.status });
}
