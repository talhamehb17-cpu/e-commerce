import { json } from '@/lib/api';
import { getActivePromotionEvents } from '@/lib/promotions';

export const dynamic='force-dynamic';
export async function GET(){
  const events=await getActivePromotionEvents({publicOnly:true});
  return json({events:events.map(event=>({id:event.id,title:event.title,tagline:event.tagline,announcement_enabled:event.announcement_enabled,banner_enabled:event.banner_enabled,announcement_color:event.announcement_color,announcement_text_color:event.announcement_text_color,announcement_speed:event.announcement_speed,cta_href:event.cta_href,cta_label:event.cta_label,banner_image:event.banner_image,mobile_banner_image:event.mobile_banner_image,placement:event.placement,discount_percent:Number(event.discount_percent),starts_at:event.starts_at,ends_at:event.ends_at}))});
}
