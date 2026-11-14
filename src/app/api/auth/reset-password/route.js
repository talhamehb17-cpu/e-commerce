import { sql, hashPassword } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { verifyOtp } from '@/lib/otp';
import { sendMail, templates, emailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { data, error } = await parse(request, schemas.reset);
  if (error) return fail(error, 422);
  const result = await verifyOtp(data.email, 'reset_password', data.code);
  if (!result.ok) return fail(result.error, 422);

  const rows = await sql`update customers set password_hash = ${hashPassword(data.password)}, updated_at = now() where email = ${data.email} returning id, name`;
  if (!rows[0]) return fail('Account not found', 404);
  await sql`update sessions set revoked_at = now() where subject_type = 'customer' and subject_id = ${rows[0].id} and revoked_at is null`;
  if (await emailConfigured()) {
    const tpl = templates.password_changed({ name: rows[0].name });
    await sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'password_changed', customerId: rows[0].id });
  }
  return ok({ reset: true });
}
