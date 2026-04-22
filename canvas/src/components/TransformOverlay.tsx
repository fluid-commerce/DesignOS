/**
 * Interactive transform overlay on the scaled creation preview.
 * Drag body = translate, corners = scale, top handle = rotate.
 * Works with the same transform strings as BrushTransform / user-state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useEditorStore, SLOT_TRANSFORM_PREFIX } from '../store/editor';
import {
  buildTransformString,
  parseTransform,
  parseTransformComputed,
  roundLayoutRotateDeg,
  roundLayoutTranslatePx,
} from '../lib/transform-format';
import {
  elementRectToWrapOverlay,
  elementRotatedOverlayInfo,
} from '../lib/iframe-overlay-geometry';
import { collectTransformTargets } from '../lib/slot-schema';
import {
  canSnapAxisAlignedTransform,
  collectSnapEdgeLinesX,
  collectSnapEdgeLinesY,
  collectSnapHeights,
  collectSnapMidLinesX,
  collectSnapMidLinesY,
  collectSnapWidths,
  DEFAULT_SNAP_THRESHOLD_PX,
  elementRectInIframeLayout,
  layoutScalarToOverlayX,
  layoutScalarToOverlayY,
  pickCloserSnap,
  snapScaleSx,
  snapScaleSy,
  snapTranslate1D,
  type LRect,
} from '../lib/layout-snap';

const HANDLE = 9;
const ROT_STEM = 28;

interface TransformOverlayProps {
  iframeEl: HTMLIFrameElement | null;
  /** Kept for API stability; overlay derives scale from iframe layout vs getBoundingClientRect(). */
  previewScale: number;
  wrapRef: RefObject<HTMLDivElement | null>;
}

