import axios from 'axios';
import { auth } from '../config/firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Firebase token into every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/api/auth/signup', data),
  getProfile: () => api.get('/api/auth/profile'),
  refreshClaims: () => api.post('/api/auth/refresh-claims'),
};

// ── Organizations ───────────────────────────────────────────────
export const orgAPI = {
  get: () => api.get('/api/organizations/'),
  update: (data) => api.put('/api/organizations/', data),
  inviteUser: (data) => api.post('/api/organizations/invite', data),
  listUsers: () => api.get('/api/organizations/users'),
  updateUserRole: (userId, role) => api.put(`/api/organizations/users/${userId}/role?role=${role}`),
  createDeliveryZone: (data) => api.post('/api/organizations/delivery-zones', data),
  listDeliveryZones: () => api.get('/api/organizations/delivery-zones'),
  createTransitHub: (data) => api.post('/api/organizations/transit-hubs', data),
  listTransitHubs: () => api.get('/api/organizations/transit-hubs'),
  createCarrier: (data) => api.post('/api/organizations/carriers', data),
  listCarriers: () => api.get('/api/organizations/carriers'),
};

// ── Shipments ───────────────────────────────────────────────────
export const shipmentAPI = {
  create: (data) => api.post('/api/shipments/', data),
  list: (params) => api.get('/api/shipments/', { params }),
  get: (id) => api.get(`/api/shipments/${id}`),
  update: (id, data) => api.put(`/api/shipments/${id}`, data),
  delete: (id) => api.delete(`/api/shipments/${id}`),
  dispatch: (id) => api.post(`/api/shipments/${id}/dispatch`),
  stats: () => api.get('/api/shipments/stats'),
  getLocation: (id) => api.get(`/api/shipments/${id}/location`),
  getGpsTrack: (id, limit = 100) => api.get(`/api/shipments/${id}/gps-track`, { params: { limit } }),
  getEvents: (id) => api.get(`/api/shipments/${id}/events`),
};

// ── Fleet ───────────────────────────────────────────────────────
export const fleetAPI = {
  addVehicle: (data) => api.post('/api/fleet/vehicles', data),
  listVehicles: () => api.get('/api/fleet/vehicles'),
  updateVehicle: (id, data) => api.put(`/api/fleet/vehicles/${id}`, data),
  deleteVehicle: (id) => api.delete(`/api/fleet/vehicles/${id}`),
  stats: () => api.get('/api/fleet/stats'),
};

// ── Warehouses ──────────────────────────────────────────────────
export const warehouseAPI = {
  create: (data) => api.post('/api/warehouses/', data),
  list: () => api.get('/api/warehouses/'),
  update: (id, data) => api.put(`/api/warehouses/${id}`, data),
  delete: (id) => api.delete(`/api/warehouses/${id}`),
};

// ── Risk ────────────────────────────────────────────────────────
export const riskAPI = {
  evaluate: (shipmentId) => api.post(`/api/risk/evaluate/${shipmentId}`),
  getShipmentRisk: (shipmentId) => api.get(`/api/risk/shipment/${shipmentId}`),
  getAlerts: () => api.get('/api/risk/alerts'),
};

// ── Messages ────────────────────────────────────────────────────
export const messagesAPI = {
  send: (data) => api.post('/api/messages/', data),
  list: (params) => api.get('/api/messages/', { params }),
  unreadCount: () => api.get('/api/messages/unread-count'),
  markRead: (id) => api.post(`/api/messages/${id}/read`),
  threads: () => api.get('/api/messages/threads'),
};
// Legacy alias
export const messageAPI = messagesAPI;

// ── Streaming (GPS Simulation) ──────────────────────────────────
export const streamingAPI = {
  start: (shipmentId) => api.post(`/api/streaming/start/${shipmentId}`),
  stop: (shipmentId) => api.post(`/api/streaming/stop/${shipmentId}`),
  active: () => api.get('/api/streaming/active'),
};

// ── Analytics ───────────────────────────────────────────────────
export const analyticsAPI = {
  overview: () => api.get('/api/analytics/overview'),
  riskTimeline: (days = 30) => api.get('/api/analytics/risk-timeline', { params: { days } }),
  carrierPerformance: () => api.get('/api/analytics/carrier-performance'),
  delayDistribution: () => api.get('/api/analytics/delay-distribution'),
  routeHeatmap: () => api.get('/api/analytics/route-heatmap'),
  delayForecast: () => api.get('/api/analytics/delay-forecast'),
};

// ── Decisions (Phase 3 Self-Healing) ────────────────────────
export const decisionsAPI = {
  generate: (shipmentId) => api.post(`/api/decisions/generate/${shipmentId}`),
  approve: (decisionId, action) => api.post(`/api/decisions/${decisionId}/approve`, { action }),
  reject: (decisionId, reason) => api.post(`/api/decisions/${decisionId}/reject`, { reason }),
  pending: () => api.get('/api/decisions/pending'),
  history: (limit = 100) => api.get('/api/decisions/history', { params: { limit } }),
  impactSummary: () => api.get('/api/decisions/impact-summary'),
};

// ── Digital Twin (Phase 4 Simulation) ───────────────────────
export const digitalTwinAPI = {
  simulate: (payload) => api.post('/api/digital-twin/simulate', payload),
};

// ── Monitoring (Phase 5) ─────────────────────────────────────
export const monitoringAPI = {
  health:       () => api.get('/api/monitoring/health'),
  metrics:      () => api.get('/api/monitoring/metrics'),
  sla:          () => api.get('/api/monitoring/sla'),
  alertsLog:    (limit = 50) => api.get('/api/monitoring/alerts-log', { params: { limit } }),
  activityFeed: (limit = 30) => api.get('/api/monitoring/activity-feed', { params: { limit } }),
};

// ── Reports (Phase 5) ────────────────────────────────────────
export const reportsAPI = {
  summary:           () => api.get('/api/reports/summary'),
  exportShipments:   () => api.get('/api/reports/export/shipments.csv', { responseType: 'blob' }),
  exportDecisions:   () => api.get('/api/reports/export/decisions.csv', { responseType: 'blob' }),
};

// ── Shipment Requests (Manager → Admin) ─────────────────────
export const shipmentRequestAPI = {
  create:  (data) => api.post('/api/shipment-requests/', data),
  list:    (params) => api.get('/api/shipment-requests/', { params }),
  pending: () => api.get('/api/shipment-requests/pending'),
  get:     (id) => api.get(`/api/shipment-requests/${id}`),
  review:  (id, data) => api.post(`/api/shipment-requests/${id}/review`, data),
};

// ── Route Optimization ────────────────────────────────────────
export const routeAPI = {
  optimize: (data) => api.post('/api/shipments/optimize-route', data),
  predict:  (data) => api.post('/api/risk/predict', data),
};

export default api;
