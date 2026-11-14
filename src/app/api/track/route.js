import { sql, sha256, rateLimit } from '@/lib/db';
import { json } from '@/lib/api';
import { recordEvent } from '@/lib/analytics-events';
import { getSetting } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const body = await request.json();
    const path = String(body.path || '/').split('?')[0].slice(0, 300);
    if (path.startsWith('/admin') || path.startsWith('/api')) return json({ ok: true, skipped: true });
    const analytics = await getSetting('analytics');
    if (analytics.track_visitors === false) return json({ ok: true, skipped: true });
    const ip = request.headers.get('x-forwarded-for') || '';
    const ua = request.headers.get('user-agent') || '';
    const visitor = sha256(`${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`).slice(0, 32);
    if (!rateLimit(`track:${visitor}`, 120, 60_000).ok) return json({ ok: true, limited: true });
    let referrerOrigin = '';
    try { if (body.referrer) referrerOrigin = new URL(String(body.referrer)).origin.slice(0, 180); } catch { /* ignore malformed referrers */ }
    await sql`insert into page_views (path, visitor_hash, referrer, user_agent) values (${path}, ${visitor}, ${referrerOrigin || null}, null)`;
    await recordEvent('page_view', visitor);
    if (/^\/(product|products)\//.test(path)) await recordEvent('product_view', visitor);
  } catch { /* analytics should never disrupt storefront */ }
  return json({ ok: true });
}
