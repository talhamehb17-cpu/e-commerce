'use client';
import { useState } from 'react';
import { toast } from './toast';
import { ArrowRight } from './icons';

export function NewsletterForm({ dark = true }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/newsletter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) { toast('You are on the list'); setEmail(''); }
    else toast('Please enter a valid email', 'error');
  }

  return (
    <form className="nl-form" onSubmit={submit} style={dark ? undefined : { background: 'var(--surface2)', borderColor: 'var(--line)' }}>
      <input
        type="email" required placeholder="Email address" value={email}
        onChange={(e) => setEmail(e.target.value)} aria-label="Email address"
        style={dark ? undefined : { color: 'var(--ink)' }}
      />
      <button className="btn" disabled={busy} aria-label="Subscribe" style={{ padding: '10px 16px' }}>
        {busy ? '…' : <ArrowRight size={15} />}
      </button>
    </form>
  );
}
