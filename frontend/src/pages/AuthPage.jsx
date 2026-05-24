import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Zap, Bot, GitBranch, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleChange = (e) => {
    clearError();
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;
    if (tab === 'login') {
      result = await login(form.email, form.password);
    } else {
      if (!form.fullName.trim()) { toast.error('El nombre es requerido'); return; }
      result = await register(form.email, form.password, form.fullName);
    }
    if (result.ok) {
      toast.success(tab === 'login' ? '¡Bienvenido de vuelta!' : '¡Cuenta creada!');
      navigate('/dashboard/flow-designer');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="auth-page">
      {/* Left branding panel */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="auth-brand-icon">
            <BookOpen />
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', textAlign: 'center', letterSpacing: '-0.03em' }}>
            AlexandrIA<br />
            <span style={{ color: 'var(--brand-primary)' }}>Magazine</span>
          </h1>
          <p className="auth-tagline">
            Plataforma inteligente para crear, revisar y publicar artículos científicos con agentes IA.
          </p>
          <div className="auth-features">
            {[
              { icon: <GitBranch size={14} />, text: 'Flow Designer visual con LangGraph' },
              { icon: <Bot size={14} />, text: 'Agentes IA: Investigador, Redactor, Revisor' },
              { icon: <Zap size={14} />, text: 'Ejecución en tiempo real con SSE' },
              { icon: <Shield size={14} />, text: 'Revisión colaborativa con @mention' },
            ].map((f, i) => (
              <div className="auth-feature" key={i}>
                <div className="auth-feature-dot" />
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-right">
        <div className="auth-form-box animate-fade-in">
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 4 }}>
              {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {tab === 'login'
                ? 'Accede a tu espacio de trabajo'
                : 'Únete a AlexandrIA Magazine'}
            </p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); clearError(); }}>
              Iniciar sesión
            </button>
            <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); clearError(); }}>
              Registrarse
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {tab === 'register' && (
              <div className="input-group">
                <label className="input-label">Nombre completo</label>
                <input
                  className="input"
                  type="text"
                  name="fullName"
                  placeholder="Tu nombre"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                className="input"
                type="email"
                name="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Contraseña</label>
              <input
                className="input"
                type="password"
                name="password"
                placeholder={tab === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--status-error-bg)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--status-error)',
              }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={isLoading}>
              {isLoading ? (
                <><div className="spinner" style={{ borderTopColor: 'white' }} /> Cargando...</>
              ) : (
                tab === 'login' ? 'Entrar' : 'Crear cuenta'
              )}
            </button>
          </form>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
            {tab === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); clearError(); }}
              style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: 'inherit', fontWeight: 600 }}
            >
              {tab === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
