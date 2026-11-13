'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from './icons';
import { useStore } from './providers';

export function SearchModal({ open, onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ products: [], categories: [] });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();
  const { money } = useStore();

  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; setTimeout(() => inputRef.current?.focus(), 80); }
    else { document.body.style.overflow = ''; setQ(''); setRes({ products: [], categories: [] }); }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (q.trim().length < 2) { setRes({ products: [], categories: [] }); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        setRes(await r.json());
      } catch { /* ignore */ }
      setBusy(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="modal" data-open={open} aria-hidden={!open} role="dialog" aria-label="Search">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel" style={{ width: 'min(680px,100%)', alignSelf: 'start', marginTop: '9vh' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onClose(); router.push(`/shop?q=${encodeURIComponent(q.trim())}`); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--line)' }}
        >
          <Search size={17} style={{ opacity: 0.5 }} />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, categories, brands…"
            style={{ flex: 1, border: 0, background: 'none', outline: 'none', fontSize: 16, fontFamily: 'var(--serif)' }}
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="icon-btn"><X size={17} /></button>
        </form>
        <div style={{ padding: 20, maxHeight: '62vh', overflow: 'auto' }}>
          {q.trim().length < 2 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Popular searches</div>
              <div className="chips">
                {['headphones', 'sneakers', 'lamp', 'serum', 'tote', 'new arrivals'].map((s) => (
                  <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {busy && <div className="muted" style={{ fontSize: 13 }}>Searching…</div>}
          {!busy && res.categories?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Categories</div>
              {res.categories.map((c) => (
                <Link key={c.slug} href={`/collections/${c.slug}`} onClick={onClose} style={{ display: 'block', padding: '7px 0', fontSize: 14 }}>{c.name}</Link>
              ))}
            </div>
          )}
          {!busy && res.products?.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Products</div>
              {res.products.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} onClick={onClose} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                  <div style={{ position: 'relative', width: 48, height: 60, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
                    <Image src={p.image} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div className="serif" style={{ fontSize: 17 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{p.categoryName}</div>
                  </div>
                  <div style={{ fontSize: 12.5 }}>{money(p.price)}</div>
                </Link>
              ))}
            </div>
          )}
          {!busy && q.trim().length >= 2 && res.products?.length === 0 && res.categories?.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>No matches. Try a broader term.</p>
          )}
        </div>
      </div>
    </div>
  );
}
