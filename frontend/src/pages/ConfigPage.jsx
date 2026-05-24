import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Database, Bot, Box, Shield, Save, LogOut, RefreshCw } from 'lucide-react';
import { configApi } from '../api/config';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const SECTIONS = [
  {
    id: 'security', label: 'Seguridad', icon: <Shield size={15} />,
    fields: [
      { key: 'SECRET_KEY', label: 'Secret Key', desc: 'Clave JWT para firmar tokens', type: 'password' },
      { key: 'ENABLE_DEV_ROLE_PROMOTION', label: 'Dev Role Promotion', desc: 'Permite promover roles desde /dev endpoints', type: 'toggle' },
    ],
  },
  {
    id: 'database', label: 'Base de datos', icon: <Database size={15} />,
    fields: [
      { key: 'DATABASE_URL', label: 'Database URL', desc: 'Cadena de conexión SQLAlchemy', type: 'text' },
    ],
  },
  {
    id: 'ollama', label: 'Ollama (LLM)', icon: <Bot size={15} />,
    fields: [
      { key: 'OLLAMA_BASE_URL', label: 'Ollama URL', desc: 'URL base del servidor Ollama', type: 'text' },
      { key: 'OLLAMA_MODEL', label: 'Modelo', desc: 'Modelo por defecto (ej: llama3.2)', type: 'text' },
    ],
  },
  {
    id: 'qdrant', label: 'Qdrant (RAG)', icon: <Box size={15} />,
    fields: [
      { key: 'QDRANT_URL', label: 'Qdrant URL', desc: 'URL del servidor Qdrant', type: 'text' },
      { key: 'QDRANT_COLLECTION', label: 'Colección', desc: 'Nombre de la colección vectorial', type: 'text' },
    ],
  },
  {
    id: 'server', label: 'Servidor', icon: <Server size={15} />,
    fields: [
      { key: 'HOST', label: 'Host', desc: 'Host del servidor FastAPI', type: 'text' },
      { key: 'PORT', label: 'Puerto', desc: 'Puerto del servidor', type: 'text' },
      { key: 'DEBUG', label: 'Modo debug', desc: 'Activa logs detallados', type: 'toggle' },
    ],
  },
];

export default function ConfigPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    configApi.get().then(data => { setConfig(data); setLoading(false); })
      .catch(() => { setLoading(false); toast.error('No se pudo cargar la configuración'); });
  }, []);

  const handleChange = (key, value) => setConfig(c => ({ ...c, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await configApi.update(config);
      toast.success('Configuración guardada');
    } catch { toast.error('Error al guardar configuración'); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
    navigate('/auth');
  };

  if (loading) return <div className="page-body"><div className="empty-state"><div className="spinner spinner-lg" /></div></div>;

  return (
    <div className="page-body" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Configuración</h2>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Parámetros del sistema (config.yaml)</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            configApi.get().then(data => { setConfig(data); toast.success('Recargado'); });
          }}>
            <RefreshCw size={14} /> Recargar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {SECTIONS.map(section => (
          <div className="config-section" key={section.id}>
            <div className="config-section-header">
              {section.icon}
              {section.label}
            </div>
            <div className="config-section-body">
              {section.fields.map(field => (
                <div className="config-row" key={field.key}>
                  <div className="config-row-info">
                    <div className="config-row-key">{field.key}</div>
                    <div className="config-row-desc">{field.desc}</div>
                  </div>
                  {field.type === 'toggle' ? (
                    <div className="toggle-wrapper"
                      onClick={() => handleChange(field.key, !config[field.key])}>
                      <div className={`toggle ${config[field.key] ? 'on' : ''}`} />
                    </div>
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'password' ? 'password' : 'text'}
                      style={{ width: 260, padding: '6px 10px', fontSize: 'var(--font-size-xs)', fontFamily: field.type === 'password' ? 'var(--font-mono)' : 'inherit' }}
                      value={config[field.key] || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout section */}
        <div className="config-section">
          <div className="config-section-header">
            <LogOut size={15} />
            Sesión
          </div>
          <div className="config-section-body">
            <div className="config-row">
              <div className="config-row-info">
                <div className="config-row-key">Cerrar sesión</div>
                <div className="config-row-desc">Elimina el token de sesión actual</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                <LogOut size={13} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
