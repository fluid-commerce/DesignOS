/**
 * Preview overlay for text fields: east/west set a fixed width (turns off “Hug width”); west adjusts left.
 * South sets a fixed height (scroll if content exceeds). Hug width is restored from the sidebar checkbox.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useEditorStore, SLOT_TEXT_BOX_PREFIX } from '../store/editor';
import { collectTransformTargets } from '../lib/slot-schema';
import {
  elementLayoutRectInIframe,
  elementRectToWrapOverlay,
} from '../lib/iframe-overlay-geometry';
import {
  collectSnapEdgeLinesX,
  collectSnapEdgeLinesY,
  collectSnapHeights,
  collectSnapMidLinesX,
  collectSnapMidLinesY,
  collectSnapWidths,
  DEFAULT_SNAP_THRESHOLD_PX,
  layoutScalarToOverlayX,
  layoutScalarToOverlayY,
  pickBestScalarSnap,
  snapDimensionToTargets,
  snapTranslate1D,
} from '../lib/layout-snap';

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
  const slotSchema = useEditorStore((s) => s.slotSchema);

  const sel = picked?.kind === 'text' ? picked.sel : null;
  const textBoxKey = sel ? `${SLOT_TEXT_BOX_PREFIX}${sel}` : '';

  const snapTargetSels = useMemo(
    () => (slotSchema ? collectTransformTargets(slotSchema).map((t) => t.sel) : []),
    [slotSchema]
  );
  const artboardW = slotSchema?.width ?? 1080;
  const artboardH = slotSchema?.height ?? 1080;

  const [snapGuides, setSnapGuides] = useState<{
    verticalLayoutX?: number;
    horizontalLayoutY?: number;
  } | null>(null);

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
    setBox(elementRectToWrapOverlay(iframeEl, wrap, el));
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
      if (!iframeEl) {
        return { w: MIN_W, h: null as number | null, l: 0, t: 0 };
      }
      /**
       * Use layout rect for l/t — not getComputedStyle left/top. Carousel `.slide-counter` uses
       * `right: 16px; left: auto`; cs.left is often "auto" → NaN → we wrongly saved l=0 and blew up size.
       */
      const layout = elementLayoutRectInIframe(iframeEl, el);
      const w = Math.max(1, Math.round(layout.w));
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
      return {
        w,
        h,
        l: Math.round(layout.l),
        t: Math.round(layout.t),
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
      setSnapGuides(null);
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
      const doc = iframeEl.contentDocument;
      const th = DEFAULT_SNAP_THRESHOLD_PX;
      const snapOn = !e.shiftKey && doc != null;

      if (d.edge === 'e') {
        const rawW = Math.max(MIN_W, d.startW + dx);
        let w = rawW;
        let guides: { verticalLayoutX?: number; horizontalLayoutY?: number } | null = null;

        if (snapOn) {
          const rawR = d.startL + rawW;
          const rawCx = d.startL + rawW / 2;
          const edgeX = collectSnapEdgeLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const midX = collectSnapMidLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const widthTargets = collectSnapWidths(doc, iframeEl, snapTargetSels, sel, artboardW);

          const dim = snapDimensionToTargets(rawW, widthTargets, th, MIN_W);
          const edgeR = snapTranslate1D([rawR], edgeX, th);
          const mid = snapTranslate1D([rawCx], midX, th);
          const wMid =
            mid.guidePos != null ? 2 * (mid.guidePos - d.startL) : rawW;

          type CW = { dist: number; w: number; vx?: number };
          const cDim: CW | null =
            dim.dist <= th ? { dist: dim.dist, w: dim.value } : null;
          const cEdge: CW | null =
            edgeR.dist <= th ? { dist: edgeR.dist, w: rawW + edgeR.delta, vx: edgeR.guidePos } : null;
          const cMid: CW | null =
            mid.dist <= th && wMid >= MIN_W ? { dist: mid.dist, w: wMid, vx: mid.guidePos } : null;

          const best = pickBestScalarSnap([cDim, cEdge, cMid], th);
          if (best) {
            w = best.w;
            if (best.vx != null) guides = { verticalLayoutX: best.vx };
          }
        }
        setSnapGuides(snapOn ? guides : null);
        updateTextBox(sel, {
          w: Math.round(w),
          h: d.startH == null ? null : Math.round(d.startH),
          l: Math.round(d.startL),
          t: Math.round(d.startT),
        });
        return;
      }
      if (d.edge === 'w') {
        const rawW = Math.max(MIN_W, d.startW - dx);
        let w = rawW;
        let l = d.startL + (d.startW - rawW);
        let guides: { verticalLayoutX?: number; horizontalLayoutY?: number } | null = null;

        if (snapOn) {
          const R0 = d.startL + d.startW;
          const rawL = d.startL + d.startW - rawW;
          const rawCx = rawL + rawW / 2;
          const edgeX = collectSnapEdgeLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const midX = collectSnapMidLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const widthTargets = collectSnapWidths(doc, iframeEl, snapTargetSels, sel, artboardW);

          const dim = snapDimensionToTargets(rawW, widthTargets, th, MIN_W);
          const edgeL = snapTranslate1D([rawL], edgeX, th);
          const mid = snapTranslate1D([rawCx], midX, th);
          const wMid = mid.guidePos != null ? 2 * (R0 - mid.guidePos) : rawW;
          const lMid = R0 - wMid;

          type CW = { dist: number; w: number; l: number; vx?: number };
          const cDim: CW | null =
            dim.dist <= th ? { dist: dim.dist, w: dim.value, l: R0 - dim.value } : null;
          const newL = rawL + edgeL.delta;
          const wE = R0 - newL;
          const cEdge: CW | null =
            edgeL.dist <= th && wE >= MIN_W
              ? { dist: edgeL.dist, w: wE, l: newL, vx: edgeL.guidePos }
              : null;
          const cMid: CW | null =
            mid.dist <= th && wMid >= MIN_W
              ? { dist: mid.dist, w: wMid, l: lMid, vx: mid.guidePos }
              : null;

          const best = pickBestScalarSnap([cDim, cEdge, cMid], th);
          if (best) {
            w = best.w;
            l = best.l;
            if (best.vx != null) guides = { verticalLayoutX: best.vx };
          }
        }
        setSnapGuides(snapOn ? guides : null);
        updateTextBox(sel, {
          w: Math.round(w),
          h: d.startH == null ? null : Math.round(d.startH),
          l: Math.round(l),
          t: Math.round(d.startT),
        });
        return;
      }
      if (d.edge === 's') {
        const baseH = d.startH ?? elOffsetHeight(readEl());
        const rawH = Math.max(24, baseH + dy);
        let newH = rawH;
        let guides: { verticalLayoutX?: number; horizontalLayoutY?: number } | null = null;

        if (snapOn) {
          const rawB = d.startT + rawH;
          const rawCy = d.startT + rawH / 2;
          const edgeY = collectSnapEdgeLinesY(doc, iframeEl, snapTargetSels, sel, artboardH);
          const midY = collectSnapMidLinesY(doc, iframeEl, snapTargetSels, sel, artboardH);
          const heightTargets = collectSnapHeights(doc, iframeEl, snapTargetSels, sel, artboardH);

          const dim = snapDimensionToTargets(rawH, heightTargets, th, 24);
          const edgeB = snapTranslate1D([rawB], edgeY, th);
          const mid = snapTranslate1D([rawCy], midY, th);
          const hMid = mid.guidePos != null ? 2 * (mid.guidePos - d.startT) : rawH;

          type CH = { dist: number; h: number; hy?: number };
          const cDim: CH | null =
            dim.dist <= th ? { dist: dim.dist, h: dim.value } : null;
          const cEdge: CH | null =
            edgeB.dist <= th ? { dist: edgeB.dist, h: rawH + edgeB.delta, hy: edgeB.guidePos } : null;
          const cMid: CH | null =
            mid.dist <= th && hMid >= 24 ? { dist: mid.dist, h: hMid, hy: mid.guidePos } : null;

          const best = pickBestScalarSnap([cDim, cEdge, cMid], th);
          if (best) {
            newH = best.h;
            if (best.hy != null) guides = { horizontalLayoutY: best.hy };
          }
        }
        setSnapGuides(snapOn ? guides : null);
        updateTextBox(sel, {
          w: Math.round(d.startW),
          h: Math.round(newH),
          l: Math.round(d.startL),
          t: Math.round(d.startT),
        });
      }
    },
    [
      sel,
      iframeEl,
      updateTextBox,
      readEl,
      snapTargetSels,
      artboardW,
      artboardH,
    ]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const t = e.currentTarget as HTMLElement;
    try {
      t.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
    setSnapGuides(null);
  }, []);

  if (!sel || !box || box.w < 4 || box.h < 4) return null;

  const yMid = box.y + box.h / 2;
  const xMid = box.x + box.w / 2;

  const wrapEl = wrapRef.current;
  let guideVOverlay: number | null = null;
  let guideHOverlay: number | null = null;
  if (snapGuides && wrapEl && iframeEl) {
    if (snapGuides.verticalLayoutX != null) {
      guideVOverlay = layoutScalarToOverlayX(iframeEl, wrapEl, snapGuides.verticalLayoutX);
    }
    if (snapGuides.horizontalLayoutY != null) {
      guideHOverlay = layoutScalarToOverlayY(iframeEl, wrapEl, snapGuides.horizontalLayoutY);
    }
  }
  const overlayH = wrapEl?.clientHeight ?? 0;
  const overlayW = wrapEl?.clientWidth ?? 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        {guideVOverlay != null && overlayH > 0 && (
          <line
            x1={guideVOverlay}
            y1={0}
            x2={guideVOverlay}
            y2={overlayH}
            stroke="#ff6b9d"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.95}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {guideHOverlay != null && overlayW > 0 && (
          <line
            x1={0}
            y1={guideHOverlay}
            x2={overlayW}
            y2={guideHOverlay}
            stroke="#ff6b9d"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.95}
            style={{ pointerEvents: 'none' }}
          />
        )}
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
