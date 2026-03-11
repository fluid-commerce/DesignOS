import { create } from 'zustand';
import type { StreamUIMessage } from '../lib/stream-parser';

interface GenerationStore {
  status: 'idle' | 'generating' | 'complete' | 'error';
  events: StreamUIMessage[];
  activeSessionId: string | null;
  activePid: number | null;
  errorMessage: string | null;

  addEvent: (event: StreamUIMessage) => void;
  startGeneration: () => void;
  setSessionId: (sessionId: string) => void;
  completeGeneration: () => void;
  errorGeneration: (message: string) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  status: 'idle',
  events: [],
  activeSessionId: null,
  activePid: null,
  errorMessage: null,

  addEvent: (event: StreamUIMessage) => {
    set((state) => ({
      events: [...state.events, event],
    }));
  },

  startGeneration: () => {
    set({
      status: 'generating',
      events: [],
      activeSessionId: null,
      errorMessage: null,
    });
  },

  setSessionId: (sessionId: string) => {
    set({ activeSessionId: sessionId });
  },

  completeGeneration: () => {
    set({ status: 'complete' });
  },

  errorGeneration: (message: string) => {
    set({ status: 'error', errorMessage: message });
  },

  reset: () => {
    set({
      status: 'idle',
      events: [],
      activeSessionId: null,
      activePid: null,
      errorMessage: null,
    });
  },
}));
