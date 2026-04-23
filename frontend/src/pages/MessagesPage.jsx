export default function MessagesPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header"><h1>💬 Messages</h1></div>
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>💬</div>
        <h3>Internal Messaging</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Real-time communication between drivers, admins, and managers. Coming in Phase 2 with Firebase Realtime Database integration.
        </p>
      </div>
    </div>
  );
}
