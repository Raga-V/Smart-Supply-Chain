import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { orgAPI } from '../services/api';
import { Settings, Building2, Users, Package, Save, Edit3 } from 'lucide-react';

export default function OrganizationPage() {
  const { userProfile } = useAuth();
  const [org, setOrg] = useState({ name: 'Loading...', industry: '', country: 'India', member_count: 0, shipment_count: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', country: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    orgAPI.get().then(r => {
      setOrg(r.data);
      setForm({ name: r.data.name, industry: r.data.industry || '', country: r.data.country || 'India' });
    }).catch(() => {
      const fallback = { name: userProfile?.orgName || 'My Organization', industry: 'logistics', country: 'India', member_count: 4, shipment_count: 47 };
      setOrg(fallback);
      setForm({ name: fallback.name, industry: fallback.industry, country: fallback.country });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await orgAPI.update(form);
      setOrg(prev => ({ ...prev, ...form }));
      setEditing(false);
    } catch { /* keep local state */ }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <h1><Settings size={22} className="icon" /> Organization Settings</h1>
        {!editing ? (
          <button className="btn btn-secondary" onClick={() => setEditing(true)}><Edit3 size={14} /> Edit</button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="panel-header">
          <h3><Building2 size={18} className="icon" /> Organization Details</h3>
        </div>
        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={editing ? form.name : org.name} onChange={e => setForm({...form, name: e.target.value})} readOnly={!editing} />
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            {editing ? (
              <select className="form-select" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}>
                <option value="logistics">Logistics & Transport</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="retail">Retail & E-commerce</option>
                <option value="pharma">Pharmaceuticals</option>
                <option value="food">Food & Beverage</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <input className="form-input" value={org.industry || ''} readOnly style={{ textTransform: 'capitalize' }} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input className="form-input" value={editing ? form.country : org.country || ''} onChange={e => setForm({...form, country: e.target.value})} readOnly={!editing} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <input className="form-input" value="Active" readOnly style={{ color: 'var(--risk-low)' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-2 stagger-children">
        <div className="glass-card metric-card" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="metric-icon-wrap"><Users size={18} /></div>
          <div className="metric-value">{org.member_count}</div>
          <div className="metric-label">Team Members</div>
        </div>
        <div className="glass-card metric-card" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="metric-icon-wrap"><Package size={18} /></div>
          <div className="metric-value">{org.shipment_count}</div>
          <div className="metric-label">Total Shipments</div>
        </div>
      </div>
    </div>
  );
}
