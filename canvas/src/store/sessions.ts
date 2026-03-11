import { create } from 'zustand';
import type { SessionSummary, SessionData } from '../lib/types';

interface SessionStore {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSessionData: SessionData | null;
  loading: boolean;
  /** Internal counter to discard stale fetch responses on rapid clicking */
  _requestId: number;

  refreshSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  setActiveSessionId: (id: string) => Promise<void>;
  clearSelection: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSessionData: null,
  loading: false,
  _requestId: 0,

  refreshSessions: async () => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) return;
      const sessions: SessionSummary[] = await res.json();
      set({ sessions });

      // If active session still exists, refresh its data too
      const activeId = get().activeSessionId;
      if (activeId && sessions.some((s) => s.id === activeId)) {
        const dataRes = await fetch(`/api/sessions/${activeId}`);
        if (dataRes.ok) {
          const data: SessionData = await dataRes.json();
          set({ activeSessionData: data });
        }
      }
    } catch {
      // Network error -- keep existing state
    }
  },

  selectSession: async (id: string) => {
    const requestId = get()._requestId + 1;
    set({ activeSessionId: id, activeSessionData: null, loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/sessions/${id}`);
      // If a newer request has started, discard this stale response
      if (get()._requestId !== requestId) return;
      if (!res.ok) {
        set({ activeSessionData: null, loading: false });
        return;
      }
      const data: SessionData = await res.json();
      if (get()._requestId !== requestId) return;
      set({ activeSessionData: data, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[session store] Failed to load session:', id, err);
      set({ activeSessionData: null, loading: false });
    }
  },

  setActiveSessionId: async (id: string) => {
    await get().selectSession(id);
  },

  clearSelection: () => {
    set({ activeSessionId: null, activeSessionData: null });
  },
}));
