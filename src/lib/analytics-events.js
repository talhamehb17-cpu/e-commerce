import { sha256, sql } from '@/lib/db';
import { getSetting } from '@/lib/settings';
export function visitorHash(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = request.headers.get('user-agent') || '';
  return sha256(`${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`).slice(0, 32);
}
export async function recordEvent(type, visitor, { productId = null, orderId = null } = {}) {
  if (!['page_view','product_view','add_to_cart','checkout_started','purchase'].includes(type)) return;
  const analytics = await getSetting('analytics').catch(() => ({track_visitors:false}));
  if (analytics.track_visitors === false) return;
  await sql`insert into analytics_events (event_type, visitor_hash, product_id, order_id) values (${type}, ${visitor}, ${productId}, ${orderId})`.catch(() => {});
}
