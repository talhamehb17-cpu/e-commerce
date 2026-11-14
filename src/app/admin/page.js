import { AdminDashboard } from '@/components/admin/dashboard';
import { getAdminStats, resolveStatsPeriod } from '@/lib/admin-stats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function AdminHome() {
  const period = resolveStatsPeriod(new URLSearchParams('range=30'));
  const initial = await getAdminStats(period);
  return <AdminDashboard initial={initial} emailAlerts={{ failures: initial.totals.emailFailures }} />;
}
