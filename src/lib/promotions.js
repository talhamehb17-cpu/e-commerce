import { sql, cached } from './db.js';

const activeEvents = () => cached('active-promotion-events', 10_000, async () => {
  const events = await sql`select * from promotion_events
    where is_enabled and not is_paused and starts_at <= now() and ends_at > now()
    order by priority desc, starts_at desc, created_at desc`;
  if (!events.length) return [];
  const ids = events.map((event) => event.id);
  const [products, categories] = await Promise.all([
    sql`select event_id,product_id from promotion_event_products where event_id=any(${ids})`,
    sql`select event_id,category_id from promotion_event_categories where event_id=any(${ids})`,
  ]);
  return events.map((event) => ({
    ...event,
    productIds: products.filter((row) => row.event_id === event.id).map((row) => row.product_id),
    categoryIds: categories.filter((row) => row.event_id === event.id).map((row) => row.category_id),
  }));
});

export async function getActivePromotionEvents({ publicOnly = false } = {}) {
  const events = await activeEvents();
  return publicOnly ? events.filter((event) => event.announcement_enabled || event.banner_enabled) : events;
}

export function pickPromotion(events, productId, categoryId) {
  return events.find((event) => event.discount_percent > 0 && (
    event.apply_to_all || event.productIds.includes(productId) || event.categoryIds.includes(categoryId)
  )) || null;
}

export function applyPromotionPrice(product, event) {
  const base = Number(product.price || 0);
  if (!event) return { ...product, basePrice: base, salePrice: base, promotion: null };
  const percent = Math.min(100, Math.max(0, Number(event.discount_percent) || 0));
  const salePrice = Math.max(0, Math.round(base * (100 - percent) / 100));
  return {
    ...product,
    basePrice: base,
    salePrice,
    promotion: { id: event.id, title: event.title, discountPercent: percent, combineWithCoupon: event.combine_with_coupon, placement:event.placement, bannerEnabled:event.banner_enabled, bannerImage:event.banner_image, mobileBannerImage:event.mobile_banner_image, tagline:event.tagline, ctaLabel:event.cta_label, ctaHref:event.cta_href, announcementColor:event.announcement_color, announcementTextColor:event.announcement_text_color },
  };
}

export async function priceProducts(products) {
  if (!products.length) return products;
  const events = await activeEvents();
  return products.map((product) => applyPromotionPrice(product, pickPromotion(events, product.id, product.category_id)));
}

export async function priceCartItems(items) {
  if (!items.length) return items;
  const events = await activeEvents();
  // Choose the highest-priority eligible event for each line; never stack event discounts.
  return items.map((item) => {
    const event = pickPromotion(events, item.product_id, item.category_id);
    const variantBase = Number(item.base_unit_price || 0) + Number(item.price_delta || 0);
    const eventPrice = event ? Math.max(0, Math.round(variantBase * (100 - Number(event.discount_percent)) / 100)) : variantBase;
    return {
      ...item,
      original_unit_price: variantBase,
      unit_price: eventPrice,
      event_id: event?.id || null,
      event_title: event?.title || null,
      event_discount: variantBase - eventPrice,
      event_combine_with_coupon: event?.combine_with_coupon ?? true,
      line_total: eventPrice * Number(item.qty),
    };
  });
}

export async function recordPromotionActivity({eventId,activityType,visitorHash=null,productId=null,orderId=null}) {
  if(!eventId||!['event_view','banner_click','product_view','add_to_cart','order'].includes(activityType))return false;
  const rows=await sql`insert into promotion_event_activity(event_id,activity_type,visitor_hash,product_id,order_id)
    select id,${activityType},${visitorHash},${productId},${orderId} from promotion_events
    where id=${eventId} and is_enabled and not is_paused and starts_at<=now() and ends_at>now() returning id`;
  return Boolean(rows[0]);
}

export function eventStatus(event, now = Date.now()) {
  if (!event.is_enabled) return 'disabled';
  if (event.is_paused) return 'paused';
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  if (now < start) return 'scheduled';
  if (now >= end) return 'expired';
  return 'active';
}
