import { useState, useEffect } from 'react';
import { fleetAPI } from '../services/api';
import { Truck, PlusCircle, Gauge, Wrench, CheckCircle2, X } from 'lucide-react';

const DEMO = [
  { id: 'v1', vehicle_id: 'MH-01-AB-1234', vehicle_type: 'truck', capacity_kg: 10000, status: 'available' },
  { id: 'v2', vehicle_id: 'DL-02-CD-5678', vehicle_type: 'truck', capacity_kg: 20000, status: 'in_transit' },
  { id: 'v3', vehicle_id: 'KA-03-EF-9012', vehicle_type: 'van', capacity_kg: 3000, status: 'maintenance' },
];

const STATUS_COLORS = { available: 'var(--risk-low)', in_transit: 'var(--accent-secondary)', maintenance: 'var(--risk-medium)' };
const STATUS_ICONS = { available: CheckCircle2, in_transit: Truck, maintenance: Wrench };

export default function FleetPage() {
  const [vehicles, setVehicles] = useState(DEMO);
  const [stats, setStats] = useState({ total: 3, available: 1, in_transit: 1, maintenance: 1, total_capacity_kg: 33000 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', vehicle_type: 'truck', capacity_kg: '', status: 'available' });

  useEffect(() => {
    Promise.allSettled([fleetAPI.listVehicles(), fleetAPI.stats()]).then(([vRes, sRes]) => {
      if (vRes.status === 'fulfilled' && vRes.value.data.vehicles?.length) setVehicles(vRes.value.data.vehicles);
      if (sRes.status === 'fulfilled') setStats(sRes.value.data);
    });
  }, []);

  const handleAdd = async () => {
    try {
      await fleetAPI.addVehicle({ ...form, capacity_kg: parseFloat(form.capacity_kg) || 0 });
      setShowForm(false);
      fleetAPI.listVehicles().then(r => setVehicles(r.data.vehicles));
    } catch { setVehicles([...vehicles, { id: 'new', ...form }]); setShowForm(false); }
  };

  const metricCards = [
    { icon: Truck, label: 'Total Vehicles', value: stats.total, color: null },
    { icon: CheckCircle2, label: 'Available', value: stats.available, color: 'var(--risk-low)' },
    { icon: Gauge, label: 'In Transit', value: stats.in_transit, color: 'var(--accent-secondary)' },
    { icon: Wrench, label: 'Maintenance', value: stats.maintenance, color: 'var(--risk-medium)' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <h1><Truck size={22} className="icon" /> Fleet Management</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={14} /> Cancel</> : <><PlusCircle size={14} /> Add Vehicle</>}
        </button>
      </div>

      <div className="grid grid-4 stagger-children" style={{ marginBottom: 'var(--space-lg)' }}>
        {metricCards.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="glass-card metric-card">
              <div className="metric-icon-wrap"><Icon size={18} /></div>
              <div className="metric-value" style={m.color ? {color: m.color} : undefined}>{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="glass-card animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            <div className="form-group"><label className="form-label">Vehicle ID</label><input className="form-input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} placeholder="MH-01-XX-0000" /></div>
            <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}><option value="truck">Truck</option><option value="van">Van</option><option value="trailer">Trailer</option></select></div>
            <div className="form-group"><label className="form-label">Capacity (kg)</label><input className="form-input" type="number" value={form.capacity_kg} onChange={e => setForm({ ...form, capacity_kg: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="available">Available</option><option value="in_transit">In Transit</option><option value="maintenance">Maintenance</option></select></div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleAdd}>Save Vehicle</button>
        </div>
      )}

      <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Vehicle ID</th><th>Type</th><th>Capacity</th><th>Status</th></tr></thead>
          <tbody>
            {vehicles.map(v => {
              const SIcon = STATUS_ICONS[v.status] || Truck;
              return (
                <tr key={v.id}>
                  <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary-light)' }}>{v.vehicle_id}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{v.vehicle_type}</td>
                  <td>{Number(v.capacity_kg).toLocaleString()} kg</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[v.status], fontWeight: 600, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <SIcon size={13} /> {v.status?.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
