/**
 * Editor store — Zustand store for the right sidebar content editor.
 * Tracks selected iteration, slot schema, current slot values, and dirty state.
 * Sends postMessage to iframe for live preview updates.
 * Persists user edits via PATCH /api/iterations/:id/user-state.
 */

import { create } from 'zustand';
import type { SlotSchema } from '../lib/slot-schema';
import type { Iteration } from '../lib/campaign-types';

interface EditorStore {
  /** Currently selected iteration ID (null = nothing selected) */
  selectedIterationId: string | null;
  /** Slot schema from the iteration's slotSchema field */
  slotSchema: SlotSchema | null;
  /** Current slot values keyed by CSS selector */
  slotValues: Record<string, string>;
  /** True when slotValues differ from what's persisted */
  isDirty: boolean;
  /** Reference to the active iframe for postMessage communication */
  iframeRef: HTMLIFrameElement | null;

  /** Load an iteration from the API, parse its slot schema and current values */
  selectIteration: (id: string) => Promise<void>;
  /** Update a single slot value locally and send postMessage to iframe */
  updateSlotValue: (sel: string, value: string, mode?: string) => void;
  /** PATCH /api/iterations/:id/user-state with current slotValues, resets isDirty */
  saveUserState: () => Promise<void>;
  /** Set the iframe reference for postMessage targeting */
  setIframeRef: (ref: HTMLIFrameElement | null) => void;
  /** Reset all editor state */
  clearSelection: () => void;
}

/** Normalize image URL to origin-relative form for persistence (so it works across port/origin). Blob URLs become empty so reload shows template default. */
function normalizeImageUrlForSave(value: string): string {
  if (typeof value !== 'string') return value;
  if (value.startsWith('blob:')) return '';
  if (value.startsWith('data:') || !value.startsWith('http')) return value;
  try {
    const u = new URL(value);
    if (u.origin === window.location.origin && u.pathname.startsWith('/template-assets/')) {
      return u.pathname;
    }
  } catch {
    /* ignore */
  }
  return value;
}

/** Extract initial slot values from userState (preferred) or aiBaseline; normalize template-asset URLs to path-only */
function extractSlotValues(iteration: Iteration): Record<string, string> {
  const source = (iteration.userState || iteration.aiBaseline) as Record<string, string> | null;
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).map(([k, v]) => {
      const s = String(v);
      return [k, normalizeImageUrlForSave(s)];
    })
  );
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedIterationId: null,
  slotSchema: null,
  slotValues: {},
  isDirty: false,
  iframeRef: null,

  selectIteration: async (id: string) => {
    try {
      const res = await fetch(`/api/iterations/${id}`);
      if (!res.ok) {
        console.warn(`Editor: failed to load iteration ${id}`, res.status);
        return;
      }
      const iteration: Iteration = await res.json();
      const schema = iteration.slotSchema as SlotSchema | null;
      const values = extractSlotValues(iteration);
      set({
        selectedIterationId: id,
        slotSchema: schema,
        slotValues: values,
        isDirty: false,
      });
    } catch (err) {
      console.warn('Editor: selectIteration error', err);
    }
  },

  updateSlotValue: (sel: string, value: string, mode?: string) => {
    set((state) => ({
      slotValues: { ...state.slotValues, [sel]: value },
      isDirty: true,
    }));

    // Send postMessage to iframe for live preview
    const { iframeRef } = get();
    if (iframeRef?.contentWindow) {
      iframeRef.contentWindow.postMessage(
        { type: 'tmpl', sel, value, mode: mode ?? 'text' },
        '*'
      );
    }
  },

  saveUserState: async () => {
    const { selectedIterationId, slotValues } = get();
    if (!selectedIterationId) return;
    const normalized = Object.fromEntries(
      Object.entries(slotValues).map(([k, v]) => [k, normalizeImageUrlForSave(v)])
    );
    try {
      const res = await fetch(`/api/iterations/${selectedIterationId}/user-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userState: normalized }),
      });
      if (res.ok) {
        set({ isDirty: false });
      } else {
        console.warn('Editor: saveUserState failed', res.status);
      }
    } catch (err) {
      console.warn('Editor: saveUserState error', err);
    }
  },

  setIframeRef: (ref: HTMLIFrameElement | null) => {
    set({ iframeRef: ref });
  },

  clearSelection: () => {
    set({
      selectedIterationId: null,
      slotSchema: null,
      slotValues: {},
      isDirty: false,
      iframeRef: null,
    });
  },
}));
