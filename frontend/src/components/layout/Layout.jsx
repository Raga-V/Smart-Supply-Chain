import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import {
  LayoutDashboard, Package, MapPin, Navigation, Route, ClipboardList,
  Truck, Warehouse, Users, MessageSquare, BarChart3, Settings,
  Bell, LogOut, Building2, ChevronDown
} from 'lucide-react';
import './Layout.css';

// ── Role-based nav config ─────────────────────────────────────
const NAV = {
  admin: [
    { section: 'Operations', items: [
      { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard' },
      { icon: Package,         label: 'Shipments',        path: '/shipments' },
      { icon: ClipboardList,   label: 'Requests',         path: '/shipment-requests' },
      { icon: Navigation,      label: 'Live Tracking',    path: '/live-tracking' },
      { icon: Route,           label: 'Route Optimizer',  path: '/route-optimization' },
    ]},
    { section: 'Fleet & Assets', items: [
      { icon: Truck,     label: 'Fleet',      path: '/fleet' },
      { icon: Warehouse, label: 'Warehouses', path: '/warehouses' },
    ]},
    { section: 'Team', items: [
      { icon: Users,        label: 'Team Members', path: '/users' },
      { icon: MessageSquare,label: 'Messages',     path: '/messages' },
      { icon: Building2,    label: 'Organization', path: '/organization' },
    ]},
  ],
  manager: [
    { section: 'Operations', items: [
      { icon: LayoutDashboard, label: 'Dashboard',      path: '/dashboard' },
      { icon: Package,         label: 'Shipments',      path: '/shipments' },
      { icon: ClipboardList,   label: 'My Requests',    path: '/shipment-requests' },
      { icon: Navigation,      label: 'Live Tracking',  path: '/live-tracking' },
      { icon: Route,           label: 'Route Optimizer',path: '/route-optimization' },
    ]},
    { section: 'Communication', items: [
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
    ]},
  ],
  fleet_manager: [
    { section: 'Operations', items: [
      { icon: LayoutDashboard, label: 'Dashboard',     path: '/dashboard' },
      { icon: Package,         label: 'Shipments',     path: '/shipments' },
      { icon: Navigation,      label: 'Live Tracking', path: '/live-tracking' },
    ]},
    { section: 'Fleet', items: [
      { icon: Truck,         label: 'Fleet',      path: '/fleet' },
      { icon: Warehouse,     label: 'Warehouses', path: '/warehouses' },
      { icon: MessageSquare, label: 'Messages',   path: '/messages' },
    ]},
  ],
  analyst: [
    { section: 'Operations', items: [
      { icon: LayoutDashboard, label: 'Dashboard',      path: '/dashboard' },
      { icon: Package,         label: 'Shipments',      path: '/shipments' },
      { icon: Navigation,      label: 'Live Tracking',  path: '/live-tracking' },
      { icon: Route,           label: 'Route Optimizer',path: '/route-optimization' },
    ]},
    { section: 'Communication', items: [
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
    ]},
  ],
  driver: [
    { section: 'My Delivery', items: [
      { icon: LayoutDashboard, label: 'Dashboard',   path: '/dashboard' },
      { icon: Navigation,      label: 'My GPS',      path: '/driver-tracking' },
      { icon: Package,         label: 'Shipments',   path: '/shipments' },
      { icon: MessageSquare,   label: 'Messages',    path: '/messages' },
    ]},
  ],
};

const PAGE_TITLES = {
  '/dashboard':          'Dashboard',
  '/shipments':          'Shipments',
  '/shipments/new':      'Create Shipment',
  '/live-tracking':      'Live Tracking',
  '/route-optimization': 'Route Optimizer',
  '/fleet':              'Fleet Management',
  '/warehouses':         'Warehouses',
  '/users':              'Team Members',
  '/messages':           'Messages',
  '/organization':       'Organization',
  '/shipment-requests':  'Shipment Requests',
  '/request-shipment':   'Request Shipment',
  '/driver-tracking':    'GPS Tracking',
};

const ROLE_LABELS = {
  admin:        'Admin',
  manager:      'Manager',
  fleet_manager:'Fleet Manager',
  analyst:      'Analyst',
  driver:       'Driver',
};

export default function Layout({ children }) {
  const { userProfile, logout, role } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [notifs, setNotifs]         = useState([]);
  const [notifOpen, setNotifOpen]   = useState(false);
  const notifRef = useRef(null);

  // Real-time notifications from Firestore
  useEffect(() => {
    if (!userProfile?.orgId) return;
    const userRole = userProfile.role;
    const q = query(
      collection(db, 'organizations', userProfile.orgId, 'notifications'),
      where('read', '==', false),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter by target_roles
      const visible = all.filter(n =>
        !n.target_roles ||
        n.target_roles.length === 0 ||
        n.target_roles.includes(userRole)
      );
      setNotifs(visible);
    }, () => {});
    return unsub;
  }, [userProfile?.orgId, userProfile?.role]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const markAllRead = async () => {
    if (!userProfile?.orgId) return;
    await Promise.all(
      notifs.map(n =>
        updateDoc(doc(db, 'organizations', userProfile.orgId, 'notifications', n.id), { read: true })
      )
    );
    setNotifs([]);
    setNotifOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navSections = NAV[role || 'analyst'] || NAV.analyst;

  const pageTitle = PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/shipments/') ? 'Shipment Details' : 'Dashboard');

  const initials = (userProfile?.displayName || userProfile?.email || 'U')
    .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">SE</div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">SupplyEazy</div>
            <div className="sidebar-brand-tagline">Intelligence Platform</div>
          </div>
        </div>

        {/* User chip */}
        <div className="sidebar-role-chip">
          <div className="sidebar-role-avatar">{initials}</div>
          <div className="sidebar-role-info">
            <div className="sidebar-role-name">
              {userProfile?.displayName || userProfile?.email?.split('@')[0] || 'User'}
            </div>
            <div className="sidebar-role-badge">
              {ROLE_LABELS[role] || role || 'Member'}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} className="nav-icon" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">
        {/* Header */}
        <header className="top-header">
          <span className="header-title">{pageTitle}</span>

          <div className="header-right">
            {/* Notification bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
                <Bell size={17} />
                {notifs.length > 0 && (
                  <span className="notif-count">
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span className="notif-header-title">
                      Notifications {notifs.length > 0 && `(${notifs.length})`}
                    </span>
                    {notifs.length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={markAllRead}
                        style={{ fontSize: '0.75rem', padding: '0.1875rem 0.5rem' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifs.length === 0 ? (
                    <div className="notif-empty">No new notifications</div>
                  ) : (
                    notifs.slice(0, 8).map(n => (
                      <div
                        key={n.id}
                        className="notif-item"
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.shipment_id) navigate(`/shipments/${n.shipment_id}`);
                          else if (n.ref_id) navigate('/shipment-requests');
                        }}
                        style={{ cursor: n.shipment_id || n.ref_id ? 'pointer' : 'default' }}
                      >
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-msg">{n.message}</div>
                        {n.created_at && (
                          <div className="notif-item-time">
                            {n.created_at.toDate?.()
                              ? new Date(n.created_at.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Admin quick-create */}
            {role === 'admin' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/shipments/new')}
              >
                <Package size={14} /> New Shipment
              </button>
            )}
            {role === 'manager' && (
              <button
                className="btn btn-sm"
                style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}
                onClick={() => navigate('/request-shipment')}
              >
                <ClipboardList size={14} /> Request Shipment
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
