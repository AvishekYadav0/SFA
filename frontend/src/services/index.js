import api from './api';

export const authService = {
  login:          (data) => api.post('/auth/login', data),
  getMe:          ()     => api.get('/auth/me'),
  checkAdmin:     ()     => api.get('/auth/check-admin'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const userService = {
  getAll:          (params)   => api.get('/users', { params }),
  getOne:          (id)       => api.get(`/users/${id}`),
  getSubordinates: (params)   => api.get('/users/subordinates', { params }),
  create:          (data)     => api.post('/users', data),
  createStaff:     (data)     => api.post('/users', data),
  update:          (id, data) => api.put(`/users/${id}`, data),
  delete:          (id)       => api.delete(`/users/${id}`),
  toggleStatus:    (id)       => api.patch(`/users/${id}/status`),
  resetPassword:   (id, data) => api.put(`/users/${id}/reset-password`, data),
};

export const dealerService = {
  getAll:    (params)      => api.get('/dealers', { params }),
  getOne:    (id)          => api.get(`/dealers/${id}`),
  create:    (data)        => api.post('/dealers', data),
  update:    (id, data)    => api.put(`/dealers/${id}`, data),
  delete:    (id)          => api.delete(`/dealers/${id}`),
  assignSO:  (id, assignments) => api.put(`/dealers/${id}/assign-so`, {
    ...(assignments.some?.(item => typeof item === 'object') ? { assignments } : { soIds: assignments }),
  }),
  linkUser:  (id, userId)  => api.put(`/dealers/${id}/link-user`, { userId }),
};

export const productService = {
  getAll:  (params)   => api.get('/products', { params }),
  getOne:  (id)       => api.get(`/products/${id}`),
  create:  (data)     => api.post('/products', data),
  update:  (id, data) => api.put(`/products/${id}`, data),
  delete:  (id)       => api.delete(`/products/${id}`),
};

export const orderService = {
  getAll:       (params)   => api.get('/orders', { params }),
  getOne:       (id)       => api.get(`/orders/${id}`),
  create:       (data)     => api.post('/orders', data),
  update:       (id, data) => api.put(`/orders/${id}`, data),
  delete:       (id)       => api.delete(`/orders/${id}`),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
};

export const collectionService = {
  getAll:  (params)   => api.get('/collections', { params }),
  getOne:  (id)       => api.get(`/collections/${id}`),
  create:  (data)     => api.post('/collections', data),
  update:  (id, data) => api.put(`/collections/${id}`, data),
  delete:  (id)       => api.delete(`/collections/${id}`),
};

export const visitService = {
  getAll:  (params)   => api.get('/visits', { params }),
  getOne:  (id)       => api.get(`/visits/${id}`),
  create:  (data)     => api.post('/visits', data),
  update:  (id, data) => api.put(`/visits/${id}`, data),
  delete:  (id)       => api.delete(`/visits/${id}`),
};

export const dashboardService = {
  get: (params) => api.get('/dashboard', { params }),
};

export const reportService = {
  sales:             (params) => api.get('/reports/sales',              { params }),
  collection:        (params) => api.get('/reports/collection',         { params }),
  visit:             (params) => api.get('/reports/visit',              { params }),
  outstanding:       (params) => api.get('/reports/outstanding',        { params }),
  targetAchievement: (params) => api.get('/reports/target-achievement', { params }),
  dealerStats:       (id)     => api.get(`/reports/dealer/${id}/stats`),
};

export const targetService = {
  getAll:  (params)   => api.get('/targets', { params }),
  create:  (data)     => api.post('/targets', data),
  update:  (id, data) => api.put(`/targets/${id}`, data),
  delete:  (id)       => api.delete(`/targets/${id}`),
};

export const notificationService = {
  getAll:     (params) => api.get('/notifications', { params }),
  markRead:   (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead: ()      => api.patch('/notifications/all/read'),
};

export const dealerPortalService = {
  getSummary:  ()       => api.get('/dealer-portal/summary'),
  getProfile:  ()       => api.get('/dealer-portal/profile'),
  getOrders:   (params) => api.get('/dealer-portal/orders',   { params }),
  getPayments: (params) => api.get('/dealer-portal/payments', { params }),
};

// legacy compat
export const salespersonService = userService;
export const liftingService     = { getAll: (p) => api.get('/lifting', { params: p }), create: (d) => api.post('/lifting', d), update: (id, d) => api.put(`/lifting/${id}`, d), delete: (id) => api.delete(`/lifting/${id}`) };
export const dailyVisitService  = { getAll: (p) => api.get('/daily-visits', { params: p }), create: (d) => api.post('/daily-visits', d), update: (id, d) => api.patch(`/daily-visits/${id}`, d), remove: (id) => api.delete(`/daily-visits/${id}`) };
export const claimService       = { getAll: () => api.get('/claims'), create: (d) => api.post('/claims', d), process: (id, d) => api.post(`/claims/${id}/action`, d) };
export const saleService        = { getRecords: (p) => api.get('/sales/records', { params: p }) };
