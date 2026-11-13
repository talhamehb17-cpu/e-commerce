'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore, applyPalette } from './providers';
import { Palette, X, Check } from './icons';
import { FONT_OPTIONS, DEFAULT_FONTS } from '@/lib/typography';

export function ThemeSwitcher() {
  const { theme, customer, setTheme, setFonts } = useStore();
  const [open, setOpen] = useState(false);
  const [fontDraft, setFontDraft] = useState(theme.fonts || DEFAULT_FONTS);
  const openerRef = useRef(null);
  const closeRef = useRef(null);

  function closeDialog() {
    setOpen(false);
    openerRef.current?.focus();
  }

  useEffect(() => {
    setFontDraft(theme.fonts || DEFAULT_FONTS);
  }, [theme.fonts?.heading, theme.fonts?.body]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog();
      if (event.key === 'Tab') {
        const items = [...(event.currentTarget.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled])'))];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const dialog = document.querySelector('[data-appearance-dialog]');
    dialog?.addEventListener('keydown', onKeyDown);
    return () => dialog?.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (customer) return;
    const saved = localStorage.getItem('nova_theme');
    if (saved && saved !== theme.slug) applyPalette(saved);
  }, [customer, theme.slug]);

  if (!theme.allowOverride) return null;

  return (
    <>
      <button ref={openerRef} className="icon-btn" onClick={() => setOpen(true)} aria-label="Change appearance" title="Appearance"><Palette size={18} /></button>
      <div className="modal" data-appearance-dialog data-open={open} aria-hidden={!open} role="dialog" aria-modal="true" aria-labelledby="appearance-title">
        <div className="modal-scrim" onClick={closeDialog} />
        <div className="modal-panel" style={{ width: 'min(520px,100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="eyebrow">Appearance</div>
              <h3 id="appearance-title" style={{ fontSize: 22, marginTop: 2 }}>Choose your palette</h3>
            </div>
            <button ref={closeRef} className="icon-btn" onClick={closeDialog} aria-label="Close appearance dialog"><X size={18} /></button>
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
                    onClick={() => { setTheme(t.slug); closeDialog(); }}
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
            {theme.allowFontOverride && (
              <div className="personal-font-panel">
                <div className="eyebrow">Typography</div>
                <div className="form-row" style={{ marginTop: 8 }}>
                  <label className="field"><span>Headings</span><select className="input" value={fontDraft.heading} onChange={(e) => setFontDraft((f) => ({ ...f, heading: e.target.value }))}>{FONT_OPTIONS.map(([name,label]) => <option key={name} value={name}>{label}</option>)}</select></label>
                  <label className="field"><span>Body</span><select className="input" value={fontDraft.body} onChange={(e) => setFontDraft((f) => ({ ...f, body: e.target.value }))}>{FONT_OPTIONS.map(([name,label]) => <option key={name} value={name}>{label}</option>)}</select></label>
                </div>
                <p className="personal-font-sample" style={{ fontFamily: `'${fontDraft.heading}', Georgia, serif` }}>Considered in every detail.</p>
                <button className="btn btn-sm" onClick={() => setFonts(fontDraft,true)}>Save my typography</button>
                {theme.fontPersonal && <button className="btn btn-ghost btn-sm" onClick={() => setFonts(theme.defaultFonts || DEFAULT_FONTS,false)}>Use store typography</button>}
              </div>
            )}
            {customer && theme.source === 'customer' && (
              <button className="btn btn-outline btn-block btn-sm" style={{ marginTop: 14 }} onClick={async () => { await setTheme(null); closeDialog(); }}>
                Reset to store default
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
