import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentAPI } from '../services/api';
import {
  Package, PlusCircle, Truck, Train, Ship, Plane,
  FileText, Clock, AlertTriangle, Circle, CheckCircle2, XCircle
} from 'lucide-react';
import './ShipmentsPage.css';

const DEMO_SHIPMENTS = [
  { id: 'SHP-001', origin_name: 'Mumbai', destination_name: 'Delhi', status: 'in_transit', risk_level: 'low', risk_score: 0.23, transport_mode: 'truck', cargo_type: 'general', cargo_weight_kg: 5000, priority: 'normal', created_at: '2026-04-22T10:00:00Z' },
  { id: 'SHP-002', origin_name: 'Chennai', destination_name: 'Bangalore', status: 'in_transit', risk_level: 'high', risk_score: 0.78, transport_mode: 'truck', cargo_type: 'perishable', cargo_weight_kg: 2000, priority: 'high', created_at: '2026-04-22T09:00:00Z' },
  { id: 'SHP-003', origin_name: 'Kolkata', destination_name: 'Hyderabad', status: 'at_risk', risk_level: 'critical', risk_score: 0.91, transport_mode: 'rail', cargo_type: 'hazardous', cargo_weight_kg: 15000, priority: 'critical', created_at: '2026-04-21T14:00:00Z' },
  { id: 'SHP-004', origin_name: 'Pune', destination_name: 'Ahmedabad', status: 'in_transit', risk_level: 'medium', risk_score: 0.52, transport_mode: 'truck', cargo_type: 'fragile', cargo_weight_kg: 800, priority: 'normal', created_at: '2026-04-22T06:00:00Z' },
  { id: 'SHP-005', origin_name: 'Jaipur', destination_name: 'Lucknow', status: 'delivered', risk_level: 'low', risk_score: 0.15, transport_mode: 'truck', cargo_type: 'bulk', cargo_weight_kg: 20000, priority: 'low', created_at: '2026-04-20T08:00:00Z' },
  { id: 'SHP-006', origin_name: 'Surat', destination_name: 'Nagpur', status: 'draft', risk_level: 'low', risk_score: 0.30, transport_mode: 'rail', cargo_type: 'general', cargo_weight_kg: 10000, priority: 'normal', created_at: '2026-04-22T12:00:00Z' },
];

const STATUS_ICONS = { draft: FileText, pending: Clock, in_transit: Truck, at_risk: AlertTriangle, delayed: Circle, delivered: CheckCircle2, cancelled: XCircle };
const MODE_ICONS = { truck: Truck, rail: Train, ship: Ship, air: Plane };

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState(DEMO_SHIPMENTS);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadShipments(); }, []);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const res = await shipmentAPI.list({ page_size: 50 });
      if (res.data.shipments?.length) setShipments(res.data.shipments);
    } catch { /* keep demo data */ }
    finally { setLoading(false); }
  };

  const filtered = filter === 'all' ? shipments : shipments.filter(s => s.status === filter || s.risk_level === filter);

  return (
    <div className="shipments-page animate-fade-in">
      <div className="page-header">
        <h1><Package size={22} className="icon" /> Shipments</h1>
        <button className="btn btn-primary" onClick={() => navigate('/shipments/new')}><PlusCircle size={16} /> Create Shipment</button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all', 'in_transit', 'at_risk', 'draft', 'delivered', 'high', 'critical'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
            <span className="filter-count">{f === 'all' ? shipments.length : shipments.filter(s => s.status === f || s.risk_level === f).length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <td><strong>{s.origin_name}</strong> → <strong>{s.destination_name}</strong></td>
                  <td><span className="status-cell"><StatusIcon size={13} /> {s.status?.replace('_', ' ')}</span></td>
                  <td>
                    <span className={`badge badge-${s.risk_level}`}>{s.risk_level}</span>
                    <span className="risk-score-cell">{((s.risk_score || 0) * 100).toFixed(0)}%</span>
                  </td>
                  <td style={{display:'flex',alignItems:'center',gap:'0.375rem'}}><ModeIcon size={14} /> {s.transport_mode}</td>
                  <td className="capitalize">{s.cargo_type}</td>
                  <td>{s.cargo_weight_kg?.toLocaleString()} kg</td>
                  <td className="capitalize">{s.priority}</td>
                  <td className="text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><Package size={32} className="empty-icon" /><p>No shipments found</p></div>}
      </div>
    </div>
  );
}
