import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';
import { sendMail, templates, emailConfigured } from '@/lib/email';
import { rateLimit } from '@/lib/db';
export async function POST(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  if (admin.role !== 'owner') return fail('Only the store owner can test email delivery.', 403);
  if (!rateLimit(`email-test:${admin.id}`, 3, 60_000).ok) return fail('Test email rate limit reached.', 429);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!await emailConfigured()) return fail('SMTP is not configured.', 400);
  const to = String(body.to || admin.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail('Enter a valid test recipient.', 422);
  const tpl = templates.password_changed({ name: 'Test recipient' });
  const res = await sendMail({ to, subject: `Test email — ${tpl.subject}`, html: tpl.html, template: 'test' });
  if (!res.ok) return fail(res.error || 'Send failed', res.skipped ? 400 : 502);
  return json({ ok: true, to });
}
