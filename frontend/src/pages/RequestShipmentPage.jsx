/**
 * RequestShipmentPage — Manager submits shipment request with full details.
 * Admin receives and approves/rejects/modifies.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LocationSearchInput from '../components/LocationSearchInput';
import { shipmentRequestAPI } from '../services/api';
import { ClipboardList, MapPin, Package, ArrowRight, ArrowLeft, CheckCircle, Plus, X } from 'lucide-react';
import './CreateShipmentPage.css';

const MODES = [
  { value:'truck', label:'Truck', icon:'🚛' },
  { value:'rail',  label:'Rail',  icon:'🚂' },
  { value:'ship',  label:'Ship',  icon:'🚢' },
  { value:'air',   label:'Air',   icon:'✈️' },
];

function emptyLeg(n) {
  return { leg_number:n, origin:{name:'',lat:null,lng:null}, destination:{name:'',lat:null,lng:null}, transport_mode:'truck', stops:[] };
}

export default function RequestShipmentPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [numLegs, setNumLegs] = useState(1);
  const [legs, setLegs] = useState([emptyLeg(1)]);
  const [cargo, setCargo] = useState({
    title:'', cargo_type:'general', cargo_weight_kg:'', cargo_value:'',
    priority:'normal', delivery_deadline:'', notes:'', reason:'',
  });

  useEffect(() => {
    setLegs(prev => {
      const next=[...prev];
      while(next.length<numLegs) next.push(emptyLeg(next.length+1));
      if(next.length>numLegs) next.splice(numLegs);
      return next;
    });
  }, [numLegs]);

  const updateLeg=(i,f,v)=>setLegs(p=>{const n=[...p];n[i]={...n[i],[f]:v};return n;});

  const handleSubmit = async () => {
    if (!cargo.title) { setError('Title is required'); return; }
    if (!legs[0].origin.name) { setError('Origin is required'); return; }
    if (!legs[legs.length-1].destination.name) { setError('Destination is required'); return; }
    setLoading(true); setError('');
    try {
      await shipmentRequestAPI.create({
        title: cargo.title,
        origin_name: legs[0].origin.name,
        destination_name: legs[legs.length-1].destination.name,
        cargo_type: cargo.cargo_type,
        cargo_weight_kg: cargo.cargo_weight_kg ? parseFloat(cargo.cargo_weight_kg) : null,
        cargo_value: cargo.cargo_value ? parseFloat(cargo.cargo_value) : null,
        priority: cargo.priority,
        delivery_deadline: cargo.delivery_deadline || null,
        transport_mode: legs[0].transport_mode,
        legs: legs.map((l,i)=>({
          leg_number: i+1,
          origin_name: l.origin.name,
          origin_lat: l.origin.lat,
          origin_lng: l.origin.lng,
          destination_name: l.destination.name,
          destination_lat: l.destination.lat,
          destination_lng: l.destination.lng,
          transport_mode: l.transport_mode,
          stops: l.stops,
        })),
        notes: cargo.notes,
        reason: cargo.reason,
      });
      setSuccess(true);
    } catch(err) {
      setError(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card" style={{textAlign:'center',padding:'3rem',maxWidth:480,margin:'2rem auto'}}>
        <CheckCircle size={48} style={{color:'var(--risk-low)',margin:'0 auto 1rem'}}/>
        <h2>Request Submitted!</h2>
        <p style={{color:'var(--text-secondary)',margin:'0.75rem 0 1.5rem'}}>
          Your shipment request has been sent to the Admin for review. You'll receive a notification once it's reviewed.
        </p>
        <div style={{display:'flex',gap:'0.75rem',justifyContent:'center'}}>
          <button className="btn btn-primary" onClick={()=>navigate('/shipment-requests')}>View My Requests</button>
          <button className="btn btn-secondary" onClick={()=>navigate('/dashboard')}>Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-shipment-page animate-fade-in">
      <div className="page-header">
        <h1><ClipboardList size={22} className="icon"/>Request Shipment</h1>
        <span style={{fontSize:'0.8125rem',color:'var(--text-secondary)'}}>Your request will be reviewed by an Admin</span>
      </div>

      <div className="glass-card wizard-card">
        {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}

        {step === 1 && (
          <div className="animate-fade-in">
            <div className="step-title"><ClipboardList size={18} className="icon"/>Request Overview</div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Request Title *</label>
              <input className="form-input" value={cargo.title} onChange={e=>setCargo(p=>({...p,title:e.target.value}))} placeholder="e.g. Urgent Electronics Delivery to Bangalore" required/>
            </div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Number of Legs</label>
              <input className="form-input" type="number" min={1} max={10} value={numLegs} onChange={e=>setNumLegs(Math.max(1,Math.min(10,parseInt(e.target.value)||1)))} style={{maxWidth:100}}/>
            </div>
            {legs.map((leg,li)=>(
              <div key={li} className="leg-card">
                <div className="leg-card-header">
                  <div className="leg-number"><div className="leg-number-badge">{li+1}</div>Leg {li+1}</div>
                </div>
                <div className="grid grid-2" style={{marginBottom:'0.875rem'}}>
                  <div className="form-group">
                    <label className="form-label">Origin *</label>
                    <LocationSearchInput value={leg.origin} onChange={loc=>updateLeg(li,'origin',loc)} placeholder="Origin location…"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination *</label>
                    <LocationSearchInput value={leg.destination} onChange={loc=>updateLeg(li,'destination',loc)} placeholder="Destination location…"/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Transport Mode</label>
                  <div className="mode-selector">
                    {MODES.map(m=>(
                      <button key={m.value} type="button" className={`mode-option ${leg.transport_mode===m.value?'selected':''}`}
                        onClick={()=>updateLeg(li,'transport_mode',m.value)}>
                        <span className="mode-icon">{m.icon}</span>{m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-primary btn-lg" style={{width:'100%'}} onClick={()=>{
              if(!cargo.title){setError('Title required');return;}
              if(!legs[0].origin.name){setError('Origin required');return;}
              if(!legs[legs.length-1].destination.name){setError('Destination required');return;}
              setError(''); setStep(2);
            }}>
              Continue <ArrowRight size={16}/>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <div className="step-title"><Package size={18} className="icon"/>Cargo & Priority</div>
            <div className="grid grid-2" style={{marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Cargo Type</label>
                <select className="form-select" value={cargo.cargo_type} onChange={e=>setCargo(p=>({...p,cargo_type:e.target.value}))}>
                  <option value="general">General</option><option value="perishable">Perishable</option>
                  <option value="hazardous">Hazardous</option><option value="fragile">Fragile</option>
                  <option value="bulk">Bulk</option><option value="refrigerated">Refrigerated</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={cargo.priority} onChange={e=>setCargo(p=>({...p,priority:e.target.value}))}>
                  <option value="low">Low</option><option value="normal">Normal</option>
                  <option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2" style={{marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input className="form-input" type="number" value={cargo.cargo_weight_kg} onChange={e=>setCargo(p=>({...p,cargo_weight_kg:e.target.value}))} placeholder="5000"/>
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Deadline</label>
                <input className="form-input" type="datetime-local" value={cargo.delivery_deadline} onChange={e=>setCargo(p=>({...p,delivery_deadline:e.target.value}))}/>
              </div>
            </div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Reason for Request</label>
              <textarea className="form-textarea" rows={2} value={cargo.reason} onChange={e=>setCargo(p=>({...p,reason:e.target.value}))} placeholder="Why is this shipment needed?"/>
            </div>
            <div className="form-group" style={{marginBottom:'1.25rem'}}>
              <label className="form-label">Additional Notes</label>
              <textarea className="form-textarea" rows={2} value={cargo.notes} onChange={e=>setCargo(p=>({...p,notes:e.target.value}))} placeholder="Special handling requirements…"/>
            </div>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <button className="btn btn-secondary btn-lg" style={{flex:1}} onClick={()=>setStep(1)}><ArrowLeft size={14}/>Back</button>
              <button className="btn btn-primary btn-lg" style={{flex:2}} onClick={handleSubmit} disabled={loading}>
                {loading?'Submitting…':<><CheckCircle size={16}/>Submit Request</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
