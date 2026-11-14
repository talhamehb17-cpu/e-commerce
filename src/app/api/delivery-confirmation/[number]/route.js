import { sql, invalidate, rateLimit } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { sendMail, templates } from '@/lib/email';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to confirm delivery.', 401);
  const { number } = await params;
  const rows = await sql`select o.order_number,o.status,o.out_for_delivery_at,dc.state,dc.due_at,dc.response_at
    from orders o left join delivery_confirmations dc on dc.order_id=o.id and dc.customer_id=${customer.id}
    where o.order_number=${number} and o.customer_id=${customer.id} limit 1`;
  if (!rows[0]) return fail('Order not found.', 404);
  const row=rows[0];
  return json({show:row.status==='out_for_delivery'&&row.state==='pending'&&new Date(row.due_at)<=new Date(),...row});
}

export async function POST(request, { params }) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to confirm delivery.', 401);
  if(!rateLimit(`delivery-answer:${customer.id}`,12,60_000).ok)return fail('Too many delivery responses. Wait a moment and retry.',429);
  const { number } = await params;
  let body;
  try { body = await request.json(); } catch { return fail('Invalid request.', 400); }
  if (!['received','not_received'].includes(body.response)) return fail('Choose a delivery response.', 422);

  let result;
  try {
    result = await sql.begin(async (tx) => {
      const orderRows = await tx`select * from orders where order_number=${number} and customer_id=${customer.id} for update`;
      const order = orderRows[0];
      if (!order) return { error:'Order not found.', status:404 };
      if (order.status !== 'out_for_delivery') return { error:'This order is no longer awaiting delivery confirmation.', status:409 };
      const confirmations = await tx`select state,due_at from delivery_confirmations where order_id=${order.id} and customer_id=${customer.id} for update`;
      if (!confirmations[0] || confirmations[0].state !== 'pending') return { error:'A response has already been recorded.', status:409 };
      if(new Date(confirmations[0].due_at)>new Date())return {error:'The delivery confirmation will be available after the reminder time.',status:409};
      const changed = await tx`update delivery_confirmations set state=${body.response},response_at=now(),lease_until=null,next_reminder_at='infinity'
        where order_id=${order.id} and customer_id=${customer.id} and state='pending' returning response_at`;
      if (!changed[0]) return { error:'A response has already been recorded.', status:409 };
      const responseAt = changed[0].response_at.toISOString();
      const items = await tx`select name,qty,image_url from order_items where order_id=${order.id} order by name`;
      const details = {orderNumber:order.order_number,customerName:customer.name,email:order.email,customerId:customer.id,
        products:items,status:order.status,response:body.response,responseAt};

      if (body.response === 'received') {
        const updated = await tx`update orders set status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
          where id=${order.id} and customer_id=${customer.id} and status='out_for_delivery' returning *`;
        if (!updated[0]) return {error:'Order status changed before confirmation was saved. Refresh and try again.',status:409};
        await tx`insert into order_events(order_id,status,note,actor) values(${order.id},'delivered','Customer confirmed receipt of the order.',${`customer:${customer.id}`})`;
        await tx`insert into admin_notifications(type,title,body,details) values('delivery_received','Customer confirmed delivery',${`${customer.name} confirmed receipt for order ${order.order_number}.`},${sql.json(details)})`;
        await tx`insert into audit_logs(actor_type,actor_id,actor_email,action,entity,entity_id,meta)
          values('customer',${customer.id},${customer.email},'customer_delivery_confirmed','order',${order.id},${sql.json({orderNumber:order.order_number,responseAt})})`;
        return {ok:true,response:body.response,responseAt,orderStatus:'delivered',order:updated[0],orderId:order.id};
      }

      await tx`insert into order_events(order_id,status,note,actor) values(${order.id},'delivery_not_received','Customer reported that the package has not arrived.',${`customer:${customer.id}`})`;
      await tx`insert into admin_notifications(type,title,body,details) values('delivery_not_received','Customer reports missing delivery',${`${customer.name} says order ${order.order_number} has not arrived.`},${sql.json(details)})`;
      await tx`insert into audit_logs(actor_type,actor_id,actor_email,action,entity,entity_id,meta)
        values('customer',${customer.id},${customer.email},'customer_delivery_not_received','order',${order.id},${sql.json({orderNumber:order.order_number,responseAt})})`;
      return {ok:true,response:body.response,responseAt,orderStatus:order.status,order,orderId:order.id};
    });
  } catch (error) {
    console.error('Delivery confirmation write failed:',error?.message||'unknown error');
    return fail('We could not save your response. Please retry.',503);
  }
  if (result.error) return fail(result.error,result.status);

  if (result.response === 'received') {
    try {
      const settings=await getSetting('email');
      if (settings.order_updates !== false) {
        const template=templates.status_update({name:customer.name||'there',order:result.order,status:'delivered'});
        await sendMail({to:result.order.email,subject:template.subject,html:template.html,template:'status_delivered_customer_confirmed',orderId:result.orderId,customerId:customer.id});
      }
    } catch { /* delivery status is already committed; email retry is independent */ }
  }
  invalidate('');
  return json(result);
}
