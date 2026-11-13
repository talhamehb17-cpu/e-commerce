import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';
import { sendMail, templates, emailConfigured } from '@/lib/email';

export async function POST(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!emailConfigured()) return fail('SMTP is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS in your environment.', 400);
  const to = body.to || admin.email;
  const tpl = templates.password_changed({ name: 'Test recipient' });
  const res = await sendMail({ to, subject: `Test email — ${tpl.subject}`, html: tpl.html, template: 'test' });
  if (!res.ok) return fail(res.error || 'Send failed', res.skipped ? 400 : 502);
  return json({ ok: true, to });
}
