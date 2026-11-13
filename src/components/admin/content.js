'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from '../toast';
import { Plus, Pencil, Trash2, X, Upload, Eye, EyeOff, GripVertical } from '../icons';

const TYPES = [
  ['hero', 'Hero banner'],
  ['marquee', 'Scrolling strip'],
  ['categories', 'Category grid'],
  ['collections', 'Collection grid'],
  ['brands', 'Brand strip'],
  ['products', 'Product carousel'],
  ['banner', 'Promo banner'],
  ['story', 'Story / editorial'],
  ['values', 'Value points'],
  ['reviews', 'Reviews'],
  ['instagram', 'Social gallery'],
  ['newsletter', 'Newsletter'],
];

export function AdminContent() {
  const [sections, setSections] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/sections', { cache: 'no-store' });
    if (res.ok) setSections((await res.json()).sections);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const payload = {
      key: editing.key, type: editing.type, title: editing.title, subtitle: editing.subtitle, eyebrow: editing.eyebrow,
      image: editing.image || editing.image_url, ctaLabel: editing.cta_label, ctaHref: editing.cta_href,
      config: typeof editing.config === 'string' ? safeJson(editing.config) : editing.config,
      position: Number(editing.position) || 0, isActive: editing.is_active !== false,
    };
    const res = await fetch(editing.id ? `/api/admin/sections/${editing.id}` : '/api/admin/sections', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not save section', 'error'); return; }
    toast('Section saved');
    setEditing(null);
    load();
  }

  async function toggle(s) {
    const res = await fetch(`/api/admin/sections/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !s.is_active }),
    });
    if (res.ok) { setSections((list) => list.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x))); toast(s.is_active ? 'Hidden' : 'Published'); }
  }

  async function move(id, direction) {
    const idx = sections.findIndex((s) => s.id === id);
    const swap = sections[idx + direction];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/sections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: swap.position }) }),
      fetch(`/api/admin/sections/${swap.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: sections[idx].position }) }),
    ]);
    load();
  }

  async function remove(s) {
    if (!confirm(`Delete the “${s.title || s.key}” section?`)) return;
    await fetch(`/api/admin/sections/${s.id}`, { method: 'DELETE' });
    toast('Section deleted');
    load();
  }

  async function upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) setEditing((e) => ({ ...e, image_url: data.url }));
    else toast(data.error || 'Upload failed', 'error');
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Homepage</h1><p>Reorder, edit and publish storefront sections. No code changes needed.</p></div>
        <button className="btn btn-sm" onClick={() => setEditing({ key: '', type: 'banner', title: '', subtitle: '', eyebrow: '', position: sections.length, is_active: true, config: {} })}><Plus size={13} /> Add section</button>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="drag-list">
          {sections.map((s, i) => (
            <div className="drag-item" key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
              <span className="grip"><GripVertical size={14} /></span>
              {s.image_url && <Image src={s.image_url} alt="" width={44} height={34} style={{ borderRadius: 5, objectFit: 'cover' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{s.title || TYPES.find(([t]) => t === s.type)?.[1] || s.key}</strong>
                <small>{s.type} · #{s.position} · {s.is_active ? 'published' : 'hidden'}</small>
              </div>
              <button className="icon-btn" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="Move up" style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button className="icon-btn" onClick={() => move(s.id, 1)} disabled={i === sections.length - 1} aria-label="Move down" style={{ opacity: i === sections.length - 1 ? 0.3 : 1 }}>↓</button>
              <button className="icon-btn" onClick={() => toggle(s)} aria-label="Toggle visibility">{s.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <button className="icon-btn" onClick={() => setEditing({ ...s, config: JSON.stringify(s.config || {}, null, 2) })} aria-label="Edit"><Pencil size={14} /></button>
              <button className="icon-btn" onClick={() => remove(s)} aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
          {!loading && sections.length === 0 && <p className="empty-state">No sections yet.</p>}
        </div>
      </div>

      {editing && (
        <div className="modal" data-open="true">
          <div className="modal-scrim" onClick={() => setEditing(null)} />
          <div className="modal-panel" style={{ width: 'min(620px,100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 19 }}>{editing.id ? 'Edit section' : 'New section'}</h3>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {!editing.id && (
                <div className="form-row">
                  <div className="field"><label>Key (unique)</label><input className="input" value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="spring-promo" /></div>
                  <div className="field"><label>Type</label>
                    <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                      {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="field"><label>Eyebrow</label><input className="input" value={editing.eyebrow || ''} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} /></div>
              <div className="field"><label>Heading</label><input className="input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="field"><label>Body text</label><textarea className="input" rows={3} value={editing.subtitle || ''} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} /></div>
              <div className="form-row">
                <div className="field"><label>Button label</label><input className="input" value={editing.cta_label || ''} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} /></div>
                <div className="field"><label>Button link</label><input className="input" value={editing.cta_href || ''} onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })} placeholder="/collections/new-arrivals" /></div>
              </div>
              <div className="field">
                <label>Image</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {editing.image_url && <Image src={editing.image_url} alt="" width={70} height={50} style={{ borderRadius: 6, objectFit: 'cover' }} />}
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    <Upload size={12} /> Upload
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                  <input className="input" placeholder="or paste an image URL" value={editing.image_url || ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="field"><label>Position</label><input className="input" type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: e.target.value })} /></div>
              <details style={{ marginBottom: 14 }}>
                <summary className="sub" style={{ fontSize: 11.5, cursor: 'pointer', marginBottom: 6 }}>Advanced settings (JSON — e.g. product source, limits, stats)</summary>
                <textarea className="input" rows={6} value={typeof editing.config === 'string' ? editing.config : JSON.stringify(editing.config || {}, null, 2)} onChange={(e) => setEditing({ ...editing, config: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 11 }} />
              </details>
              <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Published</label>
              <button className="btn btn-block" onClick={save}>{editing.id ? 'Save section' : 'Create section'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
