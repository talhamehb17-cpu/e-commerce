'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useStore } from './providers';
import { CartDrawer, useCart } from './cart-drawer';
import { SearchModal } from './search';
import { ThemeSwitcher } from './theme-switcher';
import { CurrencyFlag } from './currency-flag';
import { Search, ShoppingBag, Heart, User, Menu, X } from './icons';

const NAV = [
  { label: 'Shop all', href: '/shop' },
  { label: 'New in', href: '/collections/new-arrivals' },
  { label: 'Best sellers', href: '/collections/best-sellers' },
  { label: 'Brands', href: '/brands' },
  { label: 'Our story', href: '/about' },
];

export function Header() {
  const { store, cartCount, wishlistCount, customer, currencies, currency, setCurrency, catalogMeta } = useStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const currencyButtonRef = useRef(null);
  const currencyMenuRef = useRef(null);
  const pathname = usePathname();
  const cartState = useCart(() => setCartOpen(true));

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setMenuOpen(false); setCurrOpen(false); setCurrencyQuery(''); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!currOpen) return;
    const onPointerDown = (event) => {
      if (!currencyMenuRef.current?.contains(event.target)) { setCurrOpen(false); setCurrencyQuery(''); }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setCurrOpen(false); setCurrencyQuery(''); currencyButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [currOpen]);

  const announcements = [
    store.announcement,
    'Cash on delivery · 30-day returns · Worldwide shipping',
    'New season — the wardrobe edit is live',
  ].filter(Boolean);

  return (
    <>
      <div className="announce">
        <div className="announce-inner">
          <div className="announce-track">
            {[...announcements, ...announcements].map((a, i) => (
              <span key={i}>{a} <span style={{ opacity: 0.4, marginLeft: 28 }}>✦</span></span>
            ))}
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-inner">
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu size={19} /></button>

          <nav className="nav">
            {NAV.slice(0, 3).map((n) => (
              <Link key={n.href} href={n.href} data-active={pathname === n.href ? 'true' : 'false'}>{n.label}</Link>
            ))}
          </nav>

          <Link href="/" className="logo" aria-label={`${store.name} home`}>{store.name}</Link>

          <div className="header-actions">
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></button>
            <div style={{ position: 'relative' }}>
              <button ref={currencyButtonRef} className="icon-btn" onClick={() => setCurrOpen((o) => !o)} aria-label="Change currency" aria-expanded={currOpen} aria-controls="currency-options">
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '.04em' }}><CurrencyFlag code={currency} size={18} />{currency}</span>
              </button>
              {currOpen && (
                <div ref={currencyMenuRef} id="currency-options" style={{ position: 'absolute', right: 0, top: 46, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 6, width: 'min(320px, calc(100vw - 24px))', boxShadow: 'var(--shadow)', zIndex: 70 }}>
                  <div className="eyebrow" style={{ padding: '8px 10px 4px', fontSize: 10 }}>Display currency</div>
                  <input
                    aria-label="Search currencies"
                    className="input"
                    type="search"
                    placeholder="Search by name or code"
                    value={currencyQuery}
                    onChange={(event) => setCurrencyQuery(event.target.value)}
                    autoFocus
                    style={{ padding: '8px 10px', fontSize: 12, margin: '4px 4px 8px', width: 'calc(100% - 8px)' }}
                  />
                  <div style={{ maxHeight: 'min(52vh, 360px)', overflowY: 'auto' }}>
                  {currencies.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(currencyQuery.trim().toLowerCase())).map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { setCurrency(c.code); setCurrOpen(false); setCurrencyQuery(''); }}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 12.5, background: c.code === currency ? 'var(--surface2)' : 'none', fontWeight: c.code === currency ? 600 : 400 }}
                    >
                      <CurrencyFlag code={c.code} size={19} /><span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.code} — {c.name}</span><span className="muted">{c.symbol}</span>
                    </button>
                  ))}
                  {!currencies.some((c) => `${c.code} ${c.name}`.toLowerCase().includes(currencyQuery.trim().toLowerCase())) && <p className="muted" style={{ padding: '10px', fontSize: 12 }}>No matching currencies.</p>}
                  </div>
                  <div className="muted" style={{ padding: '6px 10px', fontSize: 10.5, lineHeight: 1.4 }}>Prices convert for display; settlement is in PKR.</div>
                </div>
              )}
            </div>
            <ThemeSwitcher />
            <Link href={customer ? '/account/wishlist' : '/login'} className="icon-btn" aria-label="Wishlist">
              <Heart size={18} />
              {wishlistCount > 0 && <span className="badge-dot">{wishlistCount}</span>}
            </Link>
            <Link href={customer ? '/account' : '/login'} className="icon-btn" aria-label="Account">
              {customer?.avatar
                ? <span className="avatar" style={{ width: 26, height: 26 }}><Image src={customer.avatar} alt="" width={26} height={26} style={{ objectFit: 'cover' }} /></span>
                : <User size={18} />}
            </Link>
            <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label="Shopping bag">
              <ShoppingBag size={18} />
              {cartCount > 0 && <span className="badge-dot">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="mobile-nav" data-open={menuOpen} aria-hidden={!menuOpen}>
        <button
          type="button"
          className="mobile-nav-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
          tabIndex={menuOpen ? 0 : -1}
        />
        <nav id="mobile-navigation" className="mobile-nav-panel" aria-label="Mobile navigation" aria-modal={menuOpen || undefined} inert={!menuOpen}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span className="logo" style={{ fontSize: 19 }}>{store.name}</span>
            <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
          </div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Departments</div>
          {(catalogMeta?.categories || []).slice(0, 7).map((c) => (
            <Link key={c.slug} className="mnav" href={`/collections/${c.slug}`} onClick={() => setMenuOpen(false)}>{c.name}</Link>
          ))}
          <div className="eyebrow" style={{ margin: '18px 0 6px' }}>Explore</div>
          {NAV.map((n) => (
            <Link key={n.href} className="mnav" href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</Link>
          ))}
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href={customer ? '/account' : '/login'} className="btn btn-outline btn-block btn-sm" onClick={() => setMenuOpen(false)}>
              {customer ? 'My account' : 'Sign in'}
            </Link>
            {!customer && <Link href="/register" className="btn btn-block btn-sm" onClick={() => setMenuOpen(false)}>Create account</Link>}
          </div>
        </nav>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cartState={cartState} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
