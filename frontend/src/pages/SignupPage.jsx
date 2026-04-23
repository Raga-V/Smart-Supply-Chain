import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './AuthPages.css';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    orgName: '',
    industry: 'logistics',
    country: 'India',
    adminName: '',
    adminEmail: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Create Firebase user
      await signup(form.adminEmail, form.password, form.adminName);

      // 2. Create organization via backend
      await authAPI.signup({
        name: form.orgName,
        industry: form.industry,
        country: form.country,
        admin_email: form.adminEmail,
        admin_name: form.adminName,
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || err.message?.replace('Firebase: ', '') || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-grid"></div>
      <div className="auth-container auth-container-wide animate-fade-in-scale">
        <div className="auth-header">
          <div className="auth-logo">
            <span className="auth-logo-icon">⚡</span>
            <h1>Create Organization</h1>
          </div>
          <p className="auth-subtitle">Set up your supply chain intelligence platform</p>
        </div>

        {/* Progress Steps */}
        <div className="signup-steps">
          <div className={`signup-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Organization</span>
          </div>
          <div className="step-connector"></div>
          <div className={`signup-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Admin Account</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {step === 1 && (
            <div className="animate-fade-in">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-org">Organization Name</label>
                <input id="signup-org" className="form-input" value={form.orgName} onChange={e => updateField('orgName', e.target.value)} placeholder="Acme Logistics" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-industry">Industry</label>
                <select id="signup-industry" className="form-select" value={form.industry} onChange={e => updateField('industry', e.target.value)}>
                  <option value="logistics">Logistics & Transport</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="retail">Retail & E-commerce</option>
                  <option value="pharma">Pharmaceuticals</option>
                  <option value="food">Food & Beverage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-country">Country</label>
                <input id="signup-country" className="form-input" value={form.country} onChange={e => updateField('country', e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary btn-lg auth-btn" onClick={() => setStep(2)} disabled={!form.orgName}>
                Continue →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">Your Name</label>
                <input id="signup-name" className="form-input" value={form.adminName} onChange={e => updateField('adminName', e.target.value)} placeholder="Jane Doe" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">Email</label>
                <input id="signup-email" className="form-input" type="email" value={form.adminEmail} onChange={e => updateField('adminEmail', e.target.value)} placeholder="you@company.com" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-pw">Password</label>
                <input id="signup-pw" className="form-input" type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Min 6 characters" minLength={6} required />
              </div>
              <div style={{display:'flex', gap:'0.75rem'}}>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(1)} style={{flex:1}}>← Back</button>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{flex:2}}>
                  {loading ? <span className="loader-spinner" style={{width:20,height:20,borderWidth:2}}></span> : 'Create Organization'}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
