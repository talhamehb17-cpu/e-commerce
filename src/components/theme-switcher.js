'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './providers';
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!theme.allowOverride) return null;

  return (
    <>
      <button ref={openerRef} type="button" className="icon-btn floating-theme-trigger" onClick={() => setOpen(true)} aria-label="Change appearance" title="Appearance"><Palette size={18} /></button>
      <div className="modal appearance-modal" data-appearance-dialog data-open={open} aria-hidden={!open} inert={!open} role="dialog" aria-modal="true" aria-labelledby="appearance-title">
        <div className="modal-scrim" onClick={closeDialog} />
        <div className="modal-panel appearance-panel">
          <div className="appearance-dialog-head">
            <div>
              <div className="eyebrow">Appearance</div>
              <h3 id="appearance-title">Choose your style</h3>
            </div>
            <button ref={closeRef} className="icon-btn appearance-close" onClick={closeDialog} aria-label="Close appearance dialog"><X size={20} /></button>
          </div>
          <div className="appearance-dialog-body">
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
              {customer
                ? 'Your choice is saved to your account and only affects your experience.'
                : 'Sign in to keep your palette across devices. Guests save locally in this browser.'}
            </p>
            <div className="appearance-theme-grid">
              {theme.themes?.map((t) => {
                const on = t.slug === theme.slug;
                return (
                  <button
                    key={t.slug}
                    className="appearance-theme-option"
                    data-selected={on}
                    onClick={() => { setTheme(t.slug); closeDialog(); }}
                  >
                    <span className="appearance-theme-swatches">
                      {(Array.isArray(t.swatch) ? t.swatch : ['#f7f2ea', '#c8a96a', '#16130f']).map((c, i) => (
                        <i key={i} style={{ background: c }} />
                      ))}
                    </span>
                    <span className="appearance-theme-name">{t.name}</span>
                    {on && <Check className="appearance-theme-check" size={16} />}
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
            {theme.source === 'customer' && (
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
