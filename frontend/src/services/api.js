import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

const crud = (path) => ({
  getAll:  (params) => api.get(path, { params }),
  getOne:  (id)     => api.get(`${path}/${id}`),
  create:  (data)   => api.post(path, data),
  update:  (id, data) => api.put(`${path}/${id}`, data),
  remove:  (id)     => api.delete(`${path}/${id}`),
});

export const authService = {
  login:          (data) => api.post('/auth/login', data),
  getMe:          ()     => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const userService       = { ...crud('/users'), getSubordinates: () => api.get('/users/subordinates') };
export const dealerService     = crud('/dealers');
export const productService    = crud('/products');
export const orderService      = { ...crud('/orders'), updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data) };
export const collectionService = crud('/collections');
export const visitService      = crud('/visits');
export const dashboardService  = { get: (params) => api.get('/dashboard', { params }) };
export const reportService     = {
  sales:       (params) => api.get('/reports/sales',       { params }),
  collection:  (params) => api.get('/reports/collection',  { params }),
  visit:       (params) => api.get('/reports/visit',       { params }),
  outstanding: (params) => api.get('/reports/outstanding', { params }),
};
