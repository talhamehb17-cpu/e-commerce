'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from './icons';

function activeNow(p, now) {
  if (!p || p.enabled === false || !p.title || !p.body) return false;
  const start = p.starts_at ? Date.parse(`${String(p.starts_at).slice(0,10)}T00:00:00Z`) : null;
  const end = p.ends_at ? Date.parse(`${String(p.ends_at).slice(0,10)}T23:59:59.999Z`) : null;
  return (!start || now >= start) && (!end || now <= end);
}

export function PromotionPopups({ popups = [] }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (pathname?.startsWith('/admin')) { setCurrent(null); return; }
    const now = Date.now();
    const eligible = popups.filter((p) => activeNow(p, now)).sort((a,b) => Number(b.priority || 0) - Number(a.priority || 0));
    const candidate = eligible.find((p) => {
      try { return Number(localStorage.getItem(`nova-popup-until:${p.id}`) || 0) <= now; }
      catch { return true; }
    });
    if (!candidate) return;
    const delay = Math.max(0, Math.min(120, Number(candidate.delay_seconds) || 0)) * 1000;
    const timer = setTimeout(() => setCurrent(candidate), delay);
    return () => clearTimeout(timer);
  }, [popups, pathname]);

  function dismiss() {
    if (current) {
      const days = Math.max(1, Math.min(365, Number(current.frequency_days) || 7));
      try { localStorage.setItem(`nova-popup-until:${current.id}`, String(Date.now() + days * 86400000)); } catch { /* storage may be unavailable */ }
    }
    setCurrent(null);
  }
  if (pathname?.startsWith('/admin') || !current) return null;
  const href = typeof current.cta_url === 'string' && current.cta_url.startsWith('/') && !current.cta_url.startsWith('//') ? current.cta_url : '/shop';
  return <div className="promo-popup-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
    <section className="promo-popup" role="dialog" aria-modal="true" aria-labelledby="promo-popup-title">
      <button className="promo-popup-close" aria-label="Close promotion" onClick={dismiss}><X size={18} /></button>
      <div className="eyebrow">A note from NOVA</div>
      <h2 id="promo-popup-title">{current.title}</h2>
      <p>{current.body}</p>
      <div className="promo-popup-actions"><Link className="btn" href={href} onClick={dismiss}>{current.cta_label || 'Discover more'}</Link><button className="btn btn-ghost" onClick={dismiss}>Maybe later</button></div>
    </section>
  </div>;
}
