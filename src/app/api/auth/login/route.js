import { sql, verifyPassword, rateLimit } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { createSession, setSessionCookie, mergeGuestCart } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const limited = await rateLimit(`login:${ip}`, 10, 60_000);
  if (!limited.ok) return fail('Too many sign-in attempts. Try again in a minute.', 429);

  const { data, error } = await parse(request, schemas.login);
  if (error) return fail(error, 422);

  const rows = await sql`select id, name, email, password_hash, email_verified, is_blocked, avatar_url, currency from customers where email = ${data.email}`;
  const c = rows[0];
  if (!c || !c.password_hash || !verifyPassword(data.password, c.password_hash)) {
    return fail('That email and password combination is not correct.', 401);
  }
  if (c.is_blocked) return fail('This account has been suspended. Please contact support.', 403);

  const { token, expires } = await createSession('customer', c.id, request.headers.get('user-agent') || '', ip);
  await setSessionCookie(token, expires);
  await sql`update customers set last_login_at = now() where id = ${c.id}`;
  await mergeGuestCart(c.id);

  return ok({ customer: { id: c.id, name: c.name, email: c.email, verified: c.email_verified, avatar: c.avatar_url, currency: c.currency } });
}
