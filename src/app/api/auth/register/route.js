import { sql, hashPassword, rateLimit } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { createSession, setSessionCookie } from '@/lib/auth';
import { issueOtp } from '@/lib/otp';
import { sendMail, templates, emailConfigured } from '@/lib/email';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const limited = await rateLimit(`register:${ip}`, 5, 60_000);
  if (!limited.ok) return fail('Too many attempts. Please wait a minute.', 429);

  const { data, error } = await parse(request, schemas.register);
  if (error) return fail(error, 422);
  if (process.env.NODE_ENV === 'production' && !await emailConfigured()) return fail('Email verification is temporarily unavailable. Please contact support.', 503);

  const existing = await sql`select id, password_hash from customers where email = ${data.email}`;
  if (existing[0]?.password_hash) return fail('An account with that email already exists. Sign in instead.', 409);

  let customerId;
  if (existing[0]) {
    // guest-created record from a past checkout: claim it
    customerId = existing[0].id;
    await sql`update customers set name = ${data.name}, password_hash = ${hashPassword(data.password)},
      marketing_opt_in = ${Boolean(data.marketing)}, updated_at = now() where id = ${customerId}`;
  } else {
    const rows = await sql`
      insert into customers (name, email, password_hash, marketing_opt_in, currency)
      values (${data.name}, ${data.email}, ${hashPassword(data.password)}, ${Boolean(data.marketing)}, 'PKR')
      returning id`;
    customerId = rows[0].id;
  }

  const { token, expires } = await createSession('customer', customerId, request.headers.get('user-agent') || '', ip);
  await setSessionCookie(token, expires);

  const store = await getSetting('store');
  const settings = await getSetting('email');
  if (settings.welcome !== false && data.marketing === true && await emailConfigured()) {
    const tpl = templates.welcome({ name: data.name, storeName: store.name });
    await sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'welcome', customerId });
  }
  // verification code
  const code = await issueOtp(data.email, 'verify_email');
  if (await emailConfigured()) {
    const tpl = templates.otp({ name: data.name, code, purpose: 'verify_email', storeName: store.name });
    await sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'otp', customerId });
  }

  return ok({
    customer: { id: customerId, name: data.name, email: data.email, verified: false },
    verificationRequired: true,
    devCode: process.env.NODE_ENV === 'production' || await emailConfigured() ? undefined : code,
  });
}
