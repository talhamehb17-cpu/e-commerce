import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { sendMail, templates } from '@/lib/email';
import { rateLimit } from '@/lib/db';
import { getSetting } from '@/lib/settings';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(`contact:${ip}`, 4, 60_000).ok) return fail('Too many messages. Try again in a minute.', 429);

  const schema = z.object({
    name: z.string().trim().min(2).max(90),
    email: z.string().trim().toLowerCase().email(),
    subject: z.string().trim().min(2).max(140),
    message: z.string().trim().min(10).max(4000),
  });
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Check the highlighted fields.', 422);
  const d = parsed.data;

  const store = await getSetting('store');
  const to = process.env.ORDER_NOTIFICATION_EMAIL || store.email;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#16130f">
    <h2 style="font-family:Georgia,serif">New contact message</h2>
    <p><strong>From:</strong> ${d.name} &lt;${d.email}&gt;<br><strong>Subject:</strong> ${d.subject}</p>
    <p style="white-space:pre-line;background:#f7f2ea;padding:16px;border-radius:10px">${d.message.replace(/[<>]/g, '')}</p>
  </div>`;
  await sendMail({ to, subject: `[Contact] ${d.subject}`, html, template: 'contact' });
  return ok({ sent: true });
}
