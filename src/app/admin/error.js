'use client';

import { useEffect } from 'react';

export default function AdminRouteError({ error, reset }) {
  useEffect(() => {
    // Next.js records the server exception; this client log carries only its opaque digest.
    console.error('Admin route rendering failed', error?.digest || 'no-digest');
  }, [error]);

  return (
    <section className="panel" role="alert" style={{ maxWidth: 760, margin: '32px auto', padding: 24 }}>
      <div className="eyebrow">Admin workspace</div>
      <h1 style={{ margin: '8px 0' }}>This admin section could not load</h1>
      <p className="sub">The authenticated admin session has not been cleared. Retry this section; other admin routes remain available.</p>
      {error?.digest && <p className="sub">Error reference: <code>{error.digest}</code></p>}
      <button type="button" className="btn" onClick={() => reset()}>Retry section</button>
    </section>
  );
}
