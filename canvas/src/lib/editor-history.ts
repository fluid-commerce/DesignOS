/**
 * Debounced undo snapshots + iframe re-apply for editor slotValues.
 */

import type { SlotSchema, ImageField, TextField } from './slot-schema';
import type { TextBoxFontPreset } from './textbox-typography';
import { textBoxFontPostMessage } from './textbox-typography';

/** Keep in sync with store/editor.ts — duplicated here to avoid circular imports */
const TX_PREFIX = '__transform__:';
const TB_PREFIX = '__textbox__:';

export const MAX_UNDO = 50;
export const HISTORY_DEBOUNCE_MS = 350;

let debounceBefore: Record<string, string> | null = null;
let historyTimer: ReturnType<typeof setTimeout> | null = null;

export function clearHistoryDebounceSchedule(): void {
  if (historyTimer != null) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
  debounceBefore = null;
}

export function scheduleUndoSnapshot(
  stateBeforeMutation: Record<string, string>,
  commit: (snapshot: Record<string, string>) => void
): void {
  if (debounceBefore === null) {
    debounceBefore = structuredClone(stateBeforeMutation);
  }
  if (historyTimer != null) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    historyTimer = null;
    const b = debounceBefore;
    debounceBefore = null;
    if (!b) return;
    commit(b);
  }, HISTORY_DEBOUNCE_MS);
}

export function slotMapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (a[ka[i]] !== b[ka[i]]) return false;
  }
  return true;
}

function collectAllKeys(
  target: Record<string, string>,
  previous: Record<string, string> | null,
  schema: SlotSchema | null
): string[] {
  const s = new Set<string>([...Object.keys(target), ...Object.keys(previous ?? {})]);
  if (schema) {
    for (const f of schema.fields) {
      if (f.type === 'divider') continue;
      s.add(f.sel);
      s.add(`${TX_PREFIX}${f.sel}`);
      s.add(`${TB_PREFIX}${f.sel}`);
    }
    if (schema.brush) {
      s.add(`${TX_PREFIX}${schema.brush}`);
      s.add(`${TB_PREFIX}${schema.brush}`);
    }
    for (const b of schema.brushAdditional ?? []) {
      s.add(`${TX_PREFIX}${b.sel}`);
      s.add(`${TB_PREFIX}${b.sel}`);
    }
  }
  return [...s];
}

function textBoxJsonHasActiveFont(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const o = JSON.parse(raw) as { fontPreset?: string };
    return typeof o.fontPreset === 'string' && o.fontPreset !== '' && o.fontPreset !== 'inherit';
  } catch {
    return false;
  }
}

/**
 * Push full template state to the iframe (after undo/redo/reset).
 * `previous` lets us clear keys that disappeared from target (e.g. transforms).
 */
export function applySlotValuesToIframe(
  target: Record<string, string>,
  previous: Record<string, string> | null,
  schema: SlotSchema | null,
  win: Window
): void {
  const imageSels = new Set(
    schema?.fields.filter((f): f is ImageField => f.type === 'image').map((f) => f.sel) ?? []
  );
  const textModeBySel = new Map(
    schema?.fields.filter((f): f is TextField => f.type === 'text').map((f) => [f.sel, f.mode] as const) ??
      []
  );

  const keys = collectAllKeys(target, previous, schema);

  for (const key of keys) {
    if (key.startsWith(TX_PREFIX)) {
      const sel = key.slice(TX_PREFIX.length);
      const transform = target[key] ?? '';
      win.postMessage({ type: 'tmpl', sel, action: 'transform', transform }, '*');
      continue;
    }

    if (key.startsWith(TB_PREFIX)) {
      const sel = key.slice(TB_PREFIX.length);
      const raw = target[key];
      if (!raw) {
        win.postMessage(
          {
            type: 'tmpl',
            sel,
            action: 'textBox',
            width: 'auto',
            height: 'auto',
          },
          '*'
        );
        continue;
      }
      try {
        const o = JSON.parse(raw) as {
          w?: number | null;
          h?: number | null;
          l?: number;
          t?: number;
          align?: string;
          fontPreset?: TextBoxFontPreset;
          fontSizePx?: number;
        };
        const fixW = typeof o.w === 'number' && Number.isFinite(o.w) && o.w >= 1;
        const ta =
          o.align === 'left' || o.align === 'center' || o.align === 'right' ? o.align : undefined;
        const prevRaw = previous?.[key];
        const hadFont = textBoxJsonHasActiveFont(prevRaw);
        const hasFont = textBoxJsonHasActiveFont(raw);
        const fontExtra =
          hasFont
            ? textBoxFontPostMessage(o.fontPreset, o.fontSizePx, false)
            : hadFont && !hasFont
              ? { clearFontSize: true as const }
              : {};
        win.postMessage(
          {
            type: 'tmpl',
            sel,
            action: 'textBox',
            ...(fixW ? { width: `${Math.round(o.w!)}px` } : { widthMode: 'hug' }),
            height: o.h == null ? 'auto' : `${Math.round(Number(o.h))}px`,
            ...(o.l != null && Number.isFinite(o.l) ? { left: `${Math.round(o.l)}px` } : {}),
            ...(o.t != null && Number.isFinite(o.t) ? { top: `${Math.round(o.t)}px` } : {}),
            ...(ta ? { textAlign: ta } : {}),
            ...fontExtra,
          },
          '*'
        );
      } catch {
        /* ignore */
      }
      continue;
    }

    const value = target[key] ?? '';
    if (imageSels.has(key)) {
      win.postMessage({ type: 'tmpl', action: 'img', sel: key, value }, '*');
    } else {
      const mode = textModeBySel.get(key) ?? 'text';
      win.postMessage({ type: 'tmpl', sel: key, value, mode }, '*');
    }
  }
}
