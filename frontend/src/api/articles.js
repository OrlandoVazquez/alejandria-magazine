import api from './client';

export const articlesApi = {
  list: (params) => api.get('/api/v1/articles', { params }).then(r => r.data),
  get: (id) => api.get(`/api/v1/articles/${id}`).then(r => r.data),
  create: (data) => api.post('/api/v1/articles', data).then(r => r.data),
  update: (id, data) => api.put(`/api/v1/articles/${id}`, data).then(r => r.data),
  submit: (id) => api.post(`/api/v1/articles/${id}/submit`).then(r => r.data),
  approve: (id) => api.post(`/api/v1/articles/${id}/approve`).then(r => r.data),
  reject: (id, comment) => api.post(`/api/v1/articles/${id}/reject`, { comment }).then(r => r.data),
  assignReviewer: (id, reviewerEmail) =>
    api.post(`/api/v1/articles/${id}/assign-reviewer`, { reviewer_email: reviewerEmail }).then(r => r.data),
};
