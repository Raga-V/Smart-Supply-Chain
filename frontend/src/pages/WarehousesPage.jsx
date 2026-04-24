import { useState, useEffect } from 'react';
import { warehouseAPI } from '../services/api';
import { Warehouse, PlusCircle, MapPin, Package, Map, X } from 'lucide-react';

const DEMO = [
  { id: 'w1', name: 'Mumbai Central Warehouse', address: 'Andheri East, Mumbai', lat: 19.12, lng: 72.85, capacity: 50000, zone: 'West' },
  { id: 'w2', name: 'Delhi Distribution Hub', address: 'Okhla, New Delhi', lat: 28.53, lng: 77.27, capacity: 75000, zone: 'North' },
];

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState(DEMO);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '', capacity: '', zone: '' });

  useEffect(() => { warehouseAPI.list().then(r => { if (r.data.warehouses?.length) setWarehouses(r.data.warehouses); }).catch(() => {}); }, []);

  const handleAdd = async () => {
    try {
      await warehouseAPI.create({ ...form, lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0, capacity: parseFloat(form.capacity) || 0 });
      setShowForm(false);
      setForm({ name: '', address: '', lat: '', lng: '', capacity: '', zone: '' });
      warehouseAPI.list().then(r => setWarehouses(r.data.warehouses));
    } catch { setWarehouses([...warehouses, { id: 'new', ...form }]); setShowForm(false); }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <h1><Warehouse size={22} className="icon" /> Warehouses & Hubs</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={14} /> Cancel</> : <><PlusCircle size={14} /> Add Warehouse</>}
        </button>
      </div>

      {showForm && (
        <div className="glass-card animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Warehouse name" /></div>
            <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" /></div>
            <div className="form-group"><label className="form-label">Latitude</label><input className="form-input" type="number" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Longitude</label><input className="form-input" type="number" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Capacity (kg)</label><input className="form-input" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Zone</label><input className="form-input" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} placeholder="e.g. North, West" /></div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleAdd}>Save Warehouse</button>
        </div>
      )}

      <div className="grid grid-2">
        {warehouses.map(w => (
          <div key={w.id} className="glass-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{w.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{w.address}</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} /> {parseFloat(w.lat)?.toFixed(2)}, {parseFloat(w.lng)?.toFixed(2)}</span>
              {w.capacity && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Package size={12} /> {Number(w.capacity).toLocaleString()} kg</span>}
              {w.zone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Map size={12} /> {w.zone}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
