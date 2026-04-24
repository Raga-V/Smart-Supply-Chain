/**
 * DriverTrackingPage — Real GPS sharing for drivers.
 * Uses navigator.geolocation.watchPosition() to stream driver position
 * to Firestore every 5 seconds, updating the shipment's current_lat/lng.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
  collection, query, where, onSnapshot, limit, doc, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { Navigation, Play, Square, AlertTriangle, MapPin, Activity, CheckCircle } from 'lucide-react';

const RISK_COLORS = { low:'#16a34a', medium:'#d97706', high:'#dc2626', critical:'#b91c1c' };

export default function DriverTrackingPage() {
  const { userProfile } = useAuth();
  const [shipment, setShipment]     = useState(null);
  const [tracking, setTracking]     = useState(false);
  const [position, setPosition]     = useState(null);
  const [status, setStatus]         = useState('idle'); // idle | starting | tracking | error
  const [error, setError]           = useState('');
  const watchId = useRef(null);
  const updateInterval = useRef(null);

  // Find active shipment assigned to this driver
  useEffect(() => {
    if (!userProfile?.orgId || !userProfile?.uid) return;
    const q = query(
      collection(db, 'shipments'),
      where('org_id', '==', userProfile.orgId),
      where('status', '==', 'in_transit'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Find shipment where this driver is assigned in any leg
      const mine = all.find(s =>
        s.assigned_drivers &&
        Object.values(s.assigned_drivers).includes(userProfile.uid)
      ) || all[0]; // fallback: first in-transit if no specific assignment
      setShipment(mine || null);
    });
    return unsub;
  }, [userProfile?.orgId, userProfile?.uid]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }
    setStatus('starting');
    setError('');

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const coords = { lat: latitude, lng: longitude, speed_kmh: speed ? speed * 3.6 : null, accuracy };
        setPosition(coords);
        setStatus('tracking');
        setTracking(true);

        if (!shipment?.id) return;
        try {
          // Write GPS breadcrumb
          const gpsRef = doc(collection(db, 'shipments', shipment.id, 'gps_track'), `${Date.now()}`);
          await setDoc(gpsRef, {
            lat: latitude, lng: longitude,
            speed_kmh: coords.speed_kmh,
            accuracy,
            driver_id: userProfile.uid,
            driver_name: userProfile.displayName || userProfile.email,
          });
          // Update shipment current position
          const shipRef = doc(db, 'shipments', shipment.id);
          await updateDoc(shipRef, {
            current_lat: latitude,
            current_lng: longitude,
            current_speed_kmh: coords.speed_kmh,
            last_gps_update: serverTimestamp(),
          });
        } catch (e) { console.error('GPS write failed', e); }
      },
      (err) => {
        setStatus('error');
        setError(err.code === 1 ? 'Location permission denied. Please allow location access.' :
                 err.code === 2 ? 'Position unavailable. Check GPS signal.' :
                 'Location request timed out.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
    setStatus('idle');
  };

  useEffect(() => () => stopTracking(), []);

  if (userProfile?.role !== 'driver') {
    return (
      <div className="glass-card" style={{textAlign:'center',padding:'3rem',maxWidth:420,margin:'2rem auto'}}>
        <AlertTriangle size={40} style={{color:'var(--risk-medium)',margin:'0 auto 1rem'}}/>
        <h2>Drivers Only</h2>
        <p style={{color:'var(--text-secondary)'}}>This page is only accessible to users with the Driver role.</p>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.25rem',maxWidth:560,margin:'0 auto'}}>
      <div className="page-header">
        <h1><Navigation size={22} className="icon"/>My Delivery</h1>
        <div className="live-dot-anim" style={tracking?{}:{background:'var(--text-muted)',animation:'none'}}/>
      </div>

      {/* Active Shipment */}
      {shipment ? (
        <div className="glass-card" style={{padding:'1.5rem'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1rem'}}>
            <div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.6875rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{shipment.id?.substring(0,12)}</div>
              <h2 style={{fontSize:'1.0625rem',fontWeight:800,color:'var(--text-primary)'}}>{shipment.origin_name} → {shipment.destination_name}</h2>
            </div>
            <span className={`badge badge-${shipment.risk_level||'low'}`} style={{fontSize:'0.75rem'}}>{shipment.risk_level} risk</span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1.25rem'}}>
            {[
              {label:'Status',value:shipment.status?.replace('_',' ')},
              {label:'Progress',value:`${(shipment.progress_pct||0).toFixed(0)}%`},
              {label:'Transport',value:shipment.transport_mode},
              {label:'Priority',value:shipment.priority},
            ].map(f=>(
              <div key={f.label} style={{padding:'0.625rem',background:'var(--bg-tertiary)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color-light)'}}>
                <div style={{fontSize:'0.6875rem',color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{f.label}</div>
                <div style={{fontSize:'0.9375rem',fontWeight:700,textTransform:'capitalize'}}>{f.value||'—'}</div>
              </div>
            ))}
          </div>

          <div style={{marginBottom:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.375rem'}}>
              <span>Route Progress</span><span style={{fontWeight:700,color:'var(--text-primary)'}}>{(shipment.progress_pct||0).toFixed(1)}%</span>
            </div>
            <div style={{height:10,background:'var(--bg-tertiary)',borderRadius:'var(--radius-full)',overflow:'hidden',border:'1px solid var(--border-color-light)'}}>
              <div style={{height:'100%',width:`${shipment.progress_pct||0}%`,background:RISK_COLORS[shipment.risk_level]||'#16a34a',borderRadius:'var(--radius-full)',transition:'width 1s ease'}}/>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card">
          <div className="empty-state" style={{padding:'2.5rem'}}>
            <Navigation size={36} className="empty-icon"/>
            <p>No active shipment assigned to you. Contact your Fleet Manager.</p>
          </div>
        </div>
      )}

      {/* GPS Controls */}
      <div className="glass-card" style={{padding:'1.5rem'}}>
        <h3 style={{display:'flex',alignItems:'center',gap:'0.375rem',marginBottom:'1rem',fontWeight:700}}>
          <Activity size={18} style={{color:'var(--accent-primary)'}}/> GPS Tracking
        </h3>

        {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}

        {position && (
          <div style={{background:'var(--bg-tertiary)',borderRadius:'var(--radius-md)',padding:'0.875rem',marginBottom:'1rem',border:'1px solid var(--border-color-light)'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-muted)',marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Current Position</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',fontSize:'0.875rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>Lat: </span><strong>{position.lat.toFixed(6)}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Lng: </span><strong>{position.lng.toFixed(6)}</strong></div>
              {position.speed_kmh&&<div><span style={{color:'var(--text-muted)'}}>Speed: </span><strong>{position.speed_kmh.toFixed(0)} km/h</strong></div>}
              <div><span style={{color:'var(--text-muted)'}}>Accuracy: </span><strong>{position.accuracy?.toFixed(0)}m</strong></div>
            </div>
          </div>
        )}

        {tracking ? (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            <div className="alert-banner" style={{background:'rgba(22,163,74,0.08)',color:'#16a34a',border:'1px solid rgba(22,163,74,0.20)',display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <div className="live-dot-anim"/><strong>Live GPS Active</strong> — Broadcasting your location every 5 seconds
            </div>
            <button className="btn btn-danger btn-lg" style={{width:'100%'}} onClick={stopTracking}>
              <Square size={16}/> Stop GPS Tracking
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            style={{width:'100%'}}
            onClick={startTracking}
            disabled={status==='starting' || !shipment}
          >
            {status==='starting' ? (
              <><span className="loader-spinner" style={{width:18,height:18,borderWidth:2}}/> Acquiring GPS…</>
            ) : (
              <><Navigation size={16}/> Start GPS Tracking</>
            )}
          </button>
        )}

        <p style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.75rem',textAlign:'center',lineHeight:1.6}}>
          Your location will be shared with your logistics team while tracking is active.
          {!window.isSecureContext && ' ⚠️ HTTPS required for GPS in production.'}
        </p>
      </div>
    </div>
  );
}
