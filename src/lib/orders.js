import { sql } from './db.js';
import { sendMail, templates } from './email.js';
import { getSetting } from './settings.js';

export const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned',
];

export const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export function generateOrderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NOVA-${stamp}-${rand}`;
}

export async function fulfillOrder(orderNumber) {
  return sql`
    select o.*, json_agg(json_build_object(
      'name', oi.name, 'variant_name', oi.variant_name, 'qty', oi.qty,
      'unit_price', oi.unit_price, 'line_total', oi.line_total, 'image_url', oi.image_url,
      'product_id', oi.product_id
    )) as items
    from orders o left join order_items oi on oi.order_id = o.id
    where o.order_number = ${orderNumber}
    group by o.id limit 1
  `.then((r) => r[0] || null);
}

/**
 * Apply a status change: persist, record history, and email the customer once.
 * Duplicate notifications are prevented by only emailing on an actual change.
 */
export async function changeOrderStatus({ orderId, status, note = '', actor = 'admin', trackingNumber, carrier, sendEmail = true }) {
  if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status');

  const rows = await sql`select * from orders where id = ${orderId} limit 1`;
  const order = rows[0];
  if (!order) throw new Error('Order not found');
  const previous = order.status;
  if (previous === status && !trackingNumber && !carrier) {
    return { changed: false, order };
  }

  const patch = { status };
  if (trackingNumber !== undefined) patch.tracking_number = trackingNumber;
  if (carrier !== undefined) patch.carrier = carrier;

  const delivered = status === 'delivered' ? new Date() : null;
  const cancelled = status === 'cancelled' ? new Date() : null;

  const updated = await sql`
    update orders set
      status = ${status},
      tracking_number = ${patch.tracking_number ?? order.tracking_number},
      carrier = ${patch.carrier ?? order.carrier},
      updated_at = now(),
      delivered_at = ${delivered ?? order.delivered_at},
      cancelled_at = ${cancelled ?? order.cancelled_at},
      payment_status = ${status === 'delivered' && order.payment_method === 'cod' ? 'paid' : status === 'cancelled' ? order.payment_status : order.payment_status}
    where id = ${orderId}
    returning *
  `;

  const event = await sql`
    insert into order_events (order_id, status, note, actor) values (${orderId}, ${status}, ${note}, ${actor})
    returning id
  `;

  // This is a customer-confirmation request, not proof of delivery. It remains pending
  // until the customer responds; no automated rule changes an order to delivered.
  if (status === 'out_for_delivery' && previous !== 'out_for_delivery' && order.customer_id) {
    await sql`insert into delivery_confirmations (order_id, customer_id, state, next_reminder_at)
      values (${orderId}, ${order.customer_id}, 'pending', now())
      on conflict (order_id) do update set state='pending', response_at=null,
        reminder_count=0, created_at=now(), next_reminder_at=now()
      where delivery_confirmations.state <> 'pending'`;
  }

  // restock on cancellation
  if (status === 'cancelled' && previous !== 'cancelled') {
    const items = await sql`select product_id, variant_id, qty from order_items where order_id = ${orderId}`;
    for (const it of items) {
      if (it.product_id) await sql`update products set stock = stock + ${it.qty} where id = ${it.product_id}`;
      if (it.variant_id) await sql`update product_variants set stock = stock + ${it.qty} where id = ${it.variant_id}`;
    }
  }

  let emailed = false;
  const emailSettings = await getSetting('email');
  if (sendEmail && emailSettings.order_updates && ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'].includes(status)) {
    const tpl = templates.status_update({ name: order.shipping_address?.full_name || 'there', order: updated[0], status, note });
    const res = await sendMail({ to: order.email, subject: tpl.subject, html: tpl.html, template: `status_${status}`, orderId });
    emailed = Boolean(res.ok);
  }
  await sql`update order_events set email_sent = ${emailed} where id = ${event[0].id}`;

  return { changed: true, order: updated[0], emailed };
}

export function timelineFor(order, events = []) {
  const flow = order.status === 'cancelled' || order.status === 'returned'
    ? [...STATUS_FLOW.slice(0, 2), order.status]
    : STATUS_FLOW;
  const reached = new Set(events.map((e) => e.status));
  const idx = flow.indexOf(order.status);
  return flow.map((s, i) => {
    const ev = events.find((e) => e.status === s);
    return {
      status: s,
      done: i <= idx,
      at: ev?.created_at || null,
      note: ev?.note || null,
      current: s === order.status,
    };
  });
}
