import { fail, json } from '@/lib/api';
import { rateLimit } from '@/lib/db';
import { recordPromotionActivity } from '@/lib/promotions';
import { visitorHash } from '@/lib/analytics-events';

export const dynamic='force-dynamic';
export async function POST(request){
  const ip=request.headers.get('x-forwarded-for')||'local';
  if(!rateLimit(`promotion-track:${ip}`,120,60_000).ok)return fail('Too many promotion events.',429);
  let body;try{body=await request.json()}catch{return fail('Invalid body.',400)}
  if(typeof body.eventId!=='string'||!['event_view','banner_click','product_view','add_to_cart'].includes(body.activityType))return fail('Invalid event tracking data.',422);
  try{await recordPromotionActivity({eventId:body.eventId,activityType:body.activityType,visitorHash:visitorHash(request),productId:typeof body.productId==='string'?body.productId:null});return json({ok:true})}
  catch(error){console.error('Promotion activity write failed:',error?.message||'unknown error');return fail('Could not record promotion activity.',500)}
}
