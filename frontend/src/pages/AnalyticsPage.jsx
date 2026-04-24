import { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Shield, Clock, Package,
  Truck, Award, Zap, Leaf, BarChart3, AlertTriangle, RefreshCw
} from 'lucide-react';
import './AnalyticsPage.css';

const RISK_GRADIENT = ['#22c55e', '#f59e0b', '#ef4444', '#dc2626'];
const CARRIER_COLORS = ['#4f46e5', '#0891b2', '#0d9488', '#7c3aed', '#db2777', '#d97706', '#059669'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,14,39,0.95)',
      border: '1px solid rgba(79,70,229,0.3)',
      borderRadius: '8px',
      padding: '0.625rem 0.875rem',
      fontSize: '0.75rem',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          {p.name}: <strong>{typeof p.value === 'number' && p.value < 2 ? `${(p.value * 100).toFixed(1)}%` : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [riskTimeline, setRiskTimeline] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [delayDist, setDelayDist] = useState({ by_cargo_type: [], by_transport_mode: [] });
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ovRes, tlRes, carRes, ddRes, fcRes] = await Promise.allSettled([
        analyticsAPI.overview(),
        analyticsAPI.riskTimeline(30),
        analyticsAPI.carrierPerformance(),
        analyticsAPI.delayDistribution(),
        analyticsAPI.delayForecast(),
      ]);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data);
      if (tlRes.status === 'fulfilled') setRiskTimeline(tlRes.value.data.timeline || []);
      if (carRes.status === 'fulfilled') setCarriers(carRes.value.data.carriers || []);
      if (ddRes.status === 'fulfilled') setDelayDist(ddRes.value.data);
      if (fcRes.status === 'fulfilled') setForecast(fcRes.value.data.forecast || []);
    } catch { /* keep defaults */ }
    finally { setLoading(false); }
  };

  const kpiCards = overview ? [
    {
      icon: Package,
      label: 'Total Shipments',
      value: overview.total_shipments,
      sub: `${overview.in_transit} in transit`,
      color: '#4f46e5',
    },
    {
      icon: Shield,
      label: 'On-Time Rate',
      value: `${(overview.on_time_rate * 100).toFixed(1)}%`,
      sub: `${overview.at_risk} at risk`,
      color: overview.on_time_rate > 0.9 ? '#22c55e' : '#f59e0b',
    },
    {
      icon: Zap,
      label: 'Delays Prevented',
      value: overview.delays_prevented,
      sub: `₹${(overview.cost_saved_inr / 1000).toFixed(0)}K saved`,
      color: '#06b6d4',
    },
    {
      icon: Award,
      label: 'SLA Compliance',
      value: `${overview.sla_compliance_pct}%`,
      sub: 'vs baseline',
      color: '#22c55e',
    },
    {
      icon: Leaf,
      label: 'Carbon Saved',
      value: `${overview.carbon_saved_kg?.toLocaleString()} kg`,
      sub: 'CO₂ equivalent',
      color: '#0d9488',
    },
    {
      icon: BarChart3,
      label: 'Avg Risk Score',
      value: `${(overview.avg_risk_score * 100).toFixed(0)}%`,
      sub: `Model: ${overview.model_version}`,
      color: overview.avg_risk_score > 0.5 ? '#ef4444' : '#f59e0b',
    },
  ] : [];

  const TABS = ['overview', 'risk', 'carriers', 'forecast'];

  if (loading) {
    return (
      <div className="analytics-page animate-fade-in">
        <div className="page-header"><h1><BarChart3 size={22} className="icon" /> Analytics</h1></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <span>Loading analytics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page animate-fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
        <h1><BarChart3 size={22} className="icon" /> Analytics</h1>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="kpi-grid stagger-children" style={{ marginBottom: 'var(--space-xl)' }}>
          {kpiCards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="glass-card kpi-card">
                <div className="kpi-icon" style={{ background: `${card.color}22`, color: card.color }}>
                  <Icon size={18} />
                </div>
                <div className="kpi-value" style={{ color: card.color }}>{card.value}</div>
                <div className="kpi-label">{card.label}</div>
                <div className="kpi-sub">{card.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab navigation */}
      <div className="analytics-tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="charts-grid animate-fade-in">
          {/* Risk Timeline */}
          <div className="glass-card chart-card" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-header">
              <h3><TrendingDown size={16} className="icon" /> Risk Score Trend (30 days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={riskTimeline.slice(-30)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => v.slice(5)} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 0.8]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="avg_risk" stroke="#ef4444" strokeWidth={2}
                  fill="url(#riskGrad)" name="Avg Risk" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Delay by Transport Mode */}
          <div className="glass-card chart-card">
            <div className="panel-header">
              <h3><Truck size={16} className="icon" /> Delay by Transport Mode</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={delayDist.by_transport_mode} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mode" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_delay_min" name="Avg Delay (min)" radius={[4, 4, 0, 0]}>
                  {delayDist.by_transport_mode.map((_, i) => (
                    <Cell key={i} fill={CARRIER_COLORS[i % CARRIER_COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Delay by Cargo Type */}
          <div className="glass-card chart-card">
            <div className="panel-header">
              <h3><Package size={16} className="icon" /> On-Time Rate by Cargo</h3>
            </div>
            <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {delayDist.by_cargo_type.map((item, i) => (
                <div key={item.type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.type}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.on_time}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${item.on_time}%`,
                      background: item.on_time > 85 ? '#22c55e' : item.on_time > 75 ? '#f59e0b' : '#ef4444',
                      borderRadius: 'var(--radius-full)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Risk Tab ── */}
      {activeTab === 'risk' && (
        <div className="animate-fade-in">
          <div className="glass-card chart-card">
            <div className="panel-header">
              <h3><AlertTriangle size={16} className="icon" /> Daily Risk Score — Last 30 Days</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={riskTimeline} margin={{ top: 5, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => v.slice(5)} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 0.9]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="avg_risk" stroke="#ef4444" strokeWidth={2}
                  dot={false} name="Avg Risk" />
                <Line type="monotone" dataKey="high_risk_count" stroke="#f59e0b" strokeWidth={1.5}
                  dot={false} name="High Risk Count" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Carriers Tab ── */}
      {activeTab === 'carriers' && (
        <div className="animate-fade-in">
          <div className="glass-card">
            <div className="panel-header">
              <h3><Award size={16} className="icon" /> Carrier Reliability Rankings</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginTop: '0.5rem' }}>
              {carriers.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${CARRIER_COLORS[i % CARRIER_COLORS.length]}22`,
                    color: CARRIER_COLORS[i % CARRIER_COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
                        {c.on_time_pct}% on-time
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${c.reliability * 100}%`,
                        background: CARRIER_COLORS[i % CARRIER_COLORS.length],
                        borderRadius: 'var(--radius-full)',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right', minWidth: 60 }}>
                    <div>{c.shipments} trips</div>
                    <div style={{ color: c.avg_delay_min < 30 ? '#22c55e' : c.avg_delay_min < 60 ? '#f59e0b' : '#ef4444' }}>
                      ~{c.avg_delay_min}min delay
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Forecast Tab ── */}
      {activeTab === 'forecast' && (
        <div className="animate-fade-in">
          <div className="glass-card chart-card">
            <div className="panel-header">
              <h3><TrendingUp size={16} className="icon" /> 7-Day Delay Probability Forecast</h3>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>LightGBM model · 95% CI</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={forecast} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 0.7]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="confidence_upper" stroke="none"
                  fill="url(#ciGrad)" name="Upper CI" />
                <Area type="monotone" dataKey="delay_probability" stroke="#4f46e5" strokeWidth={2.5}
                  fill="url(#forecastGrad)" name="Delay Prob" />
                <Area type="monotone" dataKey="confidence_lower" stroke="none"
                  fill="transparent" name="Lower CI" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem', marginTop: '0.75rem' }}>
              {forecast.map(f => (
                <div key={f.date} style={{
                  textAlign: 'center',
                  padding: '0.5rem 0.25rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${f.delay_probability > 0.4 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                }}>
                  <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{f.date.slice(5)}</div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 700,
                    color: f.delay_probability > 0.4 ? '#ef4444' : f.delay_probability > 0.3 ? '#f59e0b' : '#22c55e',
                  }}>
                    {(f.delay_probability * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    {f.high_risk_routes} routes
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
