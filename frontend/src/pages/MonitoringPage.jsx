import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Activity, Server, Zap, AlertTriangle, CheckCircle,
  Clock, RefreshCw, Shield, TrendingUp, Radio, Bell,
  CheckCheck, XCircle, Info, Database
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,14,39,0.96)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong></div>)}
    </div>
  );
};

const SEV_COLORS = { critical: '#ef4444', danger: '#f97316', warning: '#f59e0b', success: '#22c55e', info: '#06b6d4' };
const SEV_ICONS = { critical: AlertTriangle, danger: AlertTriangle, warning: AlertTriangle, success: CheckCircle, info: Info };

// Fallback demo data
const DEMO_METRICS = {
  uptime_seconds: 259200,
  total_requests: 8720,
  total_errors: 14,
  error_rate_pct: 0.16,
  latency_ms: { avg: 48.3, p50: 42.1, p95: 89.4, p99: 143.2 },
  hourly_traffic: Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    requests: 80 + Math.round(Math.sin(h / 4) * 40 + Math.random() * 30),
    errors: Math.floor(Math.random() * 3),
    avg_latency_ms: 44 + Math.round(Math.random() * 20),
  })),
  top_endpoints: [
    { path: '/api/shipments/', requests: 2340, errors: 3 },
    { path: '/api/analytics/overview', requests: 1820, errors: 0 },
    { path: '/api/risk/evaluate/', requests: 1240, errors: 4 },
    { path: '/api/streaming/active', requests: 890, errors: 1 },
    { path: '/api/decisions/pending', requests: 670, errors: 0 },
  ],
  model_server_status: 'healthy',
  firestore_latency_ms: 14.3,
};

const DEMO_SLA = {
  on_time_pct: 91.7,
  sla_target_pct: 95.0,
  sla_compliant: false,
  total_shipments: 47,
  delivered: 38,
  delayed: 4,
  at_risk: 5,
  trend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    on_time_pct: 85 + Math.random() * 12,
  })),
};

