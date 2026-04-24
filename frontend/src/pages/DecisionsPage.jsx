import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { decisionsAPI, shipmentAPI } from '../services/api';
import {
  Zap, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight,
  Navigation, Truck, Train, Plane, Warehouse, RefreshCw,
  AlertTriangle, Shield, TrendingDown, Activity, Package,
  ArrowRight, BarChart3, Leaf, DollarSign
} from 'lucide-react';

const TIER_ICONS = { reroute: Navigation, mode_switch: Truck, consolidate: Package, safe_halt: Warehouse };
const TIER_COLORS = {
  reroute:     { bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.3)', text: '#818cf8' },
  mode_switch: { bg: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.25)', text: '#22d3ee' },
  consolidate: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24' },
  safe_halt:   { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)', text: '#f87171' },
};

function ImpactBadge({ label, value, positive }) {
  const color = value === 0 ? 'var(--text-muted)' : (positive ? '#22c55e' : '#ef4444');
  const prefix = value > 0 ? '+' : '';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{prefix}{value}{typeof value === 'number' && Math.abs(value) < 100 ? '%' : ''}</div>
      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function DecisionCard({ decision, onApprove, onReject, expanded, onToggle }) {
  const rec = decision.recommended_action || {};
  const TIcon = TIER_ICONS[rec.type] || Shield;
  const colors = TIER_COLORS[rec.type] || TIER_COLORS.reroute;
  const isPending = decision.status === 'pending_approval';
  const isApproved = decision.status === 'approved' || decision.status === 'auto_approved';
  const isRejected = decision.status === 'rejected';
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(decision.id || decision.decision_id, rec.type);
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    await onReject(decision.id || decision.decision_id, 'Operator override');
    setRejecting(false);
  };

  return (
    <div className="glass-card" style={{
      borderLeft: `3px solid ${colors.text}`,
      marginBottom: '0.75rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={onToggle}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TIcon size={16} style={{ color: colors.text }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{rec.title || 'Decision'}</span>
            <span style={{ fontSize: '0.5625rem', padding: '2px 6px', borderRadius: 'var(--radius-full)', fontWeight: 700, textTransform: 'uppercase',
              background: isPending ? 'rgba(245,158,11,0.15)' : isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: isPending ? '#fbbf24' : isApproved ? '#22c55e' : '#ef4444',
            }}>
              {decision.status?.replace('_', ' ')}
            </span>
            {decision.auto_executed && (
              <span style={{ fontSize: '0.5625rem', color: '#818cf8', fontWeight: 600 }}>⚡ auto</span>
            )}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Shipment {decision.shipment_id?.substring(0, 8)} · Risk {(decision.trigger_risk_score * 100).toFixed(0)}% → {(rec.new_risk_score * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginRight: '0.5rem' }}>
          <ImpactBadge label="Risk ↓" value={-Math.round(rec.risk_reduction * 100)} positive={true} />
          <ImpactBadge label="Cost" value={rec.cost_change_pct} positive={rec.cost_change_pct <= 0} />
          <ImpactBadge label="ETA ±" value={rec.eta_change_min ? `${rec.eta_change_min}m` : '0m'} positive={rec.eta_change_min <= 0} />
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                   : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>{rec.description}</p>

          {/* All options */}
          {decision.all_options?.length > 0 && (
            <div style={{ marginBottom: '0.875rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>All Options</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {decision.all_options.map(opt => {
                  const OIcon = TIER_ICONS[opt.type] || Shield;
                  const oc = TIER_COLORS[opt.type] || TIER_COLORS.reroute;
                  return (
                    <div key={opt.type} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: oc.bg, border: `1px solid ${oc.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                        <OIcon size={12} style={{ color: oc.text }} />
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: oc.text }}>{opt.title}</span>
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                        Risk: {(opt.new_risk_score * 100).toFixed(0)}% · {opt.confidence * 100}% conf
                      </div>
                      {opt.requires_approval && <div style={{ fontSize: '0.5rem', color: '#fbbf24', marginTop: '0.125rem' }}>⚠ needs approval</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons for pending */}
          {isPending && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={handleApprove} disabled={approving}>
                {approving ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Approve & Execute
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleReject} disabled={rejecting}>
                {rejecting ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={12} />}
                Reject
              </button>
            </div>
          )}
          {isApproved && <div style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><CheckCircle size={13} /> Executed {decision.approved_at ? new Date(decision.approved_at).toLocaleString() : ''}</div>}
          {isRejected && <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><XCircle size={13} /> Rejected — {decision.rejection_reason}</div>}
        </div>
      )}
    </div>
  );
}

export default function DecisionsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [decisions, setDecisions] = useState([]);
  const [impact, setImpact] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [selectedShipment, setSelectedShipment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendRes, histRes, impRes, shipsRes] = await Promise.allSettled([
        decisionsAPI.pending(),
        decisionsAPI.history(50),
        decisionsAPI.impactSummary(),
        shipmentAPI.list({ page_size: 20 }),
      ]);
      const pending = pendRes.status === 'fulfilled' ? pendRes.value.data.decisions || [] : [];
      const history = histRes.status === 'fulfilled' ? histRes.value.data.decisions || [] : [];
      if (impRes.status === 'fulfilled') setImpact(impRes.value.data);
      if (shipsRes.status === 'fulfilled') setShipments(shipsRes.value.data.shipments || []);
      if (tab === 'pending') setDecisions(pending);
      else setDecisions(history);
    } catch { setDecisions([]); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!selectedShipment) return;
    setGenerating(selectedShipment);
    try {
      const res = await decisionsAPI.generate(selectedShipment);
      setDecisions(prev => [res.data, ...prev]);
      if (res.data.status === 'pending_approval') setTab('pending');
      else setTab('history');
    } catch (e) {
      console.error('Generate failed:', e);
    } finally {
      setGenerating(null);
    }
  };

  const handleApprove = async (id, action) => {
    await decisionsAPI.approve(id, action);
    load();
  };

  const handleReject = async (id, reason) => {
    await decisionsAPI.reject(id, reason);
    load();
  };

  const atRiskShipments = shipments.filter(s => ['high', 'critical'].includes(s.risk_level));

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Zap size={22} className="icon" /> Self-Healing Decisions</h1>
          <p className="page-subtitle">AI-generated mitigation cascade — reroute → mode switch → consolidate → safe halt</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select className="form-select" style={{ fontSize: '0.8125rem' }} value={selectedShipment} onChange={e => setSelectedShipment(e.target.value)}>
            <option value="">Select shipment…</option>
            {atRiskShipments.map(s => (
              <option key={s.id} value={s.id}>{s.id?.substring(0, 10)} · {s.origin_name}→{s.destination_name} ({s.risk_level})</option>
            ))}
            {atRiskShipments.length === 0 && shipments.slice(0, 5).map(s => (
              <option key={s.id} value={s.id}>{s.id?.substring(0, 10)} · {s.origin_name}→{s.destination_name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!selectedShipment || generating}>
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            Generate Decision
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Impact KPIs */}
      {impact && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          {[
            { icon: Activity, label: 'Total Decisions', value: impact.total_decisions, color: '#818cf8' },
            { icon: Clock,     label: 'Pending',          value: impact.pending,          color: '#fbbf24' },
            { icon: CheckCircle, label: 'Executed',       value: impact.executed,          color: '#22c55e' },
            { icon: Shield,    label: 'Delays Prevented', value: impact.delays_prevented, color: '#06b6d4' },
            { icon: DollarSign, label: 'Cost Saved',      value: `₹${(impact.cost_saved_inr/1000).toFixed(0)}K`, color: '#22c55e' },
            { icon: Leaf,      label: 'CO₂ Saved',        value: `${impact.emissions_saved_kg}kg`, color: '#0d9488' },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="glass-card" style={{ padding: '0.875rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${kpi.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <Icon size={15} style={{ color: kpi.color }} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{kpi.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: 'var(--space-lg)' }}>
        {['pending', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? 'var(--accent-primary)' : 'transparent'}`, color: tab === t ? 'var(--accent-primary-light)' : 'var(--text-muted)', transition: 'all 0.2s', marginBottom: -1 }}>
            {t === 'pending' ? `Pending${impact?.pending ? ` (${impact.pending})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Decision list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 0.75rem', display: 'block' }} />
          Loading decisions…
        </div>
      ) : decisions.length === 0 ? (
        <div className="glass-card empty-state">
          <Zap size={40} className="empty-icon" />
          <p>{tab === 'pending' ? 'No decisions awaiting approval' : 'No decision history yet'}</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Select an at-risk shipment above and click "Generate Decision" to trigger the self-healing cascade</p>
        </div>
      ) : decisions.map(d => (
        <DecisionCard
          key={d.decision_id || d.id}
          decision={d}
          onApprove={handleApprove}
          onReject={handleReject}
          expanded={expandedId === (d.decision_id || d.id)}
          onToggle={() => setExpandedId(prev => prev === (d.decision_id || d.id) ? null : (d.decision_id || d.id))}
        />
      ))}
    </div>
  );
}
