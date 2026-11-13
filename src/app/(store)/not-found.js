import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <section className="section wrap" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="eyebrow">404</div>
        <h1 style={{ fontSize: 'clamp(34px,6vw,58px)', margin: '10px 0 12px' }}>We couldn&rsquo;t find that page.</h1>
        <p className="muted" style={{ maxWidth: 420, margin: '0 auto 26px' }}>
          The link may be old or the product may have moved. Everything else is still right where you left it.
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/shop" className="btn">Browse the shop</Link>
          <Link href="/" className="btn btn-outline">Back home</Link>
        </div>
      </div>
    </section>
  );
}
