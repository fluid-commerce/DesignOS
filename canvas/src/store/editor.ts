/**
 * Editor store — Zustand store for the right sidebar content editor.
 * Tracks selected iteration, slot schema, current slot values, and dirty state.
 * Sends postMessage to iframe for live preview updates.
 * Persists user edits via PATCH /api/iterations/:id/user-state.
 */

import { create } from 'zustand';
import type { SlotSchema, TransformTargetKind } from '../lib/slot-schema';
import type { Iteration } from '../lib/campaign-types';
import {
  applySlotValuesToIframe,
  clearHistoryDebounceSchedule,
  scheduleUndoSnapshot,
  slotMapsEqual,
  MAX_UNDO,
} from '../lib/editor-history';

/**
 * Prefix for transform strings in userState / slotValues.
 * Keys are `${SLOT_TRANSFORM_PREFIX}${cssSelector}` → CSS transform string.
 * Applied on iframe load by __tmpl_listener__ (watcher-injected script).
 */
export const SLOT_TRANSFORM_PREFIX = '__transform__:';

/**
 * Prefix for text box layout (width/height/left/top) as JSON: { w, h?, l?, t? }.
 * w: number → fixed width (px), text wraps inside; w: null → hug content (width grows to fit).
 * h omitted or null → height: auto.
 */
export const SLOT_TEXT_BOX_PREFIX = '__textbox__:';

export interface PickedLayoutTarget {
  sel: string;
  label: string;
  kind: TransformTargetKind;
}

interface EditorStore {
  /** Currently selected iteration ID (null = nothing selected) */
  selectedIterationId: string | null;
  /** Slot schema from the iteration's slotSchema field */
  slotSchema: SlotSchema | null;
  /** Current slot values keyed by CSS selector */
  slotValues: Record<string, string>;
  /** Snapshot when iteration was loaded or last saved — Reset restores this */
  baselineSlotValues: Record<string, string>;
  /** Undo stack (older → newer); each entry is full slotValues before a debounced edit burst */
  undoStack: Record<string, string>[];
  redoStack: Record<string, string>[];
  /** True when slotValues differ from what's persisted */
  isDirty: boolean;
  /** Reference to the active iframe for postMessage communication */
  iframeRef: HTMLIFrameElement | null;

  /**
   * Element selected in the preview (click-to-pick).
   * kind=text → resize box / reflow; image|brush → CSS transform.
   */
  pickedTransform: PickedLayoutTarget | null;
  setPickedTransform: (target: PickedLayoutTarget | null) => void;

  /** Load an iteration from the API, parse its slot schema and current values */
  selectIteration: (id: string) => Promise<void>;
  /**
   * Update a single slot value locally and echo to iframe via `tmpl` postMessage.
   * Use `skipIframeEcho` when the iframe is already the source of truth (e.g. artboard contenteditable)
   * so we don’t reset the DOM and break selection / replace-on-type.
   */
  updateSlotValue: (
    sel: string,
    value: string,
    mode?: string,
    options?: { skipIframeEcho?: boolean }
  ) => void;
  /**
   * Persist CSS transform for a template element (same postMessage as legacy brush).
   * Stored under `${SLOT_TRANSFORM_PREFIX}${sel}` so it saves with user-state.
   */
  updateElementTransform: (sel: string, transform: string) => void;
  /**
   * Text fields: width/height and optional left/top in layout px.
   * w: null = hug content (Figma-style “Hug”); number = fixed width. Clears saved transform for this sel.
   */
  updateTextBox: (
    sel: string,
    box: { w: number | null; h: number | null; l?: number; t?: number }
  ) => void;
  /** PATCH /api/iterations/:id/user-state with current slotValues, resets isDirty */
  saveUserState: () => Promise<void>;
  /** Set the iframe reference for postMessage targeting */
  setIframeRef: (ref: HTMLIFrameElement | null) => void;
  undo: () => void;
  redo: () => void;
  /** Restore slot values to last load / last save snapshot */
  resetToBaseline: () => void;
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
    if (u.origin === window.location.origin && (u.pathname.startsWith('/fluid-assets/') || u.pathname.startsWith('/api/brand-assets/serve/'))) {
      return u.pathname;
    }
  } catch {
    /* ignore */
  }
  return value;
}

