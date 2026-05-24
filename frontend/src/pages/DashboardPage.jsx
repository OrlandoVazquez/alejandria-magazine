import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  GitBranch, Bot, Zap, FileText, Settings,
  BookOpen, LogOut, Bell
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/flow-designer', icon: <GitBranch size={17} />, label: 'Flow Designer' },
  { to: '/dashboard/agents',        icon: <Bot size={17} />,        label: 'Agentes' },
  { to: '/dashboard/flows',         icon: <Zap size={17} />,        label: 'Flujos' },
  { to: '/dashboard/articles',      icon: <FileText size={17} />,   label: 'Artículos' },
];

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
    navigate('/auth');
  };

  const initials = user?.full_name
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <BookOpen size={16} color="white" />
          </div>
          <span className="sidebar-logo-text">
            Alex<span>andrIA</span>
          </span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Workspace</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/dashboard/config"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Settings size={17} />
            Configuración
          </NavLink>
          <button className="nav-item btn-ghost w-full" onClick={handleLogout}
            style={{ border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <button className="btn btn-ghost btn-icon">
                <Bell size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="avatar">{initials}</div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.full_name}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {user?.role}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <Outlet />
      </div>
    </div>
  );
}
