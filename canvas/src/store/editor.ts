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
  flushPendingUndoSnapshot,
  scheduleUndoSnapshot,
  slotMapsEqual,
  MAX_UNDO,
} from '../lib/editor-history';
import {
  type TextBoxFontPreset,
  resolveTextBoxFontSizePx,
  textBoxFontPostMessage,
} from '../lib/textbox-typography';

/**
 * Prefix for transform strings in userState / slotValues.
 * Keys are `${SLOT_TRANSFORM_PREFIX}${cssSelector}` → CSS transform string.
 * Applied on iframe load by __tmpl_listener__ (watcher-injected script).
 */
export const SLOT_TRANSFORM_PREFIX = '__transform__:';

/**
 * Prefix for text box layout (width/height/left/top/align) as JSON: { w, h?, l?, t?, align? }.
 * w: number → fixed width (px), text wraps inside; w: null → hug content (width grows to fit).
 * h omitted or null → height: auto.
 * align: left | center | right → CSS text-align on the slot element.
 * fontPreset / fontSizePx → semantic or custom font size (see textbox-typography).
 */
export const SLOT_TEXT_BOX_PREFIX = '__textbox__:';

export type TextBoxAlign = 'left' | 'center' | 'right';
export type { TextBoxFontPreset } from '../lib/textbox-typography';

const VALID_TEXT_ALIGN = new Set<string>(['left', 'center', 'right']);

