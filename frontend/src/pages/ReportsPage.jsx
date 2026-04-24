import { useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import {
  FileText, Download, TrendingUp, Shield, Package,
  CheckCircle, XCircle, AlertTriangle, RefreshCw,
  DollarSign, Leaf, Clock, BarChart3, Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,14,39,0.96)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
};

const DEMO_SUMMARY = {
  shipments: { total: 47, delivered: 38, delayed: 4, at_risk: 5, in_transit: 18, on_time_rate: 0.917 },
  risk: { avg_score: 0.38, critical_count: 2, high_count: 3 },
  decisions: { total: 12, executed: 9, pending: 1, rejected: 2 },
  impact: { delays_prevented: 8, cost_saved_inr: 280000, co2_saved_kg: 1240, sla_improvement_pct: 6.3 },
  sla_target_pct: 95.0,
  sla_actual_pct: 91.7,
  generated_at: new Date().toISOString(),
};

const DEMO_SLA_TREND = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(5, 10),
  on_time_pct: parseFloat((85 + Math.random() * 12).toFixed(1)),
  compliant: Math.random() > 0.3,
}));

const DEMO_DECISIONS_BREAKDOWN = [
  { name: 'Reroute', value: 5, color: '#818cf8' },
  { name: 'Mode Switch', value: 2, color: '#22d3ee' },
  { name: 'Consolidate', value: 1, color: '#f59e0b' },
  { name: 'Safe Halt', value: 1, color: '#ef4444' },
  { name: 'Rejected', value: 2, color: '#64748b' },
];

