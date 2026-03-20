/**
 * Interactive transform overlay on the scaled creation preview.
 * Drag body = translate, corners = scale, top handle = rotate.
 * Works with the same transform strings as BrushTransform / user-state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useEditorStore, SLOT_TRANSFORM_PREFIX } from '../store/editor';
import { buildTransformString, parseTransform } from '../lib/transform-format';

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
    transformKey ? (s.slotValues[transformKey] ?? '') : ''
  );

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
  } | null>(null);

  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
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
    const parsed = parseTransform(saved || cs.transform);
    const left = parseFloat(cs.left);
    const top = parseFloat(cs.top);
    const lx = Number.isFinite(left) ? left : 0;
    const ly = Number.isFinite(top) ? top : 0;
    /* CSS combines left/top with transform translate — full offset is sum until we zero left/top on apply */
    return {
      tx: parsed.translateX + lx,
      ty: parsed.translateY + ly,
      rot: parsed.rotateDeg,
      sx: parsed.scaleX,
      sy: parsed.scaleY,
    };
  }, [readEl, iframeEl, savedTransformForSel]);

  /**
   * Map inner-element rect to overlay coordinates.
   * getBoundingClientRect() inside the iframe is in iframe layout CSS pixels (unscaled).
   * The preview applies transform: scale(previewScale) on the iframe, so we convert
   * via iframe.getBoundingClientRect() — never subtract inner rect from wrap directly.
   */
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
  }, [sel, syncBox, wrapRef, savedTransformForSel]);

  const applyTransform = useCallback(
    (tx: number, ty: number, rot: number, sx: number, sy: number) => {
      if (!sel) return;
      updateElementTransform(sel, buildTransformString(tx, ty, rot, sx, sy));
      requestAnimationFrame(syncBox);
    },
    [sel, updateElementTransform, syncBox]
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
    [iframeEl]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!sel || !box || e.button !== 0) return;
      const t = e.currentTarget as HTMLElement;
      const mode = t.dataset.tmode as 'move' | 'rotate' | 'nw' | 'ne' | 'se' | 'sw' | undefined;
      if (!mode) return;
      if (isTextLayout && (mode === 'nw' || mode === 'ne' || mode === 'se' || mode === 'sw')) return;
      e.preventDefault();
      e.stopPropagation();
      t.setPointerCapture(e.pointerId);

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
        };
        return;
      }

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
      };
    },
    [sel, box, readParsed, readEl, iframeEl, isTextLayout]
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
        applyTransform(d.startTx + dx, d.startTy + dy, d.startRot, sxUse, syUse);
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
      const nSx =
        mode === 'nw' || mode === 'sw'
          ? Math.max(0.05, -elX / (d.nW / 2))
          : Math.max(0.05, elX / (d.nW / 2));
      const nSy =
        mode === 'nw' || mode === 'ne'
          ? Math.max(0.05, -elY / (d.nH / 2))
          : Math.max(0.05, elY / (d.nH / 2));

      applyTransform(d.startTx, d.startTy, d.startRot, nSx, nSy);
    },
    [sel, iframeEl, applyTransform, eventToIframeLayout, isTextLayout]
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

  if (!sel || !box || box.w < 2 || box.h < 2) return null;

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rotHandleY = box.y - ROT_STEM;

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
        {/* Bounding box */}
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill="rgba(68,178,255,0.04)"
          stroke="#44B2FF"
          strokeWidth={1.5}
          strokeDasharray="6 4"
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
          x1={cx}
          y1={box.y}
          x2={cx}
          y2={rotHandleY + HANDLE / 2}
          stroke="#44B2FF"
          strokeWidth={1.5}
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={cx}
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
              ['nw', box.x, box.y, 'nwse-resize'],
              ['ne', box.x + box.w, box.y, 'nesw-resize'],
              ['se', box.x + box.w, box.y + box.h, 'nwse-resize'],
              ['sw', box.x, box.y + box.h, 'nesw-resize'],
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
      </svg>
    </div>
  );
}
