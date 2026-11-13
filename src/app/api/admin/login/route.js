import { sql, verifyPassword, rateLimit } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { createSession, setSessionCookie } from '@/lib/auth';
import { z } from 'zod';
import { audit } from '@/lib/admin';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(`adminlogin:${ip}`, 8, 60_000).ok) return fail('Too many attempts. Try again in a minute.', 429);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Enter your email and password.', 422);

  const rows = await sql`select id, name, email, password_hash, role, is_active from admins where email = ${parsed.data.email} limit 1`;
  const admin = rows[0];
  if (!admin || !verifyPassword(parsed.data.password, admin.password_hash)) {
    await sql`insert into audit_logs (actor_type, actor_email, action, entity, meta) values ('system', ${parsed.data.email}, 'admin_login_failed', 'admin', '{}'::jsonb)`.catch(() => {});
    return fail('Incorrect email or password.', 401);
  }
  if (!admin.is_active) return fail('This admin account is disabled.', 403);

  const { token, expires } = await createSession('admin', admin.id, request.headers.get('user-agent') || '', ip);
  await setSessionCookie(token, expires, true);
  await sql`update admins set last_login_at = now() where id = ${admin.id}`;
  await audit(admin, 'admin_login', 'admin', admin.id);

  return json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
}
