'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Save, Upload, KeyRound, ShieldCheck } from '../icons';

export function AdminProfile() {
  const [admin, setAdmin] = useState(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/profile', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setAdmin(d.admin); setName(d.admin.name || ''); setAvatar(d.admin.avatar_url || ''); }
    })();
  }, []);

  async function patch(body, msg) {
    const res = await fetch('/api/admin/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) { toast(d.error || 'Could not save', 'error'); return false; }
    toast(msg);
    return true;
  }

  async function upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'avatars');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (res.ok) { setAvatar(d.url); patch({ avatar: d.url }, 'Photo updated'); }
    else toast(d.error || 'Upload failed', 'error');
  }

  if (!admin) return <div className="panel">Loading…</div>;

  return (
    <div>
      <div className="page-head"><div><h1>My account</h1><p>Your admin profile and password.</p></div></div>
      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><h3>Profile</h3><span className="pill delivered"><ShieldCheck size={11} /> {admin.role}</span></div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            {avatar ? <img src={avatar} alt="" width={54} height={54} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span className="avatar" style={{ width: 54, height: 54, fontSize: 20 }}>{name[0] || 'A'}</span>}
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={12} /> Change photo
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Email</label><input className="input" value={admin.email} disabled /></div>
          <p className="sub" style={{ fontSize: 11 }}>Joined {new Date(admin.created_at).toLocaleDateString('en-GB')} · last sign-in {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString('en-GB') : '—'}</p>
          <button className="btn" onClick={() => patch({ name }, 'Profile saved')}><Save size={13} /> Save profile</button>
        </div>

        <div className="panel">
          <div className="panel-head"><h3><KeyRound size={15} /> Password</h3></div>
          <div className="field"><label>Current password</label><input className="input" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div className="field"><label>New password (12+ characters)</label><input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
          <div className="field"><label>Confirm new password</label><input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          <button
            className="btn"
            onClick={async () => {
              if (pw.newPassword.length < 12) return toast('Use at least 12 characters', 'error');
              if (pw.newPassword !== pw.confirm) return toast('Passwords do not match', 'error');
              const ok = await patch({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }, 'Password changed');
              if (ok) setPw({ currentPassword: '', newPassword: '', confirm: '' });
            }}
          >Update password</button>
          <div className="notice" style={{ marginTop: 16, fontSize: 11.5 }}>
            Passwords are hashed with scrypt and never stored or logged in plain text. Other active admin sessions are revoked after a password change.
          </div>
        </div>
      </div>
    </div>
  );
}