/** Extract initial slot values from userState (preferred) or aiBaseline; normalize fluid-asset URLs to path-only */
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
  baselineSlotValues: {},
  undoStack: [],
  redoStack: [],
  isDirty: false,
  iframeRef: null,
  pickedTransform: null,

  setPickedTransform: (target) => {
    set({ pickedTransform: target });
  },

  selectIteration: async (id: string) => {
    try {
      clearHistoryDebounceSchedule();
      const res = await fetch(`/api/iterations/${id}`);
      if (!res.ok) {
        console.warn(`Editor: failed to load iteration ${id}`, res.status);
        return;
      }
      const iteration: Iteration = await res.json();
      const schema = iteration.slotSchema as SlotSchema | null;
      const values = extractSlotValues(iteration);
      const baseline = structuredClone(values);
      set({
        selectedIterationId: id,
        slotSchema: schema,
        slotValues: values,
        baselineSlotValues: baseline,
        undoStack: [],
        redoStack: [],
        isDirty: false,
        pickedTransform: null,
      });
    } catch (err) {
      console.warn('Editor: selectIteration error', err);
    }
  },

  updateSlotValue: (sel, value, mode, options) => {
    const before = structuredClone(get().slotValues);
    set((state) => ({
      slotValues: { ...state.slotValues, [sel]: value },
      isDirty: true,
    }));
    scheduleUndoSnapshot(before, (snapshot) => {
      const after = get().slotValues;
      if (!slotMapsEqual(snapshot, after)) {
        set((s) => ({
          undoStack: [...s.undoStack, snapshot].slice(-MAX_UNDO),
          redoStack: [],
        }));
      }
    });

    if (!options?.skipIframeEcho) {
      const { iframeRef } = get();
      if (iframeRef?.contentWindow) {
        iframeRef.contentWindow.postMessage(
          { type: 'tmpl', sel, value, mode: mode ?? 'text' },
          '*'
        );
      }
    }
  },

  updateElementTransform: (sel: string, transform: string) => {
    const before = structuredClone(get().slotValues);
    const key = `${SLOT_TRANSFORM_PREFIX}${sel}`;
    const tbKey = `${SLOT_TEXT_BOX_PREFIX}${sel}`;
    set((state) => {
      const next = { ...state.slotValues, [key]: transform };
      /* Position lives in transform after move/rotate — drop saved l/t so textbox reload doesn’t override */
      const raw = next[tbKey];
      if (raw) {
        try {
          const o = JSON.parse(raw) as { w?: number | null; h?: number | null };
          const slim: { w: number | null; h?: number | null } = {
            w:
              typeof o.w === 'number' && Number.isFinite(o.w) && o.w >= 1
                ? Math.round(o.w)
                : null,
          };
          if ('h' in o) {
            if (o.h == null) slim.h = null;
            else if (typeof o.h === 'number' && Number.isFinite(o.h)) slim.h = Math.round(o.h);
          }
          next[tbKey] = JSON.stringify(slim);
        } catch {
          /* keep */
        }
      }
      return { slotValues: next, isDirty: true };
    });
    scheduleUndoSnapshot(before, (snapshot) => {
      const after = get().slotValues;
      if (!slotMapsEqual(snapshot, after)) {
        set((s) => ({
          undoStack: [...s.undoStack, snapshot].slice(-MAX_UNDO),
          redoStack: [],
        }));
      }
    });
    const { iframeRef } = get();
    if (iframeRef?.contentWindow) {
      iframeRef.contentWindow.postMessage(
        { type: 'tmpl', sel, action: 'transform', transform },
        '*'
      );
    }
  },

  updateTextBox: (sel, box) => {
    const before = structuredClone(get().slotValues);
    const tbKey = `${SLOT_TEXT_BOX_PREFIX}${sel}`;
    const l = box.l;
    const t = box.t;
    const payload = JSON.stringify({
      w: box.w == null ? null : Math.round(box.w),
      h: box.h == null ? null : Math.round(box.h),
      ...(l !== undefined && Number.isFinite(l) ? { l: Math.round(l) } : {}),
      ...(t !== undefined && Number.isFinite(t) ? { t: Math.round(t) } : {}),
    });
    set((state) => ({
      slotValues: { ...state.slotValues, [tbKey]: payload },
      isDirty: true,
    }));
    scheduleUndoSnapshot(before, (snapshot) => {
      const after = get().slotValues;
      if (!slotMapsEqual(snapshot, after)) {
        set((s) => ({
          undoStack: [...s.undoStack, snapshot].slice(-MAX_UNDO),
          redoStack: [],
        }));
      }
    });
    const { iframeRef } = get();
    if (iframeRef?.contentWindow) {
      iframeRef.contentWindow.postMessage(
        {
          type: 'tmpl',
          sel,
          action: 'textBox',
          ...(box.w == null
            ? { widthMode: 'hug' }
            : { width: `${Math.round(box.w)}px` }),
          height: box.h == null ? 'auto' : `${Math.round(box.h)}px`,
          ...(l !== undefined && Number.isFinite(l) ? { left: `${Math.round(l)}px` } : {}),
          ...(t !== undefined && Number.isFinite(t) ? { top: `${Math.round(t)}px` } : {}),
        },
        '*'
      );
    }
  },

  undo: () => {
    const s = get();
    if (s.undoStack.length === 0 || !s.slotSchema || !s.iframeRef?.contentWindow) return;
    clearHistoryDebounceSchedule();
    const prev = s.undoStack[s.undoStack.length - 1]!;
    const newPast = s.undoStack.slice(0, -1);
    const current = structuredClone(s.slotValues);
    const next = structuredClone(prev);
    set({
      undoStack: newPast,
      redoStack: [...s.redoStack, current].slice(-MAX_UNDO),
      slotValues: next,
      isDirty: !slotMapsEqual(next, s.baselineSlotValues),
      pickedTransform: null,
    });
    applySlotValuesToIframe(next, current, s.slotSchema, s.iframeRef.contentWindow);
    s.iframeRef.contentWindow.postMessage({ type: 'fluidClearPick' }, '*');
  },

  redo: () => {
    const s = get();
    if (s.redoStack.length === 0 || !s.slotSchema || !s.iframeRef?.contentWindow) return;
    clearHistoryDebounceSchedule();
    const forward = s.redoStack[s.redoStack.length - 1]!;
    const newFut = s.redoStack.slice(0, -1);
    const current = structuredClone(s.slotValues);
    const next = structuredClone(forward);
    set({
      redoStack: newFut,
      undoStack: [...s.undoStack, current].slice(-MAX_UNDO),
      slotValues: next,
      isDirty: !slotMapsEqual(next, s.baselineSlotValues),
      pickedTransform: null,
    });
    applySlotValuesToIframe(next, current, s.slotSchema, s.iframeRef.contentWindow);
    s.iframeRef.contentWindow.postMessage({ type: 'fluidClearPick' }, '*');
  },

  resetToBaseline: () => {
    const s = get();
    if (!s.selectedIterationId || !s.slotSchema || !s.iframeRef?.contentWindow) return;
    clearHistoryDebounceSchedule();
    const baseline = structuredClone(s.baselineSlotValues);
    const current = structuredClone(s.slotValues);
    if (slotMapsEqual(baseline, current)) return;
    set({
      slotValues: baseline,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      pickedTransform: null,
    });
    applySlotValuesToIframe(baseline, current, s.slotSchema, s.iframeRef.contentWindow);
    s.iframeRef.contentWindow.postMessage({ type: 'fluidClearPick' }, '*');
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
        clearHistoryDebounceSchedule();
        set({
          isDirty: false,
          baselineSlotValues: structuredClone(get().slotValues),
          undoStack: [],
          redoStack: [],
        });
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
    clearHistoryDebounceSchedule();
    set({
      selectedIterationId: null,
      slotSchema: null,
      slotValues: {},
      baselineSlotValues: {},
      undoStack: [],
      redoStack: [],
      isDirty: false,
      iframeRef: null,
      pickedTransform: null,
    });
  },
}));
