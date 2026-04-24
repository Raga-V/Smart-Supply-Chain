import { useState } from 'react';
import { digitalTwinAPI } from '../services/api';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import {
  FlaskConical, Play, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Truck, Train, Ship, Plane, RefreshCw, Info,
  Target, Zap, Shield
} from 'lucide-react';

const CITY_PAIRS = [
  { origin: 'Mumbai', destination: 'Delhi', origin_lat: 19.076, origin_lng: 72.877, destination_lat: 28.613, destination_lng: 77.209 },
  { origin: 'Chennai', destination: 'Bangalore', origin_lat: 13.082, origin_lng: 80.270, destination_lat: 12.971, destination_lng: 77.594 },
  { origin: 'Kolkata', destination: 'Hyderabad', origin_lat: 22.572, origin_lng: 88.363, destination_lat: 17.385, destination_lng: 78.486 },
  { origin: 'Pune', destination: 'Ahmedabad', origin_lat: 18.520, origin_lng: 73.856, destination_lat: 23.022, destination_lng: 72.571 },
  { origin: 'Delhi', destination: 'Lucknow', origin_lat: 28.613, origin_lng: 77.209, destination_lat: 26.846, destination_lng: 80.946 },
  { origin: 'Jaipur', destination: 'Mumbai', origin_lat: 26.912, origin_lng: 75.787, destination_lat: 19.076, destination_lng: 72.877 },
];

