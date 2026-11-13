'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from './providers';
import { useCart } from './cart-drawer';
import { CartDrawer } from './cart-drawer';
import { toast } from './toast';
import { ShopGrid } from './shop';
import { Stars, Breadcrumb, SectionHead } from './ui';
import { ReviewSection } from './reviews';
import { Truck, RotateCcw, ShieldCheck, Heart, Minus, Plus, ZoomIn, Check } from './icons';

export function ProductDetail({ product, related, saved: initiallySaved, customer, myReview, verifiedPurchase }) {
  const { money } = useStore();
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart(() => setCartOpen(true));
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [qty, setQty] = useState(1);
  const optionGroups = groupVariants(product.variants);
  const [selection, setSelection] = useState(() => {
    const init = {};
    optionGroups.forEach((g) => { init[g.name] = g.options[0]?.name; });
    return init;
  });

  const chosenVariant = product.variants.length
    ? product.variants.find((v) => v.name === selection[Object.keys(selection)[0]]) || product.variants[0]
    : null;

  const price = product.price + (chosenVariant?.priceDelta || 0);
  const compare = product.compareAtPrice;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setZoom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function addToBag(buyNow = false) {
    const ok = await cart.add({ productId: product.id, variantId: chosenVariant?.id || null, qty });
    if (ok && buyNow) router.push('/checkout');
  }

  async function toggleSave() {
    const res = await fetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
    if (res.status === 401) { toast('Sign in to save items', 'error'); router.push(`/login?next=/products/${product.slug}`); return; }
    const data = await res.json();
    setSaved(data.saved);
    toast(data.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    router.refresh();
  }

  const stock = chosenVariant ? chosenVariant.stock : product.stock;

  return (
    <>
      <div className="wrap" style={{ paddingTop: 18 }}>
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: product.categoryName || 'Shop', href: `/collections/${product.categorySlug}` },
          ...(product.brandName ? [{ label: product.brandName, href: `/brands/${product.brandSlug}` }] : []),
          { label: product.name },
        ]} />
      </div>

      <div className="wrap pdp">
        <div>
          <div className="pdp-gallery">
            <div className="pdp-thumbs">
              {product.gallery.map((img, i) => (
                <button key={i} data-on={i === active ? 'true' : 'false'} onClick={() => setActive(i)} aria-label={`View image ${i + 1}`}>
                  <Image src={img.url} alt={img.alt || product.name} width={80} height={80} sizes="80px" style={{ objectFit: 'cover' }} />
                </button>
              ))}
            </div>
            <div className="pdp-stage" onClick={() => setZoom(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setZoom(true)} aria-label="Zoom image">
              <Image
                src={product.gallery[active]?.url || product.image}
                alt={product.gallery[active]?.alt || product.name}
                fill priority sizes="(max-width:980px) 100vw, 50vw" quality={85}
                style={{ objectFit: 'cover' }}
              />
              <span style={{ position: 'absolute', right: 14, bottom: 14, background: 'rgba(255,255,255,.9)', color: '#16130f', borderRadius: 100, padding: '7px 12px', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                <ZoomIn size={13} /> Zoom
              </span>
            </div>
          </div>
        </div>

        <div className="pdp-info">
          {product.brandName && <div className="eyebrow">{product.brandName}</div>}
          <h1>{product.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Stars rating={product.rating} count={product.ratingCount} size={14} />
            <span className="muted" style={{ fontSize: 11.5 }}>{product.sold} sold</span>
            {product.badge === 'new' && <span className="tag new">New</span>}
            {product.badge === 'limited' && <span className="tag limited">Limited</span>}
          </div>

          <div className="pdp-price">
            <span>{money(price)}</span>
            {compare > price && <s>{money(compare)}</s>}
            {compare > price && <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--sans)' }}>Save {Math.round(100 - (price / compare) * 100)}%</span>}
          </div>

          <p className="pdp-desc">{product.subtitle || product.description}</p>

          {optionGroups.map((g) => (
            <div className="opt-group" key={g.name}>
              <span>{g.name}: <strong style={{ color: 'var(--ink)' }}>{selection[g.name]}</strong></span>
              <div className="opt-row">
                {g.options.map((o) => (
                  <button
                    key={o.name}
                    className="opt"
                    data-on={selection[g.name] === o.name ? 'true' : 'false'}
                    onClick={() => setSelection((s) => ({ ...s, [g.name]: o.name }))}
                    disabled={o.stock === 0}
                    style={o.stock === 0 ? { opacity: 0.4, textDecoration: 'line-through' } : undefined}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className={`stock-note ${stock > 0 && stock <= (product.lowStockThreshold || 5) ? 'low' : ''}`} style={{ margin: '14px 0 0' }}>
            {stock === 0 ? 'Sold out' : stock <= (product.lowStockThreshold || 5) ? `Only ${stock} left in stock` : <><Check size={13} /> In stock, ships within 48 hours</>}
          </div>

          <div className="pdp-buy">
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={13} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Increase quantity"><Plus size={13} /></button>
            </div>
            <button className="btn" disabled={stock === 0} onClick={() => addToBag(false)}>Add to bag</button>
            <button className="btn btn-outline" style={{ flex: '0 0 auto', padding: '14px 18px' }} onClick={toggleSave} aria-label={saved ? 'Remove from wishlist' : 'Save'}>
              <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
          <button className="btn btn-accent btn-block" disabled={stock === 0} onClick={() => addToBag(true)}>Buy it now</button>

          <div className="trust-list">
            <div className="trust-item"><Truck size={18} /><div>Free delivery over Rs 15,000<small>{stock > 0 ? 'Dispatched within 48 hours' : 'Restocking soon'}</small></div></div>
            <div className="trust-item"><RotateCcw size={18} /><div>30-day free returns<small>Unused, in original packaging</small></div></div>
            <div className="trust-item"><ShieldCheck size={18} /><div>2-year quality promise<small>We repair or replace faults</small></div></div>
          </div>

          <div style={{ marginTop: 20 }}>
            {product.description && (
              <details className="accordion" open>
                <summary>Description</summary>
                <p>{product.description}</p>
              </details>
            )}
            <details className="accordion">
              <summary>Materials &amp; care</summary>
              <p>{product.material || 'See product details.'}{'\n\n'}Care: follow the label or included care card. For leather goods, condition every few months and store away from direct sun.</p>
            </details>
            <details className="accordion">
              <summary>Shipping &amp; returns</summary>
              <p>Standard delivery 3–5 business days. Express available at checkout. Returns accepted within 30 days for unused items — we cover return shipping in Pakistan.</p>
            </details>
            {product.sku && (
              <details className="accordion">
                <summary>Product details</summary>
                <p>SKU: {product.sku}{'\n'}Category: {product.categoryName}{product.brandName ? `\nBrand: ${product.brandName}` : ''}</p>
              </details>
            )}
          </div>
        </div>
      </div>

      <div className="wrap section-tight">
        <ReviewSection product={product} customer={customer} myReview={myReview} verifiedPurchase={verifiedPurchase} />
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="wrap">
            <SectionHead eyebrow="You may also like" title="Complete the edit" action="Shop all" actionHref="/shop" />
            <ShopGrid products={related} />
          </div>
        </section>
      )}

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-label="Image zoom">
          <Image src={product.gallery[active]?.url} alt={product.name} width={1400} height={1750} style={{ maxHeight: '88vh', width: 'auto' }} />
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cartState={cart} />
    </>
  );
}

function optionOf(variant, groupName) {
  // Convention: a variant's option_name groups it; single-group products use the variant name directly.
  return variant.optionName || 'Option';
}

function groupVariants(variants) {
  if (!variants?.length) return [];
  const groups = new Map();
  for (const v of variants) {
    const name = v.optionName || 'Option';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ name: v.name, stock: v.stock, id: v.id });
  }
  return [...groups.entries()].map(([name, options]) => ({ name, options }));
}
