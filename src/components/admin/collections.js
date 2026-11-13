'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from '../toast';
import { Plus, Pencil, Trash2, X, Upload, Search, Check } from '../icons';

export function AdminCollections() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [pickQ, setPickQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [c, p] = await Promise.all([
      fetch('/api/admin/collections', { cache: 'no-store' }),
      fetch('/api/admin/products?limit=200', { cache: 'no-store' }),
    ]);
    if (c.ok) setItems((await c.json()).collections);
    if (p.ok) setProducts((await p.json()).products);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing.name) return toast('Name is required', 'error');
    const payload = {
      name: editing.name, description: editing.description, image: editing.image_url,
      isFeatured: Boolean(editing.is_featured), position: Number(editing.position) || 0,
      isActive: editing.is_active !== false, productIds: editing.productIds,
    };
    const res = await fetch(editing.id ? `/api/admin/collections/${editing.id}` : '/api/admin/collections', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) return toast(d.error || 'Could not save collection', 'error');
    toast('Collection saved');
    setEditing(null);
    load();
  }

  async function remove(c) {
    if (!confirm(`Delete the “${c.name}” collection? Products stay in the catalogue.`)) return;
    await fetch(`/api/admin/collections/${c.id}`, { method: 'DELETE' });
    toast('Collection deleted');
    load();
  }

  async function upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'collections');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (res.ok) setEditing((e) => ({ ...e, image_url: d.url }));
    else toast(d.error || 'Upload failed', 'error');
  }

  async function openEdit(c) {
    const res = await fetch(`/api/admin/products?limit=200`, { cache: 'no-store' });
    const all = res.ok ? (await res.json()).products : [];
    setProducts(all);
    // product membership comes from the collection detail endpoint
    const detail = await fetch(`/api/admin/collections/${c.id}`, { cache: 'no-store' });
    let productIds = [];
    if (detail.ok) productIds = (await detail.json()).productIds || [];
    setEditing({ ...c, productIds });
  }

  const filtered = products.filter((p) => !pickQ || p.name.toLowerCase().includes(pickQ.toLowerCase()));

  return (
    <div>
      <div className="page-head">
        <div><h1>Collections</h1><p>Hand-picked groups that power “New in”, “Best sellers” and seasonal edits.</p></div>
        <button className="btn btn-sm" onClick={() => setEditing({ name: '', description: '', image_url: '', is_active: true, is_featured: false, position: items.length, productIds: [] })}>
          <Plus size={13} /> New collection
        </button>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
        {items.map((c) => (
          <div className="panel" key={c.id} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--surface2)' }}>
              {c.image_url ? <Image src={c.image_url} alt="" fill sizes="280px" style={{ objectFit: 'cover' }} /> : null}
              {c.is_featured && <span className="pill delivered" style={{ position: 'absolute', top: 10, left: 10 }}>Featured</span>}
            </div>
            <div style={{ padding: 14 }}>
              <strong style={{ fontSize: 13.5 }}>{c.name}</strong>
              <div className="sub" style={{ fontSize: 11 }}>{c.product_count} products · /{c.slug}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="chip" onClick={() => openEdit(c)}><Pencil size={11} /> Edit</button>
                <button className="chip" style={{ color: '#a2372c' }} onClick={() => remove(c)}><Trash2 size={11} /></button>
              </div>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="panel empty-state">No collections yet.</div>}
      </div>

      {editing && (
        <div className="modal" data-open="true">
          <div className="modal-scrim" onClick={() => setEditing(null)} />
          <div className="modal-panel" style={{ width: 'min(680px,100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 19 }}>{editing.id ? 'Edit collection' : 'New collection'}</h3>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="field"><label>Name</label><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="field"><label>Description</label><textarea className="input" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="field">
                <label>Cover image</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {editing.image_url && <Image src={editing.image_url} alt="" width={70} height={46} style={{ borderRadius: 6, objectFit: 'cover' }} />}
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    <Upload size={12} /> Upload
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                  <input className="input" placeholder="or paste URL" value={editing.image_url || ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="form-row">
                <div className="field"><label>Position</label><input className="input" type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: e.target.value })} /></div>
                <div className="field"><label>Options</label>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                    <label className="switch"><input type="checkbox" checked={editing.is_featured === true || editing.is_featured === 't'} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Featured</label>
                    <label className="switch"><input type="checkbox" checked={editing.is_active !== false && editing.is_active !== 'f'} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Products in this collection ({editing.productIds?.length || 0})</label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: 9, opacity: 0.45 }} />
                  <input className="input" style={{ paddingLeft: 28 }} placeholder="Filter products…" value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
                </div>
                <div style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 6 }}>
                  {filtered.map((p) => {
                    const on = editing.productIds?.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditing({ ...editing, productIds: on ? editing.productIds.filter((x) => x !== p.id) : [...(editing.productIds || []), p.id] })}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, background: on ? 'var(--accent-soft)' : 'transparent', fontSize: 12, textAlign: 'left' }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--line)', display: 'grid', placeItems: 'center', background: on ? 'var(--ink)' : 'var(--surface)', color: 'var(--bg)' }}>
                          {on ? <Check size={9} /> : null}
                        </span>
                        <span style={{ flex: 1 }}>{p.name}</span>
                        <span className="sub" style={{ fontSize: 10 }}>{p.category_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-block" onClick={save}>Save collection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
