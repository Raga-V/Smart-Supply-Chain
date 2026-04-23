import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentAPI } from '../services/api';
import './CreateShipmentPage.css';

const INDIAN_CITIES = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
];

export default function CreateShipmentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskResult, setRiskResult] = useState(null);

  const [form, setForm] = useState({
    origin: '', destination: '',
    cargo_type: 'general', cargo_description: '',
    cargo_weight_kg: '', cargo_value: '',
    transport_mode: 'truck', priority: 'normal',
    delivery_deadline: '', notes: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const originCity = INDIAN_CITIES.find(c => c.name === form.origin);
  const destCity = INDIAN_CITIES.find(c => c.name === form.destination);

  const handleSubmit = async () => {
    if (!originCity || !destCity) { setError('Select valid origin and destination'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await shipmentAPI.create({
        origin_name: form.origin,
        origin_lat: originCity.lat,
        origin_lng: originCity.lng,
        destination_name: form.destination,
        destination_lat: destCity.lat,
        destination_lng: destCity.lng,
        cargo_type: form.cargo_type,
        cargo_description: form.cargo_description,
        cargo_weight_kg: parseFloat(form.cargo_weight_kg) || 100,
        cargo_value: parseFloat(form.cargo_value) || null,
        transport_mode: form.transport_mode,
        priority: form.priority,
        delivery_deadline: form.delivery_deadline || null,
        notes: form.notes,
      });
      setRiskResult(res.data.risk_evaluation);
      setStep(4); // Show risk result
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  const RISK_COLORS = { low: 'var(--risk-low)', medium: 'var(--risk-medium)', high: 'var(--risk-high)', critical: 'var(--risk-critical)' };

  return (
    <div className="create-shipment-page animate-fade-in">
      <div className="page-header">
        <h1>➕ Create Shipment</h1>
        <button className="btn btn-ghost" onClick={() => navigate('/shipments')}>← Back</button>
      </div>

      {/* Progress */}
      <div className="wizard-progress">
        {['Route', 'Cargo Details', 'Review', 'Risk Analysis'].map((label, i) => (
          <div key={i} className={`wizard-step ${step > i ? 'completed' : ''} ${step === i + 1 ? 'active' : ''}`}>
            <span className="wizard-dot">{step > i + 1 ? '✓' : i + 1}</span>
            <span className="wizard-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="glass-card wizard-card">
        {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Step 1: Route */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 className="step-title">📍 Route Configuration</h3>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Origin City</label>
                <select className="form-select" value={form.origin} onChange={e => update('origin', e.target.value)}>
                  <option value="">Select origin</option>
                  {INDIAN_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Destination City</label>
                <select className="form-select" value={form.destination} onChange={e => update('destination', e.target.value)}>
                  <option value="">Select destination</option>
                  {INDIAN_CITIES.filter(c => c.name !== form.origin).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Transport Mode</label>
                <select className="form-select" value={form.transport_mode} onChange={e => update('transport_mode', e.target.value)}>
                  <option value="truck">🚛 Truck</option>
                  <option value="rail">🚂 Rail</option>
                  <option value="ship">🚢 Ship</option>
                  <option value="air">✈️ Air</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => update('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setStep(2)} disabled={!form.origin || !form.destination}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Cargo */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h3 className="step-title">📦 Cargo Details</h3>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Cargo Type</label>
                <select className="form-select" value={form.cargo_type} onChange={e => update('cargo_type', e.target.value)}>
                  <option value="general">General</option>
                  <option value="perishable">Perishable</option>
                  <option value="hazardous">Hazardous</option>
                  <option value="fragile">Fragile</option>
                  <option value="bulk">Bulk</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input className="form-input" type="number" value={form.cargo_weight_kg} onChange={e => update('cargo_weight_kg', e.target.value)} placeholder="e.g. 5000" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Delivery Deadline</label>
              <input className="form-input" type="datetime-local" value={form.delivery_deadline} onChange={e => update('delivery_deadline', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Special instructions..." />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h3 className="step-title">✅ Review & Submit</h3>
            <div className="review-grid">
              <div className="review-item"><span className="review-label">Route</span><span className="review-value">{form.origin} → {form.destination}</span></div>
              <div className="review-item"><span className="review-label">Mode</span><span className="review-value">{form.transport_mode}</span></div>
              <div className="review-item"><span className="review-label">Cargo</span><span className="review-value">{form.cargo_type} — {form.cargo_weight_kg || '—'} kg</span></div>
              <div className="review-item"><span className="review-label">Priority</span><span className="review-value">{form.priority}</span></div>
              {form.delivery_deadline && <div className="review-item"><span className="review-label">Deadline</span><span className="review-value">{new Date(form.delivery_deadline).toLocaleString()}</span></div>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : '🚀 Create & Evaluate Risk'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Risk Result */}
        {step === 4 && riskResult && (
          <div className="animate-fade-in">
            <h3 className="step-title">📊 Pre-Dispatch Risk Analysis</h3>
            <div className="risk-result-card" style={{ borderColor: RISK_COLORS[riskResult.risk_level] }}>
              <div className="risk-result-header">
                <div>
                  <div className="risk-result-score" style={{ color: RISK_COLORS[riskResult.risk_level] }}>
                    {(riskResult.risk_score * 100).toFixed(1)}%
                  </div>
                  <div className={`badge badge-${riskResult.risk_level}`}>{riskResult.risk_level} risk</div>
                </div>
                <div className="risk-confidence">
                  <span className="form-label">Confidence</span>
                  <span className="risk-conf-value">{(riskResult.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Risk Factors</h4>
              <div className="risk-factors">
                {Object.entries(riskResult.risk_factors || {}).map(([key, val]) => (
                  <div key={key} className="risk-factor-item">
                    <span className="risk-factor-name">{key.replace('_', ' ')}</span>
                    <div className="risk-factor-bar"><div className="risk-factor-fill" style={{ width: `${val * 100}%`, background: val > 0.7 ? 'var(--risk-high)' : val > 0.4 ? 'var(--risk-medium)' : 'var(--risk-low)' }}></div></div>
                    <span className="risk-factor-val">{(val * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              {riskResult.alternatives?.length > 0 && (
                <div className="alternatives-section">
                  <h4>🔄 Recommended Alternatives</h4>
                  {riskResult.alternatives.map((alt, i) => (
                    <div key={i} className="alternative-card">
                      <span className={`badge badge-${alt.risk_score < 0.4 ? 'low' : alt.risk_score < 0.6 ? 'medium' : 'high'}`}>{(alt.risk_score * 100).toFixed(0)}% risk</span>
                      <span className="alt-desc">{alt.description}</span>
                      <span className="alt-impact">ETA: {alt.eta_impact_min > 0 ? '+' : ''}{alt.eta_impact_min}min | Cost: {alt.cost_impact_pct > 0 ? '+' : ''}{alt.cost_impact_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => navigate('/shipments')}>
              ✅ Done — View Shipments
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
