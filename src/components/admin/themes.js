'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Check } from '../icons';

export function AdminThemes() {
  const [palettes, setPalettes] = useState([]);
  const [current, setCurrent] = useState('moonstone');
  const [allowOverride, setAllowOverride] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/themes', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const list = (d.builtin || d.themes || []).map((t) => ({ ...t, swatch: t.swatch || Object.values(t.colors || {}).slice(0, 3) }));
        setPalettes(list);
        setCurrent(d.settings?.palette || 'moonstone');
        setAllowOverride(d.settings?.allow_customer_override !== false);
      }
    })();
  }, []);

  async function save(palette) {
    setSaving(true);
    const res = await fetch('/api/admin/themes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette, allowCustomerOverride: allowOverride }),
    });
    setSaving(false);
    if (res.ok) { setCurrent(palette); toast('Store theme updated'); }
    else toast('Could not save theme', 'error');
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Appearance</h1><p>The palette you pick becomes the default for every visitor. Customers may override it personally.</p></div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <label className="switch">
          <input type="checkbox" checked={allowOverride} onChange={(e) => { setAllowOverride(e.target.checked); save(current); }} />
          Allow customers to choose their own palette
        </label>
        <p className="sub" style={{ fontSize: 11.5, marginTop: 8 }}>
          A customer's choice is stored on their account and never changes the global store theme.
        </p>
      </div>

      <div className="theme-grid">
        {palettes.map((t) => (
          <button key={t.slug} className="theme-card" data-on={t.slug === current ? 'true' : 'false'} onClick={() => save(t.slug)} disabled={saving}>
            <div className="swatch-row">
              {(t.swatch || []).map((c, i) => <span key={i} style={{ background: c }} />)}
            </div>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
            <div className="theme-meta">
              <span className="pill">{t.mode || 'light'}</span>
              {t.slug === current && <span className="pill delivered"><Check size={10} /> Active</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
