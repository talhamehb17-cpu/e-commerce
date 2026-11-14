import nodemailer from 'nodemailer';
import { sql } from './db.js';
import { getSetting } from './settings.js';
import { getTheme } from './themes.js';
import { readSmtpConfig } from './smtp-settings.js';

let cachedTransport = null;
async function getTransport() {
  const stored = await readSmtpConfig().catch(() => null);
  const envPassword = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const config = stored?.host && stored?.username && stored?.password ? {
    host: stored.host, port: Number(stored.port || 587), secure: Boolean(stored.secure), user: stored.username, pass: stored.password, sender: stored.sender,
  } : {
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465,
    user: process.env.SMTP_USER, pass: envPassword, sender: process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER,
  };
  if (!config.host || !config.user || !config.pass) return null;
  const fingerprint = `${config.host}|${config.port}|${config.secure}|${config.user}|${config.pass}`;
  if (!cachedTransport || cachedTransport.fingerprint !== fingerprint) {
    cachedTransport = { fingerprint, sender: config.sender, transport: nodemailer.createTransport({ host:config.host, port:config.port, secure:config.secure,
      auth:{user:config.user,pass:config.pass}, connectionTimeout:10_000, greetingTimeout:10_000, socketTimeout:15_000 }) };
  }
  return cachedTransport;
}

export async function emailConfigured() {
  const stored = await readSmtpConfig().catch(() => null);
  return Boolean((stored?.host && stored?.username && stored?.password) || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

const BRAND = {
  name: process.env.MAIL_FROM_NAME || 'NOVA',
  site: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

function layout({ title, preheader = '', body, cta, ctaHref, footerNote = '' }) {
  const theme = getTheme('moonstone');
  const t = theme.colors;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>${title}</title></head>
  <body style="margin:0;padding:0;background:#f2ece2;font-family:'Helvetica Neue',Arial,sans-serif;color:#16130f">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ece2;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #e3d8c6">
        <tr><td style="padding:26px 32px;border-bottom:1px solid #eee3d2;text-align:center">
          <div style="font-family:Georgia,'Times New Roman',serif;letter-spacing:.34em;font-size:20px;color:#16130f;text-transform:uppercase">${BRAND.name}</div>
          <div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#b08d4f;margin-top:6px">Wear your little wonder</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.25;margin:0 0 14px;color:#16130f">${title}</h1>
          <div style="font-size:14.5px;line-height:1.7;color:#4c453d">${body}</div>
          ${cta ? `<div style="margin:26px 0 6px"><a href="${ctaHref}" style="display:inline-block;background:${t.ink};color:#fffdf8;text-decoration:none;padding:13px 26px;border-radius:100px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600">${cta}</a></div>` : ''}
          ${footerNote ? `<p style="font-size:12px;color:#8a8073;margin-top:22px;line-height:1.6">${footerNote}</p>` : ''}
        </td></tr>
        <tr><td style="padding:22px 32px;background:#f7f2ea;border-top:1px solid #eee3d2;font-size:11px;color:#8a8073;line-height:1.7">
          <strong style="color:#16130f">${BRAND.name}</strong> · Hand-finished in Lahore, Pakistan<br>
          Questions? Reply to this email — a human answers.<br>
          <a href="${BRAND.site}" style="color:#b08d4f;text-decoration:none">${BRAND.site.replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
      <div style="font-size:10.5px;color:#a49b8c;margin-top:16px">You are receiving this because you have an account at ${BRAND.name}.</div>
    </td></tr>
  </table></body></html>`;
}

export async function sendMail({ to, subject, html, template = 'custom', orderId = null, customerId = null }) {
  const emailSettings = await getSetting('email');
  const mailer = await getTransport();
  
  if (!mailer) {
    await sql`insert into email_logs (to_email, subject, template, order_id, status, error)
      values (${to}, ${subject}, ${template}, ${orderId}, 'skipped', 'SMTP not configured')`.catch(() => {});
    return { ok: false, skipped: true };
  }
  try {
    const from = mailer.sender || emailSettings.from_email || process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
    await mailer.transport.sendMail({
      from: `"${emailSettings.from_name || BRAND.name}" <${from}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000),
    });
    await sql`insert into email_logs (to_email, subject, template, order_id, status)
      values (${to}, ${subject}, ${template}, ${orderId}, 'sent')`.catch(() => {});
    return { ok: true };
  } catch (e) {
    await sql`insert into email_logs (to_email, subject, template, order_id, status, error)
      values (${to}, ${subject}, ${template}, ${orderId}, 'failed', ${'SMTP delivery failed'})`.catch(() => {});
    return { ok: false, error: 'SMTP delivery failed' };
  }
}

const money = (minor, cur = 'PKR') => `Rs ${(Number(minor) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function itemsTable(items) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #eee3d2">
    ${items.map((i) => `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #f2ebdf;font-size:13.5px">
        <strong style="font-weight:600">${i.name}</strong>${i.variant_name ? ` <span style="color:#8a8073">· ${i.variant_name}</span>` : ''}
        <div style="color:#8a8073;font-size:12px">Qty ${i.qty} × ${money(i.unit_price)}</div>
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid #f2ebdf;font-size:13.5px;white-space:nowrap">${money(i.line_total ?? i.unit_price * i.qty)}</td>
    </tr>`).join('')}
  </table>`;
}

