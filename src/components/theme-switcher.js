'use client';
import { useEffect, useState } from 'react';
import { useStore, applyPalette } from './providers';
import { Palette, X, Check } from './icons';

export function ThemeSwitcher() {
  const { theme, customer, setTheme } = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (customer) return;
    const saved = localStorage.getItem('nova_theme');
    if (saved && saved !== theme.slug) applyPalette(saved);
  }, [customer, theme.slug]);

  if (!theme.allowOverride) return null;

  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Change appearance" title="Appearance"><Palette size={18} /></button>
      <div className="modal" data-open={open} aria-hidden={!open} role="dialog" aria-label="Appearance">
        <div className="modal-scrim" onClick={() => setOpen(false)} />
        <div className="modal-panel" style={{ width: 'min(520px,100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="eyebrow">Appearance</div>
              <h3 style={{ fontSize: 22, marginTop: 2 }}>Choose your palette</h3>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div style={{ padding: 22 }}>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
              {customer
                ? 'Your choice is saved to your account and only affects your experience.'
                : 'Sign in to keep your palette across devices. Guests save locally in this browser.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {theme.themes?.map((t) => {
                const on = t.slug === theme.slug;
                return (
                  <button
                    key={t.slug}
                    onClick={() => { setTheme(t.slug); setOpen(false); }}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--surface)', textAlign: 'left' }}
                  >
                    <span style={{ display: 'flex' }}>
                      {(Array.isArray(t.swatch) ? t.swatch : ['#f7f2ea', '#c8a96a', '#16130f']).map((c, i) => (
                        <i key={i} style={{ width: 15, height: 15, borderRadius: '50%', background: c, marginLeft: i ? -4 : 0, border: '1px solid rgba(0,0,0,.12)' }} />
                      ))}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{t.name}</span>
                    {on && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
            {customer && theme.source === 'customer' && (
              <button className="btn btn-outline btn-block btn-sm" style={{ marginTop: 14 }} onClick={async () => { await setTheme(null); setOpen(false); }}>
                Reset to store default
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
