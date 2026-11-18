import axios from 'axios';

const apiRoot = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '').replace(/\/+$/, '');
const baseURL = `${apiRoot}/api`;

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platformAdminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platformAdminToken');
      window.location.href = '/platform-admin/login';
    }
    return Promise.reject(error);
  }
);

export const platformAdminApi = {
  login: (data) => api.post('/platform-admin/auth/login', data),
  getMe: () => api.get('/platform-admin/auth/me'),
  getDashboard: () => api.get('/platform-admin/dashboard'),
  getCompanies: (params) => api.get('/platform-admin/companies', { params }),
  getPlans: () => api.get('/platform-admin/plans'),
  updatePlan: (id, payload) => api.patch(`/platform-admin/plans/${id}`, payload),
  getFeatureCatalog: () => api.get('/platform-admin/feature-catalog'),
  getSubscriptions: (params) => api.get('/platform-admin/subscriptions', { params }),
  updateSubscriptionStatus: (id, status) => api.patch(`/platform-admin/subscriptions/${id}/status`, { status }),
  getUsers: (params) => api.get('/platform-admin/users', { params }),
  getPayments: (params) => api.get('/platform-admin/payments', { params }),
  recordManualPayment: (payload) => api.post('/platform-admin/payments/manual', payload),
  verifyManualPayment: (id) => api.post(`/platform-admin/payments/${id}/verify`),
  getAuditLogs: (params) => api.get('/platform-admin/audit-logs', { params }),
  getCompany: (id) => api.get(`/platform-admin/companies/${id}`),
  activateCompany: (id) => api.post(`/platform-admin/companies/${id}/activate`),
  suspendCompany: (id) => api.post(`/platform-admin/companies/${id}/suspend`),
  extendLicense: (id, payload) => api.post(`/platform-admin/companies/${id}/extend-license`, payload),
  changePlan: (id, payload) => api.post(`/platform-admin/companies/${id}/change-plan`, payload),
  updateUserLimits: (id, payload) => api.post(`/platform-admin/companies/${id}/user-limits`, payload),
  updateFeatures: (id, payload) => api.post(`/platform-admin/companies/${id}/features`, payload),
};

export default api;
