import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { shipmentAPI, streamingAPI } from '../services/api';
import { LoadScript, GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import {
  Navigation, Activity, Play, Square, AlertTriangle,
  Truck, Train, Ship, Plane, RefreshCw, Radio,
  Clock, Zap, BarChart3, Package, Wind
} from 'lucide-react';
import './LiveTrackingPage.css';

const MAPS_KEY    = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const LIBS        = ['places'];

const RISK_COLORS = { low:'#16a34a', medium:'#d97706', high:'#dc2626', critical:'#b91c1c' };
const MODE_ICONS  = { truck: Truck, rail: Train, ship: Ship, air: Plane };
const MODE_COLORS = { truck:'#4f46e5', rail:'#0891b2', ship:'#0d9488', air:'#7c3aed' };

const MAP_STYLES = [
  { featureType:'water', elementType:'geometry', stylers:[{ color:'#dce9f5' }] },
  { featureType:'landscape', elementType:'geometry', stylers:[{ color:'#f4f6fb' }] },
  { featureType:'road', elementType:'geometry', stylers:[{ color:'#e2e8f0' }] },
  { featureType:'road.arterial', elementType:'geometry', stylers:[{ color:'#cbd5e1' }] },
  { featureType:'administrative', elementType:'stroke', stylers:[{ color:'#94a3b8' }] },
  { featureType:'poi', stylers:[{ visibility:'off' }] },
];

export default function LiveTrackingPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [shipments, setShipments]         = useState([]);
  const [selectedId, setSelectedId]       = useState(null);
  const [filter, setFilter]               = useState('all');
  const [activeSimulations, setActiveSims]= useState([]);
  const [simulatingId, setSimulatingId]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [infoOpen, setInfoOpen]           = useState(null);
  const [mapRef, setMapRef]               = useState(null);
  const unsubRef = useRef(null);

  // Real-time shipments
  useEffect(() => {
    if (!userProfile?.orgId) { setLoading(false); return; }
    const q = query(
      collection(db, 'shipments'),
      where('org_id', '==', userProfile.orgId),
      limit(50)
    );
    unsubRef.current = onSnapshot(q, snap => {
      setShipments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubRef.current?.();
  }, [userProfile?.orgId]);

  // Active GPS simulations
  useEffect(() => {
    streamingAPI.active().then(r => setActiveSims(r.data.active_simulations||[])).catch(()=>{});
    const iv = setInterval(() => {
      streamingAPI.active().then(r => setActiveSims(r.data.active_simulations||[])).catch(()=>{});
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleStartSim = async (id) => {
    setSimulatingId(id);
    try { await streamingAPI.start(id); setActiveSims(p=>[...new Set([...p,id])]); }
    catch {} finally { setSimulatingId(null); }
  };
  const handleStopSim = async (id) => {
    setSimulatingId(id);
    try { await streamingAPI.stop(id); setActiveSims(p=>p.filter(x=>x!==id)); }
    catch {} finally { setSimulatingId(null); }
  };

  const filtered = shipments.filter(s => {
    if (filter==='active')    return s.status==='in_transit';
    if (filter==='at_risk')   return ['high','critical'].includes(s.risk_level);
    if (filter==='live_gps')  return activeSimulations.includes(s.id);
    return true;
  });

  const selected    = shipments.find(s=>s.id===selectedId);
  const inTransit   = shipments.filter(s=>s.status==='in_transit').length;
  const atRisk      = shipments.filter(s=>['high','critical'].includes(s.risk_level)).length;
  const liveCount   = activeSimulations.length;

  const onMapLoad = useCallback(m => setMapRef(m), []);

  // Pan to selected shipment
  useEffect(() => {
    if (mapRef && selected?.current_lat) {
      mapRef.panTo({ lat: selected.current_lat, lng: selected.current_lng });
    }
  }, [selectedId, mapRef]);

  const mapCenter = { lat: 22, lng: 82 }; // India-center default, user can pan anywhere

  return (
    <LoadScript googleMapsApiKey={MAPS_KEY} libraries={LIBS} loadingElement={
      <div className="empty-state"><div className="loader-spinner" style={{width:32,height:32}}/><p>Loading map…</p></div>
    }>
      <div className="live-tracking-page animate-fade-in">
        <div className="tracking-header">
          <div className="tracking-title">
            <Navigation size={22} style={{color:'var(--accent-primary)'}}/>
            <h1>Live Tracking</h1>
            <div className="live-badge"><div className="live-dot"/>Live</div>
          </div>
          <div className="filter-bar">
            {[
              { key:'all',      label:`All (${shipments.length})` },
              { key:'active',   label:`In Transit (${inTransit})` },
              { key:'at_risk',  label:`At Risk (${atRisk})` },
              { key:'live_gps', label:`Live GPS (${liveCount})` },
            ].map(f=>(
              <button key={f.key} className={`filter-chip ${filter===f.key?'active':''}`} onClick={()=>setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tracking-body">
          {/* Google Map */}
          <div className="map-container glass-card" style={{padding:0,overflow:'hidden'}}>
            <GoogleMap
              onLoad={onMapLoad}
              mapContainerStyle={{ width:'100%', height:'100%' }}
              center={mapCenter}
              zoom={5}
              options={{ styles: MAP_STYLES, mapTypeControl:true, streetViewControl:false }}
            >
              {/* Route polylines */}
              {filtered.map(s => {
                if (!s.origin_lat || !s.destination_lat) return null;
                const color = RISK_COLORS[s.risk_level] || '#4f46e5';
                const isSelected = selectedId === s.id;
                return (
                  <Polyline
                    key={`route-${s.id}`}
                    path={[
                      { lat: s.origin_lat,      lng: s.origin_lng },
                      { lat: s.destination_lat, lng: s.destination_lng },
                    ]}
                    options={{
                      strokeColor: color,
                      strokeWeight: isSelected ? 4 : 2,
                      strokeOpacity: isSelected ? 0.9 : 0.35,
                      geodesic: true,
                    }}
                  />
                );
              })}

              {/* Vehicle markers */}
              {filtered.map(s => {
                if (!s.current_lat) return null;
                const color = RISK_COLORS[s.risk_level] || '#4f46e5';
                const isSelected = selectedId === s.id;
                return (
                  <Marker
                    key={`marker-${s.id}`}
                    position={{ lat: s.current_lat, lng: s.current_lng }}
                    onClick={() => { setSelectedId(s.id); setInfoOpen(s.id); }}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE,
                      fillColor: color,
                      fillOpacity: 0.9,
                      strokeColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)',
                      strokeWeight: isSelected ? 2 : 1,
                      scale: isSelected ? 10 : 7,
                    }}
                  >
                    {infoOpen === s.id && (
                      <InfoWindow onCloseClick={() => setInfoOpen(null)}>
                        <div style={{ minWidth: 180, fontFamily: 'var(--font-sans)' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{s.id?.substring(0,12)}</div>
                          <strong style={{ color: '#0f172a', fontSize: 13 }}>{s.origin_name} → {s.destination_name}</strong>
                          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, background: '#f4f6fb', borderRadius: 4, padding: '2px 6px', color: color, fontWeight: 700 }}>{s.risk_level} risk</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{(s.progress_pct||0).toFixed(0)}% done</span>
                          </div>
                          {s.current_speed_kmh && <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>{s.current_speed_kmh.toFixed(0)} km/h</div>}
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                );
              })}
            </GoogleMap>

            {/* Map overlay stats */}
            <div className="map-overlay-top">
              <div className="map-stat-chip"><Activity size={12} style={{color:'var(--risk-low)'}}/><strong>{inTransit}</strong> in transit</div>
              <div className="map-stat-chip"><AlertTriangle size={12} style={{color:'var(--risk-high)'}}/><strong>{atRisk}</strong> at risk</div>
              <div className="map-stat-chip"><Radio size={12} style={{color:'#4f46e5'}}/><strong>{liveCount}</strong> live GPS</div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="shipment-panel">
            {selected && (
              <div className="glass-card" style={{padding:'0.875rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.625rem'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'0.6875rem',color:'var(--text-muted)'}}>{selected.id?.substring(0,12)}</span>
                  <span className={`badge badge-${selected.risk_level||'low'}`}>{selected.risk_level}</span>
                </div>
                <div style={{fontWeight:600,fontSize:'0.875rem',marginBottom:'0.5rem'}}>
                  {selected.origin_name} → {selected.destination_name}
                </div>
                <div style={{marginBottom:'0.625rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.6875rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>
                    <span>Progress</span><span style={{fontWeight:600,color:'var(--text-primary)'}}>{(selected.progress_pct||0).toFixed(1)}%</span>
                  </div>
                  <div style={{height:6,background:'var(--bg-tertiary)',borderRadius:'var(--radius-full)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${selected.progress_pct||0}%`,background:RISK_COLORS[selected.risk_level]||'#4f46e5',borderRadius:'var(--radius-full)',transition:'width 1.5s ease'}}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',fontSize:'0.6875rem',color:'var(--text-muted)',marginBottom:'0.75rem'}}>
                  <div><Clock size={10} style={{marginRight:3}}/>{selected.eta_hours ? `${selected.eta_hours.toFixed(1)}h ETA` : '—'}</div>
                  <div><Zap size={10} style={{marginRight:3}}/>{selected.current_speed_kmh ? `${selected.current_speed_kmh} km/h` : '—'}</div>
                  <div><BarChart3 size={10} style={{marginRight:3}}/>{selected.remaining_distance_km ? `${selected.remaining_distance_km.toFixed(0)} km left` : '—'}</div>
                  <div style={{color:selected.disruption_active?'#dc2626':'var(--text-muted)'}}>
                    <Wind size={10} style={{marginRight:3}}/>{selected.disruption_active?'Disruption!':'Normal'}
                  </div>
                </div>
                {selected.disruption_active && (
                  <div className="disruption-banner"><AlertTriangle size={13}/> Active disruption on route</div>
                )}
                <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
                  {activeSimulations.includes(selected.id) ? (
                    <button className="btn btn-sm btn-secondary" style={{flex:1,borderColor:'#dc2626',color:'#dc2626'}} onClick={()=>handleStopSim(selected.id)} disabled={simulatingId===selected.id}>
                      <Square size={12}/> Stop GPS
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-primary" style={{flex:1}} onClick={()=>handleStartSim(selected.id)} disabled={simulatingId===selected.id||selected.status==='delivered'}>
                      {simulatingId===selected.id ? <><RefreshCw size={12} className="animate-spin"/>Starting…</> : <><Play size={12}/> Start GPS</>}
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={()=>navigate(`/shipments/${selected.id}`)}>Details</button>
                </div>
              </div>
            )}

            <div className="glass-card" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',padding:'0.875rem'}}>
              <div style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-secondary)',marginBottom:'0.625rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <Package size={14}/> Shipments ({filtered.length})
              </div>
              <div className="panel-scroll">
                {loading ? (
                  <div style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}>
                    <RefreshCw size={20} className="animate-spin" style={{margin:'0 auto 0.5rem'}}/>
                    <div style={{fontSize:'0.75rem'}}>Loading…</div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state"><Navigation size={28} className="empty-icon"/><p>No shipments match this filter</p></div>
                ) : filtered.map(s => {
                  const isLive  = activeSimulations.includes(s.id);
                  const color   = RISK_COLORS[s.risk_level] || '#4f46e5';
                  const ModeIcon = MODE_ICONS[s.transport_mode] || Truck;
                  return (
                    <div key={s.id}
                      className={`track-card ${selectedId===s.id?'active-card':''}`}
                      style={{'--card-accent':color}}
                      onClick={()=>{ setSelectedId(selectedId===s.id?null:s.id); setInfoOpen(s.id); }}>
                      <div className="track-card-header">
                        <span className="track-card-id">{s.id?.substring(0,10)}</span>
                        <span className={`badge badge-${s.risk_level||'low'}`} style={{fontSize:'0.5625rem'}}>{s.risk_level}</span>
                      </div>
                      <div className="track-card-route">
                        <ModeIcon size={11} style={{display:'inline',marginRight:5,verticalAlign:'-1px'}}/>
                        {s.origin_name} → {s.destination_name}
                      </div>
                      <div className="track-card-progress">
                        <div className="progress-bar"><div className="progress-fill" style={{width:`${s.progress_pct||0}%`,background:color}}/></div>
                        <span className="progress-pct">{(s.progress_pct||0).toFixed(0)}%</span>
                      </div>
                      <div className="track-card-meta">
                        <span style={{textTransform:'capitalize',color:s.status==='in_transit'?'var(--risk-low)':'var(--text-muted)'}}>{s.status?.replace('_',' ')}</span>
                        {isLive && <span className="sim-indicator"><span className="sim-dot"/>Live GPS</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadScript>
  );
}
