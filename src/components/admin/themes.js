'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Check, RotateCcw, Eye, FileText } from '../icons';
import { FONT_OPTIONS } from '@/lib/typography';

export function AdminThemes() {
  const [palettes, setPalettes] = useState([]);
  const [current, setCurrent] = useState('moonstone');
  const [selected, setSelected] = useState('moonstone');
  const [allowOverride, setAllowOverride] = useState(true);
  const [allowFontOverride, setAllowFontOverride] = useState(true);
  const [fonts, setFonts] = useState({ heading: 'Cormorant Garamond', body: 'Inter' });
  const [saving, setSaving] = useState(false);
  const theme = palettes.find((t) => t.slug === selected) || palettes[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/themes', { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load themes');
        const d = await res.json();
        const list = d.builtin || d.themes || [];
        setPalettes(list);
        const active = d.settings?.palette || 'moonstone';
        setCurrent(active); setSelected(active);
        setAllowOverride(d.settings?.allow_customer_override !== false);
        setAllowFontOverride(d.settings?.allow_customer_font_override !== false);
        setFonts(d.settings?.fonts || { heading: list.find((t) => t.slug === active)?.font || 'Cormorant Garamond', body: 'Inter' });
      } catch { toast('Could not load theme library', 'error'); }
    })();
  }, []);

  async function save(palette = selected, override = allowOverride, nextFonts = fonts, fontOverride = allowFontOverride) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/themes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palette, allowCustomerOverride: override, allowCustomerFontOverride: fontOverride, fonts: nextFonts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save theme');
      setCurrent(palette); setSelected(palette); setAllowOverride(override); setAllowFontOverride(fontOverride); setFonts(nextFonts);
      toast('Store-wide theme updated');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  function colorsOf(t) { return t?.colors || {}; }

  return (
    <div>
      <div className="page-head">
        <div><h1>Appearance studio</h1><p>Preview a complete visual system, then apply it as the storefront default. Customer overrides remain private.</p></div>
        <button className="btn btn-outline btn-sm" onClick={() => { const defaultFonts={heading:'Cormorant Garamond',body:'Inter'}; setFonts(defaultFonts); save('moonstone',allowOverride,defaultFonts,allowFontOverride); }} disabled={saving}><RotateCcw size={13} /> Reset to default</button>
      </div>

      <div className="panel theme-preview-panel" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div className="panel-head"><div><h3>Live preview</h3><div className="sub">Preview only — live shoppers see no change until you apply.</div></div><span className="pill delivered"><Check size={11} /> Active: {palettes.find((t) => t.slug === current)?.name || current}</span></div>
        {theme && <ThemeMock theme={theme} fonts={fonts} />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => save(selected)} disabled={saving}>{saving ? 'Applying…' : selected === current ? 'Save appearance' : `Apply ${theme?.name || 'theme'}`}</button>
          <label className="switch" style={{ marginLeft: 8 }}>
            <input type="checkbox" checked={allowOverride} onChange={(e) => { const value = e.target.checked; setAllowOverride(value); save(current, value); }} />
            Allow personal customer themes
          </label>
          <label className="switch" style={{ marginLeft: 8 }}><input type="checkbox" checked={allowFontOverride} onChange={(e) => { const value=e.target.checked; setAllowFontOverride(value); save(current,allowOverride,fonts,value); }} />Allow personal font choices</label>
        </div>
        <div className="theme-font-controls">
          <label><span>Heading font</span><select className="input" value={fonts.heading} onChange={(e)=>setFonts((f)=>({...f,heading:e.target.value}))}>{FONT_OPTIONS.map(([name,label])=><option key={name} value={name}>{label}</option>)}</select></label>
          <label><span>Body font</span><select className="input" value={fonts.body} onChange={(e)=>setFonts((f)=>({...f,body:e.target.value}))}>{FONT_OPTIONS.map(([name,label])=><option key={name} value={name}>{label}</option>)}</select></label>
          <span className="theme-type-sample" style={{fontFamily:`'${fonts.heading}', Georgia, serif`}}>Aa — NOVA / {fonts.heading}</span>
        </div>
      </div>

      <div className="theme-grid theme-library-grid">
        {palettes.map((t) => {
          const c = colorsOf(t);
          return <article key={t.slug} className="theme-card-v2" data-selected={t.slug === selected} data-active={t.slug === current}>
            <button type="button" className="theme-card-preview" data-style={t.style || 'editorial'} onClick={() => { setSelected(t.slug); setFonts({heading:t.font || 'Inter',body:'Inter'}); }} aria-label={`Preview ${t.name}`} style={{ background: c.bg, color: c.ink }}>
              <div className="theme-mini-nav" style={{ background: c.surface, borderColor: c.line }}><b style={{ fontFamily: `'${t.font || 'Inter'}', Georgia, serif` }}>NOVA</b><span style={{ background: c.accent, color: c.accentInk }}>SHOP</span></div>
              <div className="theme-mini-copy"><span style={{ color: c.muted }}>CURATED FOR EVERYDAY</span><strong style={{ fontFamily: `'${t.font || 'Inter'}', Georgia, serif` }}>Made to matter.</strong><i style={{ background: c.accent }} /></div>
              <div className="theme-mini-product" style={{ background: `linear-gradient(140deg, ${c.surface2}, ${c.accentSoft})`, borderColor: c.line }}><span style={{ background: c.accent, color: c.accentInk }}>−20%</span><b style={{ color: c.ink }}>◒</b></div>
              <div className="theme-mini-review" style={{ background: c.surface, borderColor: c.line, color: c.ink }}><span style={{ color: c.accent }}>★★★★★</span><small style={{ color: c.muted }}>Thoughtfully made. ★ verified</small></div>
              <div className="theme-swatches">{[c.accent,c.accentSoft,c.bg,c.surface,c.ink].map((color,i)=><i key={i} style={{background:color,borderColor:c.line}} />)}</div>
            </button>
            <div className="theme-card-info"><div><strong>{t.name}</strong><small>{t.description}</small></div>{t.slug === current && <span className="pill delivered"><Check size={10}/> Active</span>}</div>
            <div className="theme-card-actions"><span className="theme-font-label"><FileText size={12}/>{t.font || 'Inter'} · {t.style}</span><button className="btn btn-outline btn-sm" onClick={() => { setSelected(t.slug); setFonts({heading:t.font || 'Inter',body:'Inter'}); }}><Eye size={12}/>{selected === t.slug ? 'Previewing' : 'Preview'}</button></div>
          </article>;
        })}
      </div>
    </div>
  );
}

function ThemeMock({ theme, fonts }) {
  const c = theme.colors || {};
  return <div className="theme-live-mock" data-style={theme.style || 'editorial'} style={{background:c.bg,color:c.ink,borderColor:c.line}}>
    <div className="theme-live-top" style={{background:c.surface,borderColor:c.line}}><b>NOVA</b><span>New season</span><span>Collections</span><span>Account</span><button style={{background:c.accent,color:c.accentInk}}>Shop now</button></div>
    <div className="theme-live-body"><div><small style={{color:c.muted}}>THE CONSIDERED EDIT</small><h2 style={{fontFamily:`'${fonts.heading}', Georgia, serif`}}>Everything, considered.</h2><p style={{color:c.muted}}>A preview of the theme's typography, surfaces, product cards and buttons.</p><button style={{background:c.accent,color:c.accentInk}}>Discover the edit</button></div><div className="theme-live-tile" style={{background:`linear-gradient(145deg,${c.surface2},${c.accentSoft})`,borderColor:c.line}}><span style={{background:c.surface,color:c.ink}}>NOVA / OBJECTS</span></div></div>
  </div>;
}
