import { sql, rateLimit } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { issueOtp } from '@/lib/otp';
import { sendMail, templates, emailConfigured } from '@/lib/email';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const limited = await rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!limited.ok) return fail('Please wait a minute before trying again.', 429);

  const { data, error } = await parse(request, schemas.forgot);
  if (error) return fail(error, 422);

  const rows = await sql`select id, name from customers where email = ${data.email}`;
  // Always answer the same way so we never reveal which emails exist.
  if (!rows[0]) return ok({ sent: true });

  const store = await getSetting('store');
  const code = await issueOtp(data.email, 'reset_password');
  if (emailConfigured()) {
    const tpl = templates.otp({ name: rows[0].name, code, purpose: 'reset_password', storeName: store.name });
    await sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'password_reset', customerId: rows[0].id });
  }
  return ok({ sent: true, devCode: emailConfigured() ? undefined : code });
}
