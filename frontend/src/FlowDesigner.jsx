import React, {useState} from "react";

export default function FlowDesigner() {
  const [agents, setAgents] = useState(["investigador", "redactor", "revisor", "formateador", "publicador"]);
  const [sequence, setSequence] = useState(["investigador", "redactor", "revisor", "formateador", "publicador"]);

  return (
    <div style={{border: "1px solid #ddd", padding: 12, marginTop: 16}}>
      <h2>Flow Designer (minimal)</h2>
      <p>Sequence: {sequence.join(" → ")}</p>
      <div style={{display: "flex", gap: 8, marginTop: 8}}>
        {sequence.map((s, idx) => (
          <div key={s} style={{padding: 8, border: "1px solid #ccc", borderRadius: 6}}>
            <strong>{s}</strong>
            <div style={{fontSize: 12, marginTop: 6}}>Position: {idx + 1}</div>
          </div>
        ))}
      </div>
      <p style={{marginTop: 12, fontSize: 13}}>This is a scaffold. Use the backend endpoint <code>/api/v1/agents/{article_id}/run</code> to trigger flows.</p>
    </div>
  );
}
