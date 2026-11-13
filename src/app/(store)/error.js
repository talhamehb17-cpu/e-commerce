'use client';
import Link from 'next/link';
import { useEffect } from 'react';

export default function StoreError({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section className="section wrap" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="eyebrow">Something went wrong</div>
        <h1 style={{ fontSize: 'clamp(30px,5vw,48px)', margin: '10px 0 12px' }}>That didn&rsquo;t load as expected.</h1>
        <p className="muted" style={{ maxWidth: 430, margin: '0 auto 26px' }}>
          A temporary hiccup on our side. Try again — if it keeps happening, our team is one message away.
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={reset}>Try again</button>
          <Link href="/contact" className="btn btn-outline">Contact us</Link>
        </div>
      </div>
    </section>
  );
}
