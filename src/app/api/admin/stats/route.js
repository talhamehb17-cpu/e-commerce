import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';
import { getAdminStats, resolveStatsPeriod } from '@/lib/admin-stats';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error, status } = await guard('dashboard:read');
  if (error) return fail(error, status);

  const period = resolveStatsPeriod(new URL(request.url).searchParams);
  if (period.error) return fail(period.error, 400);
  try {
    return json(await getAdminStats(period));
  } catch (cause) {
    console.error('Admin dashboard statistics query failed:', cause?.message || 'unknown error');
    return fail('Dashboard statistics are temporarily unavailable.', 500);
  }
}