export function TransformOverlay({ iframeEl, wrapRef }: TransformOverlayProps) {
  const picked = useEditorStore((s) => s.pickedTransform);
  const updateElementTransform = useEditorStore((s) => s.updateElementTransform);
  /** Only this slice — whole `slotValues` changes on every text/image edit and was retriggering effects ~350ms-feel “second moves”. */
  const sel = picked?.sel ?? null;
  /** Scale handles stretch glyphs — text uses TextBoxOverlay for width/height instead */
  const isTextLayout = picked?.kind === 'text';
  const transformKey = sel ? `${SLOT_TRANSFORM_PREFIX}${sel}` : '';
  const savedTransformForSel = useEditorStore((s) =>
    transformKey ? (s.slotValues[transformKey] ?? '') : '',
  );
  const slotSchema = useEditorStore((s) => s.slotSchema);

  const snapTargetSels = useMemo(
    () => (slotSchema ? collectTransformTargets(slotSchema).map((t) => t.sel) : []),
    [slotSchema],
  );
  const artboardW = slotSchema?.width ?? 1080;
  const artboardH = slotSchema?.height ?? 1080;

  const dragRef = useRef<{
    mode: 'move' | 'rotate' | 'nw' | 'ne' | 'se' | 'sw';
    startClientX: number;
    startClientY: number;
    startTx: number;
    startTy: number;
    startRot: number;
    startSx: number;
    startSy: number;
    /** For rotate: center in viewport px */
    pCx: number;
    pCy: number;
    startAngleDeg: number;
    /** For scale: element center in iframe layout px, half-extents */
    cx: number;
    cy: number;
    nW: number;
    nH: number;
    /** Bbox of moving element at drag start (iframe layout px) — move + axis-aligned snap only */
    moveStartRect?: LRect;
    /** Unscaled layout center at drag start — corner scale + dimension snap */
    scaleLayoutCX?: number;
    scaleLayoutCY?: number;
  } | null>(null);

  /** Smart-guide positions in iframe layout space (while snapping). */
  const [snapGuides, setSnapGuides] = useState<{
    verticalLayoutX?: number;
    horizontalLayoutY?: number;
  } | null>(null);

  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  /** Rotation-aware overlay info: center + un-rotated dims + angle */
  const [rotBox, setRotBox] = useState<{
    cx: number;
    cy: number;
    w: number;
    h: number;
    rotDeg: number;
  } | null>(null);

  const readEl = useCallback((): HTMLElement | null => {
    if (!iframeEl?.contentDocument || !sel) return null;
    return iframeEl.contentDocument.querySelector(sel) as HTMLElement | null;
  }, [iframeEl, sel]);

  const readParsed = useCallback(() => {
    const el = readEl();
    if (!el) {
      return { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
    }
    const win = iframeEl!.contentWindow!;
    const cs = win.getComputedStyle(el);
    const saved = savedTransformForSel;
    const parsed = saved ? parseTransform(saved) : parseTransformComputed(cs.transform, win);
    /* When a saved transform exists, left/top were already zeroed by the iframe
       load script (__tmpl_listener__) — the translate carries the absorbed offset.
       Only fold in left/top for never-edited elements (no saved transform). */
    let lx = 0;
    let ly = 0;
    if (!saved) {
      const left = parseFloat(cs.left);
      const top = parseFloat(cs.top);
      lx = Number.isFinite(left) ? left : 0;
      ly = Number.isFinite(top) ? top : 0;
    }
    return {
      tx: roundLayoutTranslatePx(parsed.translateX + lx),
      ty: roundLayoutTranslatePx(parsed.translateY + ly),
      rot: roundLayoutRotateDeg(parsed.rotateDeg),
      sx: parsed.scaleX,
      sy: parsed.scaleY,
    };
  }, [readEl, iframeEl, savedTransformForSel]);

  /**
   * Map inner-element rect to overlay coordinates (same space as pink snap guides).
   * Browsers disagree whether iframe content rects are embedder- or document-relative; we detect
   * and map in {@link elementRectToWrapOverlay}.
   */
  const syncBox = useCallback(() => {
    const wrap = wrapRef.current;
    const el = readEl();
    if (!wrap || !el || !iframeEl) {
      setBox(null);
      setRotBox(null);
      return;
    }
    setBox(elementRectToWrapOverlay(iframeEl, wrap, el));
    setRotBox(elementRotatedOverlayInfo(iframeEl, wrap, el as HTMLElement));
  }, [readEl, wrapRef, iframeEl]);

  useEffect(() => {
    if (!sel) {
      setBox(null);
      setRotBox(null);
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
  }, [sel, syncBox, wrapRef, savedTransformForSel]);

  const applyTransform = useCallback(
    (tx: number, ty: number, rot: number, sx: number, sy: number) => {
      if (!sel) return;
      updateElementTransform(sel, buildTransformString(tx, ty, rot, sx, sy));
      requestAnimationFrame(syncBox);
    },
    [sel, updateElementTransform, syncBox],
  );

  /* Strip any CSS scale when text is selected so height/width use layout, not stretched glyphs.
   * Must not re-run on unrelated slot edits — only when selection or this element’s transform string changes. */
  useEffect(() => {
    if (!sel || !isTextLayout) return;
    const st = readParsed();
    if (Math.abs(st.sx - 1) > 0.001 || Math.abs(st.sy - 1) > 0.001) {
      applyTransform(st.tx, st.ty, st.rot, 1, 1);
    }
  }, [sel, isTextLayout, savedTransformForSel, applyTransform, readParsed]);

  /** Screen coords → iframe document layout coords (same space as inner getBoundingClientRect). */
  const eventToIframeLayout = useCallback(
    (clientX: number, clientY: number) => {
      if (!iframeEl) return { x: 0, y: 0 };
      const ir = iframeEl.getBoundingClientRect();
      const sX = ir.width / (iframeEl.offsetWidth || 1);
      const sY = ir.height / (iframeEl.offsetHeight || 1);
      return {
        x: (clientX - ir.left) / sX,
        y: (clientY - ir.top) / sY,
      };
    },
    [iframeEl],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!sel || !box || e.button !== 0) return;
      const t = e.currentTarget as HTMLElement;
      const mode = t.dataset.tmode as 'move' | 'rotate' | 'nw' | 'ne' | 'se' | 'sw' | undefined;
      if (!mode) return;
      if (isTextLayout && (mode === 'nw' || mode === 'ne' || mode === 'se' || mode === 'sw'))
        return;
      e.preventDefault();
      e.stopPropagation();
      t.setPointerCapture(e.pointerId);
      setSnapGuides(null);

      const st = readParsed();
      const el = readEl();
      if (!el || !iframeEl) return;

      const er = el.getBoundingClientRect();
      const ir = iframeEl.getBoundingClientRect();
      const sX = ir.width / (iframeEl.offsetWidth || 1);
      const sY = ir.height / (iframeEl.offsetHeight || 1);
      /* Rotation uses browser client coords; center must be in the same space as e.clientX/Y */
      const pCx = ir.left + (er.left + er.width / 2) * sX;
      const pCy = ir.top + (er.top + er.height / 2) * sY;
      /* Scale math uses iframe layout space */
      const cx = er.left + er.width / 2;
      const cy = er.top + er.height / 2;
      const nW = el.offsetWidth || 1;
      const nH = el.offsetHeight || 1;

      if (mode === 'rotate') {
        const startAngleDeg = (Math.atan2(e.clientY - pCy, e.clientX - pCx) * 180) / Math.PI;
        dragRef.current = {
          mode: 'rotate',
          startClientX: e.clientX,
          startClientY: e.clientY,
          startTx: st.tx,
          startTy: st.ty,
          startRot: st.rot,
          startSx: st.sx,
          startSy: st.sy,
          pCx,
          pCy,
          startAngleDeg,
          cx,
          cy,
          nW,
          nH,
        };
        return;
      }

      if (mode === 'move') {
        const moveStartRect = elementRectInIframeLayout(iframeEl, el);
        dragRef.current = {
          mode: 'move',
          startClientX: e.clientX,
          startClientY: e.clientY,
          startTx: st.tx,
          startTy: st.ty,
          startRot: st.rot,
          startSx: st.sx,
          startSy: st.sy,
          pCx,
          pCy,
          startAngleDeg: 0,
          cx,
          cy,
          nW,
          nH,
          moveStartRect,
        };
        return;
      }

      const lr = elementRectInIframeLayout(iframeEl, el);
      dragRef.current = {
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTx: st.tx,
        startTy: st.ty,
        startRot: st.rot,
        startSx: st.sx,
        startSy: st.sy,
        pCx,
        pCy,
        startAngleDeg: 0,
        cx,
        cy,
        nW,
        nH,
        scaleLayoutCX: (lr.l + lr.r) / 2,
        scaleLayoutCY: (lr.t + lr.b) / 2,
      };
    },
    [sel, box, readParsed, readEl, iframeEl, isTextLayout],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !sel) return;
      e.preventDefault();

      const sxUse = isTextLayout ? 1 : d.startSx;
      const syUse = isTextLayout ? 1 : d.startSy;

      if (d.mode === 'move') {
        if (!iframeEl) return;
        const ir = iframeEl.getBoundingClientRect();
        const sX = ir.width / (iframeEl.offsetWidth || 1);
        const sY = ir.height / (iframeEl.offsetHeight || 1);
        const dx = (e.clientX - d.startClientX) / sX;
        const dy = (e.clientY - d.startClientY) / sY;
        let tx = d.startTx + dx;
        let ty = d.startTy + dy;

        const doc = iframeEl.contentDocument;
        const msr = d.moveStartRect;
        const snapOk =
          !e.shiftKey &&
          msr &&
          doc &&
          canSnapAxisAlignedTransform(d.startRot, d.startSx, d.startSy);

        if (snapOk) {
          const dTx = tx - d.startTx;
          const dTy = ty - d.startTy;
          const hypoL = msr.l + dTx;
          const hypoT = msr.t + dTy;
          const hypoR = hypoL + msr.w;
          const hypoB = hypoT + msr.h;
          const hypoCX = hypoL + msr.w / 2;
          const hypoCY = hypoT + msr.h / 2;

          const edgeX = collectSnapEdgeLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const midX = collectSnapMidLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
          const edgeY = collectSnapEdgeLinesY(doc, iframeEl, snapTargetSels, sel, artboardH);
          const midY = collectSnapMidLinesY(doc, iframeEl, snapTargetSels, sel, artboardH);

          const th = DEFAULT_SNAP_THRESHOLD_PX;
          const sxSnap = pickCloserSnap(
            snapTranslate1D([hypoL, hypoR], edgeX, th),
            snapTranslate1D([hypoCX], midX, th),
            th,
          );
          const sySnap = pickCloserSnap(
            snapTranslate1D([hypoT, hypoB], edgeY, th),
            snapTranslate1D([hypoCY], midY, th),
            th,
          );

          tx += sxSnap.delta;
          ty += sySnap.delta;

          const nextGuides: { verticalLayoutX?: number; horizontalLayoutY?: number } = {};
          if (sxSnap.delta !== 0 && sxSnap.guidePos != null) {
            nextGuides.verticalLayoutX = sxSnap.guidePos;
          }
          if (sySnap.delta !== 0 && sySnap.guidePos != null) {
            nextGuides.horizontalLayoutY = sySnap.guidePos;
          }
          setSnapGuides(
            nextGuides.verticalLayoutX != null || nextGuides.horizontalLayoutY != null
              ? nextGuides
              : null,
          );
        } else {
          setSnapGuides(null);
        }

        applyTransform(tx, ty, d.startRot, sxUse, syUse);
        return;
      }

      if (d.mode === 'rotate') {
        const cur = (Math.atan2(e.clientY - d.pCy, e.clientX - d.pCx) * 180) / Math.PI;
        const nRot = d.startRot + (cur - d.startAngleDeg);
        applyTransform(d.startTx, d.startTy, nRot, sxUse, syUse);
        return;
      }

      /* scale corners — editor.js style, iframe layout coords */
      const iMouse = eventToIframeLayout(e.clientX, e.clientY);
      const dx = iMouse.x - d.cx;
      const dy = iMouse.y - d.cy;
      const θ = (d.startRot * Math.PI) / 180;
      const elX = Math.cos(θ) * dx + Math.sin(θ) * dy;
      const elY = -Math.sin(θ) * dx + Math.cos(θ) * dy;
      const mode = d.mode;
      const MIN_SCL = 0.05;
      let nSx =
        mode === 'nw' || mode === 'sw'
          ? Math.max(MIN_SCL, -elX / (d.nW / 2))
          : Math.max(MIN_SCL, elX / (d.nW / 2));
      let nSy =
        mode === 'nw' || mode === 'ne'
          ? Math.max(MIN_SCL, -elY / (d.nH / 2))
          : Math.max(MIN_SCL, elY / (d.nH / 2));

      const doc = iframeEl?.contentDocument;
      const snapScaleOk =
        iframeEl &&
        doc &&
        !e.shiftKey &&
        d.scaleLayoutCX != null &&
        d.scaleLayoutCY != null &&
        canSnapAxisAlignedTransform(d.startRot, d.startSx, d.startSy);

      if (snapScaleOk) {
        const th = DEFAULT_SNAP_THRESHOLD_PX;
        const edgeX = collectSnapEdgeLinesX(doc, iframeEl, snapTargetSels, sel, artboardW);
        const edgeY = collectSnapEdgeLinesY(doc, iframeEl, snapTargetSels, sel, artboardH);
        const widthTargets = collectSnapWidths(doc, iframeEl, snapTargetSels, sel, artboardW);
        const heightTargets = collectSnapHeights(doc, iframeEl, snapTargetSels, sel, artboardH);
        const cxL = d.scaleLayoutCX!;
        const cyL = d.scaleLayoutCY!;

        if (mode === 'se') {
          nSx = snapScaleSx(d.nW, nSx, cxL, 'east', widthTargets, edgeX, th, MIN_SCL);
          nSy = snapScaleSy(d.nH, nSy, cyL, 'south', heightTargets, edgeY, th, MIN_SCL);
        } else if (mode === 'sw') {
          nSx = snapScaleSx(d.nW, nSx, cxL, 'west', widthTargets, edgeX, th, MIN_SCL);
          nSy = snapScaleSy(d.nH, nSy, cyL, 'south', heightTargets, edgeY, th, MIN_SCL);
        } else if (mode === 'ne') {
          nSx = snapScaleSx(d.nW, nSx, cxL, 'east', widthTargets, edgeX, th, MIN_SCL);
          nSy = snapScaleSy(d.nH, nSy, cyL, 'north', heightTargets, edgeY, th, MIN_SCL);
        } else if (mode === 'nw') {
          nSx = snapScaleSx(d.nW, nSx, cxL, 'west', widthTargets, edgeX, th, MIN_SCL);
          nSy = snapScaleSy(d.nH, nSy, cyL, 'north', heightTargets, edgeY, th, MIN_SCL);
        }
      }

      applyTransform(d.startTx, d.startTy, d.startRot, nSx, nSy);
    },
    [
      sel,
      iframeEl,
      applyTransform,
      eventToIframeLayout,
      isTextLayout,
      snapTargetSels,
      artboardW,
      artboardH,
    ],
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

  if (!sel || !box || box.w < 2 || box.h < 2) return null;

  /* Use rotation-aware geometry when available; fall back to AABB. */
  const useRotated = rotBox != null && rotBox.w > 2 && rotBox.h > 2;
  const bCx = useRotated ? rotBox.cx : box.x + box.w / 2;
  const bCy = useRotated ? rotBox.cy : box.y + box.h / 2;
  const bW = useRotated ? rotBox.w : box.w;
  const bH = useRotated ? rotBox.h : box.h;
  const bRot = useRotated ? rotBox.rotDeg : 0;
  const bX = bCx - bW / 2;
  const bY = bCy - bH / 2;
  const rotHandleY = bY - ROT_STEM;

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
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden
      >
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

        {/* Rotated group — box, handles, and rotation stem all rotate with element */}
        <g transform={`rotate(${bRot}, ${bCx}, ${bCy})`}>
          {/* Bounding box — drag body to move.
              For text elements, TextBoxOverlay draws the visible border;
              this rect is just an invisible hit area to avoid dual outlines. */}
          <rect
            x={bX}
            y={bY}
            width={bW}
            height={bH}
            fill={isTextLayout ? 'transparent' : 'rgba(68,178,255,0.04)'}
            stroke={isTextLayout ? 'none' : '#44B2FF'}
            strokeWidth={isTextLayout ? 0 : 1.5}
            strokeDasharray={isTextLayout ? undefined : '6 4'}
            style={{ pointerEvents: 'all' }}
            data-tmode="move"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            cursor="grab"
          />

          {/* Rotation stem + handle */}
          <line
            x1={bCx}
            y1={bY}
            x2={bCx}
            y2={rotHandleY + HANDLE / 2}
            stroke="#44B2FF"
            strokeWidth={1.5}
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={bCx}
            cy={rotHandleY}
            r={HANDLE / 2 + 3}
            fill="rgba(68,178,255,0.15)"
            stroke="#44B2FF"
            strokeWidth={1.5}
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            data-tmode="rotate"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {/* Corner handles — images/brushes only (scale stretches text) */}
          {!isTextLayout &&
            (
              [
                ['nw', bX, bY, 'nwse-resize'],
                ['ne', bX + bW, bY, 'nesw-resize'],
                ['se', bX + bW, bY + bH, 'nwse-resize'],
                ['sw', bX, bY + bH, 'nesw-resize'],
              ] as const
            ).map(([mode, hx, hy, cursor]) => (
              <rect
                key={mode}
                x={hx - HANDLE / 2}
                y={hy - HANDLE / 2}
                width={HANDLE}
                height={HANDLE}
                fill="#fff"
                stroke="#44B2FF"
                strokeWidth={1.5}
                style={{ pointerEvents: 'all', cursor }}
                data-tmode={mode}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            ))}
        </g>
      </svg>
    </div>
  );
}
