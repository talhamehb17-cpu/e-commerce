'use client';
import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '../toast';
import { Search, Plus, Pencil, Trash2, Upload, X, Check, EyeOff, Copy } from '../icons';

const money = (minor) => `Rs ${(Number(minor) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const EMPTY = {
  name: '', slug: '', subtitle: '', description: '', story: '', categoryId: '', brandId: '',
  price: '', compareAtPrice: '', costPrice: '', stock: 0, lowStockThreshold: 5, sku: '', material: '',
  badge: '', isFeatured: false, isActive: true, images: [], variants: [], tags: [],
};

export function AdminProducts({ initial, categories, brands }) {
  const router = useRouter();
  const [products, setProducts] = useState(initial.products);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(() => (searchParams.get('new') ? { ...EMPTY } : null));
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) (async () => {
      const res = await fetch(`/api/admin/products/${id}`, { cache: 'no-store' });
      if (res.ok) setEditing((await res.json()).product);
    })();
  }, [searchParams]);

  const load = useCallback(async (params = {}) => {
    setBusy(true);
    const qs = new URLSearchParams({ q, status: status === 'all' ? '' : status, category, ...params });
    const res = await fetch(`/api/admin/products?${qs}`, { cache: 'no-store' });
    if (res.ok) setProducts((await res.json()).products);
    setBusy(false);
  }, [q, status, category]);

  async function toggle(id, field, value) {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }
      , body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) { setProducts((list) => list.map((p) => (p.id === id ? { ...p, [field === 'isActive' ? 'is_active' : field === 'isFeatured' ? 'is_featured' : field]: value } : p))); toast('Updated'); }
    else toast('Could not update', 'error');
  }

  async function bulk(action) {
    if (!selected.length) { toast('Select products first', 'error'); return; }
    const res = await fetch('/api/admin/products/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action }),
    });
    if (res.ok) { toast(`${selected.length} updated`); setSelected([]); load(); router.refresh(); }
    else toast('Bulk action failed', 'error');
  }

  async function duplicate(p) {
    const payload = {
      name: `${p.name} (copy)`, subtitle: p.subtitle, description: p.description, story: p.story,
      categoryId: p.category_id, brandId: p.brand_id, price: p.price / 100, compareAtPrice: p.compare_at_price ? p.compare_at_price / 100 : null,
      costPrice: p.cost_price ? p.cost_price / 100 : null, stock: p.stock, lowStockThreshold: p.low_stock_threshold,
      sku: p.sku, material: p.material, badge: p.badge || '', isFeatured: false, isActive: false,
      images: (p.images || []).map((i) => i.url), variants: [], tags: p.tags || [],
    };
    const res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { toast('Duplicated as draft'); load(); } else { const d = await res.json(); toast(d.error || 'Failed', 'error'); }
  }

  async function remove(p) {
    if (!confirm(`Archive “${p.name}”? It will be hidden from the storefront.`)) return;
    const res = await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    if (res.ok) { setProducts((l) => l.filter((x) => x.id !== p.id)); toast('Archived'); router.refresh(); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>{products.length} loaded · manage pricing, stock, media and variants.</p>
        </div>
        <button className="btn btn-sm" onClick={() => setEditing({ ...EMPTY })}><Plus size={13} /> Add product</button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, opacity: 0.45 }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name or SKU…" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          </div>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Hidden</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => load()}>{busy ? 'Loading…' : 'Apply'}</button>
        </div>

        {selected.length > 0 && (
          <div className="notice" style={{ marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12 }}>{selected.length} selected</strong>
            <button className="chip" onClick={() => bulk('activate')}>Activate</button>
            <button className="chip" onClick={() => bulk('deactivate')}>Hide</button>
            <button className="chip" onClick={() => bulk('feature')}>Feature</button>
            <button className="chip" onClick={() => bulk('unfeature')}>Unfeature</button>
            <button className="chip" style={{ color: '#a2372c' }} onClick={() => confirm('Delete permanently?') && bulk('delete')}>Delete</button>
            <button className="chip" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" checked={selected.length === products.length && products.length > 0} onChange={(e) => setSelected(e.target.checked ? products.map((p) => p.id) : [])} /></th>
                <th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} /></td>
                  <td>
                    <div className="cell-prod">
                      {p.images?.[0]?.url ? <Image src={p.images[0].url} alt="" width={38} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 38, height: 44, borderRadius: 6, background: 'var(--surface2)' }} />}
                      <div>
                        <strong style={{ fontSize: 12.5 }}>{p.name}</strong>
                        <div className="sub" style={{ fontSize: 10.5 }}>{p.sku || '—'} · {p.brand_name || 'No brand'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="sub">{p.category_name || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{money(p.price)}{p.compare_at_price ? <s style={{ marginLeft: 6, opacity: 0.5, fontSize: 10.5 }}>{money(p.compare_at_price)}</s> : null}</td>
                  <td>
                    <span style={{ color: p.stock === 0 ? '#a2372c' : p.stock <= p.low_stock_threshold ? 'var(--accent)' : 'inherit', fontWeight: 600 }}>{p.stock}</span>
                    {p.variant_count > 0 && <span className="sub" style={{ fontSize: 10 }}> · {p.variant_count}v</span>}
                  </td>
                  <td>
                    <button onClick={() => toggle(p.id, 'isActive', !p.is_active)} className={`pill ${p.is_active ? 'delivered' : ''}`} style={{ cursor: 'pointer' }}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => toggle(p.id, 'isFeatured', !p.is_featured)} aria-label="Toggle featured" style={{ opacity: p.is_featured ? 1 : 0.3 }}>
                      <Check size={14} />
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Edit"><Pencil size={14} /></button>
                    <button className="icon-btn" onClick={() => duplicate(p)} aria-label="Duplicate"><Copy size={14} /></button>
                    <button className="icon-btn" onClick={() => remove(p)} aria-label="Archive"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={8} className="empty-state">No products match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          categories={categories}
          brands={brands}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, categories, brands, onClose, onSaved }) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    ...EMPTY,
    ...product,
    categoryId: product.category_id || '',
    brandId: product.brand_id || '',
    price: product.price ? Number(product.price) / 100 : '',
    compareAtPrice: product.compare_at_price ? Number(product.compare_at_price) / 100 : '',
    costPrice: product.cost_price ? Number(product.cost_price) / 100 : '',
    isFeatured: Boolean(product.is_featured),
    isActive: product.is_active !== false,
    images: (product.images || []).map((i) => (typeof i === 'string' ? i : i.url)),
    variants: (product.variants || []).map((v) => ({ name: v.name, optionName: v.option_name || 'Size', priceDelta: Number(v.price_delta || 0) / 100, stock: v.stock, sku: v.sku || '' })),
    tags: product.tags || [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('basics');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadMany(files) {
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'catalog');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) urls.push(data.url);
      else toast(data.error || 'Upload failed', 'error');
    }
    setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, 8) }));
    setUploading(false);
  }

  async function save() {
    setError('');
    if (!form.name || form.price === '') { setError('Name and price are required.'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug || undefined,
      subtitle: form.subtitle, description: form.description, story: form.story,
      categoryId: form.categoryId || null, brandId: form.brandId || null,
      price: Number(form.price), compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      costPrice: form.costPrice ? Number(form.costPrice) : null,
      stock: Number(form.stock) || 0, lowStockThreshold: Number(form.lowStockThreshold) || 0,
      sku: form.sku, material: form.material, badge: form.badge || '',
      isFeatured: form.isFeatured, isActive: form.isActive,
      images: form.images,
      variants: form.variants.filter((v) => v.name).map((v) => ({ name: v.name, optionName: v.optionName, priceDelta: Number(v.priceDelta) || 0, stock: Number(v.stock) || 0, sku: v.sku })),
      tags: form.tags,
    };
    const res = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${product.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Could not save product'); return; }
    toast(isNew ? 'Product created' : 'Product updated');
    onSaved();
  }

  const margin = form.price && form.costPrice ? Math.round(((Number(form.price) - Number(form.costPrice)) / Number(form.price)) * 100) : null;

  return (
    <div className="modal" data-open="true" role="dialog" aria-label="Product editor">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel" style={{ width: 'min(880px,100%)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 3, borderBottom: '1px solid var(--line)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="eyebrow">{isNew ? 'New product' : 'Edit product'}</div>
            <h3 style={{ fontSize: 20, marginTop: 2 }}>{form.name || 'Untitled product'}</h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
        </div>

        <div className="tabs" style={{ padding: '0 20px' }}>
          {[['basics', 'Basics'], ['media', 'Media'], ['variants', 'Variants'], ['seo', 'Details']].map(([k, label]) => (
            <button key={k} data-on={tab === k ? 'true' : 'false'} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {error && <div className="alert error">{error}</div>}

          {tab === 'basics' && (
            <>
              <div className="field"><label>Product name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Aurora Wireless Headphones" /></div>
              <div className="field"><label>Short description</label><input className="input" value={form.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} placeholder="One line that sells it" /></div>
              <div className="form-row">
                <div className="field">
                  <label>Category</label>
                  <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                    <option value="">Uncategorised</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Brand</label>
                  <select className="input" value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
                    <option value="">No brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="field"><label>Price (PKR)</label><input className="input" type="number" min="0" step="1" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
                <div className="field"><label>Compare at</label><input className="input" type="number" min="0" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} /></div>
                <div className="field"><label>Cost price</label><input className="input" type="number" min="0" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} /></div>
              </div>
              {margin !== null && <p className="sub" style={{ fontSize: 11, marginTop: -6, marginBottom: 12 }}>Gross margin: {margin}%</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="field"><label>Stock</label><input className="input" type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></div>
                <div className="field"><label>Low stock alert at</label><input className="input" type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} /></div>
                <div className="field"><label>SKU</label><input className="input" value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} /></div>
              </div>
              <div className="field">
                <label>Badge</label>
                <select className="input" value={form.badge || ''} onChange={(e) => set('badge', e.target.value)}>
                  <option value="">None</option><option value="new">New</option><option value="bestseller">Bestseller</option><option value="limited">Limited</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                <label className="switch"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in store</label>
                <label className="switch"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured</label>
              </div>
            </>
          )}

          {tab === 'media' && (
            <>
              <p className="sub" style={{ fontSize: 12, marginBottom: 10 }}>First image is the card image; second shows on hover. Up to 8 images.</p>
              <div className="img-grid">
                {form.images.map((url, i) => (
                  <div className="img-tile" key={url + i}>
                    <Image src={url} alt="" width={100} height={100} style={{ objectFit: 'cover' }} />
                    <button onClick={() => set('images', form.images.filter((_, idx) => idx !== i))} aria-label="Remove image"><X size={10} /></button>
                    {i === 0 && <span style={{ position: 'absolute', bottom: 3, left: 3, background: 'var(--ink)', color: 'var(--bg)', fontSize: 8, padding: '2px 5px', borderRadius: 3 }}>MAIN</span>}
                  </div>
                ))}
                {form.images.length < 8 && (
                  <label className="upload-tile">
                    {uploading ? 'Uploading…' : <><Upload size={14} style={{ margin: '0 auto 4px' }} /> Add image</>}
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && uploadMany([...e.target.files])} />
                  </label>
                )}
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Or paste an image URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" id="imgurl" placeholder="https://…" />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      const el = document.getElementById('imgurl');
                      if (el?.value) { set('images', [...form.images, el.value].slice(0, 8)); el.value = ''; }
                    }}
                  >Add</button>
                </div>
              </div>
              <div className="field" style={{ marginTop: 16 }}><label>Description</label><textarea className="input" rows={6} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Materials, sizing, what makes it good…" /></div>
            </>
          )}

          {tab === 'variants' && (
            <>
              <p className="sub" style={{ fontSize: 12, marginBottom: 10 }}>Add sizes or colours. Price delta is added to the base price.</p>
              {form.variants.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr .8fr .7fr 32px', gap: 8, marginBottom: 8 }}>
                  <input className="input" placeholder="Name (e.g. M)" value={v.name} onChange={(e) => set('variants', form.variants.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                  <input className="input" placeholder="Group (Size)" value={v.optionName} onChange={(e) => set('variants', form.variants.map((x, idx) => idx === i ? { ...x, optionName: e.target.value } : x))} />
                  <input className="input" type="number" placeholder="+PKR" value={v.priceDelta} onChange={(e) => set('variants', form.variants.map((x, idx) => idx === i ? { ...x, priceDelta: e.target.value } : x))} />
                  <input className="input" type="number" placeholder="Stock" value={v.stock} onChange={(e) => set('variants', form.variants.map((x, idx) => idx === i ? { ...x, stock: e.target.value } : x))} />
                  <button className="icon-btn" onClick={() => set('variants', form.variants.filter((_, idx) => idx !== i))} aria-label="Remove variant"><Trash2 size={13} /></button>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => set('variants', [...form.variants, { name: '', optionName: form.variants[0]?.optionName || 'Size', priceDelta: 0, stock: 0, sku: '' }])}>
                <Plus size={12} /> Add variant
              </button>
            </>
          )}

          {tab === 'seo' && (
            <>
              <div className="field"><label>URL slug</label><input className="input" value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated from the name" /></div>
              <div className="field"><label>Material / spec</label><input className="input" value={form.material || ''} onChange={(e) => set('material', e.target.value)} placeholder="e.g. Full-grain leather" /></div>
              <div className="field"><label>Story</label><textarea className="input" rows={4} value={form.story || ''} onChange={(e) => set('story', e.target.value)} placeholder="Background shown on the product page" /></div>
              <div className="field">
                <label>Tags (comma separated)</label>
                <input className="input" value={(form.tags || []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
              </div>
              {!isNew && (
                <div className="notice" style={{ fontSize: 11.5 }}>
                  <EyeOff size={13} /> Archiving hides the product from the storefront without deleting order history.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
