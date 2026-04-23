import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { orgAPI } from '../services/api';

export default function OrganizationPage() {
  const { userProfile } = useAuth();
  const [org, setOrg] = useState({ name: 'Loading...', industry: '', country: 'India', member_count: 0, shipment_count: 0 });

  useEffect(() => {
    orgAPI.get().then(r => setOrg(r.data)).catch(() => setOrg({ name: userProfile?.orgName || 'My Organization', industry: 'logistics', country: 'India', member_count: 4, shipment_count: 47 }));
  }, []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header"><h1>⚙️ Organization Settings</h1></div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Organization Details</h3>
        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={org.name} readOnly /></div>
          <div className="form-group"><label className="form-label">Industry</label><input className="form-input" value={org.industry || ''} readOnly style={{ textTransform: 'capitalize' }} /></div>
          <div className="form-group"><label className="form-label">Country</label><input className="form-input" value={org.country || ''} readOnly /></div>
          <div className="form-group"><label className="form-label">Status</label><input className="form-input" value="Active" readOnly style={{ color: 'var(--risk-low)' }} /></div>
        </div>
      </div>

      <div className="grid grid-2 stagger-children">
        <div className="glass-card metric-card" style={{ textAlign: 'center' }}>
          <div className="metric-value">{org.member_count}</div>
          <div className="metric-label">Team Members</div>
        </div>
        <div className="glass-card metric-card" style={{ textAlign: 'center' }}>
          <div className="metric-value">{org.shipment_count}</div>
          <div className="metric-label">Total Shipments</div>
        </div>
      </div>
    </div>
  );
}
