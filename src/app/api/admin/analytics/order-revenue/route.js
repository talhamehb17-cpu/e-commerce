import {guard} from '@/lib/admin';
import {fail,json} from '@/lib/api';
import {sql,rateLimit} from '@/lib/db';
import {getSetting} from '@/lib/settings';
export const dynamic='force-dynamic';
const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(`${d}T00:00:00Z`));
export async function GET(request){
 const {admin,error,status}=await guard('dashboard:read');if(error)return fail(error,status);if(!rateLimit(`order-revenue:${admin.id}`,60,60_000).ok)return fail('Too many analytics requests.',429);
 const p=new URL(request.url).searchParams,from=p.get('from'),to=p.get('to'),page=Math.max(1,Number(p.get('page')||1)),limit=Math.min(250,Math.max(50,Number(p.get('limit')||250))),statusFilter=p.get('status')||null,payment=p.get('payment')||null;
 if(!valid(from)||!valid(to)||from>to)return fail('Choose valid start and end dates.',400);
 const days=(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000+1;if(days>366)return fail('Order-wise graph ranges are limited to 366 days.',400);
 const settings=await getSetting('store');let tz=settings.timezone||'Asia/Karachi';try{new Intl.DateTimeFormat('en',{timeZone:tz})}catch{tz='Asia/Karachi'}
 const exclusive=new Date(Date.parse(`${to}T00:00:00Z`)+86400000).toISOString().slice(0,10);
 const bounds=await sql`select (${from}::date::timestamp at time zone ${tz}) start,(${exclusive}::date::timestamp at time zone ${tz}) "end"`;
 const start=bounds[0].start,end=bounds[0].end,offset=(page-1)*limit;
 const rows=await sql`select o.id,o.order_number,o.status,o.payment_status,o.payment_method,o.grand_total,o.currency,o.display_total,o.placed_at,o.email,o.shipping_address->>'full_name' customer_name,
   case when o.payment_status='paid' and o.status not in ('cancelled','returned','refunded') then o.grand_total else 0 end recognized_revenue
   from orders o where o.placed_at>=${start} and o.placed_at<${end} and (${statusFilter}::text is null or o.status=${statusFilter}) and (${payment}::text is null or o.payment_method=${payment})
   order by o.placed_at asc,o.id asc limit ${limit} offset ${offset}`;
 const count=await sql`select count(*)::int total,coalesce(sum(case when o.payment_status='paid' and o.status not in ('cancelled','returned','refunded') then o.grand_total else 0 end),0)::bigint recognized
   from orders o where o.placed_at>=${start} and o.placed_at<${end} and (${statusFilter}::text is null or o.status=${statusFilter}) and (${payment}::text is null or o.payment_method=${payment})`;
 return json({rows,total:count[0].total,recognizedRevenue:Number(count[0].recognized),page,limit,pages:Math.max(1,Math.ceil(count[0].total/limit)),range:{from,to,timezone:tz}});
}
