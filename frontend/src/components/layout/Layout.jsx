import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/dashboard', icon: '🏠', label: 'Control Tower', roles: ['admin','manager','analyst','fleet_manager','driver'] },
  { path: '/shipments', icon: '📦', label: 'Shipments', roles: ['admin','manager','analyst','fleet_manager'] },
  { path: '/shipments/new', icon: '➕', label: 'New Shipment', roles: ['admin','manager'] },
  { path: '/fleet', icon: '🚛', label: 'Fleet', roles: ['admin','fleet_manager','driver'] },
  { path: '/warehouses', icon: '🏭', label: 'Warehouses', roles: ['admin','manager'] },
  { path: '/users', icon: '👥', label: 'Team', roles: ['admin','manager'] },
  { path: '/messages', icon: '💬', label: 'Messages', roles: ['admin','manager','driver'] },
  { path: '/analytics', icon: '📊', label: 'Analytics', roles: ['admin','manager','analyst'] },
  { path: '/organization', icon: '⚙️', label: 'Settings', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { userProfile, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const role = userProfile?.role || 'analyst';
  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">⚡</span>
            {!sidebarCollapsed && <span className="logo-text">SupplyChain<span className="logo-accent">AI</span></span>}
          </div>
          <button className="btn-ghost sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {(userProfile?.displayName || userProfile?.email || '?')[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="user-details">
                <span className="user-name">{userProfile?.displayName || userProfile?.email}</span>
                <span className="user-role">{role}</span>
              </div>
            )}
          </div>
          <button className="btn-ghost nav-item" onClick={handleLogout} title="Logout">
            <span className="nav-icon">🚪</span>
            {!sidebarCollapsed && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
