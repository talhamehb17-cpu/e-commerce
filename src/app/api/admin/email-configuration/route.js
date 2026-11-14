import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { guard, audit } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { rateLimit } from '@/lib/db';
import { readSmtpConfigState, saveSmtpConfig, smtpKeyStatus, smtpStatus } from '@/lib/smtp-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notificationSchema = z.object({
  orderConfirmation:z.boolean(), paymentConfirmation:z.boolean(), orderProcessing:z.boolean(), shipped:z.boolean(),
  outForDelivery:z.boolean(), deliveryConfirmed:z.boolean(), cancellationsRefunds:z.boolean(), adminOrder:z.boolean(),
  accountSecurity:z.boolean(), marketing:z.boolean(),
});
const schema = z.object({
  host:z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/,'Enter a hostname without scheme, path or whitespace.'),
  port:z.number().int().min(1).max(65535), secure:z.boolean(), username:z.string().trim().min(1).max(254),
  password:z.string().max(500).optional().or(z.literal('')), sender:z.string().trim().email().max(254),
  senderName:z.string().trim().min(1).max(100).optional(), replyTo:z.union([z.string().trim().email().max(254),z.literal('')]).optional(),
  recipient:z.string().trim().email().max(254), orderNotifications:z.boolean(), notifications:notificationSchema.optional(),
});

async function owner() {
  const result = await guard('settings:write');
  if (result.error) return result;
  if (result.admin.role !== 'owner') return { error:'Only the store owner can manage email delivery.', status:403 };
  return result;
}

function safeErrorStack(error, secrets = []) {
  let stack = typeof error?.stack === 'string' ? error.stack : `${error?.name || 'Error'}: ${error?.message || 'unknown error'}`;
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length) stack = stack.replaceAll(secret, '[redacted]');
  }
  return stack.slice(0, 6000);
}

export async function GET() {
  const access = await owner();
  if (access.error) return fail(access.error, access.status);
  try {
    const [smtp, stored] = await Promise.all([smtpStatus(), readSmtpConfigState()]);
    const key = smtpKeyStatus();
    return json({
      smtp,
      // Safe diagnostics only. Never serialize the key, ciphertext, or SMTP password.
      keyConfigured: key.valid,
      keyStatus: key,
      storedConfigState: stored.state,
    });
  } catch (error) {
    console.error('Owner email configuration status query failed:', error?.message || 'unknown error');
    return fail('Email configuration status is temporarily unavailable. Retry the request.', 503);
  }
}

export async function PUT(request) {
  const requestId = randomUUID();
  let phase = 'authorization';
  let body;
  let stored;
  const responseFail = (message, status) => fail(message, status, { requestId });

  try {
    const access = await owner();
    if (access.error) return responseFail(access.error, access.status);

    phase = 'rate-limit';
    if (!rateLimit(`smtp-save:${access.admin.id}`, 5, 60_000).ok) {
      return responseFail('Too many email configuration changes. Try again later.', 429);
    }

    phase = 'encryption-key-check';
    const key = smtpKeyStatus();
    if (!key.valid) {
      return responseFail(key.present
        ? 'SMTP_CREDENTIALS_KEY is visible to the server but is not valid 32-byte Base64 or 64-character hexadecimal.'
        : 'SMTP_CREDENTIALS_KEY is not available to this server runtime. Confirm the Vercel project/environment and deploy after setting it.', 503);
    }

    phase = 'request-body';
    try { body = await request.json(); }
    catch { return responseFail('Invalid JSON body.', 400); }

    phase = 'request-validation';
    const parsed = schema.safeParse(body);
    if (!parsed.success) return responseFail(parsed.error.issues[0].message, 422);

    phase = 'read-existing-settings';
    try { stored = await readSmtpConfigState(); }
    catch (error) {
      console.error(JSON.stringify({ event: 'email_config_put_failure', requestId, phase, stack: safeErrorStack(error, [body?.password, process.env.SMTP_CREDENTIALS_KEY]) }));
      return responseFail('Stored email settings could not be read; no changes were saved. Retry after database connectivity is restored.', 503);
    }
    if (stored.state === 'unreadable') {
      return responseFail('Existing encrypted SMTP settings cannot be decrypted with the current key. They were left unchanged; restore the original key before saving.', 409);
    }

    const previous = stored.config;
    const d = parsed.data;
    if (!d.password && !previous?.password) return responseFail('Enter the SMTP password to configure delivery.', 422);
    const value = {
      ...d,
      senderName:d.senderName || 'NOVA',
      replyTo:d.replyTo || '',
      notifications:d.notifications || previous?.notifications || {},
      password:d.password || previous.password,
    };

    phase = 'encrypt-and-persist';
    try { await saveSmtpConfig(value); }
    catch (error) {
      console.error(JSON.stringify({ event: 'email_config_put_failure', requestId, phase, stack: safeErrorStack(error, [body?.password, previous?.password, process.env.SMTP_CREDENTIALS_KEY]) }));
      return responseFail('Could not securely save and verify SMTP settings. No credential was returned to the browser.', 503);
    }

    phase = 'audit';
    await audit(access.admin,'smtp_configuration_updated','settings','smtp_config',{host:d.host,port:d.port,username:d.username,recipient:d.recipient,orderNotifications:d.orderNotifications});

    return json({ok:true,requestId,smtp:{
      host:d.host,port:d.port,secure:d.secure,username:d.username,sender:d.sender,senderName:value.senderName,replyTo:value.replyTo,
      recipient:d.recipient,orderNotifications:d.orderNotifications,notifications:value.notifications,hasStoredPassword:true,
    }});
  } catch (error) {
    console.error(JSON.stringify({
      event: 'email_config_put_unhandled_failure',
      requestId,
      phase,
      stack: safeErrorStack(error, [body?.password, stored?.config?.password, process.env.SMTP_CREDENTIALS_KEY]),
    }));
    return responseFail(`Email settings request failed unexpectedly. Reference: ${requestId}.`, 500);
  }
}
