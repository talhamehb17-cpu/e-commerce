import '../globals.css';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';
import { sql } from '@/lib/db';

export const metadata = {
  title: { default: 'Admin · NOVA', template: '%s · NOVA Admin' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    // Only the login screen is reachable without a session.
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const path = headersList.get('x-pathname') || headersList.get('next-url') || '';
    if (path.startsWith('/admin/login')) return children;
    const { LoginGate } = await import('@/components/admin/login-gate');
    return <LoginGate />;
  }

  const [pending, lowStock, pendingReviews] = await Promise.all([
    sql`select count(*)::int n from orders where status in ('pending','confirmed')`.catch(() => [{ n: 0 }]),
    sql`select count(*)::int n from products where stock <= low_stock_threshold and is_active`.catch(() => [{ n: 0 }]),
    sql`select count(*)::int n from reviews where not is_approved`.catch(() => [{ n: 0 }]),
  ]);

  return (
    <AdminShell
      admin={{ id: admin.id, name: admin.name, email: admin.email, role: admin.role, avatar: admin.avatar_url }}
      badges={{ orders: pending[0].n, inventory: lowStock[0].n, reviews: pendingReviews[0].n }}
    >
      {children}
    </AdminShell>
  );
}
