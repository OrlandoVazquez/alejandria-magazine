import { create } from 'zustand';
import { articlesApi } from '../api/articles';

export const useArticleStore = create((set, get) => ({
  articles: [],
  currentArticle: null,
  isLoading: false,
  error: null,

  fetchArticles: async (params) => {
    set({ isLoading: true });
    try {
      const data = await articlesApi.list(params);
      set({ articles: data.items || data, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchArticle: async (id) => {
    set({ isLoading: true });
    try {
      const data = await articlesApi.get(id);
      set({ currentArticle: data, isLoading: false });
      return data;
    } catch { set({ isLoading: false }); }
  },

  createArticle: async (title, body = '') => {
    const data = await articlesApi.create({ title, body });
    set(s => ({ articles: [data, ...s.articles] }));
    return data;
  },

  updateArticle: async (id, payload) => {
    const data = await articlesApi.update(id, payload);
    set(s => ({
      articles: s.articles.map(a => a.id === id ? data : a),
      currentArticle: s.currentArticle?.id === id ? data : s.currentArticle,
    }));
    return data;
  },

  approveArticle: async (id) => {
    const data = await articlesApi.approve(id);
    set(s => ({
      articles: s.articles.map(a => a.id === id ? data : a),
      currentArticle: data,
    }));
  },

  rejectArticle: async (id, comment) => {
    const data = await articlesApi.reject(id, comment);
    set(s => ({
      articles: s.articles.map(a => a.id === id ? data : a),
      currentArticle: data,
    }));
  },

  assignReviewer: async (id, email) => {
    const data = await articlesApi.assignReviewer(id, email);
    set(s => ({
      articles: s.articles.map(a => a.id === id ? data : a),
      currentArticle: data,
    }));
  },

  setCurrentArticle: (article) => set({ currentArticle: article }),
}));
