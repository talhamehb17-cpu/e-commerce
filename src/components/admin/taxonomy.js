'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from '../toast';
import { Plus, Pencil, Trash2, X, Upload, Check } from '../icons';

/** Categories and brands share the same CRUD surface. */
export function AdminTaxonomy({ kind }) {
  const isBrand = kind === 'brands';
  const endpoint = `/api/admin/${kind}`;
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (res.ok) setItems((await res.json())[kind]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function save() {
    if (!editing.name) { toast('Name is required', 'error'); return; }
    const payload = isBrand
      ? { name: editing.name, description: editing.description, logoUrl: editing.logo, website: editing.website, isFeatured: editing.is_featured, position: Number(editing.position) || 0, isActive: editing.is_active !== false }
      : { name: editing.name, description: editing.description, imageUrl: editing.image, position: Number(editing.position) || 0, isActive: editing.is_active !== false };
    const res = await fetch(editing.id ? `${endpoint}/${editing.id}` : endpoint, {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not save', 'error'); return; }
    toast(editing.id ? 'Updated' : 'Created');
    setEditing(null);
    load();
  }

  async function remove(item) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    const res = await fetch(`${endpoint}/${item.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(data.note || 'Deleted'); load(); }
    else toast(data.error || 'Could not delete', 'error');
  }

  async function upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', kind);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) setEditing((e) => ({ ...e, [isBrand ? 'logo' : 'image']: data.url }));
    else toast(data.error || 'Upload failed', 'error');
  }

  const label = isBrand ? 'Brand' : 'Category';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isBrand ? 'Brands' : 'Categories'}</h1>
          <p>Unlimited {kind} — they appear in navigation, filters and the storefront automatically.</p>
        </div>
        <button className="btn btn-sm" onClick={() => setEditing({ name: '', description: '', position: items.length, is_active: true, is_featured: false })}>
          <Plus size={13} /> Add {label.toLowerCase()}
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Products</th><th>Position</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="cell-prod">
                      {(it.image_url || it.logo_url) ? (
                        <Image src={it.image_url || it.logo_url} alt="" width={34} height={40} style={{ objectFit: 'cover', borderRadius: 6 }} />
                      ) : <div style={{ width: 34, height: 40, borderRadius: 6, background: 'var(--surface2)' }} />}
                      <div>
                        <strong style={{ fontSize: 12.5 }}>{it.name}</strong>
                        {it.description && <div className="sub" style={{ fontSize: 10.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="sub">/{it.slug}</td>
                  <td>{it.product_count}</td>
                  <td>{it.position}</td>
                  <td><span className={`pill ${it.is_active ? 'delivered' : ''}`}>{it.is_active ? 'Active' : 'Hidden'}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing({ ...it, image: it.image_url, logo: it.logo_url })} aria-label="Edit"><Pencil size={14} /></button>
                    <button className="icon-btn" onClick={() => remove(it)} aria-label="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="empty-state">Nothing yet — add your first {label.toLowerCase()}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal" data-open="true" role="dialog">
          <div className="modal-scrim" onClick={() => setEditing(null)} />
          <div className="modal-panel" style={{ width: 'min(520px,100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 19 }}>{editing.id ? 'Edit' : 'New'} {label.toLowerCase()}</h3>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="field"><label>Name</label><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="field"><label>Description</label><textarea className="input" rows={3} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              {isBrand ? (
                <div className="field"><label>Website</label><input className="input" value={editing.website || ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} placeholder="https://…" /></div>
              ) : null}
              <div className="field">
                <label>{isBrand ? 'Logo' : 'Image'}</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="img-tile" style={{ width: 64 }}>
                    {(editing.image || editing.logo) ? <Image src={editing.image || editing.logo} alt="" width={64} height={64} style={{ objectFit: 'cover' }} /> : <span style={{ fontSize: 9, color: 'var(--muted)', padding: 4 }}>none</span>}
                  </div>
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    <Upload size={12} /> Upload
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                  <input className="input" placeholder="or paste URL" style={{ flex: 1 }} onChange={(e) => setEditing({ ...editing, [isBrand ? 'logo' : 'image']: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="field"><label>Position</label><input className="input" type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: e.target.value })} /></div>
                <div className="field"><label>Status</label>
                  <label className="switch" style={{ marginTop: 10 }}>
                    <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active
                  </label>
                </div>
              </div>
              <button className="btn btn-block" onClick={save}>{editing.id ? 'Save changes' : `Create ${label.toLowerCase()}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
