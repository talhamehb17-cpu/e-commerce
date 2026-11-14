'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Save, Mail, Store, Truck, CreditCard, Bell, Database, ShieldCheck } from '../icons';

const TABS = [
  ['store', 'Store', Store],
  ['shipping', 'Shipping & tax', Truck],
  ['payments', 'Payments', CreditCard],
  ['email', 'Email', Mail],
  ['notifications', 'Notifications', Bell],
  ['seasonal', 'Seasonal effects', Bell],
  ['promotions', 'Promotions & popups', Bell],
  ['system', 'System', Database],
];

export function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [meta, setMeta] = useState({});
  const [tab, setTab] = useState('store');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setSettings(d.settings); setMeta(d); }
    })();
  }, []);

  if (!settings) return <div className="panel">Loading settings…</div>;

  const set = (group, key, value) => setSettings((s) => ({ ...s, [group]: { ...s[group], [key]: value } }));
  const setPopup = (id, patch) => setSettings((s) => ({ ...s, promotions: { ...s.promotions, popups: (s.promotions?.popups || []).map((p) => p.id === id ? { ...p, ...patch } : p) } }));

  async function save(group) {
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: group, value: settings[group] }),
    });
    setSaving(false);
    if (res.ok) toast('Settings saved'); else toast('Could not save settings', 'error');
  }

  async function testEmail() {
    setTesting(true);
    const res = await fetch('/api/admin/email-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await res.json();
    setTesting(false);
    if (res.ok) toast(`Test email sent to ${d.to}`); else toast(d.error || 'Send failed', 'error');
  }

  const s = settings;
  const whatsappDigits = String(s.store?.whatsapp || '').replace(/\D/g, '');
  const whatsappInvalid = Boolean(whatsappDigits) && (whatsappDigits.length < 8 || whatsappDigits.length > 15);

  return (
    <div>
      <div className="page-head">
        <div><h1>Store settings</h1><p>Branding, delivery rules, payment methods and integrations.</p></div>
      </div>

      <div className="tabs">
        {TABS.filter(([k]) => k !== 'email' || meta.isOwner).map(([k, label, Icon]) => (
          <button key={k} data-on={tab === k ? 'true' : 'false'} onClick={() => setTab(k)}><Icon size={13} /> {label}</button>
        ))}
      </div>

      {tab === 'store' && (
        <div className="panel">
          <div className="form-row">
            <div className="field"><label>Store name</label><input className="input" value={s.store.name} onChange={(e) => set('store', 'name', e.target.value)} /></div>
            <div className="field"><label>Tagline</label><input className="input" value={s.store.tagline} onChange={(e) => set('store', 'tagline', e.target.value)} /></div>
          </div>
          <div className="field"><label>Announcement bar</label><input className="input" value={s.store.announcement} onChange={(e) => set('store', 'announcement', e.target.value)} /></div>
          <div className="form-row"><div className="field"><label>Show announcement from (optional)</label><input className="input" type="date" value={s.store.announcement_starts_at || ''} onChange={(e)=>set('store','announcement_starts_at',e.target.value)} /></div><div className="field"><label>Show announcement through (optional)</label><input className="input" type="date" value={s.store.announcement_ends_at || ''} onChange={(e)=>set('store','announcement_ends_at',e.target.value)} /></div></div>
          <div className="form-row">
            <div className="field"><label>Support email</label><input className="input" type="email" value={s.store.email} onChange={(e) => set('store', 'email', e.target.value)} /></div>
            <div className="field"><label>Phone</label><input className="input" value={s.store.phone} onChange={(e) => set('store', 'phone', e.target.value)} /></div>
          </div>
          <div className="field"><label>Address</label><input className="input" value={s.store.address} onChange={(e) => set('store', 'address', e.target.value)} /></div>
          <div className="form-row">
            <div className="field"><label>Instagram URL</label><input className="input" value={s.store.instagram || ''} onChange={(e) => set('store', 'instagram', e.target.value)} /></div>
            <div className="field"><label>Facebook URL</label><input className="input" value={s.store.facebook || ''} onChange={(e) => set('store', 'facebook', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>TikTok URL</label><input className="input" value={s.store.tiktok || ''} onChange={(e) => set('store', 'tiktok', e.target.value)} /></div>
            <div className="field"><label>WhatsApp number</label><input className="input" type="tel" inputMode="tel" autoComplete="tel" value={s.store.whatsapp || ''} onChange={(e) => set('store', 'whatsapp', e.target.value)} aria-describedby="whatsapp-number-help" /><small id="whatsapp-number-help" className="sub" style={whatsappInvalid ? { color: '#b4453a' } : undefined}>{whatsappInvalid ? 'Enter 8–15 digits including the country calling code, or clear the field.' : 'Include the country calling code. Leave blank to hide the floating contact button.'}</small></div>
          </div>
          <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={Boolean(s.store.maintenance)} onChange={(e) => set('store', 'maintenance', e.target.checked)} /> Maintenance mode (hide storefront)</label>
          <button className="btn" onClick={() => save('store')} disabled={saving || whatsappInvalid}><Save size={13} /> {saving ? 'Saving…' : 'Save store details'}</button>
        </div>
      )}

      {tab === 'shipping' && (
        <div className="panel">
          <div className="form-row">
            <div className="field"><label>Free shipping over (PKR)</label><input className="input" type="number" value={s.shipping.free_threshold / 100} onChange={(e) => set('shipping', 'free_threshold', Number(e.target.value) * 100)} /></div>
            <div className="field"><label>Flat rate (PKR)</label><input className="input" type="number" value={s.shipping.flat_rate / 100} onChange={(e) => set('shipping', 'flat_rate', Number(e.target.value) * 100)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Express rate (PKR)</label><input className="input" type="number" value={s.shipping.express_rate / 100} onChange={(e) => set('shipping', 'express_rate', Number(e.target.value) * 100)} /></div>
            <div className="field"><label>Tax percent</label><input className="input" type="number" step="0.1" value={s.shipping.tax_percent} onChange={(e) => set('shipping', 'tax_percent', Number(e.target.value))} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Delivery estimate</label><input className="input" value={s.shipping.delivery_days} onChange={(e) => set('shipping', 'delivery_days', e.target.value)} /></div>
            <div className="field"><label>Return window (days)</label><input className="input" type="number" value={s.shipping.return_window_days} onChange={(e) => set('shipping', 'return_window_days', Number(e.target.value))} /></div>
          </div>
          <div className="panel-head" style={{ marginTop: 18 }}><h3>Delivery confirmation reminders</h3></div>
          <div className="field" style={{ maxWidth: 240 }}><label>Reminder interval (minutes)</label><input className="input" type="number" min="1" max="1440" value={s.delivery?.reminder_minutes ?? 5} onChange={(e) => set('delivery', 'reminder_minutes', Math.max(1, Number(e.target.value)))} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={() => save('shipping')}><Save size={13} /> Save shipping</button><button className="btn btn-outline" onClick={() => save('delivery')}><Save size={13} /> Save reminders</button></div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="panel">
          <label className="switch" style={{ marginBottom: 12 }}><input type="checkbox" checked={Boolean(s.payments.cod)} onChange={(e) => set('payments', 'cod', e.target.checked)} /> Cash on delivery</label>
          <label className="switch" style={{ marginBottom: 12 }}><input type="checkbox" checked={Boolean(s.payments.bank_transfer)} onChange={(e) => set('payments', 'bank_transfer', e.target.checked)} /> Bank transfer</label>
          <div className="field"><label>Bank details shown at checkout</label><textarea className="input" rows={4} value={s.payments.bank_details || ''} onChange={(e) => set('payments', 'bank_details', e.target.value)} /></div>
          <div className="form-row">
            <div className="field"><label>EasyPaisa number</label><input className="input" value={s.payments.easypaisa || ''} onChange={(e) => set('payments', 'easypaisa', e.target.value)} /></div>
            <div className="field"><label>JazzCash number</label><input className="input" value={s.payments.jazzcash || ''} onChange={(e) => set('payments', 'jazzcash', e.target.value)} /></div>
          </div>
          <button className="btn" onClick={() => save('payments')}><Save size={13} /> Save payments</button>
        </div>
      )}

      {tab === 'email' && (
        <>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head"><h3>Sender identity</h3>
              <span className={`pill ${meta.emailConfigured ? 'delivered' : 'pending'}`}>{meta.emailConfigured ? 'SMTP connected' : 'SMTP missing'}</span>
            </div>
            <div className="form-row">
              <div className="field"><label>From name</label><input className="input" value={s.email.from_name} onChange={(e) => set('email', 'from_name', e.target.value)} /></div>
              <div className="field"><label>Reply-to address</label><input className="input" value={s.email.from_email || ''} onChange={(e) => set('email', 'from_email', e.target.value)} placeholder="falls back to support email" /></div>
            </div>
            <label className="switch" style={{ marginBottom: 10 }}><input type="checkbox" checked={Boolean(s.email.order_updates)} onChange={(e) => set('email', 'order_updates', e.target.checked)} /> Send order status emails</label>
            <label className="switch" style={{ marginBottom: 10 }}><input type="checkbox" checked={Boolean(s.email.welcome)} onChange={(e) => set('email', 'welcome', e.target.checked)} /> Send welcome email on registration</label>
            <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={Boolean(s.email.notify_admin)} onChange={(e) => set('email', 'notify_admin', e.target.checked)} /> Notify admin of new orders</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => save('email')}><Save size={13} /> Save email settings</button>
              <button className="btn btn-outline" onClick={testEmail} disabled={testing}>{testing ? 'Sending…' : 'Send test email'}</button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Automated emails</h3></div>
            <div className="chips">
              {['Welcome', 'Verify email OTP', 'Password reset', 'Order placed', 'Order confirmed', 'Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Refund issued'].map((t) => <span key={t} className="chip" data-on="true">{t}</span>)}
            </div>
            <p className="sub" style={{ fontSize: 11.5 }}>Templates are branded automatically and logged in <code>email_logs</code> with delivery status.</p>
          </div>
        </>
      )}

      {tab === 'notifications' && (
        <div className="panel">
          <div className="panel-head"><h3>Visitor analytics</h3></div>
          <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={Boolean(s.analytics.track_visitors)} onChange={(e) => set('analytics', 'track_visitors', e.target.checked)} /> Track page views and unique visitors</label>
          <button className="btn" onClick={() => save('analytics')}><Save size={13} /> Save analytics</button>
        </div>
      )}

      {tab === 'seasonal' && (
        <div className="panel">
          <div className="panel-head"><div><h3>Seasonal atmosphere</h3><p className="sub">Decorative storefront-only effects. They never capture clicks and are disabled for reduced-motion visitors.</p></div></div>
          <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={Boolean(s.seasonal?.enabled)} onChange={(e) => set('seasonal', 'enabled', e.target.checked)} /> Enable seasonal effects</label>
          <label className="switch" style={{ marginBottom: 14, display: 'flex' }}><input type="checkbox" checked={Boolean(s.seasonal?.automatic)} onChange={(e) => set('seasonal', 'automatic', e.target.checked)} /> Choose season automatically by calendar</label>
          <div className="form-row">
            <div className="field"><label>Season / effect</label><select className="input" value={s.seasonal?.season || 'none'} disabled={s.seasonal?.automatic} onChange={(e) => set('seasonal', 'season', e.target.value)}>{['none','spring','summer','autumn','winter','rain','confetti','festive'].map((v) => <option key={v} value={v}>{v.replace(/^./, (x) => x.toUpperCase())}</option>)}</select></div>
            <div className="field"><label>Intensity ({s.seasonal?.intensity ?? 35}%)</label><input className="input" type="range" min="10" max="90" value={s.seasonal?.intensity ?? 35} onChange={(e) => set('seasonal', 'intensity', Number(e.target.value))} /></div>
          </div>
          <div className="field" style={{ maxWidth: 300 }}><label>Animation speed ({s.seasonal?.speed ?? 2}×)</label><input className="input" type="range" min="0.6" max="5" step="0.2" value={s.seasonal?.speed ?? 2} onChange={(e) => set('seasonal', 'speed', Number(e.target.value))} /></div>
          <div className="form-row"><div className="field"><label>Schedule starts (optional)</label><input className="input" type="date" value={s.seasonal?.starts_at || ''} onChange={(e)=>set('seasonal','starts_at',e.target.value)} /></div><div className="field"><label>Schedule ends (optional)</label><input className="input" type="date" value={s.seasonal?.ends_at || ''} onChange={(e)=>set('seasonal','ends_at',e.target.value)} /></div></div>
          <div className="seasonal-demo" aria-hidden="true">{(s.seasonal?.season === 'winter' ? '❄ ✧ ❄' : s.seasonal?.season === 'autumn' ? '🍂 ❧ 🍂' : s.seasonal?.season === 'summer' ? '✦ ☼ ✦' : s.seasonal?.season === 'none' ? 'Preview disabled' : '✿ ❀ ✿')}</div>
          <button className="btn" onClick={() => save('seasonal')}><Save size={13} /> Save seasonal effects</button>
        </div>
      )}

      {tab === 'promotions' && (
        <div className="panel">
          <div className="panel-head"><div><h3>Priority-aware promotional popups</h3><p className="sub">Scheduled campaigns are stored in settings. If multiple are eligible, the highest priority is shown first.</p></div><button className="btn btn-sm" onClick={() => set('promotions', 'popups', [...(s.promotions?.popups || []), { id: `popup-${Date.now()}`, enabled: true, title: '', body: '', cta_label: 'Shop now', cta_url: '/shop', priority: 0, starts_at: '', ends_at: '', delay_seconds: 4, frequency_days: 7 }])}>Add popup</button></div>
          {(s.promotions?.popups || []).map((p, index) => <article key={p.id} className="popup-admin-card">
            <div className="panel-head"><strong>Campaign {index + 1}</strong><button className="btn btn-outline btn-sm" onClick={() => set('promotions','popups',(s.promotions?.popups || []).filter((x)=>x.id!==p.id))}>Remove</button></div>
            <label className="switch"><input type="checkbox" checked={p.enabled !== false} onChange={(e)=>setPopup(p.id,{enabled:e.target.checked})} /> Enabled</label>
            <div className="form-row"><div className="field"><label>Popup title</label><input className="input" maxLength={120} value={p.title || ''} onChange={(e)=>setPopup(p.id,{title:e.target.value})} /></div><div className="field"><label>Priority (higher wins)</label><input className="input" type="number" min="0" max="1000" value={p.priority ?? 0} onChange={(e)=>setPopup(p.id,{priority:Number(e.target.value)})} /></div></div>
            <div className="field"><label>Message</label><textarea className="input" rows={3} maxLength={500} value={p.body || ''} onChange={(e)=>setPopup(p.id,{body:e.target.value})} /></div>
            <div className="form-row"><div className="field"><label>Button label</label><input className="input" maxLength={40} value={p.cta_label || ''} onChange={(e)=>setPopup(p.id,{cta_label:e.target.value})} /></div><div className="field"><label>Button link (internal path)</label><input className="input" value={p.cta_url || '/shop'} onChange={(e)=>setPopup(p.id,{cta_url:e.target.value})} /></div></div>
            <div className="form-row"><div className="field"><label>Starts on</label><input className="input" type="date" value={p.starts_at || ''} onChange={(e)=>setPopup(p.id,{starts_at:e.target.value})} /></div><div className="field"><label>Ends on</label><input className="input" type="date" value={p.ends_at || ''} onChange={(e)=>setPopup(p.id,{ends_at:e.target.value})} /></div></div>
            <div className="form-row"><div className="field"><label>Initial delay (seconds)</label><input className="input" type="number" min="0" max="120" value={p.delay_seconds ?? 4} onChange={(e)=>setPopup(p.id,{delay_seconds:Math.max(0,Math.min(120,Number(e.target.value)))})} /></div><div className="field"><label>Show again after (days)</label><input className="input" type="number" min="1" max="365" value={p.frequency_days ?? 7} onChange={(e)=>setPopup(p.id,{frequency_days:Math.max(1,Math.min(365,Number(e.target.value)))})} /></div></div>
          </article>)}
          {!(s.promotions?.popups || []).length && <p className="sub">No popup campaigns configured.</p>}
          <button className="btn" onClick={() => save('promotions')} disabled={saving}><Save size={13} /> {saving ? 'Saving…' : 'Save popup campaigns'}</button>
        </div>
      )}

      {tab === 'system' && (
        <div className="panel">
          <div className="panel-head"><h3><ShieldCheck size={15} /> Connection status</h3></div>
          <div className="summary-row"><span>Database</span><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{meta.dbHost || '—'}</span></div>
          <div className="summary-row"><span>Object storage</span><span className={`pill ${meta.storageConfigured ? 'delivered' : 'pending'}`}>{meta.storageConfigured ? 'Connected' : 'Not configured'}</span></div>
          {meta.isOwner && <div className="summary-row"><span>SMTP</span><span className={`pill ${meta.emailConfigured ? 'delivered' : 'pending'}`}>{meta.emailConfigured ? 'Connected' : 'Not configured'}</span></div>}
          <div className="summary-row"><span>Base currency</span><span>{s.currency.default} (rates auto-refresh: {s.currency.auto_update ? 'on' : 'off'})</span></div>
          <p className="sub" style={{ fontSize: 11.5, marginTop: 12 }}>
            SMTP credentials are encrypted server-side and never sent to the browser. Configure the dedicated SMTP_CREDENTIALS_KEY on the server.
          </p>
        </div>
      )}
    </div>
  );
}
