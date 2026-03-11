import { create } from 'zustand';
import type { StreamUIMessage } from '../lib/stream-parser';

interface GenerationStore {
  status: 'idle' | 'generating' | 'complete' | 'error';
  events: StreamUIMessage[];
  activeSessionId: string | null;
  activePid: number | null;

  addEvent: (event: StreamUIMessage) => void;
  startGeneration: (sessionId: string) => void;
  completeGeneration: () => void;
  errorGeneration: (message: string) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  status: 'idle',
  events: [],
  activeSessionId: null,
  activePid: null,

  addEvent: (event: StreamUIMessage) => {
    set((state) => ({
      events: [...state.events, event],
    }));
  },

  startGeneration: (sessionId: string) => {
    set({
      status: 'generating',
      events: [],
      activeSessionId: sessionId,
    });
  },

  completeGeneration: () => {
    set({ status: 'complete' });
  },

  errorGeneration: (_message: string) => {
    set({ status: 'error' });
  },

  reset: () => {
    set({
      status: 'idle',
      events: [],
      activeSessionId: null,
      activePid: null,
    });
  },
}));