export const templates = {
  otp: ({ name, code, purpose }) => ({
    subject: purpose === 'reset_password' ? `${code} is your ${BRAND.name} reset code` : `Verify your email — code ${code}`,
    html: layout({
      title: purpose === 'reset_password' ? 'Reset your password' : 'Confirm your email',
      preheader: `Your verification code is ${code}`,
      body: `<p>Hello ${name || 'there'},</p>
        <p>${purpose === 'reset_password' ? 'Use the code below to set a new password.' : 'Use the code below to verify your email address and finish setting up your account.'}</p>
        <div style="margin:22px 0;padding:18px;background:#f7f2ea;border:1px solid #e3d8c6;border-radius:12px;text-align:center">
          <div style="font-size:34px;letter-spacing:.36em;font-weight:600;color:#16130f;font-family:Georgia,serif">${code}</div>
          <div style="font-size:11px;color:#8a8073;margin-top:6px">Expires in 10 minutes</div>
        </div>
        <p style="font-size:12.5px;color:#8a8073">If you didn't request this, you can safely ignore this email.</p>`,
    }),
  }),
  welcome: ({ name, email }) => ({
    subject: 'Welcome to NOVA',
    html: layout({
      title: `Welcome, ${name || 'friend'}`,
      preheader: 'Your account is ready.',
      body: `<p>Your account is live. You can now save pieces to your wishlist, track orders and check out faster.</p>
        <p>Use code <strong style="letter-spacing:.14em">WELCOME10</strong> for 10% off your first order.</p>`,
      cta: 'Browse the collection',
      ctaHref: `${BRAND.site}/shop`,
    }),
  }),
  verify_email: ({ name, code }) => templates.otp({ name, code, purpose: 'verify_email' }),
  order_placed: ({ name, order, items }) => ({
    subject: `Order ${order.order_number} received`,
    html: layout({
      title: 'We have your order',
      preheader: `Order ${order.order_number} is confirmed`,
      body: `<p>Thank you, ${name}. We're preparing order <strong>${order.order_number}</strong>.</p>
        ${itemsTable(items)}
        <table role="presentation" width="100%" style="font-size:13.5px">
          <tr><td style="padding:4px 0;color:#8a8073">Subtotal</td><td align="right">${money(order.subtotal)}</td></tr>
          ${order.discount_total ? `<tr><td style="padding:4px 0;color:#8a8073">Discount</td><td align="right">−${money(order.discount_total)}</td></tr>` : ''}
          <tr><td style="padding:4px 0;color:#8a8073">Shipping</td><td align="right">${order.shipping_total ? money(order.shipping_total) : 'Free'}</td></tr>
          <tr><td style="padding:10px 0;font-weight:600;border-top:1px solid #eee3d2">Total</td><td align="right" style="padding:10px 0;font-weight:600;border-top:1px solid #eee3d2">${money(order.grand_total)}</td></tr>
        </table>
        <p style="font-size:12.5px;color:#8a8073;margin-top:14px">Payment method: ${order.payment_method === 'cod' ? 'Cash on delivery' : order.payment_method}</p>`,
      cta: 'Track your order',
      ctaHref: `${BRAND.site}/account/orders/${order.order_number}`,
    }),
  }),
  status_update: ({ name, order, status, note }) => {
    const copy = {
      confirmed: 'Your payment details are confirmed and your order is queued.',
      processing: 'Our studio is preparing your pieces now.',
      packed: 'Your order is packed in its box and ready to leave the studio.',
      shipped: 'Your parcel is on its way.',
      out_for_delivery: 'Your parcel is out for delivery today.',
      delivered: 'Your order has been delivered. We hope you love it.',
      cancelled: 'Your order has been cancelled. If a payment was taken, a refund will follow.',
      returned: 'Your return has been recorded.',
    };
    const title = {
      confirmed: 'Order confirmed', processing: 'Being prepared', packed: 'Packed',
      shipped: 'On its way', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
      cancelled: 'Order cancelled', returned: 'Return recorded',
    }[status] || 'Order update';
    return {
      subject: `${order.order_number}: ${title.toLowerCase()}`,
      html: layout({
        title,
        preheader: copy[status] || '',
        body: `<p>Hello ${name},</p><p>${copy[status] || 'Your order status has changed.'}</p>
          <p style="margin-top:14px"><strong>Order</strong> ${order.order_number}<br>
          <strong>Status</strong> <span style="text-transform:capitalize">${status.replace(/_/g, ' ')}</span>
          ${order.tracking_number ? `<br><strong>Tracking</strong> ${order.tracking_number}${order.carrier ? ` (${order.carrier})` : ''}` : ''}</p>
          ${note ? `<p style="font-size:13px;color:#8a8073;margin-top:12px">${note}</p>` : ''}`,
        cta: 'View order',
        ctaHref: `${BRAND.site}/account/orders/${order.order_number}`,
      }),
    };
  },
  admin_new_order: ({ order, items }) => ({
    subject: `New order ${order.order_number} — ${money(order.grand_total)}`,
    html: layout({
      title: 'New order received',
      preheader: order.order_number,
      body: `<p><strong>${order.order_number}</strong> · ${money(order.grand_total)} · ${order.payment_method}</p>
        <p style="font-size:13px;color:#8a8073">${order.shipping_address?.full_name || ''} · ${order.shipping_address?.city || ''} · ${order.email}</p>
        ${itemsTable(items)}`,
      cta: 'Open in admin',
      ctaHref: `${BRAND.site}/admin/orders`,
    }),
  }),
  password_changed: ({ name }) => ({
    subject: 'Your password was changed',
    html: layout({
      title: 'Password updated',
      preheader: 'Security notice',
      body: `<p>Hello ${name},</p><p>Your ${BRAND.name} password was just changed. If this wasn't you, reply to this email immediately.</p>`,
    }),
  }),
};
