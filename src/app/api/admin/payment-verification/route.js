import { sql, rateLimit } from '@/lib/db';
import { guard, audit } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { sendMail } from '@/lib/email';
import { invalidate } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const { admin, error, status } = await guard('orders:read'); if (error) return fail(error,status);
  if (!rateLimit(`payment-queue:${admin.id}`,60,60_000).ok) return fail('Too many requests.',429);
  const p=new URL(request.url).searchParams, state=p.get('status')||'pending', method=p.get('payment')||'all', q=(p.get('q')||'').trim().slice(0,100), page=Math.max(1,Number(p.get('page')||1)), limit=40, offset=(page-1)*limit;
  if(!['all','pending','verified','rejected'].includes(state)||!['all','bank_transfer','easypaisa','jazzcash'].includes(method))return fail('Invalid filter.',400);
  const rows=await sql`with latest as (select distinct on(ps.order_id) ps.* from payment_submissions ps order by ps.order_id,ps.created_at desc)
    select l.id submission_id,l.status payment_status,l.transaction_reference,l.rejection_reason,l.created_at submitted_at,
      o.id order_id,o.order_number,o.email,o.payment_method,o.grand_total,o.currency,o.status order_status,
      o.shipping_address->>'full_name' customer_name
    from latest l join orders o on o.id=l.order_id
    where (${state}='all' or l.status=${state}) and (${method}='all' or o.payment_method=${method}) and (${q}='' or o.order_number ilike ${`%${q}%`} or o.email ilike ${`%${q}%`} or l.transaction_reference ilike ${`%${q}%`})
    order by case when l.status='pending' then 0 else 1 end,l.created_at desc limit ${limit} offset ${offset}`;
  const counts=await sql`select status,count(*)::int n from (select distinct on(order_id) status,order_id from payment_submissions order by order_id,created_at desc) x group by status`;
  const total=await sql`with latest as (select distinct on(ps.order_id) ps.status,ps.order_id,ps.transaction_reference from payment_submissions ps order by ps.order_id,ps.created_at desc)
    select count(*)::int n from latest l join orders o on o.id=l.order_id where (${state}='all' or l.status=${state}) and (${method}='all' or o.payment_method=${method}) and (${q}='' or o.order_number ilike ${`%${q}%`} or o.email ilike ${`%${q}%`} or l.transaction_reference ilike ${`%${q}%`})`;
  return json({submissions:rows,counts:counts.reduce((a,x)=>(a[x.status]=x.n,a),{}),total:total[0].n,page,limit});
}
export async function PATCH(request) {
  const {admin,error,status}=await guard('orders:write');if(error)return fail(error,status);
  let body;try{body=await request.json()}catch{return fail('Invalid request.',400)}
  if(!body?.submissionId||!['verify','reject'].includes(body.action))return fail('Choose verify or reject.',422);
  const reason=String(body.reason||'').trim();if(body.action==='reject'&&(reason.length<4||reason.length>500))return fail('Enter a rejection reason (4–500 characters).',422);
  let result;
  try {
    result=await sql.begin(async tx=>{
      const subs=await tx`select * from payment_submissions where id=${body.submissionId} for update`;const sub=subs[0];if(!sub||sub.status!=='pending')throw new Error('This submission is no longer pending. Refresh the queue.');
      const orders=await tx`select * from orders where id=${sub.order_id} for update`;const order=orders[0];if(!order||order.payment_method==='cod')throw new Error('This order is not an online payment.');
      if(['cancelled','returned','refunded'].includes(order.status))throw new Error('A closed order cannot be payment-verified.');
      const next=body.action==='verify'?'verified':'rejected';
      await tx`update payment_submissions set status=${next},rejection_reason=${next==='rejected'?reason:null},reviewed_by=${admin.id},reviewed_by_email=${admin.email},reviewed_at=now() where id=${sub.id}`;
      const updated=(await tx`update orders set payment_status=${next==='verified'?'paid':'rejected'},status=${next==='verified'?'confirmed':order.status},updated_at=now() where id=${order.id} returning *`)[0];
      const note=next==='verified'?'Manual payment verified by administrator':`Payment proof rejected: ${reason}`;
      await tx`insert into order_events(order_id,status,note,actor) values(${order.id},${next==='verified'?'confirmed':order.status},${note},${admin.email})`;
      return {order:updated,submission:sub,next,reason};
    });
  }catch(e){return fail(e.message||'Could not review payment.',409)}
  await audit(admin,`payment_${result.next}`,'payment_submission',body.submissionId,{orderId:result.order.id,reason:result.reason||null});invalidate('');
  const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  const message=result.next==='verified'?'Your transfer has been verified and your order is confirmed.':`Your payment proof needs attention. Reason: ${escapeHtml(result.reason)}. Please open your order details to submit an updated receipt and transaction reference.`;
  const html=`<p>Hello ${escapeHtml(result.order.shipping_address?.full_name||'there')},</p><p>${message}</p><p>Order ${escapeHtml(result.order.order_number)}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL||'https://nova-commerce-eight.vercel.app'}/account/orders/${encodeURIComponent(result.order.order_number)}">View your order</a></p>`;
  const mailed=await sendMail({to:result.order.email,subject:`${result.order.order_number}: payment ${result.next}`,html,template:'payment_review',orderId:result.order.id}).catch(()=>({ok:false}));
  return json({ok:true,status:result.next,orderNumber:result.order.order_number,notified:Boolean(mailed.ok)});
}
