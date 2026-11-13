'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from './providers';
import { toast } from './toast';
import { Instagram, Facebook, Mail, ArrowRight } from './icons';

export function Footer() {
  const { store, catalogMeta } = useStore();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function subscribe(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/newsletter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) { toast('You are on the list'); setEmail(''); }
    else toast('Please enter a valid email', 'error');
  }

  return (
    <footer className="footer">
      <div className="wrap footer-top">
        <div className="footer-brand">
          <Link href="/" className="logo" style={{ fontSize: 23 }}>{store.name}</Link>
          <p>One considered store for electronics, wardrobe, home, beauty and everyday carry. Free delivery over Rs 15,000 and 30-day returns.</p>
          <form onSubmit={subscribe} className="nl-form" style={{ background: 'var(--surface2)', borderColor: 'var(--line)', maxWidth: 330 }}>
            <input type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ color: 'var(--ink)' }} aria-label="Email address" />
            <button className="btn" disabled={busy} aria-label="Subscribe" style={{ padding: '10px 14px' }}><ArrowRight size={15} /></button>
          </form>
          <div className="socials" style={{ marginTop: 18 }}>
            <a href={store.instagram || '#'} aria-label="Instagram" target="_blank" rel="noreferrer"><Instagram size={15} /></a>
            <a href={store.facebook || '#'} aria-label="Facebook" target="_blank" rel="noreferrer"><Facebook size={15} /></a>
            <a href={`mailto:${store.email}`} aria-label="Email"><Mail size={15} /></a>
          </div>
        </div>

        <div>
          <h4>Departments</h4>
          <ul>
            <li><Link href="/shop">All products</Link></li>
            {(catalogMeta?.categories || []).slice(0, 6).map((c) => (
              <li key={c.slug}><Link href={`/collections/${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Policies</h4>
          <ul>
            <li><Link href="/policies/shipping">Shipping</Link></li>
            <li><Link href="/policies/returns">Returns &amp; refunds</Link></li>
            <li><Link href="/policies/privacy">Privacy policy</Link></li>
            <li><Link href="/policies/terms">Terms of service</Link></li>
            <li><Link href="/policies/faq">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h4>Account</h4>
          <ul>
            <li><Link href="/account">My account</Link></li>
            <li><Link href="/account/orders">Order history</Link></li>
            <li><Link href="/account/orders">Track an order</Link></li>
            <li><Link href="/account/wishlist">Wishlist</Link></li>
            <li><Link href="/login">Sign in</Link></li>
            <li><Link href="/register">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
        <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>Cash on delivery</span><span>·</span><span>Secure checkout</span><span>·</span><span>Worldwide delivery</span>
        </span>
      </div>
    </footer>
  );
}
