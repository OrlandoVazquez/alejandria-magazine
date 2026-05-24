import api from './client';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const agentsApi = {
  // Run pipeline
  run: (articleId, data) =>
    api.post(`/api/v1/agents/${articleId}/run`, data).then(r => r.data),

  // Get run history
  getRuns: (articleId) =>
    api.get(`/api/v1/agents/${articleId}/runs`).then(r => r.data),

  // Agent definitions
  getDefinitions: () =>
    api.get('/api/v1/agents/definitions').then(r => r.data),

  getClaudeDefs: () =>
    api.get('/api/v1/agents/claude-defs').then(r => r.data),

  updateClaudeDef: (name, content) =>
    api.put(`/api/v1/agents/claude-defs/${name}`, { content }).then(r => r.data),

  // SSE stream URL (used directly with EventSource)
  getStreamUrl: (articleId) =>
    `${BASE_API_URL}/api/v1/agents/${articleId}/stream`,
};
