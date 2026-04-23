import { useState, useEffect } from 'react';
import { orgAPI } from '../services/api';

const DEMO_USERS = [
  { uid: 'u1', email: 'admin@acme.com', display_name: 'Jane Admin', role: 'admin', status: 'active' },
  { uid: 'u2', email: 'manager@acme.com', display_name: 'John Manager', role: 'manager', status: 'active' },
  { uid: 'u3', email: 'analyst@acme.com', display_name: 'Sara Analyst', role: 'analyst', status: 'invited' },
  { uid: 'u4', email: 'driver1@acme.com', display_name: 'Raj Driver', role: 'driver', status: 'active' },
];

const ROLE_COLORS = { admin: 'var(--accent-primary)', manager: 'var(--accent-secondary)', analyst: 'var(--risk-medium)', fleet_manager: 'var(--risk-low)', driver: 'var(--text-secondary)' };

export default function UsersPage() {
  const [users, setUsers] = useState(DEMO_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'analyst', display_name: '' });

  useEffect(() => { orgAPI.listUsers().then(r => { if (r.data.users?.length) setUsers(r.data.users); }).catch(() => {}); }, []);

  const handleInvite = async () => {
    try {
      await orgAPI.inviteUser(form);
      setShowInvite(false);
      orgAPI.listUsers().then(r => setUsers(r.data.users));
    } catch { setUsers([...users, { uid: 'new', ...form, status: 'invited' }]); setShowInvite(false); }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header"><h1>👥 Team Members</h1><button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>➕ Invite User</button></div>

      {showInvite && (
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div className="grid grid-3" style={{ gap: '1rem' }}>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" /></div>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="manager">Manager</option><option value="analyst">Analyst</option><option value="fleet_manager">Fleet Manager</option><option value="driver">Driver</option></select></div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleInvite}>Send Invite</button>
        </div>
      )}

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.uid}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]}, var(--accent-primary))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{(u.display_name || u.email)[0].toUpperCase()}</div>{u.display_name || u.email.split('@')[0]}</div></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{u.email}</td>
                <td><span style={{ color: ROLE_COLORS[u.role], fontWeight: 600, textTransform: 'capitalize' }}>{u.role?.replace('_', ' ')}</span></td>
                <td><span className={`badge ${u.status === 'active' ? 'badge-low' : 'badge-medium'}`}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
