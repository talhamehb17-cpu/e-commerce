import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { z } from 'zod';
import { eventStatus } from '@/lib/promotions';

export const dynamic = 'force-dynamic';
const idList = z.array(z.string().uuid()).max(500).default([]);
const schema = z.object({
  title: z.string().trim().min(2).max(120), description: z.string().trim().max(2000).optional().nullable(),
  tagline: z.string().trim().max(240).optional().nullable(), bannerImage: z.string().trim().max(800).optional().nullable(),
  mobileBannerImage: z.string().trim().max(800).optional().nullable(),
  placement: z.enum(['homepage_hero','home_section','category','product']).default('home_section'),
  ctaLabel: z.string().trim().max(60).optional().nullable(), ctaHref: z.string().trim().max(300).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }),
  discountPercent: z.number().min(0).max(100), applyToAll: z.boolean().default(false),
  combineWithCoupon: z.boolean().default(false), isEnabled: z.boolean().default(true), isPaused: z.boolean().default(false),
  announcementEnabled: z.boolean().default(false), bannerEnabled: z.boolean().default(false),
  announcementColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#171512'),
  announcementTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  announcementSpeed: z.number().int().min(8).max(120).default(24), priority: z.number().int().min(0).max(1000).default(0),
  productIds: idList, categoryIds: idList,
}).refine((event) => new Date(event.endsAt) > new Date(event.startsAt), { message: 'Event end must be after its start.' });

async function replaceTargets(tx, id, productIds, categoryIds) {
  if (productIds) {
    await tx`delete from promotion_event_products where event_id=${id}`;
    for (const productId of productIds) await tx`insert into promotion_event_products(event_id,product_id) values(${id},${productId})`;
  }
  if (categoryIds) {
    await tx`delete from promotion_event_categories where event_id=${id}`;
    for (const categoryId of categoryIds) await tx`insert into promotion_event_categories(event_id,category_id) values(${id},${categoryId})`;
  }
}

export async function GET() {
  const { error, status } = await guard('content:read');
  if (error) return fail(error, status);
  const [rows, products, categories] = await Promise.all([sql`select e.*,
      coalesce((select json_agg(ep.product_id) from promotion_event_products ep where ep.event_id=e.id),'[]'::json) product_ids,
      coalesce((select json_agg(ec.category_id) from promotion_event_categories ec where ec.event_id=e.id),'[]'::json) category_ids,
      (select count(distinct a.visitor_hash)::int from promotion_event_activity a where a.event_id=e.id and a.activity_type='event_view') views,
      (select count(*)::int from promotion_event_activity a where a.event_id=e.id and a.activity_type='banner_click') banner_clicks,
      (select count(*)::int from promotion_event_activity a where a.event_id=e.id and a.activity_type='product_view') product_views,
      (select count(*)::int from promotion_event_activity a where a.event_id=e.id and a.activity_type='add_to_cart') add_to_carts,
      (select count(distinct o.id)::int from order_promotion_events oe join orders o on o.id=oe.order_id where oe.event_id=e.id) event_orders,
      (select coalesce(sum(o.grand_total),0)::bigint from order_promotion_events oe join orders o on o.id=oe.order_id where oe.event_id=e.id and o.status not in ('cancelled','returned','refunded')) event_revenue,
      (select coalesce(sum(oe.discount_total),0)::bigint from order_promotion_events oe where oe.event_id=e.id) discount_amount,
      (select coalesce(json_agg(json_build_object('product_id',x.product_id,'name',x.name,'views',x.views,'add_to_carts',x.add_to_carts) order by x.views desc),'[]'::json) from (
        select a.product_id,coalesce(p.name,'Deleted product') name,count(*) filter(where a.activity_type='product_view')::int views,
          count(*) filter(where a.activity_type='add_to_cart')::int add_to_carts
        from promotion_event_activity a left join products p on p.id=a.product_id
        where a.event_id=e.id and a.product_id is not null and a.activity_type in ('product_view','add_to_cart')
        group by a.product_id,p.name order by views desc limit 10
      ) x) top_products
    from promotion_events e order by e.priority desc,e.created_at desc`,
    sql`select id,name from products where is_active order by name limit 500`,
    sql`select id,name from categories where is_active order by name limit 200`,
  ]);
  return json({ products, categories, events: rows.map((row) => ({ ...row, status: eventStatus(row), views: Number(row.views), banner_clicks: Number(row.banner_clicks), product_views: Number(row.product_views), add_to_carts: Number(row.add_to_carts), event_orders: Number(row.event_orders), event_revenue: Number(row.event_revenue), discount_amount: Number(row.discount_amount), conversion_rate: Number(row.views) ? Number((Number(row.event_orders) / Number(row.views) * 100).toFixed(1)) : null })) });
}

export async function POST(request) {
  const { admin, error, status } = await guard('content:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  try {
    const event = await sql.begin(async (tx) => {
      const rows = await tx`insert into promotion_events(title,description,tagline,banner_image,mobile_banner_image,placement,cta_label,cta_href,starts_at,ends_at,discount_percent,apply_to_all,combine_with_coupon,is_enabled,is_paused,announcement_enabled,banner_enabled,announcement_color,announcement_text_color,announcement_speed,priority)
        values(${d.title},${d.description||null},${d.tagline||null},${d.bannerImage||null},${d.mobileBannerImage||null},${d.placement},${d.ctaLabel||null},${d.ctaHref||null},${d.startsAt},${d.endsAt},${d.discountPercent},${d.applyToAll},${d.combineWithCoupon},${d.isEnabled},${d.isPaused},${d.announcementEnabled},${d.bannerEnabled},${d.announcementColor},${d.announcementTextColor},${d.announcementSpeed},${d.priority}) returning *`;
      await replaceTargets(tx, rows[0].id, d.productIds, d.categoryIds);
      return rows[0];
    });
    invalidate('');
    await audit(admin, 'promotion_event_created', 'promotion_event', event.id, { title: event.title });
    return json({ ok: true, event });
  } catch (cause) {
    console.error('Promotion event create failed:', cause?.message || 'unknown error');
    return fail('Could not create this event. Check that selected products and categories still exist.', 400);
  }
}
