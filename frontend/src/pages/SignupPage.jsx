import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  Building2, User, Mail, Lock, Globe, Briefcase,
  ChevronRight, ArrowLeft, CheckCircle2, Eye, EyeOff,
  UserPlus, Shield, Zap, Navigation
} from 'lucide-react';
import './AuthPages.css';

const INDUSTRIES = [
  { value: 'logistics',     label: 'Logistics & Transport' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail',        label: 'Retail & E-commerce' },
  { value: 'pharma',        label: 'Pharmaceuticals' },
  { value: 'food',          label: 'Food & Beverage' },
  { value: 'automotive',    label: 'Automotive' },
  { value: 'tech',          label: 'Technology' },
  { value: 'other',         label: 'Other' },
];

const FEATURES = [
  { icon: Shield,     text: 'You become the Admin with full control' },
  { icon: UserPlus,   text: 'Invite your team and assign roles easily' },
  { icon: Navigation, text: 'Get live GPS tracking and route optimization' },
  { icon: Zap,        text: 'AI-powered risk prediction from day one' },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showPw, setShowPw] = useState(false);

  // Form fields
  const [orgName,    setOrgName]    = useState('');
  const [industry,   setIndustry]   = useState('logistics');
  const [country,    setCountry]    = useState('');
  const [adminName,  setAdminName]  = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password,   setPassword]   = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');

  // ── Step navigation ──────────────────────────────────────
  const goToStep2 = () => {
    setError('');
    if (!orgName.trim()) { setError('Organization name is required.'); return; }
    setStep(2);
  };

  const goToStep3 = () => {
    setError('');
    if (!adminName.trim())  { setError('Your name is required.'); return; }
    if (!adminEmail.trim()) { setError('Email address is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(adminEmail)) { setError('Please enter a valid email address.'); return; }
    if (!password)          { setError('Password is required.'); return; }
    if (password.length < 6){ setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setStep(3);
  };

  // ── Final submit ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // 1 — Create Firebase user
      await signup(adminEmail.trim(), password, adminName.trim());

      // 2 — Create org + assign admin role via backend
      await authAPI.signup({
        name:        orgName.trim(),
        industry,
        country:     country.trim() || 'Not specified',
        admin_email: adminEmail.trim(),
        admin_name:  adminName.trim(),
      });

      // 3 — Force token refresh to pick up custom claims (org_id, role=admin)
      const { auth } = await import('../config/firebase');
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      // 4 — Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      const raw = err.response?.data?.detail || err.message || '';

      // Firebase errors from step 1
      if (raw.includes('email-already-in-use')) {
        setError('An account with this email already exists. Please sign in instead.');
        setStep(2); return;
      } else if (raw.includes('weak-password')) {
        setError('Password is too weak. Use at least 6 characters.');
        setStep(2); return;
      } else if (raw.includes('invalid-email')) {
        setError('Please enter a valid email address.');
        setStep(2); return;
      }

      // If Firebase user was created but backend was unreachable (network error)
      // — redirect anyway; role will sync once backend is reachable
      if (err.code === 'ERR_NETWORK' || err.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('Backend offline — org created in Firebase only. Role will sync on next login.');
        navigate('/dashboard');
        return;
      }

      setError('Setup failed: ' + (raw.length < 120 ? raw : 'Please try again.'));
    } finally { setLoading(false); }
  };


  const industryLabel = INDUSTRIES.find(i => i.value === industry)?.label || industry;

  return (
    <div className="auth-page">
      <div className="auth-split">

        {/* ── Left Panel ── */}
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-brand-mark">SE</div>
            <div>
              <div className="auth-brand-name">SupplyEazy</div>
              <div className="auth-brand-tagline">Supply Chain Intelligence</div>
            </div>
          </div>

          <h1 className="auth-left-title">
            Set up your<br />organization today.
          </h1>
          <p className="auth-left-sub">
            You'll be the Admin. Invite your team, assign roles, and get complete supply chain visibility in minutes.
          </p>

          <div className="auth-feature-list">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="auth-feature-item">
                  <div className="auth-feature-icon"><Icon size={15} /></div>
                  <span>{f.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Form ── */}
        <div className="auth-right">
          <div className="auth-card" style={{ maxWidth: 500 }}>

            <div className="auth-card-header">
              <div className="auth-card-title">Create Organization</div>
              <div className="auth-card-subtitle">
                {step === 1 && 'Step 1 of 3 — Organization details'}
                {step === 2 && 'Step 2 of 3 — Your admin account'}
                {step === 3 && 'Step 3 of 3 — Review and confirm'}
              </div>
            </div>

            {/* Step indicator */}
            <div className="signup-steps" style={{ marginBottom: '1.5rem' }}>
              {['Organization', 'Admin Account', 'Confirm'].map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                  <div className={`signup-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                    <div className="step-num">
                      {step > i + 1 ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <span className="step-label">{label}</span>
                  </div>
                  {i < 2 && (
                    <div className={`step-connector ${step > i + 1 ? 'done' : ''}`} />
                  )}
                </div>
              ))}
            </div>

            {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleSubmit} noValidate>

              {/* ── Step 1: Organization ── */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="org-name">
                      Organization Name *
                    </label>
                    <div className="input-icon-wrap">
                      <Building2 size={15} className="input-icon" />
                      <input
                        id="org-name"
                        className="form-input"
                        type="text"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Logistics Pvt. Ltd."
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="auth-form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="industry">Industry</label>
                      <div className="input-icon-wrap">
                        <Briefcase size={15} className="input-icon" />
                        <select
                          id="industry"
                          className="form-select"
                          value={industry}
                          onChange={e => setIndustry(e.target.value)}
                          style={{ paddingLeft: '2.5rem' }}
                        >
                          {INDUSTRIES.map(i => (
                            <option key={i.value} value={i.value}>{i.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="country">Country</label>
                      <div className="input-icon-wrap">
                        <Globe size={15} className="input-icon" />
                        <input
                          id="country"
                          className="form-input"
                          type="text"
                          value={country}
                          onChange={e => setCountry(e.target.value)}
                          placeholder="e.g. India"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    onClick={goToStep2}
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* ── Step 2: Admin Account ── */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-name">Your Full Name *</label>
                    <div className="input-icon-wrap">
                      <User size={15} className="input-icon" />
                      <input
                        id="admin-name"
                        className="form-input"
                        type="text"
                        value={adminName}
                        onChange={e => setAdminName(e.target.value)}
                        placeholder="Jane Doe"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-email">Email Address *</label>
                    <div className="input-icon-wrap">
                      <Mail size={15} className="input-icon" />
                      <input
                        id="admin-email"
                        className="form-input"
                        type="email"
                        value={adminEmail}
                        onChange={e => setAdminEmail(e.target.value)}
                        placeholder="you@company.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="auth-form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="pw">Password *</label>
                      <div className="input-icon-wrap" style={{ position: 'relative' }}>
                        <Lock size={15} className="input-icon" />
                        <input
                          id="pw"
                          className="form-input"
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          style={{ paddingRight: '2.75rem' }}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPw(!showPw)}
                          style={{
                            position: 'absolute', right: '0.75rem', top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none',
                            cursor: 'pointer', color: '#94a3b8', padding: 0,
                          }}
                        >
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="confirm-pw">Confirm Password *</label>
                      <div className="input-icon-wrap">
                        <Lock size={15} className="input-icon" />
                        <input
                          id="confirm-pw"
                          className="form-input"
                          type="password"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          placeholder="Repeat password"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => { setError(''); setStep(1); }}
                    >
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      style={{ flex: 2 }}
                      onClick={goToStep3}
                    >
                      Review <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm ── */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="review-box">
                    <div className="review-box-title">Review your details</div>
                    {[
                      { label: 'Organization', value: orgName },
                      { label: 'Industry',     value: industryLabel },
                      { label: 'Country',      value: country || 'Not specified' },
                      { label: 'Admin Name',   value: adminName },
                      { label: 'Admin Email',  value: adminEmail },
                      { label: 'Your Role',    value: 'Admin (full access)' },
                    ].map(row => (
                      <div key={row.label} className="review-row">
                        <span className="review-row-label">{row.label}</span>
                        <span className="review-row-value">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="alert-banner alert-banner-info" style={{ fontSize: '0.8125rem' }}>
                    <UserPlus size={14} style={{ flexShrink: 0 }} />
                    <span>
                      After setup, invite team members from the <strong>Team</strong> page.
                      They'll receive a link to set their password and log in.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => { setError(''); setStep(2); }}
                      disabled={loading}
                    >
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      style={{ flex: 2 }}
                      disabled={loading}
                    >
                      {loading ? (
                        <><span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Setting up…</>
                      ) : (
                        <><UserPlus size={16} /> Create Organization</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="auth-footer-text">
              Already have an account? <Link to="/login">Sign In</Link>
            </p>
            <p className="auth-footer-text" style={{ marginTop: '0.375rem' }}>
              <Link to="/" style={{ color: '#94a3b8' }}>← Back to home</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
