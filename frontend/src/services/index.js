import api from './api';

export const authService = {
  checkAdmin:     ()     => api.get('/auth/check-admin'),
  registerAdmin:  (data) => api.post('/auth/register-admin', data),
  login:          (data) => api.post('/auth/login', data),
  getMe:          ()     => api.get('/auth/me'),
  updateProfile:  (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const userService = {
  getAll:        ()         => api.get('/users'),
  getOne:        (id)       => api.get(`/users/${id}`),
  createStaff:   (data)     => api.post('/users/create-staff', data),
  update:        (id, data) => api.put(`/users/${id}`, data),
  delete:        (id)       => api.delete(`/users/${id}`),
  toggleStatus:  (id)       => api.patch(`/users/${id}/status`),
  resetPassword: (id, data) => api.patch(`/users/${id}/reset-password`, data),
};


export const salespersonService = {
  getAll:  (params) => api.get('/salespersons', { params }),
  getOne:  (id)     => api.get(`/salespersons/${id}`),
  create:  (data)   => api.post('/salespersons', data),
  update:  (id, data) => api.put(`/salespersons/${id}`, data),
  delete:  (id)     => api.delete(`/salespersons/${id}`),
};

export const dealerService = {
  getAll:  (params) => api.get('/dealers', { params }),
  getOne:  (id)     => api.get(`/dealers/${id}`),
  create:  (data)   => api.post('/dealers', data),
  update:  (id, data) => api.put(`/dealers/${id}`, data),
  delete:  (id)     => api.delete(`/dealers/${id}`),
};

export const productService = {
  getAll:  (params) => api.get('/products', { params }),
  getOne:  (id)     => api.get(`/products/${id}`),
  create:  (data)   => api.post('/products', data),
  update:  (id, data) => api.put(`/products/${id}`, data),
  delete:  (id)     => api.delete(`/products/${id}`),
};

export const orderService = {
  getAll:       (params) => api.get('/orders', { params }),
  getOne:       (id)     => api.get(`/orders/${id}`),
  create:       (data)   => api.post('/orders', data),
  update:       (id, data) => api.put(`/orders/${id}`, data),
  delete:       (id)     => api.delete(`/orders/${id}`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
};

export const liftingService = {
  getAll:  (params) => api.get('/lifting', { params }),
  getOne:  (id)     => api.get(`/lifting/${id}`),
  create:  (data)   => api.post('/lifting', data),
  update:  (id, data) => api.put(`/lifting/${id}`, data),
  delete:  (id)     => api.delete(`/lifting/${id}`),
};

export const collectionService = {
  getAll:  (params) => api.get('/collections', { params }),
  getOne:  (id)     => api.get(`/collections/${id}`),
  create:  (data)   => api.post('/collections', data),
  update:  (id, data) => api.put(`/collections/${id}`, data),
  delete:  (id)     => api.delete(`/collections/${id}`),
};

export const dashboardService = {
  get: () => api.get('/dashboard'),
};

export const reportService = {
  sales:                  (params) => api.get('/reports/sales', { params }),
  collections:            (params) => api.get('/reports/collections', { params }),
  lifting:                (params) => api.get('/reports/lifting', { params }),
  dealerOutstanding:      (params) => api.get('/reports/dealer-outstanding', { params }),
  salespersonPerformance: (params) => api.get('/reports/salesperson-performance', { params }),
  productWise:            (params) => api.get('/reports/product-wise', { params }),
  provinceWise:           ()       => api.get('/reports/province-wise'),
  monthlySales:           (params) => api.get('/reports/monthly-sales', { params }),
};
