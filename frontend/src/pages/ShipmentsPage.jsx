import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shipmentAPI } from '../services/api';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import {
  Package, PlusCircle, Truck, Train, Ship, Plane,
  FileText, Clock, AlertTriangle, Circle, CheckCircle2, XCircle,
  RefreshCw
} from 'lucide-react';
import './ShipmentsPage.css';

const STATUS_ICONS = {
  draft: FileText, pending: Clock, in_transit: Truck,
  at_risk: AlertTriangle, delayed: Circle, delivered: CheckCircle2, cancelled: XCircle,
};
const MODE_ICONS = { truck: Truck, rail: Train, ship: Ship, air: Plane };

export default function ShipmentsPage() {
  const { userProfile } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [filter, setFilter]   = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();
  const unsubRef = useRef(null);

  // Real-time Firestore listener
  useEffect(() => {
    if (!userProfile?.orgId) {
      loadViaRest();
      return;
    }

    const q = query(
      collection(db, 'shipments'),
      where('org_id', '==', userProfile.orgId),
      limit(100)
    );

    unsubRef.current = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by created_at descending
      docs.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || new Date(a.created_at || 0);
        const bTime = b.created_at?.toDate?.() || new Date(b.created_at || 0);
        return bTime - aTime;
      });
      setShipments(docs);
      setLoading(false);
      setError('');
    }, () => {
      // Fallback to REST on Firestore error
      loadViaRest();
    });

    return () => unsubRef.current?.();
  }, [userProfile?.orgId]);

  const loadViaRest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await shipmentAPI.list({ page_size: 100 });
      setShipments(res.data.shipments || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load shipments. Check your connection.');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all'
    ? shipments
    : shipments.filter(s => s.status === filter || s.risk_level === filter);

  const count = (f) => f === 'all'
    ? shipments.length
    : shipments.filter(s => s.status === f || s.risk_level === f).length;

  return (
    <div className="shipments-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1><Package size={22} className="icon" /> Shipments</h1>
          <p className="page-subtitle">{shipments.length} total shipment{shipments.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={loadViaRest} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/shipments/new')}>
            <PlusCircle size={16} /> Create Shipment
          </button>
        </div>
      </div>

      {/* Live indicator */}
      {userProfile?.orgId && (
        <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.6875rem',color:'var(--risk-low)',marginBottom:'0.5rem'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--risk-low)',animation:'pulse 1.5s infinite',display:'inline-block'}}/>
          Real-time sync active
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all', 'in_transit', 'at_risk', 'draft', 'pending', 'delivered', 'high', 'critical'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
            <span className="filter-count">{count(f)}</span>
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card-static" style={{ padding: '1.5rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="shimmer" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="glass-card-static shipments-table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <Package size={48} className="empty-icon" />
              {shipments.length === 0 ? (
                <>
                  <h3 style={{ marginTop: '0.75rem', fontSize: '1rem' }}>No shipments yet</h3>
                  <p>Create your first shipment to get started with live tracking and risk analysis.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/shipments/new')}>
                    <PlusCircle size={14} /> Create Shipment
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: '0.75rem', fontSize: '1rem' }}>No shipments match this filter</h3>
                  <p>Try selecting a different status or risk level.</p>
                </>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Mode</th>
                  <th>Cargo</th>
                  <th>Weight</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const StatusIcon = STATUS_ICONS[s.status] || Circle;
                  const ModeIcon = MODE_ICONS[s.transport_mode] || Truck;
                  return (
                    <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)} style={{ cursor: 'pointer' }}>
                      <td><span className="shipment-id-cell">{s.id?.substring(0, 8)}</span></td>
                      <td className="route-cell">
                        <strong>{s.origin_name || '—'}</strong>
                        <span className="route-arrow">→</span>
                        <strong>{s.destination_name || '—'}</strong>
                      </td>
                      <td>
                        <span className={`status-cell status-${s.status}`}>
                          <StatusIcon size={13} /> {s.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${s.risk_level || 'low'}`}>{s.risk_level || 'low'}</span>
                        <span className="risk-score-cell">{((s.risk_score || 0) * 100).toFixed(0)}%</span>
                      </td>
                      <td>
                        <span className="mode-cell">
                          <ModeIcon size={14} /> {s.transport_mode}
                        </span>
                      </td>
                      <td className="capitalize">{s.cargo_type}</td>
                      <td className="mono-cell">{(s.cargo_weight_kg || 0).toLocaleString()} kg</td>
                      <td className="capitalize">{s.priority}</td>
                      <td className="date-cell">{s.created_at ? (() => { try { const d = s.created_at?.toDate?.() || new Date(s.created_at); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }})() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
