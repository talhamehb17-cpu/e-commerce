import { guard, audit } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { refreshExchangeRates } from '@/lib/currency';
import { invalidate } from '@/lib/db';

export async function POST() {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  try {
    const result = await refreshExchangeRates();
    invalidate('');
    await audit(admin, 'exchange_rates_synced', 'currency', null, result);
    return json({ ok: true, ...result });
  } catch (e) {
    return fail(`Could not reach the rate provider: ${e.message}`, 502);
  }
}
