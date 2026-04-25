import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';

// Eager
import LandingPage from './pages/LandingPage';
import LoginPage   from './pages/LoginPage';
import SignupPage  from './pages/SignupPage';

// Lazy-loaded pages
const DashboardPage        = lazy(() => import('./pages/DashboardPage'));
const ShipmentsPage        = lazy(() => import('./pages/ShipmentsPage'));
const CreateShipmentPage   = lazy(() => import('./pages/CreateShipmentPage'));
const ShipmentDetailPage   = lazy(() => import('./pages/ShipmentDetailPage'));
const FleetPage            = lazy(() => import('./pages/FleetPage'));
const WarehousesPage       = lazy(() => import('./pages/WarehousesPage'));
const UsersPage            = lazy(() => import('./pages/UsersPage'));
const MessagesPage         = lazy(() => import('./pages/MessagesPage'));
const OrganizationPage     = lazy(() => import('./pages/OrganizationPage'));
const LiveTrackingPage     = lazy(() => import('./pages/LiveTrackingPage'));
const RouteOptimizationPage= lazy(() => import('./pages/RouteOptimizationPage'));
const DriverTrackingPage   = lazy(() => import('./pages/DriverTrackingPage'));
const ShipmentRequestsPage = lazy(() => import('./pages/ShipmentRequestsPage'));
const RequestShipmentPage  = lazy(() => import('./pages/RequestShipmentPage'));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="loader-spinner" style={{ width: 32, height: 32 }} />
      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</span>
    </div>
  );
}

function PendingSetup() {
  const { user, logout, refreshClaims } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]       = useState('check'); // check | form | success | error
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('logistics');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // On mount, try a token refresh first — maybe claims were just set
  useEffect(() => {
    const tryRefresh = async () => {
      try {
        await refreshClaims();
        // If we have role after refresh, go to dashboard
        navigate('/dashboard', { replace: true });
      } catch {
        setStep('form');
      }
    };
    // Give it 1s then show form anyway
    const t = setTimeout(() => setStep('form'), 1200);
    tryRefresh().finally(() => clearTimeout(t));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) { setError('Please enter your organization name.'); return; }
    setError(''); setLoading(true);
    try {
      const { authAPI } = await import('./services/api');
      await authAPI.signup({
        name:        orgName.trim(),
        industry,
        country:     'Not specified',
        admin_email: user?.email || '',
        admin_name:  user?.displayName || user?.email?.split('@')[0] || 'Admin',
      });
      // Force token refresh to pick up new claims
      const { auth } = await import('./config/firebase');
      if (auth.currentUser) await auth.currentUser.getIdToken(true);
      await refreshClaims();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '';
      if (err.code === 'ERR_NETWORK' || msg.includes('ECONNREFUSED')) {
        setError('Cannot reach the server. Make sure the backend is running (check VITE_API_URL in .env).');
      } else {
        setError(msg || 'Setup failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  const INDUSTRIES = [
    { value:'logistics',     label:'Logistics & Transport' },
    { value:'manufacturing', label:'Manufacturing' },
    { value:'retail',        label:'Retail & E-commerce' },
    { value:'pharma',        label:'Pharmaceuticals' },
    { value:'food',          label:'Food & Beverage' },
    { value:'other',         label:'Other' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(15,23,42,0.08)', padding: '2rem',
        width: '100%', maxWidth: 420, textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', fontWeight: 800, color: '#fff',
          margin: '0 auto 1.25rem',
        }}>SE</div>

        {step === 'check' ? (
          <>
            <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Verifying account…</h2>
            <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>Checking your organization setup.</p>
            <div className="loader-spinner" style={{ margin: '0 auto', width: 28, height: 28 }} />
          </>
        ) : (
          <>
            <h2 style={{ color: '#0f172a', marginBottom: '0.375rem' }}>Complete Your Setup</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Signed in as <strong>{user?.email}</strong>.<br/>
              Enter your organization details to finish setup.
            </p>

            {error && (
              <div className="auth-error" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', textAlign: 'left' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="ps-org">Organization Name *</label>
                <input
                  id="ps-org"
                  className="form-input"
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Logistics Pvt. Ltd."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ps-ind">Industry</label>
                <select
                  id="ps-ind"
                  className="form-select"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                >
                  {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading
                  ? <><span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Setting up…</>
                  : '🚀 Complete Setup'}
              </button>
            </form>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: '#94a3b8', fontSize: '0.8125rem' }}
                onClick={async () => { await logout(); navigate('/login'); }}
              >
                Sign out and use a different account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, userProfile } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // User is authenticated but has no role yet — show pending screen
  if (!userProfile?.role && !userProfile?.orgId) return <PendingSetup />;
  // Role check: if roles required and user has a role, enforce it
  if (roles && userProfile?.role && !roles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}


function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login"  element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

        {/* Protected — all authenticated roles */}
        <Route path="/dashboard"        element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route path="/shipments"        element={<ProtectedRoute><Layout><ShipmentsPage /></Layout></ProtectedRoute>} />
        <Route path="/shipments/:id"    element={<ProtectedRoute><Layout><ShipmentDetailPage /></Layout></ProtectedRoute>} />
        <Route path="/live-tracking"    element={<ProtectedRoute><Layout><LiveTrackingPage /></Layout></ProtectedRoute>} />
        <Route path="/messages"         element={<ProtectedRoute><Layout><MessagesPage /></Layout></ProtectedRoute>} />
        <Route path="/fleet"            element={<ProtectedRoute><Layout><FleetPage /></Layout></ProtectedRoute>} />
        <Route path="/warehouses"       element={<ProtectedRoute><Layout><WarehousesPage /></Layout></ProtectedRoute>} />

        {/* Driver only */}
        <Route path="/driver-tracking"  element={<ProtectedRoute roles={['driver']}><Layout><DriverTrackingPage /></Layout></ProtectedRoute>} />

        {/* Manager+ */}
        <Route path="/request-shipment"  element={<ProtectedRoute roles={['manager','admin']}><Layout><RequestShipmentPage /></Layout></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/shipments/new"       element={<ProtectedRoute roles={['admin']}><Layout><CreateShipmentPage /></Layout></ProtectedRoute>} />
        <Route path="/shipment-requests"   element={<ProtectedRoute roles={['admin','manager']}><Layout><ShipmentRequestsPage /></Layout></ProtectedRoute>} />
        <Route path="/route-optimization"  element={<ProtectedRoute roles={['admin','manager','analyst']}><Layout><RouteOptimizationPage /></Layout></ProtectedRoute>} />
        <Route path="/users"               element={<ProtectedRoute roles={['admin','manager']}><Layout><UsersPage /></Layout></ProtectedRoute>} />
        <Route path="/organization"        element={<ProtectedRoute roles={['admin']}><Layout><OrganizationPage /></Layout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
