import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shipmentAPI, riskAPI } from '../services/api';
import './DashboardPage.css';

// Simulated demo data for when backend is not connected
const DEMO_STATS = {
  total: 47, in_transit: 18, at_risk: 5, delivered: 22,
  delayed: 2, draft: 3, pending: 2, avg_risk_score: 0.38, on_time_rate: 0.917,
};

const DEMO_SHIPMENTS = [
  { id: 'SHP-001', origin_name: 'Mumbai', destination_name: 'Delhi', status: 'in_transit', risk_level: 'low', risk_score: 0.23, transport_mode: 'truck', cargo_type: 'general', cargo_weight_kg: 5000, created_at: new Date().toISOString() },
  { id: 'SHP-002', origin_name: 'Chennai', destination_name: 'Bangalore', status: 'in_transit', risk_level: 'high', risk_score: 0.78, transport_mode: 'truck', cargo_type: 'perishable', cargo_weight_kg: 2000, created_at: new Date().toISOString() },
  { id: 'SHP-003', origin_name: 'Kolkata', destination_name: 'Hyderabad', status: 'at_risk', risk_level: 'critical', risk_score: 0.91, transport_mode: 'rail', cargo_type: 'hazardous', cargo_weight_kg: 15000, created_at: new Date().toISOString() },
  { id: 'SHP-004', origin_name: 'Pune', destination_name: 'Ahmedabad', status: 'in_transit', risk_level: 'medium', risk_score: 0.52, transport_mode: 'truck', cargo_type: 'fragile', cargo_weight_kg: 800, created_at: new Date().toISOString() },
  { id: 'SHP-005', origin_name: 'Jaipur', destination_name: 'Lucknow', status: 'delivered', risk_level: 'low', risk_score: 0.15, transport_mode: 'truck', cargo_type: 'bulk', cargo_weight_kg: 20000, created_at: new Date().toISOString() },
];

const DEMO_ALERTS = [
  { id: 'a1', title: '⚠️ Risk Alert: Shipment at CRITICAL risk', message: 'Shipment SHP-003 has a risk score of 91%. Top factors: weather: 82%, traffic: 75%, route_complexity: 68%', severity: 'critical', created_at: new Date().toISOString(), action_required: true },
  { id: 'a2', title: '⚠️ Risk Alert: Shipment at HIGH risk', message: 'Shipment SHP-002 has a risk score of 78%. Top factors: traffic: 71%, carrier_reliability: 64%. 2 alternatives available.', severity: 'danger', created_at: new Date().toISOString(), action_required: true },
  { id: 'a3', title: 'ℹ️ Shipment delivered', message: 'Shipment SHP-005 delivered successfully. On-time.', severity: 'info', created_at: new Date().toISOString(), action_required: false },
];

