import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { setSetting, getSetting } from '@/lib/settings';
import { THEMES } from '@/lib/themes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await guard('content:read');
  if (error) return fail(error, status);
  const [themeSetting, rows] = await Promise.all([
    getSetting('theme'),
    sql`select slug, name, description, swatch, colors, is_active, position from themes order by position`,
  ]);
  return json({ settings: themeSetting, themes: rows.length ? rows : THEMES, builtin: THEMES });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('content:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body.palette && !THEMES.some((t) => t.slug === body.palette)) return fail('Unknown palette', 422);
  const saved = await setSetting('theme', {
    ...(body.palette ? { palette: body.palette } : {}),
    ...(body.allowCustomerOverride !== undefined ? { allow_customer_override: Boolean(body.allowCustomerOverride) } : {}),
  });
  invalidate('');
  await audit(admin, 'theme_updated', 'settings', 'theme', saved);
  return json({ ok: true, settings: saved });
}