export default function ReportsPage() {
  const [summary, setSummary] = useState(DEMO_SUMMARY);
  const [slaTrend, setSlaTrend] = useState(DEMO_SLA_TREND);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = window.__fbToken || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/reports/summary`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        if (data.trend) setSlaTrend(data.trend.slice(-30).map(t => ({ ...t, date: t.date?.slice(5, 10) })));
      }
    } catch { /* keep demo */ }
    setLoading(false);
  }, []);

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const token = window.__fbToken || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/reports/export/${type}.csv`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* silently fail — show demo message */ alert(`Export ready: ${type}.csv (demo mode — connect API for real data)`); }
    setExporting('');
  };

  const { shipments, risk, decisions, impact } = summary;
  const slaColor = summary.sla_actual_pct >= 95 ? '#22c55e' : summary.sla_actual_pct >= 90 ? '#f59e0b' : '#ef4444';

  const kpiCards = [
    { label: 'Total Shipments', value: shipments.total, icon: Package, color: '#818cf8' },
    { label: 'On-Time Rate', value: `${(shipments.on_time_rate * 100).toFixed(1)}%`, icon: CheckCircle, color: shipments.on_time_rate >= 0.95 ? '#22c55e' : '#f59e0b' },
    { label: 'Delays Prevented', value: impact.delays_prevented, icon: Shield, color: '#22c55e' },
    { label: 'Cost Saved', value: `₹${(impact.cost_saved_inr / 1000).toFixed(0)}K`, icon: DollarSign, color: '#22c55e' },
    { label: 'CO₂ Saved', value: `${impact.co2_saved_kg}kg`, icon: Leaf, color: '#0d9488' },
    { label: 'SLA Improvement', value: `+${impact.sla_improvement_pct}%`, icon: TrendingUp, color: '#06b6d4' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><FileText size={22} className="icon" /> Reports & Analytics Export</h1>
          <p className="page-subtitle">Org-level performance summary · SLA compliance · Impact analysis · CSV export</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('shipments')} disabled={!!exporting}>
            {exporting === 'shipments' ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            Shipments CSV
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('decisions')} disabled={!!exporting}>
            {exporting === 'decisions' ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            Decisions CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {kpiCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass-card" style={{ padding: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${c.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Icon size={15} style={{ color: c.color }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* SLA Trend */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header">
            <h3><Shield size={15} className="icon" /> SLA Compliance Trend (30 days)</h3>
            <span style={{ fontSize: '0.6875rem', color: slaColor, fontWeight: 700 }}>
              {summary.sla_actual_pct}% actual / {summary.sla_target_pct}% target
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={slaTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} interval={4} />
              <YAxis domain={[75, 100]} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={95} stroke="#64748b" strokeDasharray="4 2" label={{ value: 'Target 95%', fontSize: 9, fill: '#64748b', position: 'right' }} />
              <Line type="monotone" dataKey="on_time_pct" stroke={slaColor} strokeWidth={2} dot={false} name="On-Time %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Decisions breakdown */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Zap size={15} className="icon" /> Decision Types</h3></div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={DEMO_DECISIONS_BREAKDOWN} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" radius={[3, 3, 0, 0]}>
                {DEMO_DECISIONS_BREAKDOWN.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {[
              { label: 'Total', value: decisions.total },
              { label: 'Executed', value: decisions.executed, color: '#22c55e' },
              { label: 'Pending', value: decisions.pending, color: '#f59e0b' },
              { label: 'Rejected', value: decisions.rejected, color: '#ef4444' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color || 'var(--text-primary)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shipment breakdown + Impact tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* Shipment status table */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Package size={15} className="icon" /> Shipment Summary</h3></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <tbody>
              {[
                { label: 'Total Shipments', value: shipments.total, color: null },
                { label: 'Delivered', value: shipments.delivered, color: '#22c55e' },
                { label: 'In Transit', value: shipments.in_transit, color: '#818cf8' },
                { label: 'Delayed', value: shipments.delayed, color: '#f59e0b' },
                { label: 'At Risk', value: shipments.at_risk, color: '#ef4444' },
                { label: 'Avg Risk Score', value: `${(risk.avg_score * 100).toFixed(0)}%`, color: risk.avg_score > 0.5 ? '#ef4444' : '#22c55e' },
                { label: 'Critical Risk', value: risk.critical_count, color: '#ef4444' },
                { label: 'High Risk', value: risk.high_count, color: '#f97316' },
              ].map(r => (
                <tr key={r.label} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>{r.label}</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 700, color: r.color || 'var(--text-primary)' }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Business Impact table */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><TrendingUp size={15} className="icon" /> Business Impact</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { label: 'Delays Prevented', value: impact.delays_prevented, suffix: 'shipments', icon: Shield, color: '#22c55e' },
              { label: 'Cost Saved', value: `₹${(impact.cost_saved_inr / 1000).toFixed(0)}K`, suffix: '(est.)', icon: DollarSign, color: '#22c55e' },
              { label: 'CO₂ Emissions Saved', value: `${impact.co2_saved_kg} kg`, suffix: '', icon: Leaf, color: '#0d9488' },
              { label: 'SLA Improvement', value: `+${impact.sla_improvement_pct}%`, suffix: 'vs baseline', icon: TrendingUp, color: '#06b6d4' },
            ].map(row => {
              const Icon = row.icon;
              return (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: `${row.color}0d`, borderRadius: 'var(--radius-md)', border: `1px solid ${row.color}22` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${row.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: row.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: row.color }}>{row.value} <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{row.suffix}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(79,70,229,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79,70,229,0.2)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Generated: {new Date(summary.generated_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Export section */}
      <div className="glass-card" style={{ padding: '1rem' }}>
        <div className="panel-header"><h3><Download size={15} className="icon" /> Export Data</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
          {[
            { label: 'Shipments Report', desc: 'All shipments with status, risk, route', type: 'shipments', icon: Package },
            { label: 'Decision Audit Log', desc: 'Full decision history with outcomes', type: 'decisions', icon: Zap },
          ].map(ex => {
            const Icon = ex.icon;
            return (
              <div key={ex.type} style={{ padding: '0.875rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <Icon size={15} style={{ color: 'var(--accent-primary-light)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{ex.label}</span>
                </div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{ex.desc}</p>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => handleExport(ex.type)} disabled={!!exporting}>
                  {exporting === ex.type ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                  Download CSV
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
