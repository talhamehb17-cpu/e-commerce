'use client';
import { useState } from 'react';
import { toast } from './toast';
import { Send } from './icons';

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) { setSent(true); toast('Message sent — we will reply within a day'); }
    else toast('Could not send. Email us directly instead.', 'error');
  }

  if (sent) return <div className="alert ok">Thanks — your message is in our inbox. We reply within one business day.</div>;

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <div className="field"><label htmlFor="cn">Name</label><input id="cn" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="ce">Email</label><input id="ce" type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div className="field"><label htmlFor="cs">Subject</label><input id="cs" required className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
      <div className="field"><label htmlFor="cm">Message</label><textarea id="cm" required className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : <><Send size={14} /> Send message</>}</button>
    </form>
  );
}
