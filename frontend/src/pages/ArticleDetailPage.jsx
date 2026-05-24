import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, Clock, AlertCircle } from 'lucide-react';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  draft:     { label: 'Borrador',   cls: 'badge-draft',      icon: <Clock size={11} /> },
  in_review: { label: 'Pendiente',  cls: 'badge-pending',    icon: <AlertCircle size={11} /> },
  approved:  { label: 'Aprobado',   cls: 'badge-approved',   icon: <CheckCircle size={11} /> },
  published: { label: 'Publicado',  cls: 'badge-published',  icon: <CheckCircle size={11} /> },
  rejected:  { label: 'Rechazado',  cls: 'badge-error',      icon: <XCircle size={11} /> },
};

export default function ArticleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentArticle, fetchArticle, approveArticle, rejectArticle, assignReviewer } = useArticleStore();
  const [loading, setLoading] = useState(true);
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchArticle(id).finally(() => setLoading(false));
  }, [id]);

  const article = currentArticle;
  const st = article ? (STATUS_CONFIG[article.status] || STATUS_CONFIG.draft) : null;
  const isReviewer = article?.reviewer_id === user?.id || user?.role === 'reviewer' || user?.role === 'admin';

  const handleApprove = async () => {
    setWorking(true);
    try {
      await approveArticle(id);
      toast.success('Artículo aprobado ✅');
    } catch { toast.error('Error al aprobar'); }
    finally { setWorking(false); }
  };

  const handleReject = async () => {
    setWorking(true);
    try {
      await rejectArticle(id, rejectComment);
      toast.success('Artículo rechazado');
      setShowRejectModal(false);
    } catch { toast.error('Error al rechazar'); }
    finally { setWorking(false); }
  };

  const handleAssign = async () => {
    if (!reviewerEmail.trim()) { toast.error('Escribe el email del revisor'); return; }
    setWorking(true);
    try {
      await assignReviewer(id, reviewerEmail);
      toast.success('Revisor asignado');
      setReviewerEmail('');
    } catch { toast.error('Error al asignar revisor'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="page-body"><div className="empty-state"><div className="spinner spinner-lg" /></div></div>;
  if (!article) return <div className="page-body"><div className="empty-state"><h3>Artículo no encontrado</h3></div></div>;

  return (
    <div className="page-body" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>{article.title}</h2>
            {st && <span className={`badge ${st.cls}`}>{st.icon} {st.label}</span>}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            Creado: {new Date(article.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            {article.scientific_format && article.scientific_format !== 'none' && ` · Formato ${article.scientific_format.toUpperCase()}`}
          </div>
        </div>
      </div>

      {/* Status banner */}
      {article.status === 'in_review' && (
        <div style={{ background: 'var(--status-warning-bg)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <AlertCircle size={16} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
          <div style={{ fontSize: 'var(--font-size-sm)' }}>
            <strong style={{ color: 'var(--status-warning)' }}>Pendiente de aprobación</strong>
            {article.reviewer_id && <span style={{ color: 'var(--text-muted)' }}> · Revisor asignado</span>}
          </div>
        </div>
      )}

      {article.status === 'approved' && (
        <div style={{ background: 'var(--status-success-bg)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <CheckCircle size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
          <strong style={{ color: 'var(--status-success)', fontSize: 'var(--font-size-sm)' }}>Artículo aprobado</strong>
        </div>
      )}

      {article.status === 'rejected' && article.rejection_comment && (
        <div style={{ background: 'var(--status-error-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, color: 'var(--status-error)', fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>Rechazado</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{article.rejection_comment}</div>
        </div>
      )}

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Article body */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          {article.body ? (
            <div className="markdown-body">
              <ReactMarkdown>{article.body}</ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
              <h3>Sin contenido</h3>
              <p>Este artículo aún no tiene contenido generado.</p>
            </div>
          )}
        </div>

        {/* Sidebar actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Reviewer actions */}
          {isReviewer && article.status === 'in_review' && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>Acciones de revisión</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary w-full" onClick={handleApprove} disabled={working}>
                  <CheckCircle size={14} /> Aprobar artículo
                </button>
                <button className="btn btn-danger w-full" onClick={() => setShowRejectModal(true)} disabled={working}>
                  <XCircle size={14} /> Rechazar
                </button>
              </div>
            </div>
          )}

          {/* Assign reviewer */}
          {(article.status === 'draft' || article.status === 'in_review') && !isReviewer && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={14} /> Asignar revisor
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Usa @ para mencionar al revisor
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-xs)' }}
                  placeholder="email@ejemplo.com"
                  value={reviewerEmail}
                  onChange={e => setReviewerEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssign()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAssign} disabled={working}>
                  @
                </button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>Detalles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[
                { label: 'Estado', value: st?.label },
                { label: 'Formato', value: article.scientific_format?.toUpperCase() || 'N/A' },
                { label: 'Palabras', value: article.body ? article.body.split(/\s+/).length : 0 },
                { label: 'Creado', value: new Date(article.created_at).toLocaleDateString('es-ES') },
                { label: 'Actualizado', value: new Date(article.updated_at).toLocaleDateString('es-ES') },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rechazar artículo</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowRejectModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Motivo del rechazo</label>
                <textarea className="input" rows={4}
                  placeholder="Explica los cambios necesarios..."
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRejectModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={working || !rejectComment.trim()}>
                <XCircle size={14} /> Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
