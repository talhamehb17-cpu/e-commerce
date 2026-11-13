'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from '../toast';
import { Plus, Trash2, X, ShieldCheck, UserCheck } from '../icons';

const ROLES = [
  ['owner', 'Owner — full access, can invite others'],
  ['manager', 'Manager — catalogue, orders, customers, content'],
  ['staff', 'Staff — orders and customers only'],
  ['viewer', 'Viewer — read only'],
];

export function AdminTeam() {
  const [team, setTeam] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [inviting, setInviting] = useState(null);
  const [me, setMe] = useState(null);
  const [showInvitePassword, setShowInvitePassword] = useState(false);

  async function load() {
    const [t, p] = await Promise.all([
      fetch('/api/admin/team', { cache: 'no-store' }),
      fetch('/api/admin/profile', { cache: 'no-store' }),
    ]);
    if (t.ok) { const d = await t.json(); setTeam(d.team); setCurrentId(d.currentId); setGroups(d.permissionGroups || []); }
    if (p.ok) setMe((await p.json()).admin);
  }
  useEffect(() => { load(); }, []);

  const isOwner = me?.role === 'owner';

  async function invite() {
    if (!inviting.name.trim() || !inviting.email.trim() || inviting.password.length < 12) return toast('Enter a name, email, and a password of at least 12 characters.', 'error');
    const res = await fetch('/api/admin/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inviting),
    });
    const d = await res.json();
    if (!res.ok) return toast(d.error || 'Could not add teammate', 'error');
    toast('Team member added — share their password securely.');
    setInviting(null); load();
  }

  async function patch(id, body, msg) {
    const res = await fetch('/api/admin/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const d = await res.json();
    if (!res.ok) return toast(d.error || 'Could not update', 'error');
    toast(msg); load();
  }

  async function remove(id) {
    if (!confirm('Remove this admin? Their sessions end immediately.')) return;
    const res = await fetch(`/api/admin/team?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!res.ok) return toast(d.error || 'Could not remove', 'error');
    toast('Admin removed'); load();
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Team & permissions</h1><p>Role-based access — every sensitive action is written to the audit log.</p></div>
        {isOwner && <button className="btn btn-sm" onClick={() => { setShowInvitePassword(false); setInviting({ name: '', email: '', password: '', role: 'staff', permissions: [] }); }}><Plus size={13} /> Add admin</button>}
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Admin</th><th>Role</th><th>Permissions</th><th>Last sign-in</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-prod">
                      {m.avatar_url ? <Image src={m.avatar_url} alt="" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span className="avatar" style={{ width: 30, height: 30 }}>{m.name[0]}</span>}
                      <div><strong style={{ fontSize: 12.5 }}>{m.name}{m.id === currentId ? ' (you)' : ''}</strong><div className="sub" style={{ fontSize: 10.5 }}>{m.email}</div></div>
                    </div>
                  </td>
                  <td>
                    {isOwner && m.id !== currentId ? (
                      <select className="input" style={{ width: 'auto', padding: '3px 8px', fontSize: 11.5 }} value={m.role} onChange={(e) => patch(m.id, { role: e.target.value }, 'Role updated')}>
                        {ROLES.map(([v, label]) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : <span className={`pill ${m.role === 'owner' ? 'delivered' : ''}`}><ShieldCheck size={10} /> {m.role}</span>}
                  </td>
                  <td className="sub" style={{ fontSize: 10.5 }}>{Array.isArray(m.permissions) ? (m.permissions[0] === '*' ? 'All resources' : m.permissions.join(', ') || 'role defaults') : '—'}</td>
                  <td className="sub">{m.last_login_at ? new Date(m.last_login_at).toLocaleDateString('en-GB') : 'never'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isOwner && m.id !== currentId && (
                      <button className="icon-btn" onClick={() => remove(m.id)} aria-label="Remove"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3 style={{ fontSize: 16 }}><UserCheck size={14} /> Permission scopes</h3></div>
        <div className="chips">
          {groups.map((g) => (
            <span key={g.key} className="chip" data-on="true">{g.label}: read · write</span>
          ))}
        </div>
        <p className="sub" style={{ fontSize: 11.5 }}>
          Owners have <code>*</code> access. Managers, staff, and viewers are restricted to their assigned read/write scopes.
        </p>
      </div>

      {inviting && (
        <div className="modal" data-open="true">
          <div className="modal-scrim" onClick={() => setInviting(null)} />
          <div className="modal-panel" style={{ width: 'min(460px,100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 19 }}>Add an admin</h3>
              <button className="icon-btn" onClick={() => setInviting(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="field"><label>Name</label><input className="input" value={inviting.name} onChange={(e) => setInviting({ ...inviting, name: e.target.value })} /></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={inviting.email} onChange={(e) => setInviting({ ...inviting, email: e.target.value })} /></div>
              <div className="field"><label>Temporary password</label><div className="password-input-wrap"><input className="input" type={showInvitePassword ? 'text' : 'password'} minLength={12} autoComplete="new-password" value={inviting.password} onChange={(e) => setInviting({ ...inviting, password: e.target.value })} placeholder="at least 12 characters" /><button type="button" aria-label={showInvitePassword ? 'Hide password' : 'Show password'} aria-pressed={showInvitePassword} onClick={() => setShowInvitePassword((visible) => !visible)}>{showInvitePassword ? 'Hide' : 'Show'}</button></div></div>
              <div className="field">
                <label>Role</label>
                <select className="input" value={inviting.role} onChange={(e) => setInviting({ ...inviting, role: e.target.value })}>
                  {ROLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Extra permission scopes</label>
                <div className="chips">
                  {groups.map((g) => {
                    const on = inviting.permissions.includes(`${g.key}:write`);
                    return (
                      <button key={g.key} className="chip" data-on={on ? 'true' : 'false'}
                        onClick={() => setInviting({ ...inviting, permissions: on ? inviting.permissions.filter((p) => p !== `${g.key}:write`) : [...inviting.permissions, `${g.key}:write`] })}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-block" onClick={invite}>Add team member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
