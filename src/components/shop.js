'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductGrid, Stars } from './ui';
import { useStore } from './providers';
import { useCart } from './cart-drawer';
import { toast } from './toast';
import { X, Plus, Minus, ShoppingBag } from './icons';

/** Client wrapper that binds product cards to the cart + wishlist APIs. */
export function ShopGrid({ products, savedIds = [], openCart }) {
  const { money, wishlistCount } = useStore();
  const router = useRouter();
  const cart = useCart(openCart);
  const [saved, setSaved] = useState(savedIds);

  async function onAdd(product) {
    if (product.variantCount > 0) { router.push(`/products/${product.slug}`); return; }
    await cart.add({ productId: product.id, qty: 1 });
  }

  async function onSave(product) {
    const res = await fetch('/api/wishlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id }),
    });
    if (res.status === 401) { toast('Sign in to save items', 'error'); router.push('/login?next=/shop'); return; }
    const data = await res.json();
    setSaved((s) => (data.saved ? [...s, product.id] : s.filter((id) => id !== product.id)));
    toast(data.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    router.refresh();
  }

  return <ProductGrid products={products} money={money} savedIds={saved} onAdd={onAdd} onSave={onSave} />;
}

export function QuickView({ product, open, onClose, openCart }) {
  const { money } = useStore();
  const cart = useCart(openCart);
  const [qty, setQty] = useState(1);
  useEffect(() => { if (open) setQty(1); document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  if (!product) return null;
  return (
    <div className="modal" data-open={open} aria-hidden={!open} role="dialog" aria-label={product.name}>
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel">
        <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}><X size={18} /></button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ position: 'relative', aspectRatio: '4/5', background: 'var(--surface2)', borderRadius: '22px 0 0 22px', overflow: 'hidden' }}>
            <Image src={product.image} alt={product.name} fill sizes="430px" style={{ objectFit: 'cover' }} />
          </div>
          <div style={{ padding: 30 }}>
            <div className="eyebrow">{product.brandName || product.categoryName}</div>
            <h3 style={{ fontSize: 28, margin: '8px 0 10px' }}>{product.name}</h3>
            <Stars rating={product.rating} count={product.ratingCount} />
            <div style={{ fontSize: 20, fontFamily: 'var(--serif)', margin: '14px 0' }}>{money(product.price)}</div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, minHeight: 60 }}>
              {product.subtitle || 'Considered materials, honest pricing and free returns within 30 days.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Minus size={12} /></button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Increase"><Plus size={12} /></button>
              </div>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={async () => { const ok = await cart.add({ productId: product.id, qty }); if (ok) onClose(); }}
              >
                <ShoppingBag size={14} /> Add to bag
              </button>
            </div>
            <Link href={`/products/${product.slug}`} className="link-u" style={{ display: 'inline-block', marginTop: 18 }}>Full details</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
