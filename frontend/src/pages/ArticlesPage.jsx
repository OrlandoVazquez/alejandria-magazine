import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { useArticleStore } from '../store/articleStore';

const TABS = ['Todos', 'Drafts', 'Pendientes', 'Aprobados', 'Publicados'];

const STATUS_MAP = {
  draft: { label: 'Draft', cls: 'badge-draft', icon: <Clock size={10} /> },
  in_review: { label: 'Pendiente', cls: 'badge-pending', icon: <AlertCircle size={10} /> },
  approved: { label: 'Aprobado', cls: 'badge-approved', icon: <CheckCircle size={10} /> },
  published: { label: 'Publicado', cls: 'badge-published', icon: <CheckCircle size={10} /> },
  rejected: { label: 'Rechazado', cls: 'badge-error', icon: <AlertCircle size={10} /> },
};

const TAB_FILTER = {
  'Todos': null,
  'Drafts': 'draft',
  'Pendientes': 'in_review',
  'Aprobados': 'approved',
  'Publicados': 'published',
};

export default function ArticlesPage() {
  const navigate = useNavigate();
  const { articles, fetchArticles, isLoading } = useArticleStore();
  const [tab, setTab] = useState('Todos');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchArticles(); }, []);

  const filtered = articles.filter(a => {
    const statusMatch = !TAB_FILTER[tab] || a.status === TAB_FILTER[tab];
    const searchMatch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  return (
    <div className="page-body">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Artículos</h2>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>{articles.length} artículos en total</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 300 }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input className="input" style={{ padding: '6px 10px' }}
            placeholder="Buscar artículos..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={28} /></div>
          <h3>Sin artículos</h3>
          <p>Ejecuta un pipeline desde el Flow Designer para generar tu primer artículo.</p>
        </div>
      ) : (
        <div className="article-grid">
          {filtered.map(article => {
            const st = STATUS_MAP[article.status] || STATUS_MAP.draft;
            return (
              <div key={article.id} className="article-card"
                onClick={() => navigate(`/dashboard/articles/${article.id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div className="article-card-title">{article.title}</div>
                  <span className={`badge ${st.cls}`} style={{ flexShrink: 0 }}>
                    {st.icon} {st.label}
                  </span>
                </div>
                <div className="article-card-meta">
                  <Clock size={11} />
                  {new Date(article.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {article.scientific_format && article.scientific_format !== 'none' && (
                    <span style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: 10 }}>
                      {article.scientific_format.toUpperCase()}
                    </span>
                  )}
                </div>
                {article.body && (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {article.body.replace(/[#*`]/g, '').trim()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
