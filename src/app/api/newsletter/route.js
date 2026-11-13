import { sql, rateLimit } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { sendMail, templates, emailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(`news:${ip}`, 6, 60_000).ok) return fail('Please wait a moment and try again.', 429);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return fail('Enter a valid email address.', 422);

  await sql`
    insert into newsletter_subscribers (email, source) values (${email}, ${body.source || 'footer'})
    on conflict (email) do update set unsubscribed_at = null`;
  return ok({ subscribed: true });
}
