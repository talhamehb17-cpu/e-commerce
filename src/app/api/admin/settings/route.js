import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { getAllSettings, setSetting, SETTING_DEFAULTS } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await guard('settings:read');
  if (error) return fail(error, status);
  const settings = await getAllSettings();
  return json({
    settings,
    emailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    storageConfigured: Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID),
    dbHost: (process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@').split('?')[0],
  });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body?.key || !Object.keys(SETTING_DEFAULTS).includes(body.key)) return fail('Unknown settings key', 400);
  if (!body.value || typeof body.value !== 'object') return fail('Invalid settings payload', 422);
  const saved = await setSetting(body.key, body.value);
  invalidate('');
  await audit(admin, 'settings_updated', 'settings', body.key, Object.keys(body.value));
  return json({ ok: true, settings: saved });
}
