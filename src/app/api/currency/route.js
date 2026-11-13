import { getCurrencies, refreshExchangeRates } from '@/lib/currency';
import { json, fail } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ currencies: await getCurrencies() });
}

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return fail('Admin only', 401);
  try {
    const result = await refreshExchangeRates();
    return json({ ok: true, ...result });
  } catch (e) {
    return fail(`Rate sync failed: ${e.message}`, 502);
  }
}
