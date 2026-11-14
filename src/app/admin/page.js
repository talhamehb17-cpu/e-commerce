import { AdminDashboard } from '@/components/admin/dashboard';
import { getAdminStats, resolveStatsPeriod } from '@/lib/admin-stats';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function AdminHome() {
  const store = await getSetting('store');
  const period = resolveStatsPeriod(new URLSearchParams('range=30'), store.timezone || 'Asia/Karachi');
  const initial = await getAdminStats(period);
  return <AdminDashboard initial={initial} emailAlerts={{ failures: initial.totals.emailFailures }} />;
}
