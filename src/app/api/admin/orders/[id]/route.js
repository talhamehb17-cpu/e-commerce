import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { changeOrderStatus, fulfillOrder, ORDER_STATUSES } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { error, status } = await guard('orders:read');
  if (error) return fail(error, status);
  const { id } = await params;
  const found = await sql`select order_number from orders where id::text = ${id} or order_number = ${id}`;
  if (!found[0]) return fail('Order not found', 404);
  const o = await fulfillOrder(found[0].order_number);
  if (!o) return fail('Order not found', 404);
  const events = await sql`select status, note, actor, email_sent, created_at from order_events where order_id = ${o.id} order by created_at`;
  const customer = o.customer_id ? (await sql`select id, name, email, phone, created_at from customers where id = ${o.customer_id}`)[0] : null;
  return json({ order: o, events, customer });
}

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('orders:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body.status || !ORDER_STATUSES.includes(body.status)) return fail('Choose a valid status', 422);

  try {
    const result = await changeOrderStatus({
      orderId: id,
      status: body.status,
      note: body.note || '',
      actor: admin.email,
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
      sendEmail: body.sendEmail !== false,
    });
    invalidate('');
    await audit(admin, 'order_status_changed', 'order', id, { status: body.status });
    return json({ ok: true, changed: result.changed, emailed: result.emailed, order: result.order });
  } catch (e) {
    return fail(e.message, 400);
  }
}
