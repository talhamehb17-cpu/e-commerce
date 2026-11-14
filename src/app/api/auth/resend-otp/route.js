import { sql, rateLimit } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { issueOtp } from '@/lib/otp';
import { sendMail, templates, emailConfigured } from '@/lib/email';
import { getSetting } from '@/lib/settings';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const limited = await rateLimit(`otp:${ip}`, 4, 60_000);
  if (!limited.ok) return fail('Please wait a minute before requesting another code.', 429);
  const { data, error } = await parse(request, schemas.forgot.merge(z.object({ purpose: z.enum(['verify_email', 'reset_password']).default('verify_email') })));
  if (error) return fail(error, 422);
  if (process.env.NODE_ENV === 'production' && !await emailConfigured()) return fail('Email verification is temporarily unavailable. Please contact support.', 503);
  const rows = await sql`select id, name from customers where email = ${data.email}`;
  if (!rows[0]) return ok({ sent: true });
  const store = await getSetting('store');
  const code = await issueOtp(data.email, data.purpose);
  if (await emailConfigured()) {
    const tpl = templates.otp({ name: rows[0].name, code, purpose: data.purpose, storeName: store.name });
    await sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'otp', customerId: rows[0].id });
  }
  return ok({ sent: true, devCode: process.env.NODE_ENV === 'production' || await emailConfigured() ? undefined : code });
}
