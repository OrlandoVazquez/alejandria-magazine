import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const AGENT_META = {
  investigador: { emoji: '🔍', color: '#06b6d4', label: 'Investigador', desc: 'Busca contexto en RAG y APIs científicas' },
  redactor:     { emoji: '✍️',  color: '#7c3aed', label: 'Redactor',     desc: 'Genera borrador con Ollama' },
  revisor:      { emoji: '👁️',  color: '#f59e0b', label: 'Revisor',      desc: 'Evalúa calidad (score 0-100)' },
  formateador:  { emoji: '📄',  color: '#10b981', label: 'Formateador',  desc: 'Aplica formato APA/IEEE/Vancouver' },
  publicador:   { emoji: '🚀',  color: '#ef4444', label: 'Publicador',   desc: 'Publica el artículo en DB' },
};

export const AgentNode = memo(({ data, selected }) => {
  const meta = AGENT_META[data.agentId] || { emoji: '🤖', color: '#6b6b8a', label: data.agentId, desc: '' };

  return (
    <div className={`agent-node${selected ? ' selected' : ''}`}
      style={{ borderColor: selected ? meta.color : undefined }}>
      <Handle type="target" position={Position.Left}
        style={{ background: meta.color, border: `2px solid ${meta.color}` }} />

      <div className="agent-node-header">
        <span className="agent-node-icon">{meta.emoji}</span>
        <span className="agent-node-name">{meta.label}</span>
      </div>
      <div className="agent-node-desc">{meta.desc}</div>
      <div className="agent-node-badge"
        style={{ background: `${meta.color}20`, color: meta.color }}>
        agent
      </div>

      <Handle type="source" position={Position.Right}
        style={{ background: meta.color, border: `2px solid ${meta.color}` }} />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }) => (
  <div className={`condition-node${selected ? ' selected' : ''}`}>
    <Handle type="target" position={Position.Left} />
    <div style={{ fontSize: 18, marginBottom: 4 }}>⚡</div>
    <div className="condition-node-label">{data.label || 'Condición'}</div>
    {data.expression && (
      <div className="condition-node-expr">{data.expression}</div>
    )}
    <Handle type="source" position={Position.Right} id="true"
      style={{ top: '30%', background: '#10b981', border: '2px solid #10b981' }} />
    <Handle type="source" position={Position.Right} id="false"
      style={{ top: '70%', background: '#ef4444', border: '2px solid #ef4444' }} />
  </div>
));

export const nodeTypes = {
  agent: AgentNode,
  condition: ConditionNode,
};

export { AGENT_META };
