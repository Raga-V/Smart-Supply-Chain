import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  Building2, UserPlus, ChevronRight, CheckCircle2,
  Zap, Navigation, Shield, ArrowLeft, Eye, EyeOff,
  Mail, Lock, User, Globe, Briefcase
} from 'lucide-react';
import './AuthPages.css';

const INDUSTRIES = [
  { value: 'logistics',      label: 'Logistics & Transport' },
  { value: 'manufacturing',  label: 'Manufacturing' },
  { value: 'retail',         label: 'Retail & E-commerce' },
  { value: 'pharma',         label: 'Pharmaceuticals' },
  { value: 'food',           label: 'Food & Beverage' },
  { value: 'automotive',     label: 'Automotive' },
  { value: 'tech',           label: 'Technology' },
  { value: 'other',          label: 'Other' },
];

const STEPS = [
  { num: 1, label: 'Organization' },
  { num: 2, label: 'Admin Account' },
  { num: 3, label: 'Confirmation' },
];

export default function SignupPage() {
  const [step, setStep]     = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm] = useState({
    orgName: '', industry: 'logistics', country: '', website: '',
    adminName: '', adminEmail: '', password: '', confirmPw: '',
  });

  const { signup } = useAuth();
  const navigate = useNavigate();

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const goNext = () => {
    setError('');
    if (step === 1 && !form.orgName) { setError('Organization name is required'); return; }
    if (step === 2) {
      if (!form.adminName || !form.adminEmail || !form.password) { setError('All fields are required'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (form.password !== form.confirmPw) { setError('Passwords do not match'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Create Firebase user
      await signup(form.adminEmail, form.password, form.adminName);
      // 2. Create org + set admin claims via backend
      await authAPI.signup({
        name: form.orgName,
        industry: form.industry,
        country: form.country,
        admin_email: form.adminEmail,
        admin_name: form.adminName,
      });
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message?.replace('Firebase: ', '') || 'Setup failed';
      setError(msg.replace(' (auth/email-already-in-use).', ' — this email is already registered. Try signing in.'));
    } finally {
      setLoading(false);
    }
  };

  const FEATURES = [
    { icon: Navigation, text: 'AI-powered multi-leg route optimization' },
    { icon: Shield,     text: 'Real-time risk prediction & intelligent alerts' },
    { icon: Zap,        text: 'Live GPS driver tracking worldwide' },
  ];

  return (
    <div className="auth-page">
      <div className="auth-split">
        {/* Left branding */}
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-brand-mark">R</div>
            <span className="auth-brand-name">Raga<span>-V</span></span>
          </div>
          <h1 className="auth-left-title">
            Build your intelligent<br />logistics organization.
          </h1>
          <p className="auth-left-sub">
            You'll be the Admin — invite your team, create shipments, and get full AI-powered control of your supply chain.
          </p>
          <div className="auth-feature-list">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="auth-feature-item">
                  <div className="auth-feature-icon"><Icon size={14} /></div>
                  {f.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right form */}
        <div className="auth-right">
          <div className="auth-card" style={{ maxWidth: 500 }}>
            <div className="auth-card-header">
              <div className="auth-card-title">Create Organization</div>
              <div className="auth-card-subtitle">You'll become the organization Admin</div>
            </div>

            {/* Step indicator */}
            <div className="signup-steps">
              {STEPS.map((s, i) => (
                <>
                  <div key={s.num} className={`signup-step ${step === s.num ? 'active' : step > s.num ? 'done' : ''}`}>
                    <div className="step-num">
                      {step > s.num ? <CheckCircle2 size={12} /> : s.num}
                    </div>
                    <span>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div key={`c${i}`} className="step-connector" />}
                </>
              ))}
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}

              {/* Step 1: Organization */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Organization Name *</label>
                    <div className="input-icon-wrap">
                      <Building2 size={15} className="input-icon" />
                      <input className="form-input" value={form.orgName} onChange={e => update('orgName', e.target.value)}
                        placeholder="Acme Logistics Pvt. Ltd." required />
                    </div>
                  </div>
                  <div className="auth-form-row">
                    <div className="form-group">
                      <label className="form-label">Industry</label>
                      <div className="input-icon-wrap">
                        <Briefcase size={15} className="input-icon" />
                        <select className="form-select" value={form.industry} onChange={e => update('industry', e.target.value)}>
                          {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Country</label>
                      <div className="input-icon-wrap">
                        <Globe size={15} className="input-icon" />
                        <input className="form-input" value={form.country} onChange={e => update('country', e.target.value)} placeholder="India" />
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={goNext}>
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Step 2: Admin account */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Your Full Name *</label>
                    <div className="input-icon-wrap">
                      <User size={15} className="input-icon" />
                      <input className="form-input" value={form.adminName} onChange={e => update('adminName', e.target.value)} placeholder="Jane Doe" required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <div className="input-icon-wrap">
                      <Mail size={15} className="input-icon" />
                      <input className="form-input" type="email" value={form.adminEmail} onChange={e => update('adminEmail', e.target.value)} placeholder="you@company.com" required />
                    </div>
                  </div>
                  <div className="auth-form-row">
                    <div className="form-group">
                      <label className="form-label">Password *</label>
                      <div className="input-icon-wrap" style={{ position: 'relative' }}>
                        <Lock size={15} className="input-icon" />
                        <input className="form-input" type={showPw ? 'text' : 'password'} value={form.password}
                          onChange={e => update('password', e.target.value)} placeholder="Min 6 chars" required style={{ paddingRight: '2.5rem' }} />
                        <button type="button" tabIndex={-1} onClick={() => setShowPw(!showPw)}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm Password *</label>
                      <div className="input-icon-wrap">
                        <Lock size={15} className="input-icon" />
                        <input className="form-input" type="password" value={form.confirmPw}
                          onChange={e => update('confirmPw', e.target.value)} placeholder="Repeat password" required />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(1)} style={{ flex: 1 }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="button" className="btn btn-primary btn-lg" onClick={goNext} style={{ flex: 2 }}>
                      Review <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm & Submit */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--border-color-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review Details</div>
                    {[
                      { label: 'Organization', value: form.orgName },
                      { label: 'Industry', value: INDUSTRIES.find(i => i.value === form.industry)?.label },
                      { label: 'Country', value: form.country || '—' },
                      { label: 'Admin Name', value: form.adminName },
                      { label: 'Admin Email', value: form.adminEmail },
                      { label: 'Your Role', value: 'Admin (full access)' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingBottom: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color-light)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="alert-banner alert-banner-info" style={{ fontSize: '0.8125rem' }}>
                    <UserPlus size={14} />
                    After setup, you can invite team members from the Users section. They'll receive an email with login credentials.
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(2)} style={{ flex: 1 }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 2 }}>
                      {loading
                        ? <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                        : <><UserPlus size={16} /> Create Organization</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="auth-footer-text">
              Already have an organization? <Link to="/login">Sign In</Link>
            </p>
            <p className="auth-footer-text" style={{ marginTop: '0.25rem' }}>
              <Link to="/">← Back to home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
