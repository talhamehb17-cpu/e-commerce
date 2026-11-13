import Link from 'next/link';
export const metadata = { title: 'Not found' };
export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: '#f7f2ea', color: '#16130f' }}>
      <div>
        <p style={{ letterSpacing: '.28em', fontSize: 10, textTransform: 'uppercase', color: '#b08d4f' }}>Error 404</p>
        <h1 style={{ fontSize: 'clamp(30px,6vw,52px)', margin: '12px 0' }}>This page has moved on.</h1>
        <p style={{ color: '#6d6459', marginBottom: 26 }}>Check the address, or start again from the storefront.</p>
        <Link href="/" style={{ padding: '13px 26px', borderRadius: 999, background: '#16130f', color: '#fffdf8', textDecoration: 'none' }}>Return to NOVA</Link>
      </div>
    </main>
  );
}
