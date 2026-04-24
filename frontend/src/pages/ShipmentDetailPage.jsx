import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shipmentAPI, riskAPI, streamingAPI } from '../services/api';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft, MapPin, Package, Truck, Train, Ship, Plane,
  Shield, RefreshCw, Send, Clock, CheckCircle, AlertTriangle,
  FileText, Navigation, Weight, Calendar, User, Play, Square,
  Zap, Wind, Activity, Radio, ChevronDown, ChevronRight
} from 'lucide-react';

const RISK_COLORS = { low: 'var(--risk-low)', medium: 'var(--risk-medium)', high: 'var(--risk-high)', critical: 'var(--risk-critical)' };
const MODE_ICONS = { truck: Truck, rail: Train, ship: Ship, air: Plane };
const STATUS_ORDER = ['draft', 'pending', 'in_transit', 'delivered'];

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [gpsTrack, setGpsTrack] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTrack, setShowTrack] = useState(false);

  // ── Firestore real-time listener for this shipment ────────
  useEffect(() => {
    if (!id) return;

    // Initial load via API (gets org-scoped data)
    shipmentAPI.get(id)
      .then(r => { setShipment(r.data); setLoading(false); })
      .catch(() => { setError('Shipment not found'); setLoading(false); });

    // Real-time Firestore listener for live GPS updates
    const unsub = onSnapshot(doc(db, 'shipments', id), (snap) => {
      if (snap.exists()) {
        setShipment(prev => ({ ...(prev || {}), id: snap.id, ...snap.data() }));
      }
    }, () => {});

    return () => unsub();
  }, [id]);

  // Load GPS track and events
  useEffect(() => {
    if (!id) return;
    shipmentAPI.getGpsTrack(id, 50).then(r => setGpsTrack(r.data.track || [])).catch(() => {});
    shipmentAPI.getEvents(id).then(r => setEvents(r.data.events || [])).catch(() => {});
  }, [id]);

  const handleEvaluateRisk = async () => {
    setEvaluating(true);
    try {
      const res = await riskAPI.evaluate(id);
      setShipment(prev => ({ ...prev, risk_score: res.data.risk_score, risk_level: res.data.risk_level }));
    } catch { setError('Failed to evaluate risk'); }
    finally { setEvaluating(false); }
  };

  const handleDispatch = async () => {
    setDispatching(true);
    try {
      await shipmentAPI.dispatch(id);
      setShipment(prev => ({ ...prev, status: 'in_transit' }));
    } catch (err) { setError(err.response?.data?.detail || 'Failed to dispatch'); }
    finally { setDispatching(false); }
  };

  const handleStartSim = async () => {
    setSimulationLoading(true);
    try {
      await streamingAPI.start(id);
      setShipment(prev => ({ ...prev, gps_simulation_active: true, status: 'in_transit' }));
    } catch (err) { setError('Failed to start simulation'); }
    finally { setSimulationLoading(false); }
  };

  const handleStopSim = async () => {
    setSimulationLoading(true);
    try {
      await streamingAPI.stop(id);
      setShipment(prev => ({ ...prev, gps_simulation_active: false }));
    } catch { }
    finally { setSimulationLoading(false); }
  };

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '50vh' }}>
      <span className="loader-spinner" />
    </div>
  );

  if (error && !shipment) return (
    <div style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
      <AlertTriangle size={40} style={{ color: 'var(--risk-high)', marginBottom: '1rem', opacity: 0.5 }} />
      <h3>{error}</h3>
      <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/shipments')}>
        <ArrowLeft size={14} /> Back to Shipments
      </button>
    </div>
  );

  if (!shipment) return null;

  const ModeIcon = MODE_ICONS[shipment.transport_mode] || Truck;
  const currentStatusIdx = STATUS_ORDER.indexOf(shipment.status);
  const isLive = shipment.gps_simulation_active;
  const hasDisruption = shipment.disruption_active;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Package size={22} className="icon" /> Shipment Details</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{id}</p>
            {isLive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: '#22c55e', fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.4s infinite' }} />
                LIVE GPS ACTIVE
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/shipments')}><ArrowLeft size={14} /> Back</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live-tracking')}><Navigation size={14} /> Live Map</button>
          {(shipment.status === 'draft' || shipment.status === 'pending') && (
            <button className="btn btn-primary" onClick={handleDispatch} disabled={dispatching}>
              <Send size={14} /> {dispatching ? 'Dispatching…' : 'Dispatch'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Disruption banner */}
      {hasDisruption && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: 'var(--space-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8125rem', color: '#fca5a5', animation: 'fadeIn 0.3s ease' }}>
          <Wind size={16} style={{ flexShrink: 0 }} />
          <strong>Active Disruption:</strong> Vehicle experiencing delays — risk elevated. AI is computing alternatives.
        </div>
      )}

      {/* Status Timeline */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {STATUS_ORDER.map((s, i) => {
            const isActive = shipment.status === s;
            const isPast = currentStatusIdx >= 0 && i <= currentStatusIdx;
            const StatusIcon = s === 'draft' ? FileText : s === 'pending' ? Clock : s === 'in_transit' ? Truck : CheckCircle;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_ORDER.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPast ? (isActive ? 'var(--accent-primary)' : 'var(--risk-low)') : 'var(--bg-tertiary)',
                    border: `2px solid ${isPast ? (isActive ? 'var(--accent-primary)' : 'var(--risk-low)') : 'var(--border-color)'}`,
                    color: isPast ? 'white' : 'var(--text-muted)',
                    boxShadow: isActive ? '0 0 16px var(--accent-primary-glow)' : 'none',
                    position: 'relative',
                  }}>
                    <StatusIcon size={16} />
                    {isActive && isLive && (
                      <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid var(--bg-primary)', animation: 'pulse 1.5s infinite' }} />
                    )}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: isActive ? 'var(--accent-primary-light)' : 'var(--text-muted)', fontWeight: isActive ? 600 : 400, textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </span>
                </div>
                {i < STATUS_ORDER.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: isPast && i < currentStatusIdx ? 'var(--risk-low)' : 'var(--border-color)', margin: '0 0.75rem', marginBottom: '1.25rem' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* Left: Route & Cargo */}
        <div className="glass-card">
          <div className="panel-header"><h3><Navigation size={18} className="icon" /> Route & Cargo</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { label: 'Route', value: `${shipment.origin_name} → ${shipment.destination_name}`, icon: MapPin },
              { label: 'Mode', value: shipment.transport_mode, icon: ModeIcon, cap: true },
              { label: 'Cargo Type', value: shipment.cargo_type, cap: true },
              { label: 'Weight', value: `${shipment.cargo_weight_kg?.toLocaleString()} kg`, icon: Weight },
              { label: 'Priority', value: shipment.priority, badge: true },
            ].map(row => row.value && (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</span>
                {row.badge
                  ? <span className={`badge badge-${shipment.priority === 'critical' ? 'critical' : shipment.priority === 'high' ? 'high' : 'low'}`}>{row.value}</span>
                  : <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: row.cap ? 'capitalize' : undefined }}>{row.value}</span>
                }
              </div>
            ))}
            {shipment.delivery_deadline && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deadline</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={13} /> {new Date(shipment.delivery_deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Risk + GPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Risk Assessment */}
          <div className="glass-card">
            <div className="panel-header">
              <h3><Shield size={18} className="icon" /> Risk Assessment</h3>
              <button className="btn btn-sm btn-secondary" onClick={handleEvaluateRisk} disabled={evaluating}>
                <RefreshCw size={13} className={evaluating ? 'animate-spin' : ''} /> Re-evaluate
              </button>
            </div>
            {shipment.risk_score != null ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: RISK_COLORS[shipment.risk_level] || 'var(--text-primary)', lineHeight: 1.1 }}>
                    {(shipment.risk_score * 100).toFixed(1)}%
                  </div>
                  <div className={`badge badge-${shipment.risk_level}`} style={{ marginTop: '0.5rem' }}>{shipment.risk_level} risk</div>
                </div>
                <div className="risk-bar" style={{ height: 8, borderRadius: 'var(--radius-full)' }}>
                  <div className="risk-bar-fill" style={{ width: `${shipment.risk_score * 100}%`, background: RISK_COLORS[shipment.risk_level] }} />
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <Shield size={28} className="empty-icon" />
                <p>No risk evaluation yet</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={handleEvaluateRisk}>
                  Evaluate Now
                </button>
              </div>
            )}
          </div>

          {/* GPS Tracking Card */}
          <div className="glass-card">
            <div className="panel-header">
              <h3><Radio size={18} className="icon" /> GPS Tracking</h3>
              {isLive && <span style={{ fontSize: '0.6875rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />LIVE</span>}
            </div>
            {shipment.current_lat ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {[
                  { label: 'Progress', value: `${(shipment.progress_pct || 0).toFixed(1)}%` },
                  { label: 'Speed', value: shipment.current_speed_kmh ? `${shipment.current_speed_kmh} km/h` : '—' },
                  { label: 'Remaining', value: shipment.remaining_distance_km ? `${shipment.remaining_distance_km.toFixed(0)} km` : '—' },
                  { label: 'ETA', value: shipment.eta_hours ? `${shipment.eta_hours.toFixed(1)}h` : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
                {shipment.progress_pct > 0 && (
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginTop: '0.25rem' }}>
                    <div style={{ height: '100%', width: `${shipment.progress_pct}%`, background: 'var(--accent-primary)', transition: 'width 1.5s ease', borderRadius: 'var(--radius-full)' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                No GPS data yet
              </div>
            )}
            {/* Simulation controls */}
            <div style={{ marginTop: '0.875rem' }}>
              {isLive ? (
                <button className="btn btn-sm" style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                  onClick={handleStopSim} disabled={simulationLoading}>
                  {simulationLoading ? <RefreshCw size={12} className="animate-spin" /> : <Square size={12} />}
                  Stop Live GPS Simulation
                </button>
              ) : (
                <button className="btn btn-sm btn-primary" style={{ width: '100%' }}
                  onClick={handleStartSim} disabled={simulationLoading || shipment.status === 'delivered'}>
                  {simulationLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                  Start Live GPS Simulation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      {events.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="panel-header" style={{ cursor: 'pointer' }} onClick={() => setShowTrack(!showTrack)}>
            <h3><Activity size={18} className="icon" /> Disruption Events ({events.length})</h3>
            {showTrack ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          {showTrack && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {events.slice(0, 10).map(ev => (
                <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.severity === 'high' ? '#ef4444' : '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>{ev.message}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {ev.subtype} · {new Date(ev.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <span className={`badge badge-${ev.severity === 'high' ? 'high' : 'medium'}`} style={{ fontSize: '0.5625rem' }}>{ev.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GPS Breadcrumbs */}
      {gpsTrack.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="panel-header">
            <h3><MapPin size={18} className="icon" /> GPS Track ({gpsTrack.length} points)</h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Last 50 positions</span>
          </div>
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left' }}>Lat / Lng</th>
                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>Speed</th>
                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {gpsTrack.slice(-15).reverse().map((pt, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <td style={{ padding: '0.375rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                      {pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td style={{ padding: '0.375rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {pt.lat?.toFixed(4)}, {pt.lng?.toFixed(4)}
                    </td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>{pt.speed_kmh ?? '—'} km/h</td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>
                      <span style={{ color: pt.disruption ? '#ef4444' : 'var(--text-secondary)' }}>
                        {pt.progress_pct?.toFixed(1)}%{pt.disruption ? ' ⚠' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadata footer */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <User size={12} /> Created by {shipment.created_by?.substring(0, 8)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Clock size={12} /> {shipment.created_at ? new Date(shipment.created_at).toLocaleString() : '—'}
        </span>
      </div>
    </div>
  );
}
