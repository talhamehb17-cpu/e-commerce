'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from './toast';
import { LayoutDashboard, Package, Heart, MapPin, Settings, LogOut } from './icons';

const LINKS = [
  ['/account', 'Overview', LayoutDashboard],
  ['/account/orders', 'Orders', Package],
  ['/account/wishlist', 'Wishlist', Heart],
  ['/account/addresses', 'Addresses', MapPin],
  ['/account/settings', 'Settings', Settings],
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast('Signed out');
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="account-nav">
      {LINKS.map(([href, label, Icon]) => (
        <Link key={href} href={href} data-on={pathname === href || (href !== '/account' && pathname.startsWith(href)) ? 'true' : 'false'}>
          <Icon size={15} /> {label}
        </Link>
      ))}
      <button onClick={logout} style={{ padding: '11px 14px', borderRadius: 8, fontSize: 13.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <LogOut size={15} /> Sign out
      </button>
    </nav>
  );
}
