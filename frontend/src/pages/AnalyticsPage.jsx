export default function AnalyticsPage() {
  const metrics = [
    { label: 'Delays Prevented', value: '23', icon: '🛡️', change: '+12%' },
    { label: 'Cost Savings', value: '₹4.2L', icon: '💰', change: '+8%' },
    { label: 'Fuel Reduction', value: '15%', icon: '⛽', change: '+3%' },
    { label: 'SLA Compliance', value: '94.2%', icon: '📋', change: '+2.1%' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header"><h1>📊 Analytics & Insights</h1></div>

      <div className="grid grid-4 stagger-children" style={{ marginBottom: '1.5rem' }}>
        {metrics.map(m => (
          <div key={m.label} className="glass-card metric-card" style={{ textAlign: 'center' }}>
            <span className="metric-icon">{m.icon}</span>
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
            <div style={{ color: 'var(--risk-low)', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>{m.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>🏆 Performance Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'On-Time Delivery', value: 91.7, color: 'var(--risk-low)' },
              { label: 'Risk Prediction Accuracy', value: 87, color: 'var(--accent-primary)' },
              { label: 'Fleet Utilization', value: 78, color: 'var(--accent-secondary)' },
              { label: 'Route Optimization', value: 85, color: 'var(--risk-medium)' },
            ].map(p => (
              <div key={p.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: p.color }}>{p.value}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.value}%`, background: p.color, borderRadius: 'var(--radius-full)', transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>📈 Model Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { label: 'Accuracy', value: '89.4%' },
              { label: 'Precision', value: '87.2%' },
              { label: 'Recall', value: '91.1%' },
              { label: 'AUC-ROC', value: '0.93' },
              { label: 'F1 Score', value: '0.89' },
              { label: 'MAE', value: '0.072' },
            ].map(m => (
              <div key={m.label} style={{ padding: '0.75rem', background: 'rgba(15,26,58,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary-light)', marginTop: 4 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
