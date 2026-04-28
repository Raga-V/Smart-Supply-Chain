/**
 * ShipmentRequestsPage — Admin sees all pending requests; Manager sees their own.
 * Admin can approve, request modification, or reject.
 * Uses Firestore onSnapshot for real-time updates.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shipmentRequestAPI } from '../services/api';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { ClipboardList, CheckCircle, XCircle, Edit, Clock, RefreshCw, MapPin, Package } from 'lucide-react';

const STATUS_STYLES = {
  pending:           { label:'Pending',           badge:'badge-info' },
  approved:          { label:'Approved',           badge:'badge-low' },
  rejected:          { label:'Rejected',           badge:'badge-high' },
  needs_modification:{ label:'Needs Modification', badge:'badge-medium' },
};

export default function ShipmentRequestsPage() {
  const { userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [reviewId, setReviewId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ action:'approve', admin_notes:'' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const unsubRef = useRef(null);

  // Real-time Firestore listener for shipment requests
  useEffect(() => {
    if (!userProfile?.orgId) { setLoading(false); return; }

    const constraints = [where('org_id', '==', userProfile.orgId)];
    // Managers only see their own requests
    if (userProfile.role === 'manager') {
      constraints.push(where('requested_by', '==', userProfile.uid));
    }

    const q = query(
      collection(db, 'shipment_requests'),
      ...constraints,
      limit(100)
    );

    unsubRef.current = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by created_at descending
      docs.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || new Date(a.created_at || 0);
        const bTime = b.created_at?.toDate?.() || new Date(b.created_at || 0);
        return bTime - aTime;
      });
      setRequests(docs);
      setLoading(false);
    }, () => {
      // Fallback to REST API
      loadViaRest();
    });

    return () => unsubRef.current?.();
  }, [userProfile?.orgId, userProfile?.uid, userProfile?.role]);

  const loadViaRest = async () => {
    setLoading(true);
    try {
      const res = await shipmentRequestAPI.list();
      setRequests(res.data.requests || []);
    } catch {
      setRequests([]);
    } finally { setLoading(false); }
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);

  const handleReview = async () => {
    if (!reviewForm.action) return;
    setReviewLoading(true); setError('');
    try {
      await shipmentRequestAPI.review(reviewId, reviewForm);
      setReviewId(null);
      // onSnapshot will auto-update the list
    } catch(err) {
      setError(err.response?.data?.detail || 'Failed');
    } finally { setReviewLoading(false); }
  };

  return (
    <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
      <div className="page-header">
        <h1><ClipboardList size={22} className="icon"/>Shipment Requests</h1>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {!isAdmin && (
            <button className="btn btn-primary" onClick={()=>navigate('/request-shipment')}>
              + New Request
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
        {['all','pending','approved','rejected','needs_modification'].map(f=>(
          <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
            {f==='all'?`All (${requests.length})`:STATUS_STYLES[f]?.label} ({f==='all'?requests.length:requests.filter(r=>r.status===f).length})
          </button>
        ))}
        <button className="btn-icon" onClick={loadViaRest} title="Force refresh"><RefreshCw size={15}/></button>
      </div>

      {/* Live indicator */}
      <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.6875rem',color:'var(--risk-low)'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:'var(--risk-low)',animation:'pulse 1.5s infinite',display:'inline-block'}}/>
        Real-time updates active
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader-spinner" style={{width:28,height:28}}/></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <ClipboardList size={32} className="empty-icon"/>
            <p>{isAdmin ? 'No pending requests from managers.' : 'You haven\'t submitted any requests yet.'}</p>
            {!isAdmin && <button className="btn btn-primary btn-sm" onClick={()=>navigate('/request-shipment')}>Submit Request</button>}
          </div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {filtered.map(req => {
            const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            return (
              <div key={req.id} className="glass-card" style={{padding:'1.25rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'0.6875rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{req.id?.substring(0,12)}</div>
                    <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text-primary)'}}>{req.title}</h3>
                    {req.requested_by_name&&<div style={{fontSize:'0.75rem',color:'var(--text-secondary)',marginTop:'0.125rem'}}>By: {req.requested_by_name}</div>}
                  </div>
                  <span className={`badge ${s.badge}`}>{s.label}</span>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:'1rem',fontSize:'0.8125rem',color:'var(--text-secondary)',marginBottom:'0.875rem',flexWrap:'wrap'}}>
                  <span><MapPin size={12} style={{display:'inline',verticalAlign:'-1px',marginRight:3}}/>{req.origin_name} → {req.destination_name}</span>
                  <span><Package size={12} style={{display:'inline',verticalAlign:'-1px',marginRight:3}}/>{req.cargo_type} · {req.priority} priority</span>
                  {req.legs?.length>1&&<span>{req.legs.length} legs</span>}
                </div>

                {req.reason&&<div style={{background:'var(--bg-tertiary)',borderRadius:'var(--radius-sm)',padding:'0.625rem 0.875rem',fontSize:'0.8125rem',color:'var(--text-secondary)',marginBottom:'0.875rem',border:'1px solid var(--border-color-light)'}}>
                  <strong>Reason:</strong> {req.reason}
                </div>}

                {req.admin_notes&&<div className="alert-banner alert-banner-info" style={{marginBottom:'0.875rem',fontSize:'0.8125rem'}}>
                  <strong>Admin note:</strong> {req.admin_notes}
                </div>}

                {isAdmin && req.status === 'pending' && (
                  reviewId === req.id ? (
                    <div style={{background:'var(--bg-tertiary)',borderRadius:'var(--radius-md)',padding:'1rem',border:'1px solid var(--border-color-light)'}}>
                      {error&&<div className="auth-error" style={{marginBottom:'0.75rem'}}>{error}</div>}
                      <div className="form-group" style={{marginBottom:'0.75rem'}}>
                        <label className="form-label">Action</label>
                        <div style={{display:'flex',gap:'0.5rem'}}>
                          {['approve','reject','modify'].map(a=>(
                            <button key={a} type="button"
                              className={`filter-chip ${reviewForm.action===a?'active':''}`}
                              onClick={()=>setReviewForm(p=>({...p,action:a}))}>
                              {a==='approve'?'✓ Approve':a==='reject'?'✗ Reject':'✎ Modify'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group" style={{marginBottom:'0.75rem'}}>
                        <label className="form-label">Note to Manager</label>
                        <textarea className="form-textarea" rows={2} value={reviewForm.admin_notes}
                          onChange={e=>setReviewForm(p=>({...p,admin_notes:e.target.value}))}
                          placeholder="Optional note for the manager…"/>
                      </div>
                      <div style={{display:'flex',gap:'0.5rem'}}>
                        <button className="btn btn-primary btn-sm" onClick={handleReview} disabled={reviewLoading}>
                          {reviewLoading?'…':'Submit Review'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setReviewId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={()=>{setReviewId(req.id);setError('');}}>
                      <Edit size={13}/> Review Request
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
