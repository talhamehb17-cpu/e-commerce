import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
export const dynamic='force-dynamic';
export async function POST(request,{params}){
 const customer=await getCurrentCustomer();if(!customer)return fail('Sign in to update payment proof.',401);
 const {number}=await params;let body;try{body=await request.json()}catch{return fail('Invalid request.',400)}
 const ref=String(body.transactionReference||'').trim(),key=String(body.paymentProofKey||'');
 if(ref.length<2||ref.length>120||!key.startsWith(`payment-proofs/customer-${customer.id}/`))return fail('Upload proof and enter a valid transaction reference.',422);
 try{return await sql.begin(async tx=>{
  const orders=await tx`select * from orders where order_number=${number} and customer_id=${customer.id} for update`;const order=orders[0];
  if(!order)return fail('Order not found.',404);
  if(order.payment_method==='cod'||order.payment_status==='paid'||['cancelled','returned','refunded'].includes(order.status))return fail('This order cannot accept another payment proof.',409);
  const latest=await tx`select status from payment_submissions where order_id=${order.id} order by created_at desc limit 1`;
  if(latest[0]?.status!=='rejected')return fail('A new proof can only be submitted after a rejection.',409);
  const sub=await tx`insert into payment_submissions(order_id,customer_id,proof_key,transaction_reference,status) values(${order.id},${customer.id},${key},${ref},'pending') returning id`;
  await tx`update orders set payment_status='pending',updated_at=now() where id=${order.id}`;
  await tx`insert into order_events(order_id,status,note,actor) values(${order.id},${order.status},'Customer resubmitted payment proof for review','customer')`;
  return json({ok:true,submissionId:sub[0].id});
 });}catch(e){return fail('Could not submit updated proof.',500)}
}
