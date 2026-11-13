'use client';
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f7f2ea', color: '#16130f', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 10 }}>NOVA is briefly unavailable</h1>
          <p style={{ color: '#6d6459', marginBottom: 22 }}>Please retry in a moment.</p>
          <button onClick={reset} style={{ padding: '12px 22px', borderRadius: 999, border: 'none', background: '#16130f', color: '#fffdf8' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
