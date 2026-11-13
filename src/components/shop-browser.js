'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShopGrid } from './shop';
import { Empty } from './ui';
import { SlidersHorizontal, X } from './icons';

const SORTS = [
  ['featured', 'Featured'],
  ['newest', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['bestselling', 'Best selling'],
  ['rating', 'Top rated'],
];

export function ShopBrowser({ products, total, page, perPage, categories, brands, params, basePath = '/shop' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [openFilters, setOpenFilters] = useState(false);

  function setParam(key, value) {
    const qs = new URLSearchParams();
    const merged = { ...params, [key]: value };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && k !== 'page') qs.set(k, String(v));
    });
    router.push(`${basePath}${qs.toString() ? `?${qs}` : ''}`);
  }

  const selectStyle = { padding: '9px 12px', borderRadius: 100, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 12.5, width: 'auto' };
  const pages = Math.ceil(total / perPage);
  const priceBands = [[0, 5000], [5000, 15000], [15000, 30000], [30000, 60000], [60000, null]];

  return (
    <div className="shop-layout">
      <aside className="filters" data-open={openFilters} style={openFilters ? { display: 'grid' } : undefined}>
        <div className="filter-group">
          <h4>Category</h4>
          <Link href={basePath} className="filter-link" data-on={!params.category ? 'true' : 'false'}>
            <span>All products</span>
          </Link>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setParam('category', c.slug === params.category ? undefined : c.slug)}
              className="filter-link"
              data-on={params.category === c.slug ? 'true' : 'false'}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <span>{c.name}</span><span>{c.product_count}</span>
            </button>
          ))}
        </div>

        <div className="filter-group">
          <h4>Brand</h4>
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => setParam('brand', b.slug === params.brand ? undefined : b.slug)}
              className="filter-link"
              data-on={params.brand === b.slug ? 'true' : 'false'}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <span>{b.name}</span><span>{b.product_count}</span>
            </button>
          ))}
        </div>

        <div className="filter-group">
          <h4>Price</h4>
          {priceBands.map(([min, max]) => {
            const on = String(params.min || '') === String(min) && String(params.max || '') === String(max || '');
            return (
              <button
                key={min}
                className="filter-link"
                data-on={on ? 'true' : 'false'}
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => {
                  const qs = new URLSearchParams();
                  const merged = { ...params, min: on ? undefined : min, max: max ?? undefined };
                  Object.entries(merged).forEach(([k, v]) => { if (v !== undefined && v !== '' && k !== 'page') qs.set(k, String(v)); });
                  router.push(`${basePath}${qs.toString() ? `?${qs}` : ''}`);
                }}
              >
                <span>{max ? `Under ${(max / 1).toLocaleString()}` : `Over ${min.toLocaleString()}`}{max ? ' PKR' : ' PKR'}</span>
              </button>
            );
          })}
        </div>

        <div className="filter-group">
          <h4>Availability</h4>
          <button className="filter-link" data-on={params.stock === '1' ? 'true' : 'false'} style={{ width: '100%', textAlign: 'left' }} onClick={() => setParam('stock', params.stock === '1' ? undefined : '1')}>
            <span>In stock only</span>
          </button>
        </div>

        {(params.category || params.brand || params.min || params.max || params.stock || params.q) && (
          <div className="filter-group">
            <Link href={basePath} className="link-u" style={{ color: 'var(--accent)' }}>Clear all filters</Link>
          </div>
        )}
      </aside>

      <div>
        <div className="shop-toolbar">
          <span className="muted" style={{ fontSize: 12.5 }}>
            {total} {total === 1 ? 'product' : 'products'}
            {params.q ? ` for “${params.q}”` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="chip" onClick={() => setOpenFilters((o) => !o)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <SlidersHorizontal size={13} /> Filters
            </button>
            <select
              value={params.sort || 'featured'}
              onChange={(e) => setParam('sort', e.target.value)}
              className="input"
              style={selectStyle}
              aria-label="Sort products"
            >
              {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
        </div>

        {products.length === 0 ? (
          <Empty title="Nothing matches yet" body="Try removing a filter or searching a broader term." cta="Reset filters" href={basePath} />
        ) : (
          <ShopGrid products={products} />
        )}

        {pages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            {Array.from({ length: pages }).slice(0, 12).map((_, i) => {
              const qs = new URLSearchParams();
              Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && k !== 'page') qs.set(k, String(v)); });
              if (i + 1 > 1) qs.set('page', String(i + 1));
              return (
                <Link key={i} href={`${basePath}${qs.toString() ? `?${qs}` : ''}`} data-on={page === i + 1 ? 'true' : 'false'}>
                  {i + 1}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