function parseTextBoxPrev(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface PickedLayoutTarget {
  sel: string;
  label: string;
  kind: TransformTargetKind;
}

/** JSON map of brush selector → CSS transform string; persisted in userState */
export const BRUSH_TRANSFORM_STATE_KEY = '__brushTransform__';

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
  /** 1-based slide index for carousels (properties panel + iframe sync) */
  activeCarouselSlide: number;

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
    options?: { skipIframeEcho?: boolean },
  ) => void;
  /**
   * Persist CSS transform for a template element (same postMessage as legacy brush).
   * Stored under `${SLOT_TRANSFORM_PREFIX}${sel}` so it saves with user-state.
   */
  updateElementTransform: (sel: string, transform: string) => void;
  /**
   * Brush / overlay transforms persisted in `__brushTransform__` JSON map (selector → CSS string).
   */
  patchBrushTransform: (sel: string, transform: string) => void;
  /**
   * Text fields: width/height and optional left/top in layout px, optional text align.
   * w: null = hug content (Figma-style “Hug”); number = fixed width. Clears saved transform for this sel.
   * Partial updates merge with existing `__textbox__` JSON (e.g. overlay resize keeps align).
   */
  updateTextBox: (
    sel: string,
    box: {
      w?: number | null;
      h?: number | null;
      l?: number;
      t?: number;
      align?: TextBoxAlign;
      fontPreset?: TextBoxFontPreset;
      fontSizePx?: number;
    },
  ) => void;
  /** PATCH /api/iterations/:id/user-state with current slotValues, resets isDirty */
  saveUserState: () => Promise<void>;
  /** Set the iframe reference for postMessage targeting */
  setIframeRef: (ref: HTMLIFrameElement | null) => void;
  /** Carousel slide tabs — updates state and should pair with postMessage setSlide */
  setActiveCarouselSlide: (slide: number) => void;
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
    if (
      u.origin === window.location.origin &&
      (u.pathname.startsWith('/fluid-assets/') || u.pathname.startsWith('/api/brand-assets/serve/'))
    ) {
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
    }),
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
  activeCarouselSlide: 1,
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
      // Do not reset activeCarouselSlide — keep it aligned with the creation’s active slide
      // (App sync). Resetting to 1 left the iframe on slide 1 while editing slide 2+.
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
          '*',
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
          const o = JSON.parse(raw) as {
            w?: number | null;
            h?: number | null;
            align?: string;
            fontPreset?: string;
            fontSizePx?: number;
          };
          const slim: {
            w: number | null;
            h?: number | null;
            align?: TextBoxAlign;
            fontPreset?: TextBoxFontPreset;
            fontSizePx?: number;
          } = {
            w: typeof o.w === 'number' && Number.isFinite(o.w) && o.w >= 1 ? Math.round(o.w) : null,
          };
          if ('h' in o) {
            if (o.h == null) slim.h = null;
            else if (typeof o.h === 'number' && Number.isFinite(o.h)) slim.h = Math.round(o.h);
          }
          if (typeof o.align === 'string' && VALID_TEXT_ALIGN.has(o.align)) {
            slim.align = o.align as TextBoxAlign;
          }
          if (typeof o.fontPreset === 'string' && o.fontPreset !== 'inherit') {
            if (o.fontPreset === 'custom') {
              if (typeof o.fontSizePx === 'number' && Number.isFinite(o.fontSizePx)) {
                slim.fontPreset = 'custom';
                slim.fontSizePx = resolveTextBoxFontSizePx('custom', o.fontSizePx) ?? 16;
              }
            } else if (
              o.fontPreset === 'h1' ||
              o.fontPreset === 'h2' ||
              o.fontPreset === 'h3' ||
              o.fontPreset === 'h4' ||
              o.fontPreset === 'h5' ||
              o.fontPreset === 'h6' ||
              o.fontPreset === 'p1' ||
              o.fontPreset === 'p2' ||
              o.fontPreset === 'p3'
            ) {
              slim.fontPreset = o.fontPreset;
            }
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
        '*',
      );
    }
  },

  updateTextBox: (sel, box) => {
    const before = structuredClone(get().slotValues);
    const tbKey = `${SLOT_TEXT_BOX_PREFIX}${sel}`;
    const p = parseTextBoxPrev(get().slotValues[tbKey]);

    const w =
      'w' in box
        ? box.w == null
          ? null
          : Math.round(box.w)
        : typeof p.w === 'number' && Number.isFinite(p.w)
          ? Math.round(p.w)
          : null;

    const h =
      'h' in box
        ? box.h == null
          ? null
          : Math.round(box.h)
        : p.h === null || p.h === undefined
          ? null
          : typeof p.h === 'number' && Number.isFinite(p.h)
            ? Math.round(p.h)
            : null;

    let mergedL: number | undefined;
    if ('l' in box && Number.isFinite(box.l)) mergedL = Math.round(box.l!);
    else if (typeof p.l === 'number' && Number.isFinite(p.l)) mergedL = Math.round(p.l);

    let mergedT: number | undefined;
    if ('t' in box && Number.isFinite(box.t)) mergedT = Math.round(box.t!);
    else if (typeof p.t === 'number' && Number.isFinite(p.t)) mergedT = Math.round(p.t);

    let mergedAlign: TextBoxAlign | undefined;
    if ('align' in box && box.align && VALID_TEXT_ALIGN.has(box.align)) {
      mergedAlign = box.align;
    } else if (typeof p.align === 'string' && VALID_TEXT_ALIGN.has(p.align)) {
      mergedAlign = p.align as TextBoxAlign;
    }

    let mergedFontPreset: TextBoxFontPreset | undefined;
    let mergedFontSizePx: number | undefined;
    let explicitFontInherit = false;
    if ('fontPreset' in box) {
      if (box.fontPreset === 'inherit') {
        mergedFontPreset = undefined;
        mergedFontSizePx = undefined;
        explicitFontInherit = true;
      } else if (box.fontPreset === 'custom') {
        mergedFontPreset = 'custom';
        if ('fontSizePx' in box && Number.isFinite(box.fontSizePx)) {
          mergedFontSizePx = resolveTextBoxFontSizePx('custom', box.fontSizePx) ?? undefined;
        } else if (typeof p.fontSizePx === 'number' && Number.isFinite(p.fontSizePx)) {
          mergedFontSizePx = resolveTextBoxFontSizePx('custom', p.fontSizePx) ?? undefined;
        }
      } else if (
        box.fontPreset === 'h1' ||
        box.fontPreset === 'h2' ||
        box.fontPreset === 'h3' ||
        box.fontPreset === 'h4' ||
        box.fontPreset === 'h5' ||
        box.fontPreset === 'h6' ||
        box.fontPreset === 'p1' ||
        box.fontPreset === 'p2' ||
        box.fontPreset === 'p3'
      ) {
        mergedFontPreset = box.fontPreset;
        mergedFontSizePx = undefined;
      }
    } else {
      const pp = p.fontPreset;
      if (
        pp === 'h1' ||
        pp === 'h2' ||
        pp === 'h3' ||
        pp === 'h4' ||
        pp === 'h5' ||
        pp === 'h6' ||
        pp === 'p1' ||
        pp === 'p2' ||
        pp === 'p3' ||
        pp === 'custom'
      ) {
        mergedFontPreset = pp as TextBoxFontPreset;
        if (pp === 'custom' && typeof p.fontSizePx === 'number' && Number.isFinite(p.fontSizePx)) {
          mergedFontSizePx = resolveTextBoxFontSizePx('custom', p.fontSizePx) ?? undefined;
        }
      }
    }

    const payloadObj: {
      w: number | null;
      h: number | null;
      l?: number;
      t?: number;
      align?: TextBoxAlign;
      fontPreset?: TextBoxFontPreset;
      fontSizePx?: number;
    } = { w, h };
    if (mergedL !== undefined) payloadObj.l = mergedL;
    if (mergedT !== undefined) payloadObj.t = mergedT;
    if (mergedAlign) payloadObj.align = mergedAlign;
    if (mergedFontPreset === 'custom' && mergedFontSizePx != null) {
      payloadObj.fontPreset = 'custom';
      payloadObj.fontSizePx = mergedFontSizePx;
    } else if (
      mergedFontPreset === 'h1' ||
      mergedFontPreset === 'h2' ||
      mergedFontPreset === 'h3' ||
      mergedFontPreset === 'h4' ||
      mergedFontPreset === 'h5' ||
      mergedFontPreset === 'h6' ||
      mergedFontPreset === 'p1' ||
      mergedFontPreset === 'p2' ||
      mergedFontPreset === 'p3'
    ) {
      payloadObj.fontPreset = mergedFontPreset;
    }

    const payload = JSON.stringify(payloadObj);
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
      const fontMsg = textBoxFontPostMessage(
        mergedFontPreset,
        mergedFontSizePx,
        explicitFontInherit,
      );
      iframeRef.contentWindow.postMessage(
        {
          type: 'tmpl',
          sel,
          action: 'textBox',
          ...(w == null ? { widthMode: 'hug' } : { width: `${w}px` }),
          height: h == null ? 'auto' : `${h}px`,
          ...(mergedL !== undefined ? { left: `${mergedL}px` } : {}),
          ...(mergedT !== undefined ? { top: `${mergedT}px` } : {}),
          ...(mergedAlign ? { textAlign: mergedAlign } : {}),
          ...fontMsg,
        },
        '*',
      );
    }
  },

  undo: () => {
    const s = get();
    if (!s.selectedIterationId || !s.iframeRef?.contentWindow) return;

    flushPendingUndoSnapshot(
      () => get().slotValues,
      (snapshot) => {
        const after = get().slotValues;
        if (!slotMapsEqual(snapshot, after)) {
          set((st) => ({
            undoStack: [...st.undoStack, snapshot].slice(-MAX_UNDO),
            redoStack: [],
          }));
        }
      },
    );

    const s2 = get();
    if (s2.undoStack.length === 0) return;
    const win = s2.iframeRef?.contentWindow;
    if (!win) return;
    clearHistoryDebounceSchedule();
    const prev = s2.undoStack[s2.undoStack.length - 1]!;
    const newPast = s2.undoStack.slice(0, -1);
    const current = structuredClone(s2.slotValues);
    const next = structuredClone(prev);
    set({
      undoStack: newPast,
      redoStack: [...s2.redoStack, current].slice(-MAX_UNDO),
      slotValues: next,
      isDirty: !slotMapsEqual(next, s2.baselineSlotValues),
      pickedTransform: null,
    });
    applySlotValuesToIframe(next, current, s2.slotSchema, win);
    win.postMessage({ type: 'fluidClearPick' }, '*');
  },

  redo: () => {
    const s = get();
    if (!s.selectedIterationId || !s.iframeRef?.contentWindow) return;

    flushPendingUndoSnapshot(
      () => get().slotValues,
      (snapshot) => {
        const after = get().slotValues;
        if (!slotMapsEqual(snapshot, after)) {
          set((st) => ({
            undoStack: [...st.undoStack, snapshot].slice(-MAX_UNDO),
            redoStack: [],
          }));
        }
      },
    );

    const s2 = get();
    if (s2.redoStack.length === 0) return;
    const win = s2.iframeRef?.contentWindow;
    if (!win) return;
    clearHistoryDebounceSchedule();
    const forward = s2.redoStack[s2.redoStack.length - 1]!;
    const newFut = s2.redoStack.slice(0, -1);
    const current = structuredClone(s2.slotValues);
    const next = structuredClone(forward);
    set({
      redoStack: newFut,
      undoStack: [...s2.undoStack, current].slice(-MAX_UNDO),
      slotValues: next,
      isDirty: !slotMapsEqual(next, s2.baselineSlotValues),
      pickedTransform: null,
    });
    applySlotValuesToIframe(next, current, s2.slotSchema, win);
    win.postMessage({ type: 'fluidClearPick' }, '*');
  },

  resetToBaseline: () => {
    const s = get();
    if (!s.selectedIterationId || !s.iframeRef?.contentWindow) return;
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

  patchBrushTransform: (sel: string, transform: string) => {
    const before = structuredClone(get().slotValues);
    set((state) => {
      let map: Record<string, string> = {};
      try {
        map = JSON.parse(state.slotValues[BRUSH_TRANSFORM_STATE_KEY] || '{}') as Record<
          string,
          string
        >;
      } catch {
        map = {};
      }
      map[sel] = transform;
      return {
        slotValues: { ...state.slotValues, [BRUSH_TRANSFORM_STATE_KEY]: JSON.stringify(map) },
        isDirty: true,
      };
    });
    scheduleUndoSnapshot(before, (snapshot) => {
      const after = get().slotValues;
      if (!slotMapsEqual(snapshot, after)) {
        set((st) => ({
          undoStack: [...st.undoStack, snapshot].slice(-MAX_UNDO),
          redoStack: [],
        }));
      }
    });
    const { iframeRef } = get();
    if (iframeRef?.contentWindow) {
      iframeRef.contentWindow.postMessage(
        { type: 'tmpl', sel, action: 'transform', transform },
        '*',
      );
    }
  },

  saveUserState: async () => {
    const { selectedIterationId, slotValues } = get();
    if (!selectedIterationId) return;
    const normalized = Object.fromEntries(
      Object.entries(slotValues).map(([k, v]) => [k, normalizeImageUrlForSave(v)]),
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

  setActiveCarouselSlide: (slide: number) => {
    set({ activeCarouselSlide: Math.max(1, slide) });
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
      activeCarouselSlide: 1,
    });
  },
}));
