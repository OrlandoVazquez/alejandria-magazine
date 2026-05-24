import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

import AuthPage          from './pages/AuthPage';
import DashboardPage     from './pages/DashboardPage';
import FlowDesignerPage  from './pages/FlowDesignerPage';
import FlowsPage         from './pages/FlowsPage';
import AgentsPage        from './pages/AgentsPage';
import ArticlesPage      from './pages/ArticlesPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import ConfigPage        from './pages/ConfigPage';
import ExecutionPage     from './pages/ExecutionPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard/flow-designer" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            boxShadow: 'var(--shadow-lg)',
          },
          success: { iconTheme: { primary: 'var(--status-success)', secondary: 'var(--bg-elevated)' } },
          error:   { iconTheme: { primary: 'var(--status-error)',   secondary: 'var(--bg-elevated)' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* Execution (full screen, no dashboard shell) */}
        <Route path="/execution/:articleId" element={
          <ProtectedRoute><ExecutionPage /></ProtectedRoute>
        } />

        {/* Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}>
          <Route index element={<Navigate to="flow-designer" replace />} />
          <Route path="flow-designer" element={<FlowDesignerPage />} />
          <Route path="flows"         element={<FlowsPage />} />
          <Route path="agents"        element={<AgentsPage />} />
          <Route path="articles"      element={<ArticlesPage />} />
          <Route path="articles/:id"  element={<ArticleDetailPage />} />
          <Route path="config"        element={<ConfigPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
