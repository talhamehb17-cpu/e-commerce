import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { getAllSettings, setSetting, SETTING_DEFAULTS } from '@/lib/settings';
import { emailConfigured } from '@/lib/email';
import { storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { admin, error, status } = await guard('settings:read');
  if (error) return fail(error, status);
  const settings = await getAllSettings();
  if (admin.role !== 'owner') delete settings.email;
  return json({
    settings,
    isOwner: admin.role === 'owner',
    emailConfigured: admin.role === 'owner' ? await emailConfigured() : null,
    storageConfigured: storageConfigured(),
    dbHost: (process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@').split('?')[0],
  });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body?.key || !Object.keys(SETTING_DEFAULTS).includes(body.key)) return fail('Unknown settings key', 400);
  if (body.key === 'email' && admin.role !== 'owner') return fail('Only the store owner can change email settings.', 403);
  if (!body.value || typeof body.value !== 'object') return fail('Invalid settings payload', 422);
  const saved = await setSetting(body.key, body.value);
  invalidate('');
  await audit(admin, 'settings_updated', 'settings', body.key, Object.keys(body.value));
  return json({ ok: true, settings: saved });
}
