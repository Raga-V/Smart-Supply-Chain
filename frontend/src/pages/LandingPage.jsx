import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, MapPin, Shield, TrendingUp, Users, ArrowRight,
  Package, Truck, Navigation, AlertTriangle, CheckCircle2,
  Globe, Clock, BarChart3
} from 'lucide-react';
import './LandingPage.css';

const FEATURES = [
  {
    icon: Navigation,
    title: 'AI Route Optimization',
    desc: 'Predict the 5 best routes for any shipment based on risk, distance, traffic, and real-time conditions.',
    color: '#4f46e5',
    bg: 'rgba(79,70,229,0.08)',
  },
  {
    icon: Shield,
    title: 'Real-Time Risk Prediction',
    desc: 'Live weather, news feeds, and traffic bottlenecks analyzed instantly to predict disruptions before they happen.',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
  },
  {
    icon: MapPin,
    title: 'Multi-Leg GPS Tracking',
    desc: 'Track each driver across every leg of your shipment with real-time GPS updates on an interactive world map.',
    color: '#0d9488',
    bg: 'rgba(13,148,136,0.08)',
  },
  {
    icon: Users,
    title: 'Role-Based Operations',
    desc: 'Admin, Manager, Fleet Manager, Analyst, and Driver — each with tailored dashboards and permissions.',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.08)',
  },
  {
    icon: Globe,
    title: 'Global Shipments',
    desc: 'Create shipments to anywhere in the world with mixed transport modes — truck, rail, ship, air.',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
  },
  {
    icon: Zap,
    title: 'Intelligent Alternatives',
    desc: 'When risk is detected mid-shipment, the system instantly proposes safest reroutes and mode changes.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
  },
];

const STATS = [
  { value: '5+', label: 'Route Predictions', icon: Navigation },
  { value: 'Real-time', label: 'Risk Detection', icon: AlertTriangle },
  { value: '5 Roles', label: 'RBAC Access', icon: Users },
  { value: '24/7', label: 'GPS Tracking', icon: MapPin },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <img src="/logo.svg" alt="SupplyEazy Logo" className="landing-logo-mark" />
            <span className="landing-logo-text">Supply<span className="landing-logo-accent">Eazy</span></span>
          </div>
          <div className="landing-nav-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
            <button className="btn btn-primary" onClick={() => navigate('/signup')}>
              Create Organization <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-grid" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={12} />
            AI-Powered Supply Chain Intelligence
          </div>
          <h1 className="hero-title">
            Smarter routes.
            <br />
            <span className="hero-accent">Zero surprises.</span>
          </h1>
          <p className="hero-subtitle">
            SupplyEazy is your intelligent logistics control tower — predicting risks before they happen,
            optimizing routes in real time, and giving every team member the visibility they need.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-xl" onClick={() => navigate('/signup')}>
              <Package size={18} /> Create Your Organization
            </button>
            <button className="btn btn-secondary btn-xl" onClick={() => navigate('/login')}>
              Sign In to Dashboard <ArrowRight size={16} />
            </button>
          </div>

          {/* Stats strip */}
          <div className="hero-stats">
            {STATS.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="hero-stat">
                  <div className="hero-stat-value">{s.value}</div>
                  <div className="hero-stat-label">
                    <Icon size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hero visual */}
        <div className="hero-visual">
          <div className="hero-dashboard-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              </div>
              <span className="preview-title">Control Tower</span>
            </div>
            <div className="preview-stats-row">
              {[
                { label: 'Active Shipments', val: '24', color: '#4f46e5' },
                { label: 'At Risk', val: '3', color: '#dc2626' },
                { label: 'On-Time Rate', val: '96%', color: '#16a34a' },
              ].map(s => (
                <div key={s.label} className="preview-stat">
                  <div className="preview-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="preview-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="preview-map-area">
              <div className="preview-map-bg" />
              {[
                { x: 25, y: 35, color: '#4f46e5', label: 'Mumbai' },
                { x: 55, y: 20, color: '#16a34a', label: 'Delhi' },
                { x: 75, y: 55, color: '#dc2626', label: 'Chennai' },
                { x: 40, y: 60, color: '#d97706', label: 'Hyderabad' },
              ].map(dot => (
                <div key={dot.label} className="map-dot" style={{ left: `${dot.x}%`, top: `${dot.y}%`, background: dot.color }}>
                  <span className="map-dot-pulse" style={{ '--c': dot.color }} />
                  <span className="map-dot-label">{dot.label}</span>
                </div>
              ))}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <path d="M25%,35% Q45%,20% 55%,20%" stroke="#4f46e5" strokeWidth="1.5" fill="none" strokeDasharray="4,3" opacity="0.5" />
                <path d="M55%,20% Q68%,35% 75%,55%" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeDasharray="4,3" opacity="0.5" />
              </svg>
            </div>
            <div className="preview-alert">
              <AlertTriangle size={11} style={{ color: '#dc2626' }} />
              <span>Risk detected on Route 3 — 2 alternatives suggested</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <div className="section-header">
          <div className="section-badge">Features</div>
          <h2>Everything you need to run<br />a modern supply chain</h2>
          <p>Purpose-built for logistics teams that need real-time intelligence, not spreadsheets.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feature-card">
                <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                  <Icon size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-how">
        <div className="section-header">
          <div className="section-badge">Workflow</div>
          <h2>Built for every role in your team</h2>
        </div>
        <div className="roles-grid">
          {[
            { role: 'Admin', color: '#4f46e5', bg: 'rgba(79,70,229,0.08)', desc: 'Full control — create shipments, manage team, override AI decisions, monitor everything.' },
            { role: 'Manager', color: '#0d9488', bg: 'rgba(13,148,136,0.08)', desc: 'Request shipments, view progress, receive risk alerts, communicate with team.' },
            { role: 'Fleet Manager', color: '#d97706', bg: 'rgba(217,119,6,0.08)', desc: 'Manage vehicles, assign drivers, monitor fleet health and active deliveries.' },
            { role: 'Driver', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', desc: 'See your assigned delivery, share real-time GPS location, update delivery status.' },
            { role: 'Analyst', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', desc: 'View all shipment data, risk trends, and route performance across the organization.' },
          ].map(r => (
            <div key={r.role} className="role-card" style={{ '--rc': r.color }}>
              <div className="role-card-icon" style={{ background: r.bg, color: r.color }}>
                <Users size={18} />
              </div>
              <div className="role-card-name" style={{ color: r.color }}>{r.role}</div>
              <p className="role-card-desc">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-cta">
        <div className="cta-card">
          <div className="cta-orb" />
          <h2>Ready to transform your logistics?</h2>
          <p>Create your organization in under 2 minutes and start optimizing routes today.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-xl" onClick={() => navigate('/signup')}>
              <Package size={18} /> Create Organization — It's Free
            </button>
            <button className="btn btn-secondary btn-xl" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-logo" style={{ marginBottom: '0.5rem' }}>
          <div className="landing-logo-mark" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>SE</div>
          <span className="landing-logo-text" style={{ fontSize: '0.875rem' }}>Supply<span className="landing-logo-accent">Eazy</span></span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>
          © 2026 SupplyEazy. Built for Google Solution Challenge.
        </p>
      </footer>
    </div>
  );
}
