import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogIn, Mail, Lock, Eye, EyeOff, Shield, Zap, Navigation, ArrowRight
} from 'lucide-react';
import './AuthPages.css';

const FEATURES = [
  { icon: Navigation, text: 'AI-powered route optimization across 5 alternatives' },
  { icon: Shield,     text: 'Real-time risk prediction with weather & geopolitical data' },
  { icon: Zap,        text: 'Live GPS tracking for every shipment leg, worldwide' },
];

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please check your credentials.');
      }
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch {
      setError('Google sign-in was cancelled or failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">

        {/* ── Left Branding Panel ── */}
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-brand-mark">SE</div>
            <div>
              <div className="auth-brand-name">SupplyEazy</div>
              <div className="auth-brand-tagline">Supply Chain Intelligence</div>
            </div>
          </div>

          <h1 className="auth-left-title">
            Smarter logistics,<br />from day one.
          </h1>
          <p className="auth-left-sub">
            Sign in to your control tower. Track shipments, predict risk, and optimize routes — all in one place.
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
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-card-title">Welcome back</div>
              <div className="auth-card-subtitle">Sign in to your SupplyEazy account</div>
            </div>

            {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email address</label>
                <div className="input-icon-wrap">
                  <Mail size={15} className="input-icon" />
                  <input
                    id="login-email"
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-pw">Password</label>
                <div className="input-icon-wrap" style={{ position: 'relative' }}>
                  <Lock size={15} className="input-icon" />
                  <input
                    id="login-pw"
                    className="form-input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute', right: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', padding: 0, display: 'flex',
                    }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Sign In */}
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={loading}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                {loading ? (
                  <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                ) : (
                  <><LogIn size={16} /> Sign In</>
                )}
              </button>

              <div className="auth-divider"><span>or continue with</span></div>

              {/* Google */}
              <button
                type="button"
                className="btn btn-google btn-lg"
                onClick={handleGoogle}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <svg className="google-icon" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <p className="auth-footer-text">
              Need to set up your organization?{' '}
              <Link to="/signup">Create Organization <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /></Link>
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