const RISK_COLORS = { low: 'var(--risk-low)', medium: 'var(--risk-medium)', high: 'var(--risk-high)', critical: 'var(--risk-critical)' };

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(DEMO_STATS);
  const [shipments, setShipments] = useState(DEMO_SHIPMENTS);
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, shipmentsRes, alertsRes] = await Promise.allSettled([
        shipmentAPI.stats(),
        shipmentAPI.list({ page_size: 10 }),
        riskAPI.getAlerts(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (shipmentsRes.status === 'fulfilled') setShipments(shipmentsRes.value.data.shipments);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data.alerts);
    } catch {
      // Keep demo data on error
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="dashboard-page animate-fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{greeting()}, {userProfile?.displayName || 'Operator'}</h1>
          <p className="dashboard-subtitle">Supply Chain Intelligence Control Tower</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shipments/new')}>
          ➕ New Shipment
        </button>
      </div>

      {/* Metrics Ribbon */}
      <div className="metrics-ribbon stagger-children">
        <div className="glass-card metric-card">
          <span className="metric-icon">📦</span>
          <div className="metric-value">{stats.total}</div>
          <div className="metric-label">Total Shipments</div>
        </div>
        <div className="glass-card metric-card">
          <span className="metric-icon">🚛</span>
          <div className="metric-value">{stats.in_transit}</div>
          <div className="metric-label">In Transit</div>
        </div>
        <div className="glass-card metric-card metric-card-danger">
          <span className="metric-icon">⚠️</span>
          <div className="metric-value" style={{color: stats.at_risk > 0 ? 'var(--risk-high)' : undefined}}>{stats.at_risk}</div>
          <div className="metric-label">At Risk</div>
        </div>
        <div className="glass-card metric-card">
          <span className="metric-icon">✅</span>
          <div className="metric-value" style={{color: 'var(--risk-low)'}}>{stats.delivered}</div>
          <div className="metric-label">Delivered</div>
        </div>
        <div className="glass-card metric-card">
          <span className="metric-icon">🎯</span>
          <div className="metric-value">{(stats.on_time_rate * 100).toFixed(1)}%</div>
          <div className="metric-label">On-Time Rate</div>
        </div>
        <div className="glass-card metric-card">
          <span className="metric-icon">📉</span>
          <div className="metric-value">{(stats.avg_risk_score * 100).toFixed(0)}%</div>
          <div className="metric-label">Avg Risk Score</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Active Shipments */}
        <div className="glass-card dashboard-panel shipments-panel">
          <div className="panel-header">
            <h3>Active Shipments</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All →</button>
          </div>
          <div className="shipment-list">
            {shipments.filter(s => s.status !== 'delivered').map(s => (
              <div key={s.id} className="shipment-item" onClick={() => navigate(`/shipments/${s.id}`)}>
                <div className="shipment-route">
                  <span className="shipment-id">{s.id?.substring(0, 8)}</span>
                  <span className="route-text">{s.origin_name} → {s.destination_name}</span>
                </div>
                <div className="shipment-meta">
                  <span className={`badge badge-${s.risk_level}`}>{s.risk_level}</span>
                  <span className="shipment-mode">{s.transport_mode === 'truck' ? '🚛' : s.transport_mode === 'rail' ? '🚂' : s.transport_mode === 'ship' ? '🚢' : '✈️'}</span>
                </div>
                <div className="risk-bar">
                  <div className="risk-bar-fill" style={{
                    width: `${(s.risk_score || 0) * 100}%`,
                    background: RISK_COLORS[s.risk_level] || 'var(--accent-primary)',
                  }}></div>
                </div>
              </div>
            ))}
            {shipments.filter(s => s.status !== 'delivered').length === 0 && (
              <div className="empty-state"><p>No active shipments</p></div>
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="glass-card dashboard-panel alerts-panel">
          <div className="panel-header">
            <h3>🔔 Alerts</h3>
            <span className="badge badge-high">{alerts.filter(a => a.action_required).length} action required</span>
          </div>
          <div className="alerts-list">
            {alerts.map(alert => (
              <div key={alert.id} className={`alert-item alert-${alert.severity}`}>
                <div className="alert-title">{alert.title}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-footer">
                  <span className="alert-time">{new Date(alert.created_at).toLocaleTimeString()}</span>
                  {alert.action_required && (
                    <button className="btn btn-sm btn-primary">Take Action</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Overview */}
        <div className="glass-card dashboard-panel risk-overview">
          <div className="panel-header">
            <h3>Risk Distribution</h3>
          </div>
          <div className="risk-distribution">
            {['low', 'medium', 'high', 'critical'].map(level => {
              const count = shipments.filter(s => s.risk_level === level).length;
              const pct = shipments.length > 0 ? (count / shipments.length) * 100 : 0;
              return (
                <div key={level} className="risk-dist-item">
                  <div className="risk-dist-header">
                    <span className={`badge badge-${level}`}>{level}</span>
                    <span className="risk-dist-count">{count}</span>
                  </div>
                  <div className="risk-dist-bar">
                    <div className="risk-dist-fill" style={{
                      width: `${pct}%`,
                      background: RISK_COLORS[level],
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="risk-summary">
            <div className="risk-summary-item">
              <span className="risk-summary-label">Avg Confidence</span>
              <span className="risk-summary-value">87%</span>
            </div>
            <div className="risk-summary-item">
              <span className="risk-summary-label">Model Version</span>
              <span className="risk-summary-value">v1.0-lgbm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
