import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shipmentAPI, riskAPI } from '../services/api';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import {
  Package, Truck, AlertTriangle, CheckCircle2, PlusCircle,
  ArrowRight, Bell, Shield, Clock, Navigation, Zap, Route,
  Users, ClipboardList, TrendingUp, BarChart3, MapPin,
  Play, Radio, Activity, Warehouse
} from 'lucide-react';
import './DashboardPage.css';

const RISK_COLORS = { low:'#16a34a', medium:'#d97706', high:'#dc2626', critical:'#b91c1c' };
const MODE_ICONS  = { truck: Truck, rail: Activity, ship: Warehouse, air: Zap };

// ── Sub-dashboards per role ────────────────────────────────────

function AdminDashboard({ stats, shipments, alerts, navigate }) {
  const cards = [
    { icon: Package,       label: 'Total Shipments',  value: stats.total,       accent: '#4f46e5', bg: 'rgba(79,70,229,0.08)' },
    { icon: Truck,         label: 'In Transit',        value: stats.in_transit,  accent: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
    { icon: AlertTriangle, label: 'At Risk',           value: stats.at_risk,     accent: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
    { icon: CheckCircle2,  label: 'Delivered',         value: stats.delivered,   accent: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    { icon: TrendingUp,    label: 'On-Time Rate',      value: `${((stats.on_time_rate||0)*100).toFixed(1)}%`, accent:'#4f46e5', bg:'rgba(79,70,229,0.08)' },
    { icon: Radio,         label: 'Avg Risk',          value: `${((stats.avg_risk_score||0)*100).toFixed(0)}%`, accent:'#d97706', bg:'rgba(217,119,6,0.08)' },
  ];

  const quickActions = [
    { icon: PlusCircle, label: 'Create Shipment', desc:'Admin only', path:'/shipments/new', color:'#4f46e5', bg:'rgba(79,70,229,0.08)' },
    { icon: ClipboardList, label: 'Requests', desc:'Pending approval', path:'/shipment-requests', color:'#d97706', bg:'rgba(217,119,6,0.08)' },
    { icon: Route, label: 'Route Optimizer', desc:'AI predictions', path:'/route-optimization', color:'#0d9488', bg:'rgba(13,148,136,0.08)' },
    { icon: Users, label: 'Manage Team', desc:'Invite & assign', path:'/users', color:'#7c3aed', bg:'rgba(124,58,237,0.08)' },
    { icon: Navigation, label: 'Live Map', desc:'GPS tracking', path:'/live-tracking', color:'#0ea5e9', bg:'rgba(14,165,233,0.08)' },
    { icon: Truck, label: 'Fleet', desc:'Vehicles & drivers', path:'/fleet', color:'#16a34a', bg:'rgba(22,163,74,0.08)' },
  ];

  return (
    <div className="dashboard-page">
      <div className="role-welcome">
        <div className="role-welcome-text">
          <h1>Admin Control Tower</h1>
          <p>Full visibility and control over your entire supply chain operation.</p>
        </div>
        <div className="role-welcome-actions">
          <button className="btn btn-outline-white btn-sm" onClick={() => navigate('/shipment-requests')}>
            <ClipboardList size={14}/> View Requests
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/shipments/new')} style={{background:'white',color:'var(--accent-primary)'}}>
            <PlusCircle size={14}/> Create Shipment
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="stat-card" style={{'--card-accent': c.accent}}>
              <div className="stat-icon" style={{background:c.bg, color:c.accent}}><Icon size={20}/></div>
              <div className="stat-value">{c.value ?? '—'}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="glass-card">
        <div className="panel-header"><h3><Zap size={16} className="icon"/>Quick Actions</h3></div>
        <div className="quick-actions">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.path} className="quick-action-card" onClick={() => navigate(a.path)}>
                <div className="quick-action-icon" style={{background:a.bg, color:a.color}}><Icon size={22}/></div>
                <div className="quick-action-label">{a.label}</div>
                <div className="quick-action-desc">{a.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card">
          <div className="panel-header">
            <h3><Activity size={16} className="icon"/>Active Shipments</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All <ArrowRight size={13}/></button>
          </div>
          <div className="shipment-rows">
            {shipments.filter(s => s.status !== 'delivered').slice(0,6).map(s => {
              const ModeIcon = MODE_ICONS[s.transport_mode] || Truck;
              return (
                <div key={s.id} className="shipment-row" onClick={() => navigate(`/shipments/${s.id}`)}>
                  <div className="shipment-row-icon" style={{background:`rgba(${s.risk_level==='high'||s.risk_level==='critical'?'220,38,38':'79,70,229'},0.08)`, color: RISK_COLORS[s.risk_level]||'#4f46e5'}}>
                    <ModeIcon size={16}/>
                  </div>
                  <div className="shipment-row-body">
                    <div className="shipment-row-id">{s.id?.substring(0,10)}</div>
                    <div className="shipment-row-route">{s.origin_name} → {s.destination_name}</div>
                    <div className="shipment-row-meta">
                      <span className={`badge badge-${s.risk_level||'low'}`}>{s.risk_level}</span>
                      <span style={{fontSize:'0.6875rem', color:'var(--text-muted)', textTransform:'capitalize'}}>{s.status?.replace('_',' ')}</span>
                    </div>
                  </div>
                  <div className="shipment-row-progress">
                    <div style={{fontSize:'0.6875rem', color:'var(--text-muted)', textAlign:'right', marginBottom:4}}>{(s.progress_pct||0).toFixed(0)}%</div>
                    <div className="progress-bar-mini">
                      <div className="progress-fill-mini" style={{width:`${s.progress_pct||0}%`, background: RISK_COLORS[s.risk_level]||'#4f46e5'}}/>
                    </div>
                  </div>
                </div>
              );
            })}
            {shipments.filter(s=>s.status!=='delivered').length===0 && (
              <div className="empty-state">
                <Package size={28} className="empty-icon"/>
                <p>No active shipments</p>
                <button className="btn btn-primary btn-sm" onClick={()=>navigate('/shipments/new')}><PlusCircle size={12}/>Create one</button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card">
          <div className="panel-header"><h3><Bell size={16} className="icon"/>Risk Alerts</h3></div>
          <div className="alerts-list">
            {alerts.slice(0,5).map(a => (
              <div key={a.id} className={`alert-item alert-${a.severity||'info'}`}>
                <div className="alert-title">
                  <AlertTriangle size={13}/> {a.title}
                </div>
                <div className="alert-message">{a.message}</div>
                <div className="alert-footer">
                  <span className="alert-time"><Clock size={10}/> {new Date(a.created_at).toLocaleTimeString()}</span>
                  {a.shipment_id && <button className="btn btn-sm btn-ghost" onClick={()=>navigate(`/shipments/${a.shipment_id}`)}>View</button>}
                </div>
              </div>
            ))}
            {alerts.length===0 && <div className="empty-state"><Shield size={24} className="empty-icon"/><p>No active alerts</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerDashboard({ stats, shipments, navigate }) {
  const myShipments = shipments.filter(s => s.status !== 'delivered');
  return (
    <div className="dashboard-page">
      <div className="role-welcome" style={{background:'linear-gradient(135deg,#0d9488,#0ea5e9)'}}>
        <div className="role-welcome-text">
          <h1>Manager Dashboard</h1>
          <p>Monitor shipments and request new routes for Admin approval.</p>
        </div>
        <div className="role-welcome-actions">
          <button className="btn btn-secondary btn-sm" style={{background:'white',color:'#0d9488'}} onClick={()=>navigate('/request-shipment')}>
            <PlusCircle size={14}/> Request Shipment
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          {icon:Package, label:'Active Shipments', value:stats.in_transit, accent:'#0d9488', bg:'rgba(13,148,136,0.08)'},
          {icon:AlertTriangle, label:'At Risk', value:stats.at_risk, accent:'#dc2626', bg:'rgba(220,38,38,0.08)'},
          {icon:CheckCircle2, label:'Delivered', value:stats.delivered, accent:'#16a34a', bg:'rgba(22,163,74,0.08)'},
          {icon:TrendingUp, label:'On-Time', value:`${((stats.on_time_rate||0)*100).toFixed(0)}%`, accent:'#4f46e5', bg:'rgba(79,70,229,0.08)'},
        ].map(c=>{const I=c.icon;return(
          <div key={c.label} className="stat-card" style={{'--card-accent':c.accent}}>
            <div className="stat-icon" style={{background:c.bg,color:c.accent}}><I size={20}/></div>
            <div className="stat-value">{c.value??'—'}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        );})}
      </div>

      <div className="alert-banner alert-banner-info" style={{marginBottom:'0'}}>
        <ClipboardList size={16}/>
        As a Manager, you can <strong>request</strong> shipments. An Admin will review and create them. You have full visibility on all org shipments.
      </div>

      <div className="glass-card">
        <div className="panel-header">
          <h3><Activity size={16} className="icon"/>Shipments Overview</h3>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/shipments')}>All Shipments <ArrowRight size={13}/></button>
        </div>
        <div className="shipment-rows">
          {myShipments.slice(0,8).map(s=>{
            const ModeIcon=MODE_ICONS[s.transport_mode]||Truck;
            return(
              <div key={s.id} className="shipment-row" onClick={()=>navigate(`/shipments/${s.id}`)}>
                <div className="shipment-row-icon" style={{background:'rgba(13,148,136,0.08)',color:'#0d9488'}}><ModeIcon size={16}/></div>
                <div className="shipment-row-body">
                  <div className="shipment-row-id">{s.id?.substring(0,10)}</div>
                  <div className="shipment-row-route">{s.origin_name} → {s.destination_name}</div>
                  <div className="shipment-row-meta">
                    <span className={`badge badge-${s.risk_level||'low'}`}>{s.risk_level}</span>
                  </div>
                </div>
                <div className="shipment-row-progress">
                  <div style={{fontSize:'0.6875rem',color:'var(--text-muted)',textAlign:'right',marginBottom:4}}>{(s.progress_pct||0).toFixed(0)}%</div>
                  <div className="progress-bar-mini"><div className="progress-fill-mini" style={{width:`${s.progress_pct||0}%`,background:RISK_COLORS[s.risk_level]||'#4f46e5'}}/></div>
                </div>
              </div>
            );
          })}
          {myShipments.length===0&&<div className="empty-state"><Package size={28} className="empty-icon"/><p>No active shipments</p><button className="btn btn-primary btn-sm" onClick={()=>navigate('/request-shipment')}>Request one</button></div>}
        </div>
      </div>
    </div>
  );
}

function FleetManagerDashboard({ stats, shipments, navigate }) {
  return (
    <div className="dashboard-page">
      <div className="role-welcome" style={{background:'linear-gradient(135deg,#d97706,#f59e0b)'}}>
        <div className="role-welcome-text">
          <h1>Fleet Manager Dashboard</h1>
          <p>Monitor vehicles, drivers, and active deliveries.</p>
        </div>
        <div className="role-welcome-actions">
          <button className="btn btn-secondary btn-sm" style={{background:'white',color:'#d97706'}} onClick={()=>navigate('/fleet')}>
            <Truck size={14}/> Manage Fleet
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {icon:Truck, label:'In Transit', value:stats.in_transit, accent:'#d97706', bg:'rgba(217,119,6,0.08)'},
          {icon:AlertTriangle, label:'At Risk', value:stats.at_risk, accent:'#dc2626', bg:'rgba(220,38,38,0.08)'},
          {icon:CheckCircle2, label:'Delivered Today', value:stats.delivered, accent:'#16a34a', bg:'rgba(22,163,74,0.08)'},
          {icon:Package, label:'Total Shipments', value:stats.total, accent:'#4f46e5', bg:'rgba(79,70,229,0.08)'},
        ].map(c=>{const I=c.icon;return(
          <div key={c.label} className="stat-card" style={{'--card-accent':c.accent}}>
            <div className="stat-icon" style={{background:c.bg,color:c.accent}}><I size={20}/></div>
            <div className="stat-value">{c.value??'—'}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        );})}
      </div>
      <div className="dashboard-grid">
        <div className="glass-card">
          <div className="panel-header"><h3><Truck size={16} className="icon"/>Active Shipments</h3><button className="btn btn-ghost btn-sm" onClick={()=>navigate('/shipments')}>All <ArrowRight size={13}/></button></div>
          <div className="shipment-rows">
            {shipments.filter(s=>s.status==='in_transit').slice(0,6).map(s=>(
              <div key={s.id} className="shipment-row" onClick={()=>navigate(`/shipments/${s.id}`)}>
                <div className="shipment-row-icon" style={{background:'rgba(217,119,6,0.08)',color:'#d97706'}}><Truck size={16}/></div>
                <div className="shipment-row-body">
                  <div className="shipment-row-route">{s.origin_name} → {s.destination_name}</div>
                  <div className="shipment-row-meta"><span className={`badge badge-${s.risk_level||'low'}`}>{s.risk_level}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card">
          <div className="panel-header"><h3><Navigation size={16} className="icon"/>Live Tracking</h3></div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',alignItems:'center',justifyContent:'center',padding:'1.5rem 0'}}>
            <Navigation size={40} style={{color:'var(--accent-primary)',opacity:0.3}}/>
            <p style={{textAlign:'center',fontSize:'0.875rem',color:'var(--text-secondary)'}}>Monitor all driver locations in real-time</p>
            <button className="btn btn-primary" onClick={()=>navigate('/live-tracking')}><Navigation size={14}/>Open Live Map</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalystDashboard({ stats, shipments, navigate }) {
  const riskDist = ['low','medium','high','critical'].map(l=>({level:l, count:shipments.filter(s=>s.risk_level===l).length}));
  return (
    <div className="dashboard-page">
      <div className="role-welcome" style={{background:'linear-gradient(135deg,#0ea5e9,#6366f1)'}}>
        <div className="role-welcome-text"><h1>Analyst Dashboard</h1><p>Data insights across all shipments and risk trends.</p></div>
      </div>
      <div className="stats-grid">
        {[
          {icon:Package, label:'Total Shipments', value:stats.total, accent:'#4f46e5', bg:'rgba(79,70,229,0.08)'},
          {icon:AlertTriangle, label:'At Risk', value:stats.at_risk, accent:'#dc2626', bg:'rgba(220,38,38,0.08)'},
          {icon:TrendingUp, label:'On-Time Rate', value:`${((stats.on_time_rate||0)*100).toFixed(1)}%`, accent:'#16a34a', bg:'rgba(22,163,74,0.08)'},
          {icon:BarChart3, label:'Avg Risk Score', value:`${((stats.avg_risk_score||0)*100).toFixed(0)}%`, accent:'#d97706', bg:'rgba(217,119,6,0.08)'},
        ].map(c=>{const I=c.icon;return(
          <div key={c.label} className="stat-card" style={{'--card-accent':c.accent}}>
            <div className="stat-icon" style={{background:c.bg,color:c.accent}}><I size={20}/></div>
            <div className="stat-value">{c.value??'—'}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        );})}
      </div>
      <div className="glass-card">
        <div className="panel-header"><h3><Shield size={16} className="icon"/>Risk Distribution</h3></div>
        <div className="risk-dist-list">
          {riskDist.map(r=>(
            <div key={r.level} className="risk-dist-item">
              <div className="risk-dist-header">
                <span className={`badge badge-${r.level}`}>{r.level}</span>
                <span className="risk-dist-count">{r.count} shipment{r.count!==1?'s':''}</span>
              </div>
              <div className="risk-dist-bar">
                <div className="risk-dist-fill" style={{width:shipments.length?`${(r.count/shipments.length)*100}%`:'0%', background:RISK_COLORS[r.level]}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DriverDashboard({ userProfile, shipments, navigate }) {
  const myShipments = shipments.filter(s =>
    s.assigned_drivers && Object.values(s.assigned_drivers).includes(userProfile?.uid)
  );
  const activeShipment = myShipments.find(s => s.status === 'in_transit') || myShipments[0];

  return (
    <div className="dashboard-page">
      <div className="role-welcome" style={{background:'linear-gradient(135deg,#16a34a,#0d9488)'}}>
        <div className="role-welcome-text"><h1>Driver Dashboard</h1><p>Your active delivery and GPS status.</p></div>
        <div className="role-welcome-actions">
          <button className="btn btn-secondary btn-sm" style={{background:'white',color:'#16a34a'}} onClick={()=>navigate('/driver-tracking')}>
            <Navigation size={14}/> Start GPS Tracking
          </button>
        </div>
      </div>

      {activeShipment ? (
        <div className="driver-shipment-card">
          <div className="driver-shipment-header">
            <div>
              <div style={{fontSize:'0.75rem',color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginBottom:'0.25rem'}}>{activeShipment.id?.substring(0,12)}</div>
              <h2 style={{fontSize:'1.25rem',fontWeight:800,color:'var(--text-primary)'}}>{activeShipment.origin_name} → {activeShipment.destination_name}</h2>
            </div>
            <span className={`badge badge-${activeShipment.risk_level||'low'}`} style={{fontSize:'0.75rem'}}>{activeShipment.risk_level} risk</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.25rem'}}>
            {[
              {label:'Status',value:activeShipment.status?.replace('_',' ')},
              {label:'Progress',value:`${(activeShipment.progress_pct||0).toFixed(0)}%`},
              {label:'Transport',value:activeShipment.transport_mode},
              {label:'Priority',value:activeShipment.priority},
            ].map(f=>(
              <div key={f.label} style={{padding:'0.75rem',background:'var(--bg-tertiary)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color-light)'}}>
                <div style={{fontSize:'0.6875rem',color:'var(--text-muted)',fontWeight:600,marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{f.label}</div>
                <div style={{fontSize:'0.9375rem',fontWeight:700,color:'var(--text-primary)',textTransform:'capitalize'}}>{f.value||'—'}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.375rem'}}>
              <span>Route Progress</span><span style={{fontWeight:700,color:'var(--text-primary)'}}>{(activeShipment.progress_pct||0).toFixed(1)}%</span>
            </div>
            <div style={{height:10,background:'var(--bg-tertiary)',borderRadius:'var(--radius-full)',overflow:'hidden',border:'1px solid var(--border-color-light)'}}>
              <div style={{height:'100%',width:`${activeShipment.progress_pct||0}%`,background:RISK_COLORS[activeShipment.risk_level]||'#16a34a',borderRadius:'var(--radius-full)',transition:'width 1s ease'}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.75rem'}}>
            <button className="btn btn-primary btn-lg" style={{flex:1}} onClick={()=>navigate('/driver-tracking')}>
              <Navigation size={16}/> Start GPS Tracking
            </button>
            <button className="btn btn-secondary" onClick={()=>navigate(`/shipments/${activeShipment.id}`)}>
              View Details
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card">
          <div className="empty-state" style={{padding:'3rem'}}>
            <Truck size={40} className="empty-icon"/>
            <p>No active shipment assigned to you yet.</p>
            <p style={{fontSize:'0.75rem'}}>Contact your Admin or Fleet Manager to be assigned to a shipment.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard (role router) ───────────────────────────────
export default function DashboardPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total:0, in_transit:0, at_risk:0, delivered:0, delayed:0, avg_risk_score:0, on_time_rate:0 });
  const [shipments, setShipments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!userProfile?.orgId) return;

    const q = query(
      collection(db, 'shipments'),
      where('org_id', '==', userProfile.orgId),
      limit(50)
    );

    unsubRef.current = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setShipments(docs);
      setStats({
        total:         docs.length,
        in_transit:    docs.filter(s=>s.status==='in_transit').length,
        at_risk:       docs.filter(s=>['high','critical'].includes(s.risk_level)).length,
        delivered:     docs.filter(s=>s.status==='delivered').length,
        delayed:       docs.filter(s=>s.status==='delayed').length,
        avg_risk_score: docs.reduce((a,s)=>a+(s.risk_score||0),0)/Math.max(docs.length,1),
        on_time_rate:  (() => {
          const d=docs.filter(s=>s.status==='delivered').length;
          const dl=docs.filter(s=>s.status==='delayed').length;
          return d/Math.max(d+dl,1);
        })(),
      });
    }, () => {
      shipmentAPI.stats().then(r=>setStats(r.data)).catch(()=>{});
      shipmentAPI.list({page_size:50}).then(r=>setShipments(r.data.shipments||[])).catch(()=>{});
    });

    riskAPI.getAlerts().then(r=>{ if(r.data.alerts?.length) setAlerts(r.data.alerts); }).catch(()=>{});

    return () => unsubRef.current?.();
  }, [userProfile?.orgId]);

  const role = userProfile?.role || 'analyst';

  const props = { stats, shipments, alerts, navigate, userProfile };

  if (role === 'admin')        return <AdminDashboard        {...props}/>;
  if (role === 'manager')      return <ManagerDashboard      {...props}/>;
  if (role === 'fleet_manager')return <FleetManagerDashboard {...props}/>;
  if (role === 'analyst')      return <AnalystDashboard      {...props}/>;
  if (role === 'driver')       return <DriverDashboard       {...props}/>;

  return <AnalystDashboard {...props}/>;
}
