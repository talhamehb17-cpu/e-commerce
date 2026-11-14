import { AdminDashboard } from '@/components/admin/dashboard';
import { getAdminStats, resolveStatsPeriod } from '@/lib/admin-stats';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function AdminHome() {
  let initial = null;
  let dashboardError = '';
  try {
    const store = await getSetting('store');
    const period = resolveStatsPeriod(new URLSearchParams('range=30'), store.timezone || 'Asia/Karachi');
    initial = await getAdminStats(period);
  } catch (error) {
    // Keep the authenticated admin shell usable when a dashboard aggregate fails.
    console.error('Admin dashboard initial aggregate failed:', error?.message || 'unknown error');
    dashboardError = 'Dashboard data could not be loaded from the database. The rest of the admin workspace is still available; retry the dashboard data request.';
  }
  return <AdminDashboard initial={initial} initialError={dashboardError} emailAlerts={{ failures: initial?.totals?.emailFailures || 0 }} />;
}
