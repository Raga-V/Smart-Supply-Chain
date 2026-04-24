import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shipmentAPI, orgAPI } from '../services/api';
import LocationSearchInput from '../components/LocationSearchInput';
import {
  MapPin, Package, CheckCircle, BarChart3, ArrowLeft, ArrowRight,
  Rocket, RefreshCw, Truck, Train, Ship, Plane, Plus, Trash2,
  User, AlertTriangle, Navigation, X
} from 'lucide-react';
import './CreateShipmentPage.css';

const MODES = [
  { value:'truck', label:'Truck',  icon:'🚛' },
  { value:'rail',  label:'Rail',   icon:'🚂' },
  { value:'ship',  label:'Ship',   icon:'🚢' },
  { value:'air',   label:'Air',    icon:'✈️' },
];

const RISK_COLORS = { low:'var(--risk-low)', medium:'var(--risk-medium)', high:'var(--risk-high)', critical:'var(--risk-critical)' };

function emptyLeg(n) {
  return {
    leg_number: n,
    origin:      { name:'', lat:null, lng:null },
    destination: { name:'', lat:null, lng:null },
    transport_mode: 'truck',
    vehicle_id: '',
    driver_id: '',
    stops: [],
    estimated_duration_min: '',
  };
}

function emptyStop() {
  return { location:{ name:'', lat:null, lng:null }, stop_duration_min:30 };
}

