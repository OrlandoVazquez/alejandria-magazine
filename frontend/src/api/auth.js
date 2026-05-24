import api from './client';

export const authApi = {
  register: (data) => api.post('/api/v1/auth/register', data).then(r => r.data),
  login: (data) => api.post('/api/v1/auth/login', data).then(r => r.data),
  me: () => api.get('/api/v1/auth/me').then(r => r.data),
  promoteReviewer: () => api.post('/api/v1/auth/dev/promote-reviewer').then(r => r.data),
};
