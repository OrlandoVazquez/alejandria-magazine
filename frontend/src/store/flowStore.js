import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { flowsApi } from '../api/flows';

const DRAFT_KEY = 'flow_designer_draft';

export const useFlowStore = create(
  persist(
    (set, get) => ({
      flows: [],
      activeFlow: null,
      draftNodes: [],
      draftEdges: [],
      draftName: 'Nuevo Flujo',
      draftChanged: false,
      isLoading: false,
      error: null,

      // Remote flows
      fetchFlows: async () => {
        set({ isLoading: true });
        try {
          const data = await flowsApi.list();
          set({ flows: data, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      loadFlow: async (id) => {
        const data = await flowsApi.get(id);
        set({
          activeFlow: data,
          draftNodes: data.nodes || [],
          draftEdges: data.edges || [],
          draftName: data.name,
          draftChanged: false,
        });
        return data;
      },

      saveFlow: async () => {
        const { activeFlow, draftNodes, draftEdges, draftName } = get();
        const flowData = {
          name: draftName,
          nodes: draftNodes,
          edges: draftEdges,
          flow_sequence: draftNodes.map(n => n.data?.agentId).filter(Boolean),
        };
        let saved;
        if (activeFlow?.id) {
          saved = await flowsApi.update(activeFlow.id, flowData);
        } else {
          saved = await flowsApi.create(flowData);
        }
        set({ activeFlow: saved, draftChanged: false });
        get().fetchFlows();
        return saved;
      },

      deleteFlow: async (id) => {
        await flowsApi.delete(id);
        set(s => ({ flows: s.flows.filter(f => f.id !== id) }));
      },

      // Draft canvas state
      setDraftNodes: (nodes) => set({ draftNodes: nodes, draftChanged: true }),
      setDraftEdges: (edges) => set({ draftEdges: edges, draftChanged: true }),
      setDraftName: (name) => set({ draftName: name, draftChanged: true }),

      newFlow: () => set({
        activeFlow: null,
        draftNodes: [],
        draftEdges: [],
        draftName: 'Nuevo Flujo',
        draftChanged: false,
      }),

      // localStorage checkpoint
      saveDraftLocally: () => {
        const { draftNodes, draftEdges, draftName } = get();
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ draftNodes, draftEdges, draftName, ts: Date.now() }));
      },

      loadLocalDraft: () => {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      },

      clearLocalDraft: () => localStorage.removeItem(DRAFT_KEY),
    }),
    {
      name: 'flow-store',
      partialize: (s) => ({ flows: s.flows }),
    }
  )
);
