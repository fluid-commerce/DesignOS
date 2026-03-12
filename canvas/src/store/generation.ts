import { create } from 'zustand';
import type { StreamUIMessage } from '../lib/stream-parser';

interface GenerationStore {
  status: 'idle' | 'generating' | 'complete' | 'error';
  events: StreamUIMessage[];
  activeSessionId: string | null;
  activeCampaignId: string | null;
  activePid: number | null;
  errorMessage: string | null;

  addEvent: (event: StreamUIMessage) => void;
  startGeneration: () => void;
  setSessionId: (sessionId: string) => void;
  setCampaignId: (campaignId: string) => void;
  completeGeneration: () => void;
  errorGeneration: (message: string) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  status: 'idle',
  events: [],
  activeSessionId: null,
  activeCampaignId: null,
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
      activeCampaignId: null,
      errorMessage: null,
    });
  },

  setSessionId: (sessionId: string) => {
    set({ activeSessionId: sessionId });
  },

  setCampaignId: (campaignId: string) => {
    set({ activeCampaignId: campaignId });
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
      activeCampaignId: null,
      activePid: null,
      errorMessage: null,
    });
  },
}));
