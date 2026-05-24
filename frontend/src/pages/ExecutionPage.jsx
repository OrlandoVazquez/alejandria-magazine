import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { CheckCircle, XCircle, Clock, Loader, ArrowRight, FileText, UserPlus } from 'lucide-react';
import { agentsApi } from '../api/agents';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const AGENT_META = {
  investigador: { emoji: '🔍', label: 'Investigador', color: '#06b6d4' },
  redactor:     { emoji: '✍️',  label: 'Redactor',    color: '#7c3aed' },
  revisor:      { emoji: '👁️',  label: 'Revisor',     color: '#f59e0b' },
  formateador:  { emoji: '📄',  label: 'Formateador', color: '#10b981' },
  publicador:   { emoji: '🚀',  label: 'Publicador',  color: '#ef4444' },
};

const STATUS_ICON = {
  waiting:   <Clock size={16} style={{ color: 'var(--text-muted)' }} />,
  running:   <Loader size={16} style={{ color: 'var(--status-info)', animation: 'spin 1s linear infinite' }} />,
  completed: <CheckCircle size={16} style={{ color: 'var(--status-success)' }} />,
  failed:    <XCircle size={16} style={{ color: 'var(--status-error)' }} />,
};

export default function ExecutionPage() {
  const { articleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { fetchArticle, assignReviewer } = useArticleStore();

  const flowSequence = location.state?.flowSequence || [];
  const [steps, setSteps] = useState(
    flowSequence.map(id => ({ id, status: 'waiting', output: '' }))
  );
  const [logs, setLogs] = useState([]);
  const [preview, setPreview] = useState('');
  const [done, setDone] = useState(false);
  const [hasPublicador, setHasPublicador] = useState(flowSequence.includes('publicador'));
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [article, setArticle] = useState(null);
  const logsEndRef = useRef(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Connect SSE
  useEffect(() => {
    if (!articleId) return;
    const token_ = localStorage.getItem('access_token');
    const url = `${agentsApi.getStreamUrl(articleId)}?token=${token_}`;
    const evtSource = new EventSource(url);

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'agent_start') {
          setSteps(s => s.map(st => st.id === data.agent ? { ...st, status: 'running' } : st));
          addLog(`▶ ${data.agent} iniciado`, 'info');
        } else if (data.type === 'agent_end') {
          setSteps(s => s.map(st => st.id === data.agent ? { ...st, status: 'completed', output: data.output } : st));
          addLog(`✓ ${data.agent} completado`, 'success');
          if (data.draft_text) setPreview(data.draft_text);
          if (data.formatted_text) setPreview(data.formatted_text);
        } else if (data.type === 'agent_error') {
          setSteps(s => s.map(st => st.id === data.agent ? { ...st, status: 'failed' } : st));
          addLog(`✗ ${data.agent}: ${data.error}`, 'error');
        } else if (data.type === 'log') {
          addLog(data.message);
        } else if (data.type === 'done') {
          setDone(true);
          addLog('Pipeline completado', 'success');
          fetchArticle(articleId).then(a => setArticle(a));
          evtSource.close();
        }
      } catch { /* ignore parse errors */ }
    };

    evtSource.onerror = () => {
      addLog('Conexión SSE perdida', 'error');
      evtSource.close();
      setDone(true);
    };

    return () => evtSource.close();
  }, [articleId]);

  // Trigger the actual pipeline run
  useEffect(() => {
    if (flowSequence.length > 0) {
      agentsApi.run(articleId, { flow_sequence: flowSequence }).catch(() => {
        toast.error('Error al iniciar el pipeline');
      });
    }
  }, []);

  const addLog = (msg, type = '') => {
    setLogs(l => [...l, { msg, type, ts: new Date().toLocaleTimeString() }]);
  };

  const handleAssignReviewer = async () => {
    if (!reviewerEmail.trim()) { toast.error('Escribe el email del revisor'); return; }
    setAssigning(true);
    try {
      await assignReviewer(articleId, reviewerEmail);
      toast.success(`Revisor asignado: ${reviewerEmail}`);
      setReviewerEmail('');
    } catch { toast.error('Error al asignar revisor'); }
    finally { setAssigning(false); }
  };

  return (
    <div className="execution-layout">
      {/* Left panel */}
      <div className="execution-sidebar">
        <div className="execution-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {done
              ? <CheckCircle size={16} style={{ color: 'var(--status-success)' }} />
              : <Loader size={16} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
            }
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              {done ? 'Pipeline completado' : 'Ejecutando pipeline…'}
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ID: {articleId?.slice(0, 8)}…
          </div>
        </div>

        {/* Steps */}
        <div className="execution-steps">
          {steps.map((step, i) => {
            const meta = AGENT_META[step.id] || { emoji: '🤖', label: step.id, color: '#6b6b8a' };
            return (
              <div key={step.id} className={`step-card ${step.status}`}>
                <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                <div className="step-info">
                  <div className="step-name">{meta.label}</div>
                  <div className="step-status">
                    {step.status === 'waiting' ? 'Esperando...' :
                     step.status === 'running' ? 'Ejecutando...' :
                     step.status === 'completed' ? 'Completado' : 'Error'}
                  </div>
                </div>
                {STATUS_ICON[step.status]}
                {i < steps.length - 1 && step.status === 'completed' && (
                  <ArrowRight size={12} style={{ position: 'absolute', right: -8, color: 'var(--status-success)' }} />
                )}
              </div>
            );
          })}

          {/* Post-completion actions */}
          {done && !hasPublicador && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={14} /> Asignar revisor
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 10 }}>
                El pipeline no incluye un publicador. Asigna un revisor para validar el artículo.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-xs)' }}
                  placeholder="@email del revisor"
                  value={reviewerEmail}
                  onChange={e => setReviewerEmail(e.target.value.replace('@', ''))}
                  onKeyDown={e => e.key === 'Enter' && handleAssignReviewer()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAssignReviewer} disabled={assigning}>
                  {assigning ? '…' : 'Asignar'}
                </button>
              </div>
            </div>
          )}

          {done && (
            <button className="btn btn-secondary w-full" style={{ marginTop: 'var(--space-3)' }}
              onClick={() => navigate(`/dashboard/articles/${articleId}`)}>
              <FileText size={14} /> Ver artículo
            </button>
          )}
        </div>

        {/* Log terminal */}
        <div className="execution-log">
          {logs.map((l, i) => (
            <div key={i} className={`log-line ${l.type}`}>
              <span style={{ opacity: 0.5 }}>{l.ts} </span>{l.msg}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Right preview */}
      <div className="execution-preview">
        <div className="execution-preview-header">
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Vista previa del artículo</span>
          {preview && <span className="badge badge-running animate-pulse">Generando…</span>}
          {done && preview && <span className="badge badge-approved">Completo</span>}
        </div>
        <div className="execution-preview-body">
          {preview ? (
            <div className="markdown-body">
              <ReactMarkdown>{preview}</ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={28} />
              </div>
              <h3>Esperando contenido</h3>
              <p>El artículo aparecerá aquí conforme los agentes generen contenido.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
