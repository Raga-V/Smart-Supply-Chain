import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  LayoutDashboard, Package, PlusCircle, Truck, Warehouse,
  Users, MessageSquare, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Navigation, Map, Bell,
  ClipboardList, Route, FileText
} from 'lucide-react';
import './Layout.css';

// Role-based nav definitions
const NAV_CONFIG = {
  admin: [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'Control Tower' },
    { path: '/live-tracking',      icon: Navigation,      label: 'Live Map' },
    { path: '/shipments',          icon: Package,         label: 'Shipments' },
    { path: '/shipments/new',      icon: PlusCircle,      label: 'Create Shipment' },
    { path: '/shipment-requests',  icon: ClipboardList,   label: 'Requests' },
    { path: '/route-optimization', icon: Route,           label: 'Route Optimizer' },
    { path: '/fleet',              icon: Truck,           label: 'Fleet' },
    { path: '/warehouses',         icon: Warehouse,       label: 'Warehouses' },
    { path: '/users',              icon: Users,           label: 'Team' },
    { path: '/messages',           icon: MessageSquare,   label: 'Messages' },
    { path: '/organization',       icon: Settings,        label: 'Organization' },
  ],
  manager: [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/shipments',          icon: Package,         label: 'Shipments' },
    { path: '/request-shipment',   icon: PlusCircle,      label: 'Request Shipment' },
    { path: '/live-tracking',      icon: Navigation,      label: 'Live Map' },
    { path: '/fleet',              icon: Truck,           label: 'Fleet' },
    { path: '/messages',           icon: MessageSquare,   label: 'Messages' },
  ],
  fleet_manager: [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/shipments',          icon: Package,         label: 'Shipments' },
    { path: '/live-tracking',      icon: Navigation,      label: 'Live Map' },
    { path: '/fleet',              icon: Truck,           label: 'Fleet' },
    { path: '/messages',           icon: MessageSquare,   label: 'Messages' },
  ],
  analyst: [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/shipments',          icon: Package,         label: 'Shipments' },
    { path: '/live-tracking',      icon: Navigation,      label: 'Live Map' },
  ],
  driver: [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'My Dashboard' },
    { path: '/driver-tracking',    icon: Navigation,      label: 'My Delivery' },
    { path: '/messages',           icon: MessageSquare,   label: 'Messages' },
  ],
};

const ROLE_COLORS = {
  admin: 'role-admin', manager: 'role-manager', fleet_manager: 'role-fleet_manager',
  analyst: 'role-analyst', driver: 'role-driver',
};

export default function Layout({ children }) {
  const { userProfile, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef(null);

  const role = userProfile?.role || 'analyst';
  const filteredNav = NAV_CONFIG[role] || NAV_CONFIG.analyst;
  const unreadNotifs = notifications.filter(n => !n.read).length;

  // Real-time notifications from Firestore
  useEffect(() => {
    if (!userProfile?.orgId) return;
    const orgRef = collection(db, 'organizations', userProfile.orgId, 'notifications');
    const q = query(
      orgRef,
      where('target_roles', 'array-contains', role),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [userProfile?.orgId, role]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = window.location.pathname;
    const item = filteredNav.find(n => n.path === path);
    return item?.label || 'Supply Chain Intelligence';
  };

  const notifTypeStyle = (type) => {
    if (type === 'risk' || type === 'alert') return { background: 'rgba(220,38,38,0.10)', color: '#dc2626' };
    if (type === 'success') return { background: 'rgba(22,163,74,0.10)', color: '#16a34a' };
    return { background: 'rgba(79,70,229,0.10)', color: '#4f46e5' };
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-mark">R</div>
            {!sidebarCollapsed && (
              <span className="logo-text">Raga<span className="logo-accent">-V</span></span>
            )}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label="Toggle sidebar">
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {(userProfile?.displayName || userProfile?.email || '?')[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="user-details">
                <span className="user-name">{userProfile?.displayName || userProfile?.email}</span>
                <span className="user-role">{role.replace('_', ' ')}</span>
              </div>
            )}
          </div>
          <button className="nav-item logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={17} className="nav-icon" />
            {!sidebarCollapsed && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* Top bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <span className="top-bar-title">{getPageTitle()}</span>
            <span className="top-bar-subtitle">
              {userProfile?.displayName || userProfile?.email} · <span className={`role-badge ${ROLE_COLORS[role]}`}>{role.replace('_', ' ')}</span>
            </span>
          </div>
          <div className="top-bar-right">
            {/* Notification Bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="notif-bell-btn" onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications">
                <Bell size={18} />
                {unreadNotifs > 0 && (
                  <span className="notif-badge">{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <span>Notifications</span>
                    {unreadNotifs > 0 && (
                      <span className="badge badge-purple">{unreadNotifs} new</span>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications yet</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                        <div className="notif-icon-wrap" style={notifTypeStyle(n.type)}>
                          <Bell size={14} />
                        </div>
                        <div className="notif-body">
                          <div className="notif-title">{n.title || 'Notification'}</div>
                          <div className="notif-msg">{n.message}</div>
                          <div className="notif-time">
                            {n.created_at ? new Date(n.created_at?.toDate?.() || n.created_at).toLocaleTimeString() : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="content-body">
          {children}
        </div>
      </main>
    </div>
  );
}
