import React, { useEffect, useState } from 'react';
import { Bot, Pencil, Code, Sliders, X, Save } from 'lucide-react';
import { agentsApi } from '../api/agents';
import toast from 'react-hot-toast';

const BUILTIN_AGENTS = [
  { id: 'investigador', emoji: '🔍', label: 'Investigador', color: '#06b6d4', desc: 'Busca contexto en Qdrant RAG y APIs científicas (EuropePMC, OpenAlex).' },
  { id: 'redactor',     emoji: '✍️',  label: 'Redactor',    color: '#7c3aed', desc: 'Genera borrador académico en Markdown usando Ollama.' },
  { id: 'revisor',      emoji: '👁️',  label: 'Revisor',     color: '#f59e0b', desc: 'Evalúa el borrador con un score 0-100 y genera feedback.' },
  { id: 'formateador',  emoji: '📄',  label: 'Formateador', color: '#10b981', desc: 'Reformatea citas en APA, IEEE o Vancouver.' },
  { id: 'publicador',   emoji: '🚀',  label: 'Publicador',  color: '#ef4444', desc: 'Guarda el artículo final en DB y lo marca como PUBLISHED.' },
];

export default function AgentsPage() {
  const [claudeDefs, setClaudeDefs] = useState([]);
  const [editAgent, setEditAgent] = useState(null);
  const [editTab, setEditTab] = useState('md');
  const [mdContent, setMdContent] = useState('');
  const [params, setParams] = useState({ model: '', temperature: 0.7, prompt_template: '', rag_enabled: true, rag_collection: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    agentsApi.getClaudeDefs().then(setClaudeDefs).catch(() => setClaudeDefs([]));
  }, []);

  const openEdit = (agent) => {
    setEditAgent(agent);
    setMdContent(agent.content || `# ${agent.label || agent.id}\n\nDescripción del agente.\n`);
    setParams({ model: agent.model || 'llama3.2', temperature: agent.temperature ?? 0.7, prompt_template: agent.prompt_template || '', rag_enabled: agent.rag_enabled ?? true, rag_collection: agent.rag_collection || 'rag_docs' });
    setEditTab('md');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentsApi.updateClaudeDef(editAgent.id, editTab === 'md' ? mdContent : JSON.stringify(params));
      toast.success('Agente guardado');
      setEditAgent(null);
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-body">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ marginBottom: 4 }}>Agentes</h2>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>Agentes del sistema y sus configuraciones</p>
      </div>

      {/* Built-in agents */}
      <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Agentes del backend
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {BUILTIN_AGENTS.map(agent => (
          <div key={agent.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ width: 40, height: 40, background: `${agent.color}20`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {agent.emoji}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{agent.label}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: agent.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>backend agent</div>
              </div>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>{agent.desc}</p>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
              onClick={() => openEdit(agent)}>
              <Pencil size={13} /> Editar
            </button>
          </div>
        ))}
      </div>

      {/* Claude defs */}
      {claudeDefs.length > 0 && (
        <>
          <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Agentes .claude/agents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {claudeDefs.map(def => (
              <div key={def.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 40, height: 40, background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{def.name || def.id}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>.claude agent</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openEdit(def)}>
                  <Pencil size={13} /> Editar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editAgent && (
        <div className="modal-backdrop" onClick={() => setEditAgent(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar — {editAgent.label || editAgent.name || editAgent.id}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditAgent(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {/* Tabs */}
              <div style={{ padding: 'var(--space-4) var(--space-6) 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 4 }}>
                {[{ id: 'md', icon: <Code size={13} />, label: 'Markdown' }, { id: 'params', icon: <Sliders size={13} />, label: 'Parámetros' }].map(t => (
                  <button key={t.id} onClick={() => setEditTab(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: editTab === t.id ? 'var(--brand-primary)' : 'var(--text-muted)', borderBottom: editTab === t.id ? '2px solid var(--brand-primary)' : '2px solid transparent', marginBottom: -1 }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
                {editTab === 'md' ? (
                  <textarea
                    className="input"
                    style={{ minHeight: 320, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', lineHeight: 1.7 }}
                    value={mdContent}
                    onChange={e => setMdContent(e.target.value)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="input-group">
                      <label className="input-label">Modelo (Ollama)</label>
                      <input className="input" value={params.model} onChange={e => setParams(p => ({ ...p, model: e.target.value }))} placeholder="llama3.2" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Temperature ({params.temperature})</label>
                      <input type="range" min="0" max="2" step="0.1" value={params.temperature}
                        onChange={e => setParams(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                        style={{ width: '100%', accentColor: 'var(--brand-primary)' }} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Prompt template</label>
                      <textarea className="input" rows={5} value={params.prompt_template}
                        onChange={e => setParams(p => ({ ...p, prompt_template: e.target.value }))}
                        placeholder="Usa {title}, {context}, {feedback} como variables..." />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div className="toggle-wrapper" onClick={() => setParams(p => ({ ...p, rag_enabled: !p.rag_enabled }))}>
                        <div className={`toggle ${params.rag_enabled ? 'on' : ''}`} />
                        <span className="toggle-label">RAG habilitado</span>
                      </div>
                      {params.rag_enabled && (
                        <div className="input-group">
                          <label className="input-label">Colección RAG</label>
                          <input className="input" value={params.rag_collection}
                            onChange={e => setParams(p => ({ ...p, rag_collection: e.target.value }))} placeholder="rag_docs" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditAgent(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