const MODE_ICONS = { truck: Truck, rail: Train, ship: Ship, air: Plane };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,14,39,0.95)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: '0.5rem' }}>
          <span>{p.name}:</span><strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function DigitalTwinPage() {
  const [form, setForm] = useState({
    origin_name: 'Mumbai', destination_name: 'Delhi',
    origin_lat: 19.076, origin_lng: 72.877,
    destination_lat: 28.613, destination_lng: 77.209,
    transport_mode: 'truck', cargo_type: 'general',
    cargo_weight_kg: 5000, delivery_deadline_days: 3,
    n_scenarios: 200,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCityPair = (e) => {
    const idx = parseInt(e.target.value);
    if (idx >= 0) setForm(prev => ({ ...prev, ...CITY_PAIRS[idx] }));
  };

  const runSimulation = async () => {
    setLoading(true); setError('');
    try {
      const res = await digitalTwinAPI.simulate(form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Simulation failed. Check API connection.');
    } finally { setLoading(false); }
  };

  const recColor = result?.recommendation === 'PROCEED' ? '#22c55e'
    : result?.recommendation === 'CAUTION' ? '#f59e0b' : '#ef4444';

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><FlaskConical size={22} className="icon" /> Digital Twin Simulator</h1>
          <p className="page-subtitle">Monte Carlo pre-dispatch simulation — run 200 stochastic scenarios before committing a shipment</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '320px 1fr' : '1fr', gap: 'var(--space-lg)' }}>
        {/* ── Config Panel ── */}
        <div className="glass-card" style={{ alignSelf: 'start' }}>
          <div className="panel-header"><h3><Target size={16} className="icon" /> Simulation Setup</h3></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* City pair shortcut */}
            <div className="form-group">
              <label className="form-label">Route Preset</label>
              <select className="form-select" onChange={handleCityPair} defaultValue="">
                <option value="">— custom —</option>
                {CITY_PAIRS.map((p, i) => (
                  <option key={i} value={i}>{p.origin} → {p.destination}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Origin</label>
              <input className="form-input" value={form.origin_name} onChange={e => setForm(p => ({ ...p, origin_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Destination</label>
              <input className="form-input" value={form.destination_name} onChange={e => setForm(p => ({ ...p, destination_name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Transport Mode</label>
              <select className="form-select" value={form.transport_mode} onChange={e => setForm(p => ({ ...p, transport_mode: e.target.value }))}>
                <option value="truck">Truck</option>
                <option value="rail">Rail</option>
                <option value="ship">Ship</option>
                <option value="air">Air</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cargo Type</label>
              <select className="form-select" value={form.cargo_type} onChange={e => setForm(p => ({ ...p, cargo_type: e.target.value }))}>
                <option value="general">General</option>
                <option value="perishable">Perishable</option>
                <option value="hazardous">Hazardous</option>
                <option value="fragile">Fragile</option>
                <option value="bulk">Bulk</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input type="number" className="form-input" value={form.cargo_weight_kg} min={100} max={50000} onChange={e => setForm(p => ({ ...p, cargo_weight_kg: +e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Deadline (days)</label>
              <input type="number" className="form-input" value={form.delivery_deadline_days} min={1} max={30} onChange={e => setForm(p => ({ ...p, delivery_deadline_days: +e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Scenarios: {form.n_scenarios}</label>
              <input type="range" min={50} max={500} step={50} value={form.n_scenarios} onChange={e => setForm(p => ({ ...p, n_scenarios: +e.target.value }))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
            </div>

            {error && <div style={{ fontSize: '0.75rem', color: '#ef4444', padding: '0.5rem', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>{error}</div>}

            <button className="btn btn-primary" onClick={runSimulation} disabled={loading} style={{ width: '100%', marginTop: '0.25rem' }}>
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Running {form.n_scenarios} scenarios…</> : <><Play size={14} /> Run Simulation</>}
            </button>
          </div>
        </div>

        {/* ── Results Panel ── */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Recommendation banner */}
            <div style={{
              padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)',
              background: `${recColor}15`, border: `1px solid ${recColor}40`,
              display: 'flex', alignItems: 'center', gap: '0.875rem',
            }}>
              {result.recommendation === 'PROCEED' ? <CheckCircle size={24} style={{ color: recColor, flexShrink: 0 }} />
                : result.recommendation === 'CAUTION' ? <AlertTriangle size={24} style={{ color: recColor, flexShrink: 0 }} />
                : <AlertTriangle size={24} style={{ color: recColor, flexShrink: 0 }} />}
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: recColor }}>{result.recommendation}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>{result.recommendation_detail}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: recColor }}>{(result.on_time_probability * 100).toFixed(0)}%</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>On-Time Probability</div>
              </div>
            </div>

            {/* Key stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
              {[
                { label: 'Distance', value: `${result.simulation.distance_km} km`, icon: Target, color: '#818cf8' },
                { label: 'P50 ETA', value: `${result.delivery_hours.p50.toFixed(1)}h`, icon: Clock, color: '#22d3ee' },
                { label: 'Avg Risk', value: `${(result.avg_risk_score * 100).toFixed(0)}%`, icon: Shield, color: result.avg_risk_score > 0.5 ? '#ef4444' : '#22c55e' },
                { label: 'Scenarios', value: result.simulation.n_scenarios, icon: FlaskConical, color: '#f59e0b' },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="glass-card" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} style={{ color: s.color }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery distribution & risk timeline side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              {/* Delivery hours distribution */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div className="panel-header"><h3><Clock size={14} className="icon" /> Delivery Time Distribution</h3></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {[
                    { label: 'Best case (P10)',   value: result.delivery_hours.p10, color: '#22c55e' },
                    { label: 'Median (P50)',       value: result.delivery_hours.p50, color: '#818cf8' },
                    { label: 'Likely worst (P90)', value: result.delivery_hours.p90, color: '#f59e0b' },
                    { label: 'Extreme case (P99)', value: result.delivery_hours.p99, color: '#ef4444' },
                    { label: 'Your deadline',      value: result.delivery_hours.deadline, color: '#ffffff', isDashed: true },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0, border: row.isDashed ? '2px dashed white' : 'none' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{row.label}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.75rem', color: row.color }}>{row.value.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={[
                    { name: 'P10', hours: result.delivery_hours.p10 },
                    { name: 'P50', hours: result.delivery_hours.p50 },
                    { name: 'P90', hours: result.delivery_hours.p90 },
                    { name: 'P99', hours: result.delivery_hours.p99 },
                  ]} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={result.delivery_hours.deadline} stroke="white" strokeDasharray="4 2" label={{ value: 'Deadline', fontSize: 9, fill: 'white' }} />
                    <Bar dataKey="hours" name="Hours" radius={[3, 3, 0, 0]}>
                      {['#22c55e', '#818cf8', '#f59e0b', '#ef4444'].map((c, i) => <Cell key={i} fill={c} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk timeline */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div className="panel-header"><h3><TrendingUp size={14} className="icon" /> Projected Risk During Transit</h3></div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={result.risk_timeline} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskTwinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={h => `${h}h`} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${(v*100).toFixed(0)}%`} domain={[0, 0.9]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fill="url(#riskTwinGrad)" name="Risk" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Disruption probabilities */}
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div className="panel-header"><h3><AlertTriangle size={14} className="icon" /> Disruption Probability</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
                {[
                  { label: 'Weather Event', key: 'weather', color: '#06b6d4' },
                  { label: 'Vehicle Breakdown', key: 'breakdown', color: '#f59e0b' },
                  { label: 'Customs Delay', key: 'customs', color: '#7c3aed' },
                ].map(d => {
                  const pct = (result.disruption_probabilities[d.key] * 100).toFixed(0);
                  return (
                    <div key={d.key} style={{ textAlign: 'center', padding: '0.75rem' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: d.color }}>{pct}%</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{d.label}</div>
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: d.color, borderRadius: 'var(--radius-full)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mode comparison */}
            {result.mode_comparison?.length > 0 && (
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div className="panel-header"><h3><Truck size={14} className="icon" /> Alternative Mode Comparison</h3></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {/* Current mode first */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'rgba(79,70,229,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79,70,229,0.2)' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#818cf8', fontWeight: 700, width: 60, textTransform: 'capitalize' }}>{form.transport_mode} ✓</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${result.on_time_probability * 100}%`, background: '#818cf8', borderRadius: 'var(--radius-full)' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', width: 50, textAlign: 'right' }}>{(result.on_time_probability * 100).toFixed(0)}% OT</span>
                  </div>
                  {result.mode_comparison.map(m => {
                    const MIcon = MODE_ICONS[m.mode] || Truck;
                    const color = m.on_time_pct > 80 ? '#22c55e' : m.on_time_pct > 60 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={m.mode} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: 60, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MIcon size={11} />{m.mode}
                        </span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${m.on_time_pct}%`, background: color, borderRadius: 'var(--radius-full)' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color, width: 50, textAlign: 'right' }}>{m.on_time_pct}% OT</span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: 50, textAlign: 'right' }}>{m.avg_hours}h avg</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state when no result yet */}
      {!result && !loading && (
        <div className="glass-card empty-state" style={{ marginTop: 'var(--space-xl)' }}>
          <FlaskConical size={48} className="empty-icon" />
          <p>Configure your shipment parameters and click Run Simulation</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', maxWidth: 400, textAlign: 'center' }}>
            The digital twin runs {form.n_scenarios} Monte Carlo scenarios to predict delivery probability, disruption risk, and optimal transport mode before you commit.
          </p>
        </div>
      )}
    </div>
  );
}
