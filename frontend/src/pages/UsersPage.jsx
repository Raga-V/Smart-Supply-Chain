import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { orgAPI } from '../services/api';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Users, UserPlus, Shield, X, Copy, Check, Link, RefreshCw, Mail } from 'lucide-react';
import './UsersPage.css';

const ROLE_COLORS = {
  admin:         { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
  manager:       { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7' },
  analyst:       { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  fleet_manager: { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  driver:        { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
};

function RoleBadge({ role }) {
  const style = ROLE_COLORS[role] || ROLE_COLORS.analyst;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'capitalize',
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
    }}>
      <Shield size={10} /> {role?.replace('_', ' ')}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={doCopy} className="btn btn-ghost btn-sm" title="Copy to clipboard"
      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
      {copied ? <><Check size={12} style={{ color: '#16a34a' }} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
    </button>
  );
}

export default function UsersPage() {
  const { userProfile, isAdmin } = useAuth();
  const canManage = isAdmin || userProfile?.role === 'admin';
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [form,        setForm]        = useState({ email: '', role: 'manager', display_name: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [dataSource, setDataSource]   = useState('loading'); // 'firestore' | 'api' | 'loading'
  const unsubRef = useRef(null);

  // PRIMARY: Real-time Firestore listener for users collection
  useEffect(() => {
    if (!userProfile?.orgId) {
      // No orgId — fallback to REST API
      loadViaRest();
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('org_id', '==', userProfile.orgId),
      limit(200)
    );

    unsubRef.current = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        uid: d.id, // uid is the doc ID
        ...d.data(),
      }));
      if (docs.length > 0) {
        setUsers(docs);
        setDataSource('firestore');
        setLoading(false);
      } else {
        // Firestore returned 0 users — try REST API as fallback
        loadViaRest();
      }
    }, (err) => {
      console.warn('Firestore users listener failed:', err);
      // Firestore failed (possibly index issue) — fallback to REST
      loadViaRest();
    });

    return () => unsubRef.current?.();
  }, [userProfile?.orgId]);

  // FALLBACK: REST API — try configured URL, then local backend
  const loadViaRest = async () => {
    setLoading(true);
    try {
      const r = await orgAPI.listUsers();
      const apiUsers = r.data.users || [];
      if (apiUsers.length > 0 || dataSource !== 'firestore') {
        setUsers(apiUsers);
        setDataSource('api');
      }
    } catch (err) {
      console.warn('REST API users fetch failed:', err?.message || err);
      // Try local backend as last resort
      try {
        const { auth: fbAuth } = await import('../config/firebase');
        const token = fbAuth.currentUser ? await fbAuth.currentUser.getIdToken() : null;
        if (token) {
          const localRes = await fetch('http://localhost:8000/api/organizations/users', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (localRes.ok) {
            const data = await localRes.json();
            const localUsers = data.users || [];
            if (localUsers.length > 0) {
              setUsers(localUsers);
              setDataSource('api');
              setLoading(false);
              return;
            }
          }
        }
      } catch { /* local backend not available */ }
      if (users.length === 0) {
        setUsers([]);
        setDataSource('api');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!form.email) { setError('Email is required'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await orgAPI.inviteUser(form);
      setInviteResult({
        email: form.email,
        role: form.role,
        display_name: form.display_name,
        invite_link: res.data.invite_link,
        uid: res.data.uid,
      });
      setShowInvite(false);
      setForm({ email: '', role: 'manager', display_name: '' });
      // onSnapshot will auto-update, but also trigger REST refresh
      setTimeout(() => loadViaRest(), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invite failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="users-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1><Users size={22} className="icon" /> Team Members</h1>
          <p className="users-subtitle">{users.length} member{users.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={loadViaRest} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => { setShowInvite(!showInvite); setInviteResult(null); }}>
              {showInvite ? <><X size={14} /> Cancel</> : <><UserPlus size={14} /> Invite User</>}
            </button>
          )}
        </div>
      </div>

      {/* Data source indicator */}
      <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.6875rem',color: dataSource === 'firestore' ? 'var(--risk-low)' : 'var(--text-muted)',marginBottom:'0.5rem'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background: dataSource === 'firestore' ? 'var(--risk-low)' : 'var(--text-muted)',animation: dataSource === 'firestore' ? 'pulse 1.5s infinite' : 'none',display:'inline-block'}}/>
        {dataSource === 'firestore' ? 'Real-time sync active' : dataSource === 'api' ? 'Loaded from API' : 'Loading…'}
      </div>

      {/* Read-only notice for non-admin */}
      {!canManage && (
        <div className="alert-banner alert-banner-info" style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}>
          <Users size={14} style={{ flexShrink: 0 }} />
          <span>You're viewing your organization's team directory. Contact an Admin to manage members.</span>
        </div>
      )}

      {/* Invite Result Banner */}
      {inviteResult && (
        <div className="invite-success-banner animate-fade-in">
          <div className="invite-success-icon">✓</div>
          <div style={{ flex: 1 }}>
            <div className="invite-success-title">
              {inviteResult.display_name || inviteResult.email} invited as <strong>{inviteResult.role.replace('_', ' ')}</strong>
            </div>
            {inviteResult.invite_link ? (
              <div className="invite-link-box">
                <Link size={12} style={{ flexShrink: 0, color: '#4f46e5' }} />
                <span className="invite-link-text">{inviteResult.invite_link}</span>
                <CopyButton text={inviteResult.invite_link} />
              </div>
            ) : (
              <p className="invite-link-note">
                The user was created in Firebase. Share their email ({inviteResult.email}) and ask them to use "Forgot Password" on the login page to set their password.
              </p>
            )}
            <p className="invite-link-note">
              Share this link with the user so they can set their password and log in.
            </p>
          </div>
          <button onClick={() => setInviteResult(null)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Invite Form — only for admin */}
      {canManage && showInvite && (
        <div className="glass-card animate-fade-in" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="invite-form-header">
            <UserPlus size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>Invite a new team member</span>
          </div>
          <p className="invite-form-note">
            A Firebase account will be created and a password-setup link will be generated for the user to activate their account.
          </p>

          {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="invite-form-grid">
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.display_name}
                onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="analyst">Analyst</option>
                <option value="fleet_manager">Fleet Manager</option>
                <option value="driver">Driver</option>
              </select>
            </div>
          </div>

          <div className="alert-banner alert-banner-info" style={{ fontSize: '0.8125rem', marginTop: '1rem' }}>
            <Mail size={14} style={{ flexShrink: 0 }} />
            <span>
              After inviting, share the generated <strong>password setup link</strong> with the user.
              They click it, set a password, and can immediately log in.
            </span>
          </div>

          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleInvite} disabled={submitting}>
            {submitting ? <><span className="loader-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Inviting…</> : <><UserPlus size={14} /> Send Invite</>}
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <Users size={40} className="empty-icon" />
            <h3 style={{ marginTop: '0.75rem', fontSize: '0.9375rem' }}>No team members found</h3>
            <p>{canManage ? 'Invite your first team member using the button above.' : 'No members are visible yet. Ask your admin to verify team setup.'}</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={loadViaRest}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {canManage && <th>Invite Link</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.uid || u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="user-avatar" style={{
                        background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]?.color || '#4f46e5'}, #6366f1)`,
                      }}>
                        {(u.display_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {u.display_name || (u.email ? u.email.split('@')[0] : 'Unknown')}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{u.email || '—'}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-low' : 'badge-medium'}`}>
                      {u.status || 'invited'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      {u.invite_link ? (
                        <CopyButton text={u.invite_link} />
                      ) : u.status === 'active' ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--risk-low)' }}>✓ Active</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
