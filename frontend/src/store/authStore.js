import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login({ email, password });
          localStorage.setItem('access_token', data.access_token);
          const user = await authApi.me();
          set({ token: data.access_token, user, isAuthenticated: true, isLoading: false });
          return { ok: true };
        } catch (err) {
          const msg = err.response?.data?.detail || 'Error al iniciar sesión';
          set({ isLoading: false, error: msg });
          return { ok: false, error: msg };
        }
      },

      register: async (email, password, fullName) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.register({ email, password, full_name: fullName });
          localStorage.setItem('access_token', data.access_token);
          const user = await authApi.me();
          set({ token: data.access_token, user, isAuthenticated: true, isLoading: false });
          return { ok: true };
        } catch (err) {
          const msg = err.response?.data?.detail || 'Error al registrarse';
          set({ isLoading: false, error: msg });
          return { ok: false, error: msg };
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
