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

/** Persist an order transition and its durable side effects atomically. SMTP runs only
 * after commit so network latency never leaves a half-updated fulfillment state. */
export async function changeOrderStatus({ orderId, status, note = '', actor = 'admin', trackingNumber, carrier, sendEmail = true }) {
  if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status');
  const transition=await sql.begin(async tx=>{
    const rows=await tx`select * from orders where id=${orderId} for update`;
    const order=rows[0];
    if(!order)return {error:'Order not found'};
    const previous=order.status;
    if(order.payment_method!=='cod'&&order.payment_status!=='paid'&&status!==previous&&status!=='cancelled')
      return {error:'Online payment must be verified before confirming or fulfilling this order.'};
    if(previous===status&&!trackingNumber&&!carrier)return {changed:false,order};
    const delivered=status==='delivered'?new Date():null;
    const cancelled=status==='cancelled'?new Date():null;
    const updated=await tx`update orders set
      status=${status},tracking_number=${trackingNumber??order.tracking_number},carrier=${carrier??order.carrier},updated_at=now(),
      delivered_at=${delivered??order.delivered_at},
      out_for_delivery_at=case when ${status}='out_for_delivery' and ${previous}<>'out_for_delivery' then now() else out_for_delivery_at end,
      cancelled_at=${cancelled??order.cancelled_at},
      payment_status=${status==='delivered'&&order.payment_method==='cod'?'paid':order.payment_status}
      where id=${orderId} returning *`;
    const event=await tx`insert into order_events(order_id,status,note,actor) values(${orderId},${status},${note},${actor}) returning id`;
    if(status==='out_for_delivery'&&previous!=='out_for_delivery'&&order.customer_id){
      await tx`insert into delivery_confirmations(order_id,customer_id,state,response_at,next_reminder_at,last_reminder_at,reminder_count,due_at,lease_until,created_at)
        values(${orderId},${order.customer_id},'pending',null,now()+interval '10 minutes',null,0,now()+interval '10 minutes',null,now())
        on conflict(order_id) do update set customer_id=excluded.customer_id,state='pending',response_at=null,reminder_count=0,
          created_at=now(),next_reminder_at=now()+interval '10 minutes',due_at=now()+interval '10 minutes',last_reminder_at=null,lease_until=null`;
    }else if(previous==='out_for_delivery'&&status!=='out_for_delivery'){
      await tx`update delivery_confirmations set state='superseded',lease_until=null where order_id=${orderId} and state='pending'`;
    }
    if(status==='cancelled'&&previous!=='cancelled'){
      const items=await tx`select product_id,variant_id,qty from order_items where order_id=${orderId}`;
      for(const item of items){
        if(item.product_id)await tx`update products set stock=stock+${item.qty} where id=${item.product_id}`;
        if(item.variant_id)await tx`update product_variants set stock=stock+${item.qty} where id=${item.variant_id}`;
      }
    }
    return {changed:true,previous,order:updated[0],eventId:event[0].id};
  });
  if(transition.error)throw new Error(transition.error);
  if(!transition.changed)return transition;
  let emailed=false;
  const emailSettings=await getSetting('email');
  if(sendEmail&&emailSettings.order_updates&&['confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','returned'].includes(status)){
    const template=templates.status_update({name:transition.order.shipping_address?.full_name||'there',order:transition.order,status,note});
    const sent=await sendMail({to:transition.order.email,subject:template.subject,html:template.html,template:`status_${status}`,orderId});
    emailed=Boolean(sent.ok);
  }
  await sql`update order_events set email_sent=${emailed} where id=${transition.eventId}`;
  return {...transition,emailed};
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
