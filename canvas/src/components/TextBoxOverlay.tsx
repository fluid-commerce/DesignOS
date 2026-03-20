/**
 * Preview overlay for text fields: east/west set a fixed width (turns off “Hug width”); west adjusts left.
 * South sets a fixed height (scroll if content exceeds). Hug width is restored from the sidebar checkbox.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useEditorStore, SLOT_TEXT_BOX_PREFIX } from '../store/editor';

const HANDLE = 9;
const MIN_W = 32;

interface TextBoxOverlayProps {
  iframeEl: HTMLIFrameElement | null;
  wrapRef: RefObject<HTMLDivElement | null>;
}

export function TextBoxOverlay({ iframeEl, wrapRef }: TextBoxOverlayProps) {
  const picked = useEditorStore((s) => s.pickedTransform);
  const updateTextBox = useEditorStore((s) => s.updateTextBox);
  const slotValues = useEditorStore((s) => s.slotValues);

  const sel = picked?.kind === 'text' ? picked.sel : null;
  const textBoxKey = sel ? `${SLOT_TEXT_BOX_PREFIX}${sel}` : '';

  const dragRef = useRef<{
    edge: 'e' | 'w' | 's';
    startClientX: number;
    startClientY: number;
    startW: number;
    startH: number | null;
    startL: number;
    startT: number;
  } | null>(null);

  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const readEl = useCallback((): HTMLElement | null => {
    if (!iframeEl?.contentDocument || !sel) return null;
    return iframeEl.contentDocument.querySelector(sel) as HTMLElement | null;
  }, [iframeEl, sel]);

  const syncBox = useCallback(() => {
    const wrap = wrapRef.current;
    const el = readEl();
    if (!wrap || !el || !iframeEl) {
      setBox(null);
      return;
    }
    const er = el.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const ir = iframeEl.getBoundingClientRect();
    const sX = ir.width / (iframeEl.offsetWidth || 1);
    const sY = ir.height / (iframeEl.offsetHeight || 1);
    setBox({
      x: ir.left + er.left * sX - wr.left,
      y: ir.top + er.top * sY - wr.top,
      w: er.width * sX,
      h: er.height * sY,
    });
  }, [readEl, wrapRef, iframeEl]);

  useEffect(() => {
    if (!sel) {
      setBox(null);
      return;
    }
    syncBox();
    const wrap = wrapRef.current;
    const ro = new ResizeObserver(() => syncBox());
    if (wrap) ro.observe(wrap);
    window.addEventListener('resize', syncBox);
    const id = window.setInterval(syncBox, 120);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncBox);
      window.clearInterval(id);
    };
  }, [sel, syncBox, wrapRef, slotValues[textBoxKey]]);

  /**
   * Fixed height vs auto: getComputedStyle().height is always a pixel length for sized boxes, so it
   * falsely looked “fixed” after height:auto — E/W resize then saved a pixel h and text stopped growing.
   * Prefer saved __textbox__ JSON; else treat only explicit inline px height as fixed.
   */
  const readLayoutAtDragStart = useCallback(
    (el: HTMLElement) => {
      const win = iframeEl!.contentWindow!;
      const cs = win.getComputedStyle(el);
      const w = el.offsetWidth;
      let h: number | null = null;
      const raw = slotValues[textBoxKey];
      if (raw) {
        try {
          const o = JSON.parse(raw) as { h?: number | null };
          if (typeof o.h === 'number' && Number.isFinite(o.h)) {
            h = Math.round(o.h);
          } else {
            h = null;
          }
        } catch {
          h = inferFixedHeightFromInlineStyle(el);
        }
      } else {
        h = inferFixedHeightFromInlineStyle(el);
      }
      const l = parseFloat(cs.left);
      const t = parseFloat(cs.top);
      return {
        w,
        h,
        l: Number.isFinite(l) ? l : 0,
        t: Number.isFinite(t) ? t : 0,
      };
    },
    [iframeEl, slotValues, textBoxKey]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!sel || !box || e.button !== 0) return;
      const t = e.currentTarget as HTMLElement;
      const edge = t.dataset.edge as 'e' | 'w' | 's' | undefined;
      if (!edge) return;
      const el = readEl();
      if (!el || !iframeEl) return;
      e.preventDefault();
      e.stopPropagation();
      t.setPointerCapture(e.pointerId);
      const lay = readLayoutAtDragStart(el);
      dragRef.current = {
        edge,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startW: lay.w,
        startH: lay.h,
        startL: lay.l,
        startT: lay.t,
      };
    },
    [sel, box, readEl, iframeEl, readLayoutAtDragStart]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !sel || !iframeEl) return;
      e.preventDefault();
      const ir = iframeEl.getBoundingClientRect();
      const sX = ir.width / (iframeEl.offsetWidth || 1);
      const sY = ir.height / (iframeEl.offsetHeight || 1);
      const dx = (e.clientX - d.startClientX) / sX;
      const dy = (e.clientY - d.startClientY) / sY;

      if (d.edge === 'e') {
        const w = Math.max(MIN_W, d.startW + dx);
        updateTextBox(sel, { w, h: d.startH, l: d.startL, t: d.startT });
        return;
      }
      if (d.edge === 'w') {
        const w = Math.max(MIN_W, d.startW - dx);
        const l = d.startL + (d.startW - w);
        updateTextBox(sel, { w, h: d.startH, l, t: d.startT });
        return;
      }
      if (d.edge === 's') {
        const newH = Math.max(24, (d.startH ?? elOffsetHeight(readEl())) + dy);
        updateTextBox(sel, { w: d.startW, h: newH, l: d.startL, t: d.startT });
      }
    },
    [sel, iframeEl, updateTextBox, readEl]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const t = e.currentTarget as HTMLElement;
    try {
      t.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  }, []);

  if (!sel || !box || box.w < 4 || box.h < 4) return null;

  const yMid = box.y + box.h / 2;
  const xMid = box.x + box.w / 2;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill="rgba(68,178,255,0.06)"
          stroke="#44B2FF"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          style={{ pointerEvents: 'none' }}
        />
        {/* East */}
        <rect
          x={box.x + box.w - HANDLE / 2}
          y={yMid - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          fill="#fff"
          stroke="#44B2FF"
          strokeWidth={1.5}
          style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
          data-edge="e"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {/* West */}
        <rect
          x={box.x - HANDLE / 2}
          y={yMid - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          fill="#fff"
          stroke="#44B2FF"
          strokeWidth={1.5}
          style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
          data-edge="w"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {/* South */}
        <rect
          x={xMid - HANDLE / 2}
          y={box.y + box.h - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          fill="#fff"
          stroke="#44B2FF"
          strokeWidth={1.5}
          style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
          data-edge="s"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </svg>
    </div>
  );
}

function elOffsetHeight(el: HTMLElement | null): number {
  return el?.offsetHeight ?? 120;
}

/** If the element has no inline height or inline auto, height follows content (auto). */
function inferFixedHeightFromInlineStyle(el: HTMLElement): number | null {
  const sh = el.style.height;
  if (!sh || sh === 'auto') return null;
  if (sh.endsWith('px')) return Math.max(24, Math.round(el.offsetHeight));
  return null;
}
