'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Star, ChevronRight, Heart, Eye } from './icons';

export function Stars({ rating = 0, count, size = 12 }) {
  const full = Math.round(Number(rating) || 0);
  return (
    <span className="stars" aria-label={`Rated ${Number(rating).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} strokeWidth={1.5} fill={i <= full ? 'currentColor' : 'none'} opacity={i <= full ? 1 : 0.32} />
      ))}
      {count != null && <span style={{ marginLeft: 5, color: 'var(--muted)', fontSize: 11.5 }}>({count})</span>}
    </span>
  );
}

export function ProductCard({ product, money, priority = false, saved = false, onAdd, onSave, onQuick, sizes = '(max-width:720px) 50vw, (max-width:1180px) 33vw, 25vw' }) {
  const hasCompare = product.compareAtPrice && product.compareAtPrice > product.price;
  return (
    <article className="pcard" data-product-id={product.id}>
      <div className="pcard-media-wrap">
      <Link href={`/products/${product.slug}`} className="pcard-media" aria-label={product.name} data-has-gallery={Boolean(product.image2 && product.image2 !== product.image)}>
        <span className="pcard-badges">
          {product.badge === 'new' && <span className="tag new">New</span>}
          {product.badge === 'bestseller' && <span className="tag">Bestseller</span>}
          {product.badge === 'limited' && <span className="tag limited">Limited</span>}
          {hasCompare && <span className="tag sale">−{Math.round(100 - (product.price / product.compareAtPrice) * 100)}%</span>}
          {product.stock === 0 && <span className="tag">Sold out</span>}
        </span>
        <Image className="img-a" src={product.image} alt={product.name} fill sizes={sizes} priority={priority} quality={78} />
        {product.image2 && product.image2 !== product.image && <Image className="img-b" src={product.image2} alt={`${product.name}, alternate view`} fill sizes={sizes} quality={78} aria-hidden="true" />}
      </Link>

      <div className="pcard-actions">
        <button type="button" aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} data-on={saved ? 'true' : 'false'} onClick={() => onSave?.(product)}>
          <Heart size={15} fill={saved ? 'currentColor' : 'none'} strokeWidth={1.7} />
        </button>
        {onQuick && (
          <button type="button" aria-label="Quick view" onClick={() => onQuick(product)}>
            <Eye size={15} strokeWidth={1.7} />
          </button>
        )}
      </div>

      <div className="pcard-quick">
        <button type="button" className="btn" aria-label={product.stock === 0 ? `${product.name} is sold out` : `${product.variantCount > 0 ? 'Choose options for' : 'Add'} ${product.name} to bag`} disabled={product.stock === 0} onClick={() => onAdd?.(product)}>
          {product.stock === 0 ? 'Sold out' : product.variantCount > 0 ? 'Choose options' : 'Add to bag'}
        </button>
      </div>
      </div>

      <div className="pcard-body">
        {product.brandName && <span className="pcard-brand">{product.brandName}</span>}
        <Link href={`/products/${product.slug}`}><h3 className="pcard-title">{product.name}</h3></Link>
        <div className="pcard-meta">
          {product.ratingCount > 0 ? <Stars rating={product.rating} count={product.ratingCount} /> : <span style={{ fontSize: 11.5 }}>{product.categoryName}</span>}
        </div>
        <span className="pcard-price">
          <span>{money(product.price)}</span>
          {hasCompare && <s>{money(product.compareAtPrice)}</s>}
        </span>
      </div>
    </article>
  );
}

export function ProductGrid({ products, money, savedIds = [], ...handlers }) {
  return (
    <div className="grid-products">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} money={money} priority={i < 2} saved={savedIds.includes(p.id)} {...handlers} />
      ))}
    </div>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span>{it.label}</span>}
          {i < items.length - 1 && <ChevronRight size={11} opacity={0.5} />}
        </span>
      ))}
    </nav>
  );
}

export function SectionHead({ eyebrow, title, subtitle, action, actionHref }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2>{title}</h2>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && actionHref && <Link className="link-u" href={actionHref}>{action}</Link>}
    </div>
  );
}

export function Empty({ title, body, cta, href }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {cta && href && <Link className="btn" href={href}>{cta}</Link>}
    </div>
  );
}

export function StatusPill({ status }) {
  const s = String(status || '').toLowerCase();
  const map = { pending: 'pending', confirmed: 'confirmed', processing: 'processing', packed: 'packed', shipped: 'shipped', out_for_delivery: 'shipped', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned' };
  return <span className={`pill ${map[s] || ''}`}>{s.replace(/_/g, ' ')}</span>;
}
