import axios from 'axios';
import { auth } from '../config/firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
      // Token expired — redirect to login
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
export const messageAPI = {
  send: (data) => api.post('/api/messages/', data),
  list: (params) => api.get('/api/messages/', { params }),
};

export default api;