export default function CreateShipmentPage() {
  const navigate = useNavigate();
  const { userProfile, isAdmin } = useAuth();
  const [step, setStep]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskResult, setRiskResult] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [numLegs, setNumLegs] = useState(1);
  const [legs, setLegs] = useState([emptyLeg(1)]);

  const [cargo, setCargo] = useState({
    cargo_type: 'general',
    cargo_description: '',
    cargo_weight_kg: '',
    cargo_value: '',
    priority: 'normal',
    delivery_deadline: '',
    temperature_min: '',
    temperature_max: '',
    notes: '',
  });

  // Load drivers & vehicles on mount
  useEffect(() => {
    orgAPI.listUsers().then(r => {
      setDrivers((r.data.users||[]).filter(u => u.role === 'driver'));
    }).catch(()=>{});
    // vehicles from fleet API (use import if needed)
    import('../services/api').then(({ fleetAPI }) => {
      fleetAPI.listVehicles().then(r => setVehicles(r.data.vehicles||[])).catch(()=>{});
    });
  }, []);

  // Sync legs array when numLegs changes
  useEffect(() => {
    setLegs(prev => {
      const next = [...prev];
      while (next.length < numLegs) next.push(emptyLeg(next.length + 1));
      if (next.length > numLegs) next.splice(numLegs);
      return next;
    });
  }, [numLegs]);

  const updateLeg = (i, field, val) => setLegs(prev => {
    const next = [...prev];
    next[i] = { ...next[i], [field]: val };
    return next;
  });

  const updateStop = (li, si, field, val) => setLegs(prev => {
    const next = [...prev];
    const stops = [...next[li].stops];
    stops[si] = { ...stops[si], [field]: val };
    next[li] = { ...next[li], stops };
    return next;
  });

  const addStop = (li) => setLegs(prev => {
    const next = [...prev];
    next[li] = { ...next[li], stops: [...next[li].stops, emptyStop()] };
    return next;
  });

  const removeStop = (li, si) => setLegs(prev => {
    const next = [...prev];
    const stops = [...next[li].stops];
    stops.splice(si, 1);
    next[li] = { ...next[li], stops };
    return next;
  });

  const updateStopLocation = (li, si, loc) => setLegs(prev => {
    const next = [...prev];
    const stops = [...next[li].stops];
    stops[si] = { ...stops[si], location: loc };
    next[li] = { ...next[li], stops };
    return next;
  });

  const validateLegs = () => {
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (!l.origin.name) return `Leg ${i+1}: origin is required`;
      if (!l.destination.name) return `Leg ${i+1}: destination is required`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const legError = validateLegs();
    if (legError) { setError(legError); return; }
    if (!cargo.cargo_weight_kg) { setError('Cargo weight is required'); return; }
    setLoading(true);
    setError('');
    try {
      const firstLeg = legs[0];
      const lastLeg  = legs[legs.length - 1];
      const payload = {
        origin_name:     firstLeg.origin.name,
        origin_lat:      firstLeg.origin.lat || 0,
        origin_lng:      firstLeg.origin.lng || 0,
        destination_name: lastLeg.destination.name,
        destination_lat:  lastLeg.destination.lat || 0,
        destination_lng:  lastLeg.destination.lng || 0,
        cargo_type:        cargo.cargo_type,
        cargo_description: cargo.cargo_description,
        cargo_weight_kg:   parseFloat(cargo.cargo_weight_kg),
        cargo_value:       cargo.cargo_value ? parseFloat(cargo.cargo_value) : null,
        transport_mode:    firstLeg.transport_mode,
        priority:          cargo.priority,
        delivery_deadline: cargo.delivery_deadline || null,
        temperature_min:   cargo.temperature_min ? parseFloat(cargo.temperature_min) : null,
        temperature_max:   cargo.temperature_max ? parseFloat(cargo.temperature_max) : null,
        notes:             cargo.notes,
        route_legs: legs.map((l, idx) => ({
          origin: { name: l.origin.name, lat: l.origin.lat||0, lng: l.origin.lng||0, order: idx*2 },
          destination: { name: l.destination.name, lat: l.destination.lat||0, lng: l.destination.lng||0, order: idx*2+1 },
          transport_mode: l.transport_mode,
          vehicle_id: l.vehicle_id || null,
          driver_id: l.driver_id || null,
          stops: l.stops.map(s=>({ name:s.location.name, lat:s.location.lat||0, lng:s.location.lng||0, stop_duration_min:s.stop_duration_min })),
          estimated_duration_min: l.estimated_duration_min ? parseInt(l.estimated_duration_min) : null,
        })),
        waypoints: legs.flatMap((l, idx) =>
          l.stops.map(s => ({ name:s.location.name, lat:s.location.lat||0, lng:s.location.lng||0, order: idx*10, stop_duration_min:s.stop_duration_min }))
        ),
      };
      const res = await shipmentAPI.create(payload);
      setRiskResult(res.data.risk_evaluation);
      setStep(4);
    } catch(err) {
      setError(err.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-card" style={{textAlign:'center', padding:'3rem'}}>
        <AlertTriangle size={40} style={{color:'var(--risk-high)',margin:'0 auto 1rem'}}/>
        <h2>Admin Access Required</h2>
        <p style={{color:'var(--text-secondary)',marginTop:'0.5rem'}}>Only Admins can create shipments. Managers can submit a shipment request.</p>
        <button className="btn btn-primary" style={{marginTop:'1.25rem'}} onClick={()=>navigate('/request-shipment')}>
          Submit a Request
        </button>
      </div>
    );
  }

  const STEPS = ['Legs & Routes', 'Cargo Details', 'Review', 'Risk Analysis'];

  return (
    <div className="create-shipment-page animate-fade-in">
      <div className="page-header">
        <h1><Package size={22} className="icon"/>Create Shipment</h1>
        <button className="btn btn-ghost" onClick={()=>navigate('/shipments')}><ArrowLeft size={14}/>Back</button>
      </div>

      {/* Wizard progress */}
      <div className="wizard-progress">
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${step > i+1 ? 'completed' : ''} ${step === i+1 ? 'active' : ''}`}>
            <span className="wizard-dot">{step > i+1 ? <CheckCircle size={13}/> : i+1}</span>
            <span className="wizard-label">{label}</span>
            {i < STEPS.length-1 && <span style={{flex:1}}/>}
          </div>
        ))}
      </div>

      <div className="glass-card wizard-card">
        {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}

        {/* ── Step 1: Legs & Routes ── */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="step-title"><MapPin size={18} className="icon"/>Legs & Route Configuration</div>

            <div className="form-group" style={{marginBottom:'1.25rem'}}>
              <label className="form-label">Number of Transport Legs</label>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                <input className="form-input" type="number" min={1} max={10} value={numLegs}
                  onChange={e=>setNumLegs(Math.max(1, Math.min(10, parseInt(e.target.value)||1)))}
                  style={{maxWidth:100}}/>
                <span style={{fontSize:'0.8125rem',color:'var(--text-secondary)'}}>
                  {numLegs === 1 ? 'Single leg (direct)' : `Multi-leg shipment (${numLegs} transport legs)`}
                </span>
              </div>
            </div>

            {legs.map((leg, li) => (
              <div key={li} className="leg-card">
                <div className="leg-card-header">
                  <div className="leg-number">
                    <div className="leg-number-badge">{li+1}</div>
                    Leg {li+1}
                  </div>
                </div>

                {/* Origin & Destination */}
                <div className="grid grid-2" style={{marginBottom:'1rem'}}>
                  <div className="form-group">
                    <label className="form-label">Origin *</label>
                    <LocationSearchInput
                      value={leg.origin}
                      onChange={loc=>updateLeg(li,'origin',loc)}
                      placeholder="Search origin location…"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination *</label>
                    <LocationSearchInput
                      value={leg.destination}
                      onChange={loc=>updateLeg(li,'destination',loc)}
                      placeholder="Search destination location…"
                    />
                  </div>
                </div>

                {/* Transport Mode */}
                <div className="form-group" style={{marginBottom:'1rem'}}>
                  <label className="form-label">Transport Mode</label>
                  <div className="mode-selector">
                    {MODES.map(m=>(
                      <button key={m.value} type="button"
                        className={`mode-option ${leg.transport_mode===m.value?'selected':''}`}
                        onClick={()=>updateLeg(li,'transport_mode',m.value)}>
                        <span className="mode-icon">{m.icon}</span>{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vehicle & Driver */}
                <div className="grid grid-2" style={{marginBottom:'1rem'}}>
                  <div className="form-group">
                    <label className="form-label">Vehicle (optional)</label>
                    <select className="form-select" value={leg.vehicle_id} onChange={e=>updateLeg(li,'vehicle_id',e.target.value)}>
                      <option value="">Select vehicle…</option>
                      {vehicles.map(v=>(
                        <option key={v.id} value={v.id}>{v.registration_number} — {v.type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label"><User size={12} style={{display:'inline',verticalAlign:'-1px',marginRight:3}}/>Assigned Driver</label>
                    <select className="form-select" value={leg.driver_id} onChange={e=>updateLeg(li,'driver_id',e.target.value)}>
                      <option value="">Select driver…</option>
                      {drivers.map(d=>(
                        <option key={d.uid} value={d.uid}>{d.display_name || d.email}</option>
                      ))}
                    </select>
                    {drivers.length===0&&<div style={{fontSize:'0.6875rem',color:'var(--text-muted)',marginTop:4}}>No drivers found. Invite drivers from Team page.</div>}
                  </div>
                </div>

                {/* Stops */}
                <div style={{marginBottom:'0.5rem'}}>
                  <label className="form-label" style={{marginBottom:'0.5rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    Stop Points ({leg.stops.length})
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>addStop(li)}>
                      <Plus size={13}/>Add Stop
                    </button>
                  </label>
                  {leg.stops.map((stop, si)=>(
                    <div key={si} className="stop-card">
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                        <span style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-secondary)'}}>Stop {si+1}</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>removeStop(li,si)} style={{padding:'0.125rem 0.375rem'}}>
                          <X size={12}/>
                        </button>
                      </div>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Location</label>
                          <LocationSearchInput
                            value={stop.location}
                            onChange={loc=>updateStopLocation(li,si,loc)}
                            placeholder="Stop location…"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Stop Duration (min)</label>
                          <input className="form-input" type="number" min={0}
                            value={stop.stop_duration_min}
                            onChange={e=>updateStop(li,si,'stop_duration_min',parseInt(e.target.value)||0)}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button className="btn btn-primary btn-lg" style={{width:'100%',marginTop:'0.5rem'}}
              onClick={()=>{const e=validateLegs();if(e){setError(e);return;}setError('');setStep(2);}}>
              Continue <ArrowRight size={16}/>
            </button>
          </div>
        )}

        {/* ── Step 2: Cargo Details ── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="step-title"><Package size={18} className="icon"/>Cargo Details</div>
            <div className="grid grid-2" style={{marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Cargo Type</label>
                <select className="form-select" value={cargo.cargo_type} onChange={e=>setCargo(p=>({...p,cargo_type:e.target.value}))}>
                  <option value="general">General</option>
                  <option value="perishable">Perishable</option>
                  <option value="hazardous">Hazardous</option>
                  <option value="fragile">Fragile</option>
                  <option value="bulk">Bulk</option>
                  <option value="refrigerated">Refrigerated</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg) *</label>
                <input className="form-input" type="number" value={cargo.cargo_weight_kg}
                  onChange={e=>setCargo(p=>({...p,cargo_weight_kg:e.target.value}))} placeholder="e.g. 5000" required/>
              </div>
            </div>
            <div className="grid grid-2" style={{marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Cargo Value (₹ optional)</label>
                <input className="form-input" type="number" value={cargo.cargo_value}
                  onChange={e=>setCargo(p=>({...p,cargo_value:e.target.value}))} placeholder="e.g. 500000"/>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={cargo.priority} onChange={e=>setCargo(p=>({...p,priority:e.target.value}))}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            {(cargo.cargo_type==='refrigerated'||cargo.cargo_type==='perishable')&&(
              <div className="grid grid-2" style={{marginBottom:'1rem'}}>
                <div className="form-group"><label className="form-label">Min Temp (°C)</label><input className="form-input" type="number" value={cargo.temperature_min} onChange={e=>setCargo(p=>({...p,temperature_min:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Max Temp (°C)</label><input className="form-input" type="number" value={cargo.temperature_max} onChange={e=>setCargo(p=>({...p,temperature_max:e.target.value}))}/></div>
              </div>
            )}
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Delivery Deadline</label>
              <input className="form-input" type="datetime-local" value={cargo.delivery_deadline}
                onChange={e=>setCargo(p=>({...p,delivery_deadline:e.target.value}))}/>
            </div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Description / Notes</label>
              <textarea className="form-textarea" value={cargo.notes} rows={3}
                onChange={e=>setCargo(p=>({...p,notes:e.target.value}))} placeholder="Special handling instructions…"/>
            </div>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <button className="btn btn-secondary btn-lg" style={{flex:1}} onClick={()=>setStep(1)}><ArrowLeft size={14}/>Back</button>
              <button className="btn btn-primary btn-lg" style={{flex:2}} onClick={()=>{if(!cargo.cargo_weight_kg){setError('Weight required');return;}setError('');setStep(3);}}>
                Continue <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="step-title"><CheckCircle size={18} className="icon"/>Review & Submit</div>
            <div className="review-grid">
              <div className="review-item"><span className="review-label">Legs</span><span className="review-value">{legs.length} leg{legs.length>1?'s':''}</span></div>
              <div className="review-item"><span className="review-label">Route</span><span className="review-value">{legs[0].origin.name||'—'} → {legs[legs.length-1].destination.name||'—'}</span></div>
              {legs.map((l,i)=>(
                <div key={i} className="review-item">
                  <span className="review-label">Leg {i+1}</span>
                  <span className="review-value">{l.origin.name} → {l.destination.name} via {l.transport_mode}{l.stops.length>0?` (${l.stops.length} stop${l.stops.length>1?'s':''})`:''}
                  {l.driver_id&&<span style={{fontSize:'0.6875rem',color:'var(--text-muted)',marginLeft:4}}>Driver: {drivers.find(d=>d.uid===l.driver_id)?.display_name||l.driver_id}</span>}
                  </span>
                </div>
              ))}
              <div className="review-item"><span className="review-label">Cargo</span><span className="review-value capitalize">{cargo.cargo_type} — {cargo.cargo_weight_kg} kg</span></div>
              <div className="review-item"><span className="review-label">Priority</span><span className="review-value capitalize">{cargo.priority}</span></div>
              {cargo.delivery_deadline&&<div className="review-item"><span className="review-label">Deadline</span><span className="review-value">{new Date(cargo.delivery_deadline).toLocaleString()}</span></div>}
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.5rem'}}>
              <button className="btn btn-secondary btn-lg" style={{flex:1}} onClick={()=>setStep(2)}><ArrowLeft size={14}/>Back</button>
              <button className="btn btn-primary btn-lg" style={{flex:2}} onClick={handleSubmit} disabled={loading}>
                {loading?'Creating…':<><Rocket size={16}/>Create & Evaluate Risk</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Risk Result ── */}
        {step === 4 && riskResult && (
          <div className="animate-fade-in">
            <div className="step-title"><BarChart3 size={18} className="icon"/>Risk Analysis Results</div>
            <div className="risk-result-card" style={{borderColor:RISK_COLORS[riskResult.risk_level]}}>
              <div className="risk-result-header">
                <div>
                  <div className="risk-result-score" style={{color:RISK_COLORS[riskResult.risk_level]}}>{(riskResult.risk_score*100).toFixed(1)}%</div>
                  <span className={`badge badge-${riskResult.risk_level}`} style={{marginTop:'0.375rem'}}>{riskResult.risk_level} risk</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>Confidence</div>
                  <div style={{fontSize:'1.25rem',fontWeight:800,color:'var(--text-primary)'}}>{(riskResult.confidence*100).toFixed(0)}%</div>
                </div>
              </div>
              {riskResult.risk_factors&&(
                <div style={{marginTop:'1rem'}}>
                  <h4 style={{fontSize:'0.875rem',marginBottom:'0.625rem',color:'var(--text-primary)'}}>Risk Factors</h4>
                  <div className="risk-factors">
                    {Object.entries(riskResult.risk_factors).map(([k,v])=>(
                      <div key={k} className="risk-factor-item">
                        <span className="risk-factor-name">{k.replace(/_/g,' ')}</span>
                        <div className="risk-factor-bar"><div className="risk-factor-fill" style={{width:`${v*100}%`,background:v>0.7?'var(--risk-high)':v>0.4?'var(--risk-medium)':'var(--risk-low)'}}/></div>
                        <span className="risk-factor-val">{(v*100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {riskResult.alternatives?.length>0&&(
                <div className="alternatives-section">
                  <h4><RefreshCw size={13}/>Recommended Alternatives</h4>
                  {riskResult.alternatives.map((alt,i)=>(
                    <div key={i} className="alternative-card">
                      <span className={`badge badge-${alt.risk_score<0.4?'low':alt.risk_score<0.6?'medium':'high'}`}>{(alt.risk_score*100).toFixed(0)}%</span>
                      <span className="alt-desc">{alt.description}</span>
                      <span className="alt-impact">ETA: {alt.eta_impact_min>0?'+':''}{alt.eta_impact_min}min | Cost: {alt.cost_impact_pct>0?'+':''}{alt.cost_impact_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.5rem'}}>
              <button className="btn btn-primary btn-lg" style={{flex:1}} onClick={()=>navigate('/shipments')}>
                <CheckCircle size={16}/>View Shipments
              </button>
              <button className="btn btn-secondary" onClick={()=>navigate('/live-tracking')}>
                <Navigation size={14}/>Live Map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
