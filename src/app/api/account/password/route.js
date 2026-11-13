import { sql, hashPassword, verifyPassword, rateLimit } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer, createSession, setSessionCookie, destroySession } from '@/lib/auth';
import { z } from 'zod';
import { sendMail, templates } from '@/lib/email';

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(8).max(120),
});

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  if (!rateLimit(`pwd:${customer.id}`, 5, 60_000).ok) return fail('Too many attempts.', 429);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('New password must be at least 8 characters.', 422);

  const rows = await sql`select password_hash from customers where id = ${customer.id}`;
  if (!verifyPassword(parsed.data.current, rows[0].password_hash)) return fail('Current password is incorrect.', 403);

  await sql`update customers set password_hash = ${hashPassword(parsed.data.next)}, updated_at = now() where id = ${customer.id}`;
  const tpl = templates.password_changed({ name: customer.name });
  sendMail({ to: customer.email, subject: tpl.subject, html: tpl.html, template: 'password_changed' }).catch(() => {});
  return ok({ changed: true });
}
