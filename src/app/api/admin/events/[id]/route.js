import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const patchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(2000).nullable().optional(), tagline: z.string().trim().max(240).nullable().optional(),
  bannerImage: z.string().trim().max(800).nullable().optional(), mobileBannerImage: z.string().trim().max(800).nullable().optional(),
  placement: z.enum(['homepage_hero','home_section','category','product']).optional(), ctaLabel: z.string().trim().max(60).nullable().optional(), ctaHref: z.string().trim().max(300).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(), endsAt: z.string().datetime({ offset: true }).optional(), discountPercent: z.number().min(0).max(100).optional(),
  applyToAll: z.boolean().optional(), combineWithCoupon: z.boolean().optional(), isEnabled: z.boolean().optional(), isPaused: z.boolean().optional(),
  announcementEnabled: z.boolean().optional(), bannerEnabled: z.boolean().optional(), announcementColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  announcementTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), announcementSpeed: z.number().int().min(8).max(120).optional(), priority: z.number().int().min(0).max(1000).optional(),
  productIds: z.array(z.string().uuid()).max(500).optional(), categoryIds: z.array(z.string().uuid()).max(500).optional(),
});
const columns = { title:'title',description:'description',tagline:'tagline',bannerImage:'banner_image',mobileBannerImage:'mobile_banner_image',placement:'placement',ctaLabel:'cta_label',ctaHref:'cta_href',startsAt:'starts_at',endsAt:'ends_at',discountPercent:'discount_percent',applyToAll:'apply_to_all',combineWithCoupon:'combine_with_coupon',isEnabled:'is_enabled',isPaused:'is_paused',announcementEnabled:'announcement_enabled',bannerEnabled:'banner_enabled',announcementColor:'announcement_color',announcementTextColor:'announcement_text_color',announcementSpeed:'announcement_speed',priority:'priority' };

export async function PATCH(request,{params}) {
  const {admin,error,status}=await guard('content:write'); if(error)return fail(error,status);
  const {id}=await params; let body; try{body=await request.json()}catch{return fail('Invalid body',400)}
  const parsed=patchSchema.safeParse(body); if(!parsed.success)return fail(parsed.error.issues[0].message,422);
  const d=parsed.data; const current=(await sql`select starts_at,ends_at from promotion_events where id=${id}`)[0];
  if(!current)return fail('Event not found.',404);
  const starts=new Date(d.startsAt??current.starts_at), ends=new Date(d.endsAt??current.ends_at);
  if(ends<=starts)return fail('Event end must be after its start.',422);
  const patch={updated_at:new Date()};
  for(const [key,column] of Object.entries(columns))if(d[key]!==undefined)patch[column]=d[key];
  try{
    await sql.begin(async(tx)=>{
      await tx`update promotion_events set ${sql(patch)} where id=${id}`;
      if(d.productIds!==undefined){await tx`delete from promotion_event_products where event_id=${id}`;for(const productId of d.productIds)await tx`insert into promotion_event_products(event_id,product_id) values(${id},${productId})`}
      if(d.categoryIds!==undefined){await tx`delete from promotion_event_categories where event_id=${id}`;for(const categoryId of d.categoryIds)await tx`insert into promotion_event_categories(event_id,category_id) values(${id},${categoryId})`}
    });
  }catch(cause){console.error('Promotion event update failed:',cause?.message||'unknown error');return fail('Could not update this event. Check selected products/categories.',400)}
  invalidate(''); await audit(admin,'promotion_event_updated','promotion_event',id,{title:d.title||current.title||null});
  return json({ok:true});
}

export async function DELETE(_request,{params}) {
  const {admin,error,status}=await guard('content:write'); if(error)return fail(error,status);
  const {id}=await params;
  const rows=await sql`update promotion_events set is_enabled=false,is_paused=true,announcement_enabled=false,banner_enabled=false,updated_at=now() where id=${id} returning id,title`;
  if(!rows[0])return fail('Event not found.',404);
  invalidate(''); await audit(admin,'promotion_event_archived','promotion_event',id,{title:rows[0].title});
  return json({ok:true});
}
