import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { refreshExchangeRates } from '@/lib/currency';
import { CURRENCY_META } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await guard('settings:read');
  if (error) return fail(error, status);
  const rows = await sql`select * from currencies order by is_default desc, code`;
  return json({ currencies: rows });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body.action === 'refresh') {
    try { const result = await refreshExchangeRates(); invalidate(''); return json({ ok: true, ...result }); }
    catch (e) { return fail(`Could not reach the rate provider: ${e.message}`, 502); }
  }
  if (body.action === 'add') {
    const code = String(body.code || '').toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(code)) return fail('Use a 3-letter currency code', 422);
    const meta = CURRENCY_META[code] || { name: code, symbol: code, decimals: 2 };
    await sql`
      insert into currencies (code, name, symbol, rate_to_base, decimals, is_active)
      values (${code}, ${meta.name}, ${meta.symbol}, ${Number(body.rate) || 1}, ${meta.decimals}, true)
      on conflict (code) do update set is_active = true, rate_to_base = excluded.rate_to_base`;
    invalidate('');
    await audit(admin, 'currency_added', 'currency', code);
    return json({ ok: true });
  }
  if (body.action === 'update' && body.code) {
    const patch = {};
    if (body.rate !== undefined) patch.rate_to_base = Number(body.rate);
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
    if (body.manualOverride !== undefined) patch.manual_override = Boolean(body.manualOverride);
    if (body.isDefault) {
      await sql`update currencies set is_default = false`;
      patch.is_default = true;
    }
    if (Object.keys(patch).length) {
      await sql`update currencies set ${sql(patch)}, updated_at = now() where code = ${body.code}`;
    }
    invalidate('');
    await audit(admin, 'currency_updated', 'currency', body.code, patch);
    return json({ ok: true });
  }
  return fail('Unknown action', 400);
}