const DEMO_ALERTS = [
  { id: 'a1', title: 'Critical: SHP-003', message: 'Risk score 91% — disruption active', severity: 'critical', created_at: new Date(Date.now() - 720000).toISOString(), read: false },
  { id: 'a2', title: 'High: SHP-002', message: 'Risk 78% — 2 alternatives available', severity: 'danger', created_at: new Date(Date.now() - 3600000).toISOString(), read: true },
  { id: 'a3', title: 'AI Decision executed', message: 'Reroute applied → risk 34%', severity: 'success', created_at: new Date(Date.now() - 7200000).toISOString(), read: true },
  { id: 'a4', title: 'SLA Warning', message: 'On-time rate 88% (target 95%)', severity: 'warning', created_at: new Date(Date.now() - 14400000).toISOString(), read: false },
  { id: 'a5', title: 'SHP-001 delivered', message: 'Jaipur → Mumbai on-time', severity: 'success', created_at: new Date(Date.now() - 21600000).toISOString(), read: true },
];

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState(DEMO_METRICS);
  const [sla, setSla] = useState(DEMO_SLA);
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = window.__fbToken || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [mRes, sRes, aRes, actRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/monitoring/metrics`, { headers }),
        fetch(`${API_BASE}/api/monitoring/sla`, { headers }),
        fetch(`${API_BASE}/api/monitoring/alerts-log`, { headers }),
        fetch(`${API_BASE}/api/monitoring/activity-feed`, { headers }),
      ]);
      if (mRes.status === 'fulfilled' && mRes.value.ok) setMetrics(await mRes.value.json());
      if (sRes.status === 'fulfilled' && sRes.value.ok) setSla(await sRes.value.json());
      if (aRes.status === 'fulfilled' && aRes.value.ok) { const d = await aRes.value.json(); setAlerts(d.alerts || DEMO_ALERTS); }
      if (actRes.status === 'fulfilled' && actRes.value.ok) { const d = await actRes.value.json(); setActivity(d.feed || []); }
    } catch { /* keep demo */ }
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const slaColor = sla.on_time_pct >= sla.sla_target_pct ? '#22c55e' : sla.on_time_pct >= 90 ? '#f59e0b' : '#ef4444';
  const upH = Math.floor(metrics.uptime_seconds / 3600);
  const upM = Math.floor((metrics.uptime_seconds % 3600) / 60);

  const statCards = [
    { label: 'Uptime', value: `${upH}h ${upM}m`, icon: Server, color: '#22c55e' },
    { label: 'Total Requests', value: metrics.total_requests.toLocaleString(), icon: Activity, color: '#818cf8' },
    { label: 'Error Rate', value: `${metrics.error_rate_pct}%`, icon: XCircle, color: metrics.error_rate_pct > 1 ? '#ef4444' : '#22c55e' },
    { label: 'Avg Latency', value: `${metrics.latency_ms.avg}ms`, icon: Zap, color: '#f59e0b' },
    { label: 'P95 Latency', value: `${metrics.latency_ms.p95}ms`, icon: Clock, color: metrics.latency_ms.p95 > 200 ? '#ef4444' : '#06b6d4' },
    { label: 'Firestore', value: `${metrics.firestore_latency_ms}ms`, icon: Database, color: '#0d9488' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Activity size={22} className="icon" /> System Monitoring</h1>
          <p className="page-subtitle">Real-time health · SLA compliance · Alert history · Activity feed</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      <div style={{
        padding: '0.75rem 1.25rem', marginBottom: 'var(--space-lg)',
        borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.875rem' }}>All Systems Operational</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem' }}>
          {[['API', '✓'], ['Firestore', '✓'], ['ML Model', '✓'], ['GPS Sim', '✓']].map(([svc, st]) => (
            <span key={svc} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {svc} <span style={{ color: '#22c55e' }}>{st}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {statCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass-card" style={{ padding: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${c.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Icon size={15} style={{ color: c.color }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* Traffic chart */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Activity size={15} className="icon" /> Hourly Traffic (24h)</h3></div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={metrics.hourly_traffic} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="requests" stroke="#818cf8" strokeWidth={2} fill="url(#reqGrad)" name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Latency chart */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Zap size={15} className="icon" /> Latency (ms) — 24h</h3></div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={metrics.hourly_traffic} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'SLA', fontSize: 9, fill: '#ef4444' }} />
              <Line type="monotone" dataKey="avg_latency_ms" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SLA + Endpoints + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* SLA gauge */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Shield size={15} className="icon" /> SLA Compliance</h3></div>
          <div style={{ textAlign: 'center', margin: '0.75rem 0' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: slaColor }}>{sla.on_time_pct}%</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Target: {sla.sla_target_pct}%</div>
            <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.6875rem', fontWeight: 700, background: sla.sla_compliant ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: slaColor }}>
              {sla.sla_compliant ? '✓ COMPLIANT' : '✗ BELOW TARGET'}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '0.875rem' }}>
            <div style={{ height: '100%', width: `${sla.on_time_pct}%`, background: slaColor, borderRadius: 'var(--radius-full)', transition: 'width 1s ease' }} />
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={sla.trend?.slice(-14)} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <YAxis domain={[80, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
              <ReferenceLine y={95} stroke="#64748b" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="on_time_pct" stroke={slaColor} strokeWidth={1.5} dot={false} />
              <Tooltip content={<CustomTooltip />} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top endpoints */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Server size={15} className="icon" /> Top Endpoints</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {metrics.top_endpoints.map(ep => {
              const errRate = ep.errors / Math.max(ep.requests, 1) * 100;
              return (
                <div key={ep.path}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{ep.path}</span>
                    <span style={{ fontSize: '0.6875rem', color: ep.errors > 0 ? '#ef4444' : 'var(--text-muted)' }}>{ep.requests} reqs{ep.errors > 0 ? ` · ${ep.errors} err` : ''}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(ep.requests / metrics.top_endpoints[0].requests) * 100}%`, background: '#818cf8', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts log */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header">
            <h3><Bell size={15} className="icon" /> Alert Log</h3>
            <span style={{ fontSize: '0.625rem', color: '#ef4444', fontWeight: 700 }}>
              {alerts.filter(a => !a.read).length} unread
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: 240 }}>
            {alerts.map(al => {
              const Icon = SEV_ICONS[al.severity] || Info;
              const color = SEV_COLORS[al.severity] || '#818cf8';
              return (
                <div key={al.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem', borderRadius: 'var(--radius-md)', background: al.read ? 'transparent' : `${color}0d`, borderLeft: `2px solid ${color}` }}>
                  <Icon size={12} style={{ color, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: al.read ? 400 : 700, color: al.read ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{al.title}</div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{new Date(al.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      {activity.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="panel-header"><h3><Radio size={15} className="icon" /> Live Activity Feed</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
            {activity.slice(0, 10).map(ev => {
              const color = SEV_COLORS[ev.severity] || '#818cf8';
              return (
                <div key={ev.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ev.message}</div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
