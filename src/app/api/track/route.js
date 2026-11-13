import { sql } from '@/lib/db';
import { sha256 } from '@/lib/db';
import { json } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Records a page view. Deliberately silent on failure — analytics must never break a page. */
export async function POST(request) {
  try {
    const body = await request.json();
    const path = String(body.path || '/').slice(0, 300);
    if (path.startsWith('/admin') || path.startsWith('/api')) return json({ ok: true, skipped: true });
    const ip = request.headers.get('x-forwarded-for') || '';
    const ua = request.headers.get('user-agent') || '';
    const visitor = sha256(`${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`).slice(0, 32);
    await sql`insert into page_views (path, visitor_hash, referrer, user_agent)
      values (${path}, ${visitor}, ${String(body.referrer || '').slice(0, 300)}, ${ua.slice(0, 300)})`;
  } catch { /* ignore */ }
  return json({ ok: true });
}
