import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, userProfile } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
