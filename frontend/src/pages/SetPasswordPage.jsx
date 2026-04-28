/**
 * SetPasswordPage — handles Firebase password-reset / email-action links.
 * Invited users click their invite link which contains ?mode=resetPassword&oobCode=...
 * This page lets them set a new password and logs them in automatically.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authAPI } from '../services/api';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import './AuthPages.css';

export default function SetPasswordPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const oobCode    = params.get('oobCode');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!oobCode) { setError('Invalid or expired link. Please ask your admin to resend the invite.'); setVerifying(false); return; }
    verifyPasswordResetCode(auth, oobCode)
      .then(em => { setEmail(em); setVerifying(false); })
      .catch(() => { setError('This link has expired or already been used. Please ask your admin for a new invite link.'); setVerifying(false); });
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      // Auto sign-in
      await signInWithEmailAndPassword(auth, email, password);
      // Refresh claims so org_id and role are picked up
      if (auth.currentUser) await auth.currentUser.getIdToken(true);
      try { await authAPI.refreshClaims(); } catch {}
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-brand-mark">SE</div>
            <div>
              <div className="auth-brand-name">SupplyEazy</div>
              <div className="auth-brand-tagline">Supply Chain Intelligence</div>
            </div>
          </div>
          <h1 className="auth-left-title">Welcome to<br/>your team.</h1>
          <p className="auth-left-sub">Set your password to activate your account and access the supply chain dashboard.</p>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-card-title">
                {done ? '🎉 Password Set!' : 'Set Your Password'}
              </div>
              <div className="auth-card-subtitle">
                {verifying ? 'Verifying your invite link…' : done ? 'Redirecting to dashboard…' : `Activating account for ${email}`}
              </div>
            </div>

            {verifying && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="loader-spinner" style={{ width: 32, height: 32 }} />
              </div>
            )}

            {done && (
              <div className="auth-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <CheckCircle size={16} /> Account activated! Taking you to the dashboard…
              </div>
            )}

            {!verifying && !done && (
              <>
                {error && <div className="auth-error" style={{ marginBottom: '1rem' }}><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{error}</div>}

                {!error && (
                  <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={email} disabled style={{ opacity: 0.7 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="sp-pw">New Password *</label>
                      <div className="input-icon-wrap" style={{ position: 'relative' }}>
                        <Lock size={15} className="input-icon" />
                        <input id="sp-pw" className="form-input" type={showPw ? 'text' : 'password'}
                          value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Min. 6 characters" style={{ paddingRight: '2.75rem' }} />
                        <button type="button" tabIndex={-1} onClick={() => setShowPw(!showPw)}
                          style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0 }}>
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="sp-confirm">Confirm Password *</label>
                      <div className="input-icon-wrap">
                        <Lock size={15} className="input-icon" />
                        <input id="sp-confirm" className="form-input" type="password"
                          value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
                      </div>
                    </div>
                    <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.25rem' }}>
                      {loading ? <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><CheckCircle size={16} /> Activate Account</>}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
