'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from '../toast';
import {
  LayoutDashboard, Boxes, Package, Tag, Users, MessageSquare, Ticket, ImageIcon,
  Palette, Coins, Settings, ClipboardList, User as UserIcon, LogOut, Menu, X, Store, ExternalLink,
  BarChart3, Layers, Grid2x2, ShieldCheck, Mail,
} from '../icons';

const NAV = [
  { group: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/orders', label: 'Orders', icon: Package, badgeKey: 'orders' },
    { href: '/admin/customers', label: 'Customers', icon: Users },
  ]},
  { group: 'Catalogue', items: [
    { href: '/admin/products', label: 'Products', icon: Boxes },
    { href: '/admin/collections', label: 'Collections', icon: Layers },
    { href: '/admin/categories', label: 'Categories', icon: Grid2x2 },
    { href: '/admin/brands', label: 'Brands', icon: Tag },
    { href: '/admin/inventory', label: 'Inventory', icon: ClipboardList, badgeKey: 'inventory' },
    { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare, badgeKey: 'reviews' },
  ]},
  { group: 'Marketing', items: [
    { href: '/admin/discounts', label: 'Discounts', icon: Ticket },
    { href: '/admin/content', label: 'Homepage', icon: ImageIcon },
    { href: '/admin/themes', label: 'Appearance', icon: Palette },
  ]},
  { group: 'Settings', items: [
    { href: '/admin/currencies', label: 'Currencies', icon: Coins },
    { href: '/admin/settings', label: 'Store settings', icon: Settings },
    { href: '/admin/email', label: 'Email configuration', icon: Mail },
    { href: '/admin/team', label: 'Team & access', icon: ShieldCheck },
    { href: '/admin/profile', label: 'My account', icon: UserIcon },
  ]},
];

export function AdminShell({ admin, adminAccess = {}, badges = {}, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const accessFor = (href) => {
    if (href === '/admin') return true;
    if (href.startsWith('/admin/analytics')) return adminAccess.analytics;
    if (href.startsWith('/admin/orders')) return adminAccess.orders;
    if (href.startsWith('/admin/customers')) return adminAccess.customers;
    if (href.startsWith('/admin/products') || href.startsWith('/admin/inventory') || href.startsWith('/admin/categories') || href.startsWith('/admin/brands') || href.startsWith('/admin/collections')) return adminAccess.products;
    if (href.startsWith('/admin/reviews')) return adminAccess.reviews;
    if (href.startsWith('/admin/content') || href.startsWith('/admin/themes')) return adminAccess.content;
    if (href.startsWith('/admin/email')) return adminAccess.ownerEmail;
    if (href.startsWith('/admin/discounts') || href.startsWith('/admin/currencies') || href.startsWith('/admin/settings') || href.startsWith('/admin/team')) return adminAccess.settings;
    return true;
  };

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    toast('Signed out');
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="admin-root" data-menu={open}>
      <a href="#admin-main" className="skip-link">Skip to dashboard</a>
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="logo" style={{ fontSize: 18, letterSpacing: '.28em' }}>NOVA</span>
          <span className="admin-tag">Admin</span>
        </div>
        <nav className="admin-nav">
          {NAV.map((g) => ({ ...g, items: g.items.filter((item) => accessFor(item.href)) })).filter((g) => g.items.length > 0).map((g) => (
            <div key={g.group} className="admin-nav-group">
              <div className="admin-nav-label">{g.group}</div>
              {g.items.map((it) => {
                const active = it.href === '/admin' ? pathname === '/admin' : pathname.startsWith(it.href);
                const badge = it.badgeKey ? badges[it.badgeKey] : 0;
                return (
                  <Link key={it.href} href={it.href} data-on={active ? 'true' : 'false'} onClick={() => setOpen(false)}>
                    <it.icon size={15} />
                    <span>{it.label}</span>
                    {badge > 0 && <i className="admin-badge">{badge}</i>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/" target="_blank" className="admin-view-store"><Store size={14} /> View store <ExternalLink size={11} /></Link>
          <div className="admin-user">
            <span className="avatar" style={{ width: 30, height: 30 }}>{(admin?.name || 'A')[0]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name}</strong>
              <small style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{admin?.role}</small>
            </div>
            <button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <button className="icon-btn admin-burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div style={{ flex: 1 }} />
          <Link href="/" target="_blank" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', gap: 6 }}>
            <Store size={13} /> Storefront
          </Link>
        </header>
        <div id="admin-main" className="admin-content" tabIndex={-1}>{children}</div>
      </div>

      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
