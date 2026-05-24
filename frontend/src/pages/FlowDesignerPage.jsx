import React, { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { Save, Play, Trash2, Plus, GitBranch } from 'lucide-react';
import { nodeTypes, AGENT_META } from '../components/flow/AgentNode';
import { useFlowStore } from '../store/flowStore';
import { useArticleStore } from '../store/articleStore';
import toast from 'react-hot-toast';

const PALETTE_AGENTS = Object.entries(AGENT_META).map(([id, m]) => ({ id, ...m }));

let nodeId = 100;
const newId = () => `node_${++nodeId}`;

export default function FlowDesignerPage() {
  const navigate = useNavigate();
  const {
    draftNodes, draftEdges, draftName,
    setDraftNodes, setDraftEdges, setDraftName,
    saveFlow, newFlow, saveDraftLocally, loadLocalDraft, clearLocalDraft,
    activeFlow,
  } = useFlowStore();
  const { createArticle } = useArticleStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(draftNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(draftEdges);
  const [flowName, setFlowName] = React.useState(draftName);
  const [saving, setSaving] = React.useState(false);
  const [showRunModal, setShowRunModal] = React.useState(false);
  const [runTitle, setRunTitle] = React.useState('');
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance] = React.useState(null);

  // Auto-checkpoint every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setDraftNodes(nodes);
      setDraftEdges(edges);
      setDraftName(flowName);
      saveDraftLocally();
    }, 30000);
    return () => clearInterval(timer);
  }, [nodes, edges, flowName]);

  // Check for local draft on mount
  useEffect(() => {
    if (!activeFlow) {
      const draft = loadLocalDraft();
      if (draft && draft.draftNodes?.length > 0) {
        toast((t) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Tienes un borrador sin guardar
            <button className="btn btn-primary btn-sm" onClick={() => {
              setNodes(draft.draftNodes);
              setEdges(draft.draftEdges);
              setFlowName(draft.draftName);
              toast.dismiss(t.id);
            }}>Restaurar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              clearLocalDraft(); toast.dismiss(t.id);
            }}>Descartar</button>
          </span>
        ), { duration: 10000 });
      }
    }
  }, []);

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: 'var(--brand-primary)' } }, eds));
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData('application/agentId');
    const nodeType = e.dataTransfer.getData('application/nodeType') || 'agent';
    if (!agentId && nodeType !== 'condition') return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });

    const node = nodeType === 'condition'
      ? { id: newId(), type: 'condition', position, data: { label: 'Condición', expression: 'score >= 80' } }
      : { id: newId(), type: 'agent', position, data: { agentId, label: AGENT_META[agentId]?.label } };

    setNodes(nds => [...nds, node]);
  }, [rfInstance]);

  const handleSave = async () => {
    setSaving(true);
    setDraftNodes(nodes);
    setDraftEdges(edges);
    setDraftName(flowName);
    try {
      await saveFlow();
      clearLocalDraft();
      toast.success('Flujo guardado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!runTitle.trim()) { toast.error('Escribe un título para el artículo'); return; }
    try {
      const article = await createArticle(runTitle);
      setShowRunModal(false);
      navigate(`/execution/${article.id}`, {
        state: {
          flowNodes: nodes,
          flowEdges: edges,
          flowSequence: nodes.filter(n => n.type === 'agent').map(n => n.data.agentId),
        }
      });
    } catch { toast.error('Error al crear artículo'); }
  };

  return (
    <div className="flow-designer-layout">
      {/* Agent Palette */}
      <div className="flow-palette">
        <div className="palette-title">Agentes</div>
        {PALETTE_AGENTS.map(agent => (
          <div
            key={agent.id}
            className="palette-node"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/agentId', agent.id);
              e.dataTransfer.setData('application/nodeType', 'agent');
              e.dataTransfer.effectAllowed = 'move';
            }}
          >
            <div className="palette-node-icon" style={{ background: `${agent.color}20` }}>
              {agent.emoji}
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{agent.label}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{agent.desc}</div>
            </div>
          </div>
        ))}

        <div className="palette-title" style={{ marginTop: 'var(--space-4)' }}>Lógica</div>
        <div
          className="palette-node"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/agentId', 'condition');
            e.dataTransfer.setData('application/nodeType', 'condition');
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <div className="palette-node-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>⚡</div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Condición</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Bifurcación condicional</div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flow-canvas-area" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background variant="dots" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'condition') return '#f59e0b';
              return AGENT_META[n.data?.agentId]?.color || '#6b6b8a';
            }}
            maskColor="rgba(0,0,0,0.6)"
          />

          {/* Toolbar */}
          <Panel position="top-center">
            <div className="flow-toolbar">
              <input
                className="input"
                style={{ width: 200, padding: '6px 10px' }}
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                placeholder="Nombre del flujo"
              />
              <div className="divider" style={{ width: 1, height: 24, margin: '0 4px' }} />
              <button className="btn btn-ghost btn-sm btn-icon" title="Limpiar canvas"
                onClick={() => { setNodes([]); setEdges([]); }}>
                <Trash2 size={15} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={14} />
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowRunModal(true)}
                disabled={nodes.filter(n => n.type === 'agent').length === 0}>
                <Play size={14} />
                Ejecutar
              </button>
            </div>
          </Panel>
        </ReactFlow>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="empty-state" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            <div className="empty-state-icon">
              <GitBranch size={28} />
            </div>
            <h3>Diseña tu pipeline</h3>
            <p>Arrastra agentes desde el panel izquierdo al canvas para crear tu flujo de trabajo.</p>
          </div>
        )}
      </div>

      {/* Run Modal */}
      {showRunModal && (
        <div className="modal-backdrop" onClick={() => setShowRunModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ejecutar pipeline</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowRunModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                Se creará un nuevo artículo y se ejecutará el pipeline <strong style={{ color: 'var(--text-primary)' }}>{flowName}</strong> sobre él.
              </p>
              <div className="input-group">
                <label className="input-label">Título del artículo</label>
                <input
                  className="input"
                  placeholder="Ej: El impacto del cambio climático en ecosistemas marinos"
                  value={runTitle}
                  onChange={e => setRunTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRun()}
                  autoFocus
                />
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Secuencia:</strong>{' '}
                {nodes.filter(n => n.type === 'agent').map(n => AGENT_META[n.data?.agentId]?.emoji + ' ' + AGENT_META[n.data?.agentId]?.label).join(' → ')}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRunModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRun}>
                <Play size={14} /> Ejecutar pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
