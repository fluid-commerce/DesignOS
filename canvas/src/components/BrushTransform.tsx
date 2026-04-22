/**
 * BrushTransform — Bounding-box overlay for drag / scale / rotate on the brush element.
 * Portals an SVG-style control frame over the iframe (screen coords), with numeric fallbacks.
 * Persists transforms via editor store patchBrushTransform → __brushTransform__ in userState.
 */

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore, BRUSH_TRANSFORM_STATE_KEY } from '../store/editor';

interface BrushTransformProps {
  brushSel: string;
  brushLabel?: string;
  assetWidth: number;
  assetHeight: number;
  iframeEl: HTMLIFrameElement | null;
}

interface TransformState {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
}

function parseTransform(transform: string): TransformState {
  const result: TransformState = {
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
  if (!transform || transform === 'none') return result;
  const tx = transform.match(/translate\(([^,)]+),\s*([^)]+)\)/);
  if (tx) {
    result.translateX = parseFloat(tx[1]) || 0;
    result.translateY = parseFloat(tx[2]) || 0;
  }
  const rot = transform.match(/rotate\(([^)]+)deg\)/);
  if (rot) result.rotateDeg = parseFloat(rot[1]) || 0;
  const sc = transform.match(/scale\(([^,)]+)(?:,\s*([^)]+))?\)/);
  if (sc) {
    result.scaleX = parseFloat(sc[1]) || 1;
    result.scaleY = sc[2] != null ? parseFloat(sc[2]) || 1 : result.scaleX;
  }
  return result;
}

/**
 * Read transform from getComputedStyle: browsers usually return matrix() / matrix3d(),
 * which parseTransform() misses — first inline apply would then wipe rotate/scale from CSS.
 */
function parseTransformFromComputed(transform: string): TransformState {
  const fallback: TransformState = {
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
  if (!transform || transform === 'none') return fallback;

  const trimmed = transform.trim();
  // Persisted / hand-authored string with named functions (not a single matrix token)
  if (/translate\s*\(/.test(transform) && !/^matrix/.test(trimmed)) {
    return parseTransform(transform);
  }

  try {
    const m = new DOMMatrixReadOnly(transform);
    const rotateRad = Math.atan2(m.b, m.a);
    const scaleX = Math.hypot(m.a, m.b) || 1;
    const scaleY = Math.hypot(m.c, m.d) || 1;
    return {
      translateX: m.e,
      translateY: m.f,
      rotateDeg: (rotateRad * 180) / Math.PI,
      scaleX: Math.abs(scaleX) < 1e-6 ? 1 : scaleX,
      scaleY: Math.abs(scaleY) < 1e-6 ? 1 : scaleY,
    };
  } catch {
    return parseTransform(transform);
  }
}

function buildTransformString(tx: number, ty: number, rot: number, sx: number, sy: number): string {
  return `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
}

function readBrushMap(slotValues: Record<string, string>): Record<string, string> {
  try {
    return JSON.parse(slotValues[BRUSH_TRANSFORM_STATE_KEY] || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Map brush element rect to parent window fixed coordinates (handles CSS scale on iframe). */
function getBrushScreenRect(iframe: HTMLIFrameElement | null, selector: string): DOMRect | null {
  if (!iframe?.contentDocument) return null;
  const el = iframe.contentDocument.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const iframeRect = iframe.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const iw = iframe.offsetWidth || iframe.contentDocument?.documentElement?.clientWidth || 1;
  const ih = iframe.offsetHeight || iframe.contentDocument?.documentElement?.clientHeight || 1;
  const sx = iw > 0 ? iframeRect.width / iw : 1;
  const sy = ih > 0 ? iframeRect.height / ih : 1;
  const left = iframeRect.left + elRect.left * sx;
  const top = iframeRect.top + elRect.top * sy;
  const width = elRect.width * sx;
  const height = elRect.height * sy;
  if (width <= 0 || height <= 0) return null;
  return new DOMRect(left, top, width, height);
}

function parseCssPxPair(width: string, height: string): { w: number; h: number } | null {
  const mw = String(width)
    .trim()
    .match(/^([\d.]+)px$/);
  const mh = String(height)
    .trim()
    .match(/^([\d.]+)px$/);
  if (!mw || !mh) return null;
  const w = parseFloat(mw[1]);
  const h = parseFloat(mh[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Layout size in iframe CSS pixels **without** transform effects (stable under `rotate()`).
 * Do not use getBoundingClientRect() here — caller seeds fallback once via bootstrap only.
 */
function getBrushRotationInvariantLayoutSize(el: Element): { w: number; h: number } | null {
  if (el instanceof HTMLElement) {
    const w = el.offsetWidth || el.clientWidth;
    const h = el.offsetHeight || el.clientHeight;
    if (w > 0 && h > 0) {
      return { w, h };
    }
  }
  if (typeof SVGElement !== 'undefined' && el instanceof SVGElement) {
    const svg = el as SVGSVGElement;
    const w = svg.clientWidth || (svg as unknown as HTMLElement).offsetWidth || 0;
    const h = svg.clientHeight || (svg as unknown as HTMLElement).offsetHeight || 0;
    if (w > 0 && h > 0) {
      return { w, h };
    }
    try {
      if (typeof svg.getBBox === 'function') {
        const b = svg.getBBox();
        const vw = svg.viewBox?.baseVal?.width;
        if (b.width > 0 && b.height > 0 && vw != null && vw > 0 && svg.clientWidth > 0) {
          const scalePx = svg.clientWidth / vw;
          return { w: b.width * scalePx, h: b.height * scalePx };
        }
        if (b.width > 0 && b.height > 0) {
          return { w: b.width, h: b.height };
        }
      }
    } catch {
      /* detached svg */
    }
  }
  const view = el.ownerDocument?.defaultView;
  if (view) {
    const cs = view.getComputedStyle(el);
    const parsed = parseCssPxPair(cs.width, cs.height);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * One-time layout seed when invariant reads fail (e.g. SVG before first layout). Uses AABB once
 * and caches — do not re-call per rotation frame (see rotationInvariantLayoutIframeRef).
 */
function bootstrapLayoutFromBBox(el: Element): { w: number; h: number } | null {
  const br = el.getBoundingClientRect();
  if (br.width > 0 && br.height > 0) {
    return { w: br.width, h: br.height };
  }
  return null;
}

/** Visible handle square */
const HANDLE = 12;
/** Minimum drag target around each corner (easier than a 12px dot) */
const CORNER_HIT = 40;
const MOVE_HIT_INSET = 16;
const ROTATE_HIT = 34;
const ROTATE_OFFSET = 30;
/** Extra padding so corner handles sit inside the portal (reliable hit-testing). */
const OVERLAY_PAD = HANDLE + 12;
const OVERLAY_Z = 100100;

type ScaleCorner = 'nw' | 'ne' | 'se' | 'sw';

function localCornerOffset(
  corner: ScaleCorner,
  hw: number,
  hh: number,
): { vx: number; vy: number } {
  switch (corner) {
    case 'nw':
      return { vx: -hw, vy: -hh };
    case 'ne':
      return { vx: hw, vy: -hh };
    case 'se':
      return { vx: hw, vy: hh };
    case 'sw':
      return { vx: -hw, vy: hh };
  }
}

function oppositeScaleCorner(corner: ScaleCorner): ScaleCorner {
  const op: Record<ScaleCorner, ScaleCorner> = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
  return op[corner];
}

/** Scale then rotate (matches overlay + CSS: rotate(θ) scale(sx,sy) around origin — scale applies first to local vector). */
function screenDeltaFromLocalScaled(
  lvx: number,
  lvy: number,
  rotDeg: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const wx = lvx * sx;
  const wy = lvy * sy;
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: c * wx - s * wy, y: s * wx + c * wy };
}

function cornerScreenPx(
  ol: { left: number; top: number; ox: number; oy: number },
  corner: ScaleCorner,
  layoutW: number,
  layoutH: number,
  rotDeg: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const hw = layoutW / 2;
  const hh = layoutH / 2;
  const { vx, vy } = localCornerOffset(corner, hw, hh);
  const off = screenDeltaFromLocalScaled(vx, vy, rotDeg, sx, sy);
  return { x: ol.left + ol.ox + off.x, y: ol.top + ol.oy + off.y };
}

function scaleCursorForCorner(corner: ScaleCorner): string {
  switch (corner) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    default:
      return 'nwse-resize';
  }
}

export function BrushTransform({
  brushSel,
  brushLabel,
  assetWidth,
  assetHeight,
  iframeEl,
}: BrushTransformProps) {
  const { iframeRef, patchBrushTransform, selectedIterationId } = useEditorStore();
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rot, setRot] = useState(0);
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);

  /** Bumps when iframe resizes or window scrolls — must feed screenRect memo or the box stays in the wrong place. */
  const [layoutVersion, setLayoutVersion] = useState(0);

  type DragSession = {
    mode: 'move' | 'scale' | 'rotate';
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    startRot: number;
    startSx: number;
    startSy: number;
    startAngle?: number;
    cx?: number;
    cy?: number;
    /** Corner scale with opposite corner fixed in screen space. */
    scaleCorner?: ScaleCorner;
    anchorX?: number;
    anchorY?: number;
    cornerStartX?: number;
    cornerStartY?: number;
    halfW?: number;
    halfH?: number;
    signX?: number;
    signY?: number;
    /** Anchor offset from center in iframe CSS px (for translate correction) */
    anchorVx?: number;
    anchorVy?: number;
  };
  const dragRef = useRef<DragSession | null>(null);
  const [hoverRotateCorner, setHoverRotateCorner] = useState<ScaleCorner | null>(null);

  const effectiveIframe = iframeRef ?? iframeEl;

  const safeW = Number.isFinite(assetWidth) && assetWidth > 0 ? assetWidth : 1080;
  const safeH = Number.isFinite(assetHeight) && assetHeight > 0 ? assetHeight : 1080;

  const iframeScale = useCallback((): number => {
    if (!effectiveIframe) return 1;
    const r = effectiveIframe.getBoundingClientRect();
    const iw =
      effectiveIframe.offsetWidth ||
      effectiveIframe.contentDocument?.documentElement?.clientWidth ||
      safeW ||
      1;
    const ratio = iw > 0 ? r.width / iw : 1;
    if (!Number.isFinite(ratio) || ratio <= 0) return 1;
    // Cap so a near-zero layout width can't turn 1px of pointer movement into a huge document delta
    return Math.min(Math.max(ratio, 0.02), 50);
  }, [effectiveIframe, safeW]);

  const sendTransform = useCallback(
    (newTx: number, newTy: number, newRot: number, newSx: number, newSy: number) => {
      const maxT = Math.max(safeW, safeH, 800) * 3;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const ctx = clamp(newTx, -maxT, maxT);
      const cty = clamp(newTy, -maxT, maxT);
      const csx = clamp(newSx, 0.05, 8);
      const csy = clamp(newSy, 0.05, 8);
      let crot = newRot;
      while (crot > 180) crot -= 360;
      while (crot < -180) crot += 360;

      const transformStr = buildTransformString(ctx, cty, crot, csx, csy);
      setTx(ctx);
      setTy(cty);
      setRot(crot);
      setSx(csx);
      setSy(csy);
      patchBrushTransform(brushSel, transformStr);
    },
    [brushSel, patchBrushTransform, safeW, safeH],
  );

  // Hydrate once when iteration / brush / iframe changes — NOT on every __brushTransform__ save (that re-ran every drag frame and could fight local state).
  useEffect(() => {
    const map = readBrushMap(useEditorStore.getState().slotValues);
    const saved = map[brushSel];
    if (saved) {
      const p = parseTransform(saved);
      setTx(p.translateX);
      setTy(p.translateY);
      setRot(p.rotateDeg);
      setSx(p.scaleX);
      setSy(p.scaleY);
      return;
    }
    const applyDom = () => {
      if (!effectiveIframe?.contentDocument) return;
      try {
        const el = effectiveIframe.contentDocument.querySelector(brushSel) as HTMLElement | null;
        if (!el) return;
        const cs = effectiveIframe.contentDocument.defaultView?.getComputedStyle(el);
        if (!cs) return;
        const parsed = parseTransformFromComputed(cs.transform);
        // Important: do NOT seed tx/ty from CSS left/top.
        // left/top are base layout positioning; tx/ty should represent only transform translate().
        // Mixing them causes a double offset on first drag (element jumps off-canvas).
        setTx(parsed.translateX);
        setTy(parsed.translateY);
        setRot(parsed.rotateDeg);
        setSx(parsed.scaleX);
        setSy(parsed.scaleY);
      } catch {
        /* ignore */
      }
    };
    applyDom();
    effectiveIframe?.addEventListener('load', applyDom);
    return () => effectiveIframe?.removeEventListener('load', applyDom);
  }, [brushSel, selectedIterationId, effectiveIframe]);

  useLayoutEffect(() => {
    const obs = new ResizeObserver(() => setLayoutVersion((t) => t + 1));
    if (effectiveIframe) obs.observe(effectiveIframe);
    const onScroll = () => setLayoutVersion((t) => t + 1);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [effectiveIframe]);

  /** Last non-null rect so a single bad layout frame doesn’t unmount the portal (box “vanishes”). */
  const lastScreenRectRef = useRef<DOMRect | null>(null);
  /** Last oriented overlay layout (un-scaled W/H in parent px + pivot). */
  const lastOverlayLayoutRef = useRef<{
    layoutW: number;
    layoutH: number;
    pivotCx: number;
    pivotCy: number;
    ox: number;
    oy: number;
    left: number;
    top: number;
  } | null>(null);
  /** Last rotation-invariant iframe px size (never AABB) so scale/rotate maths stay stable. */
  const rotationInvariantLayoutIframeRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    lastScreenRectRef.current = null;
    lastOverlayLayoutRef.current = null;
    rotationInvariantLayoutIframeRef.current = null;
  }, [brushSel, selectedIterationId]);

  const screenRect = useMemo(() => {
    const r = getBrushScreenRect(effectiveIframe, brushSel);
    if (r && r.width > 0 && r.height > 0) {
      lastScreenRectRef.current = r;
      return r;
    }
    return lastScreenRectRef.current;
    // layoutVersion: scroll/resize must re-measure; tx..sy: transform updates DOM bbox
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIframe, brushSel, tx, ty, rot, sx, sy, layoutVersion]);

  /**
   * Layout size = iframe element offsetWidth/Height mapped to parent pixels (pre-transform).
   * Pivot = axis-aligned bounds center in parent px (stable centroid for rotated rects).
   * The portal root applies the same rotate + scale as the brush so the frame rotates with the asset.
   */
  const overlayLayout = useMemo(() => {
    const aabb = screenRect;
    if (!effectiveIframe?.contentDocument || !aabb || aabb.width <= 0 || aabb.height <= 0) {
      return lastOverlayLayoutRef.current;
    }
    const el = effectiveIframe.contentDocument.querySelector(brushSel);
    if (!el) {
      return lastOverlayLayoutRef.current;
    }
    const iframeRect = effectiveIframe.getBoundingClientRect();
    const iw =
      effectiveIframe.offsetWidth ||
      effectiveIframe.contentDocument.documentElement?.clientWidth ||
      1;
    const ih =
      effectiveIframe.offsetHeight ||
      effectiveIframe.contentDocument.documentElement?.clientHeight ||
      1;
    const scaleXi = iw > 0 ? iframeRect.width / iw : 1;
    const scaleYi = ih > 0 ? iframeRect.height / ih : 1;
    let layoutIframe = getBrushRotationInvariantLayoutSize(el);
    if (layoutIframe) {
      rotationInvariantLayoutIframeRef.current = layoutIframe;
    } else {
      layoutIframe = rotationInvariantLayoutIframeRef.current;
    }
    if (!layoutIframe) {
      const boot = bootstrapLayoutFromBBox(el);
      if (boot) {
        layoutIframe = boot;
        rotationInvariantLayoutIframeRef.current = boot;
      }
    }
    if (!layoutIframe) {
      return lastOverlayLayoutRef.current;
    }
    const layoutW = layoutIframe.w * scaleXi;
    const layoutH = layoutIframe.h * scaleYi;
    const pivotCx = aabb.left + aabb.width / 2;
    const pivotCy = aabb.top + aabb.height / 2;
    const ox = OVERLAY_PAD + layoutW / 2;
    const oy = OVERLAY_PAD + layoutH / 2;
    const out = {
      layoutW,
      layoutH,
      pivotCx,
      pivotCy,
      ox,
      oy,
      left: pivotCx - ox,
      top: pivotCy - oy,
    };
    lastOverlayLayoutRef.current = out;
    return out;
  }, [effectiveIframe, brushSel, screenRect, layoutVersion]);

  const displayName = brushLabel ?? 'element';

  const attachPointerDrag = useCallback(
    (session: DragSession, target: Element, pointerId: number) => {
      dragRef.current = session;
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* capture unsupported or target detached */
      }

      // Full-screen veil: once the pointer leaves the small portal, hit-testing targets the *iframe*
      // and events are delivered to the nested document — parent `document` listeners never see them.
      // A transparent fixed layer above everything keeps move/scale/rotate working until release.
      const veil = document.createElement('div');
      const veilCursor =
        session.mode === 'move'
          ? 'move'
          : session.mode === 'rotate'
            ? 'grabbing'
            : session.scaleCorner
              ? scaleCursorForCorner(session.scaleCorner)
              : 'nwse-resize';
      veil.style.cssText = [
        'position:fixed',
        'inset:0',
        `z-index:${OVERLAY_Z + 500}`,
        'touch-action:none',
        'background:transparent',
        `cursor:${veilCursor}`,
      ].join(';');
      document.body.appendChild(veil);

      let moveApplied = false;
      let ended = false;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const rel = dragRef.current;
        if (!rel) return;
        const scale = iframeScale();
        if (!Number.isFinite(scale) || scale <= 0) return;
        if (rel.mode === 'move') {
          const dxScreen = ev.clientX - rel.startX;
          const dyScreen = ev.clientY - rel.startY;
          // Ignore a tiny initial jitter only until we’ve committed to a real drag
          if (!moveApplied && Math.hypot(dxScreen, dyScreen) < 2) return;
          moveApplied = true;
          const dx = dxScreen / scale;
          const dy = dyScreen / scale;
          sendTransform(rel.startTx + dx, rel.startTy + dy, rel.startRot, rel.startSx, rel.startSy);
        } else if (
          rel.mode === 'scale' &&
          rel.scaleCorner != null &&
          rel.anchorX != null &&
          rel.anchorY != null &&
          rel.cornerStartX != null &&
          rel.cornerStartY != null &&
          rel.anchorVx != null &&
          rel.anchorVy != null
        ) {
          // Corner scale with opposite corner fixed; independent X/Y scaling.
          const ax = rel.anchorX;
          const ay = rel.anchorY;
          if (!rel.halfW || !rel.halfH || !rel.signX || !rel.signY) return;
          const mx = ev.clientX - ax;
          const my = ev.clientY - ay;
          const rad = (rel.startRot * Math.PI) / 180;
          const c = Math.cos(rad);
          const s = Math.sin(rad);
          // Convert screen vector into local (pre-rotation) space.
          const localX = c * mx + s * my;
          const localY = -s * mx + c * my;
          const targetSx = (rel.signX * localX) / (2 * rel.halfW);
          const targetSy = (rel.signY * localY) / (2 * rel.halfH);
          const s1x = Math.min(8, Math.max(0.05, targetSx));
          const s1y = Math.min(8, Math.max(0.05, targetSy));
          const dvx = (rel.startSx - s1x) * rel.anchorVx;
          const dvy = (rel.startSy - s1y) * rel.anchorVy;
          const dTx = c * dvx - s * dvy;
          const dTy = s * dvx + c * dvy;
          sendTransform(rel.startTx + dTx, rel.startTy + dTy, rel.startRot, s1x, s1y);
        } else if (
          rel.mode === 'rotate' &&
          rel.cx != null &&
          rel.cy != null &&
          rel.startAngle != null
        ) {
          const ang = (Math.atan2(ev.clientY - rel.cy, ev.clientX - rel.cx) * 180) / Math.PI;
          sendTransform(
            rel.startTx,
            rel.startTy,
            rel.startRot + (ang - rel.startAngle),
            rel.startSx,
            rel.startSy,
          );
        }
      };

      const onMoveDom: EventListener = (ev) => onMove(ev as PointerEvent);

      const cleanup = (ev?: PointerEvent) => {
        if (ev && ev.pointerId !== pointerId) return;
        if (ended) return;
        ended = true;
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
        dragRef.current = null;
        veil.removeEventListener('pointermove', onMoveDom);
        veil.removeEventListener('pointerup', cleanup as EventListener);
        veil.removeEventListener('pointercancel', cleanup as EventListener);
        target.removeEventListener('pointermove', onMoveDom);
        target.removeEventListener('pointerup', cleanupDom);
        target.removeEventListener('pointercancel', cleanupDom);
        target.removeEventListener('lostpointercapture', onLostCapture);
        veil.remove();
        setLayoutVersion((v) => v + 1);
      };

      const cleanupDom = ((ev: Event) => cleanup(ev as PointerEvent)) as EventListener;

      const onLostCapture = (ev: Event) => {
        const pe = ev as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        cleanup(pe);
      };

      // Veil: when pointer capture fails, moves over the iframe still hit this layer.
      veil.addEventListener('pointermove', onMoveDom, { passive: false });
      veil.addEventListener('pointerup', cleanup as EventListener);
      veil.addEventListener('pointercancel', cleanup as EventListener);
      // Target: when capture succeeds, the browser retargets events to this node (not the veil).
      target.addEventListener('pointermove', onMoveDom, { passive: false });
      target.addEventListener('pointerup', cleanupDom);
      target.addEventListener('pointercancel', cleanupDom);
      target.addEventListener('lostpointercapture', onLostCapture);
    },
    [iframeScale, sendTransform],
  );

  const startMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    attachPointerDrag(
      {
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        startRot: rot,
        startSx: sx,
        startSy: sy,
      },
      e.currentTarget,
      e.pointerId,
    );
  };

  /** Scale from this corner; opposite corner stays put (Figma / Illustrator-style). */
  const startScaleCorner = (e: React.PointerEvent, corner: ScaleCorner) => {
    e.preventDefault();
    e.stopPropagation();
    const ol = overlayLayout;
    if (!ol || !effectiveIframe?.contentDocument) return;
    const el = effectiveIframe.contentDocument.querySelector(brushSel);
    if (!el) return;
    let layoutIframe = getBrushRotationInvariantLayoutSize(el);
    if (layoutIframe) {
      rotationInvariantLayoutIframeRef.current = layoutIframe;
    } else {
      layoutIframe = rotationInvariantLayoutIframeRef.current;
    }
    if (!layoutIframe) {
      const boot = bootstrapLayoutFromBBox(el);
      if (boot) {
        layoutIframe = boot;
        rotationInvariantLayoutIframeRef.current = boot;
      }
    }
    if (!layoutIframe) return;
    const hwI = layoutIframe.w / 2;
    const hhI = layoutIframe.h / 2;
    const anchorCorner = oppositeScaleCorner(corner);
    const cornerOffset = localCornerOffset(corner, hwI, hhI);
    const { vx: avx, vy: avy } = localCornerOffset(anchorCorner, hwI, hhI);
    const anchorPx = cornerScreenPx(ol, anchorCorner, ol.layoutW, ol.layoutH, rot, sx, sy);
    const handlePx = cornerScreenPx(ol, corner, ol.layoutW, ol.layoutH, rot, sx, sy);
    attachPointerDrag(
      {
        mode: 'scale',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        startRot: rot,
        startSx: sx,
        startSy: sy,
        scaleCorner: corner,
        anchorX: anchorPx.x,
        anchorY: anchorPx.y,
        cornerStartX: handlePx.x,
        cornerStartY: handlePx.y,
        halfW: hwI,
        halfH: hhI,
        signX: cornerOffset.vx >= 0 ? 1 : -1,
        signY: cornerOffset.vy >= 0 ? 1 : -1,
        anchorVx: avx,
        anchorVy: avy,
      },
      e.currentTarget,
      e.pointerId,
    );
  };

  /** Rotate from a hotspot just outside each corner; pivot remains center of the box. */
  const startRotateCorner = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ol = overlayLayout;
    const cx = ol ? ol.pivotCx : screenRect ? screenRect.left + screenRect.width / 2 : NaN;
    const cy = ol ? ol.pivotCy : screenRect ? screenRect.top + screenRect.height / 2 : NaN;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    const startAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    attachPointerDrag(
      {
        mode: 'rotate',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        startRot: rot,
        startSx: sx,
        startSy: sy,
        startAngle,
        cx,
        cy,
      },
      e.currentTarget,
      e.pointerId,
    );
  };

  /** Corner hit target: large invisible tap area, small visible knob centered. */
  const cornerHitBox = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: CORNER_HIT,
    height: CORNER_HIT,
    marginLeft: -CORNER_HIT / 2,
    marginTop: -CORNER_HIT / 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor,
    touchAction: 'none',
    pointerEvents: 'auto',
    zIndex: 10,
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    // Parent overlay scales with the object; inverse scale keeps corner handles fixed-size on screen.
    transform: `scale(${1 / Math.max(sx, 1e-3)}, ${1 / Math.max(sy, 1e-3)})`,
    transformOrigin: 'center center',
  });

  const cornerKnob: React.CSSProperties = {
    width: HANDLE,
    height: HANDLE,
    backgroundColor: '#44B2FF',
    border: '2px solid #fff',
    borderRadius: 2,
    boxSizing: 'border-box',
    flexShrink: 0,
    pointerEvents: 'none',
  };

  const rotateHotspot = (corner: ScaleCorner): React.CSSProperties => {
    let left = OVERLAY_PAD;
    let top = OVERLAY_PAD;
    if (corner === 'ne' || corner === 'se') left = OVERLAY_PAD + (ol?.layoutW ?? 0);
    if (corner === 'sw' || corner === 'se') top = OVERLAY_PAD + (ol?.layoutH ?? 0);
    if (corner === 'nw' || corner === 'sw') left -= ROTATE_OFFSET;
    if (corner === 'ne' || corner === 'se') left += ROTATE_OFFSET;
    if (corner === 'nw' || corner === 'ne') top -= ROTATE_OFFSET;
    if (corner === 'sw' || corner === 'se') top += ROTATE_OFFSET;
    return {
      position: 'absolute',
      left,
      top,
      width: ROTATE_HIT,
      height: ROTATE_HIT,
      marginLeft: -ROTATE_HIT / 2,
      marginTop: -ROTATE_HIT / 2,
      pointerEvents: 'auto',
      touchAction: 'none',
      cursor: 'grab',
      background: 'transparent',
      zIndex: 11,
    };
  };

  const ol = overlayLayout;
  const overlay =
    ol &&
    createPortal(
      <div
        style={{
          position: 'fixed',
          left: ol.left,
          top: ol.top,
          width: ol.layoutW + 2 * OVERLAY_PAD,
          height: ol.layoutH + 2 * OVERLAY_PAD,
          zIndex: OVERLAY_Z,
          pointerEvents: 'none',
          transform: `rotate(${rot}deg) scale(${sx}, ${sy})`,
          transformOrigin: `${ol.ox}px ${ol.oy}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: OVERLAY_PAD,
            top: OVERLAY_PAD,
            width: ol.layoutW,
            height: ol.layoutH,
            boxSizing: 'border-box',
            border: '2px solid rgba(68, 178, 255, 0.95)',
            borderRadius: 4,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
        <div
          onPointerDown={startMove}
          style={{
            position: 'absolute',
            left: OVERLAY_PAD + MOVE_HIT_INSET,
            top: OVERLAY_PAD + MOVE_HIT_INSET,
            width: Math.max(24, ol.layoutW - MOVE_HIT_INSET * 2),
            height: Math.max(24, ol.layoutH - MOVE_HIT_INSET * 2),
            borderRadius: 3,
            pointerEvents: 'auto',
            cursor: 'move',
            touchAction: 'none',
            background: 'transparent',
            zIndex: 1,
          }}
          title={`Drag ${displayName}`}
        />
        {/* Scale corners — large hit targets so scale/gesture wins over move */}
        <div
          onPointerDown={(ev) => startScaleCorner(ev, 'nw')}
          style={{ ...cornerHitBox('nwse-resize'), left: OVERLAY_PAD, top: OVERLAY_PAD }}
          title="Scale from corner"
        >
          <div style={cornerKnob} />
        </div>
        <div
          onPointerDown={(ev) => startScaleCorner(ev, 'ne')}
          style={{
            ...cornerHitBox('nesw-resize'),
            left: OVERLAY_PAD + ol.layoutW,
            top: OVERLAY_PAD,
          }}
          title="Scale from corner"
        >
          <div style={cornerKnob} />
        </div>
        <div
          onPointerDown={(ev) => startScaleCorner(ev, 'sw')}
          style={{
            ...cornerHitBox('nesw-resize'),
            left: OVERLAY_PAD,
            top: OVERLAY_PAD + ol.layoutH,
          }}
          title="Scale from corner"
        >
          <div style={cornerKnob} />
        </div>
        <div
          onPointerDown={(ev) => startScaleCorner(ev, 'se')}
          style={{
            ...cornerHitBox('nwse-resize'),
            left: OVERLAY_PAD + ol.layoutW,
            top: OVERLAY_PAD + ol.layoutH,
          }}
          title="Scale from corner"
        >
          <div style={cornerKnob} />
        </div>
        {/* Rotate hotspots: slightly outside corners; show icon only on hover. */}
        {(['nw', 'ne', 'sw', 'se'] as ScaleCorner[]).map((corner) => (
          <div
            key={`rot-${corner}`}
            onPointerDown={startRotateCorner}
            onPointerEnter={() => setHoverRotateCorner(corner)}
            onPointerLeave={() => setHoverRotateCorner((prev) => (prev === corner ? null : prev))}
            style={rotateHotspot(corner)}
            title="Rotate"
          />
        ))}
        {hoverRotateCorner && (
          <div
            style={{
              ...rotateHotspot(hoverRotateCorner),
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#44B2FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div style={styles.container}>
      {overlay}
      <div style={styles.hint}>
        Drag to move, pull corners to scale width/height independently. Hover slightly past a corner
        to show rotate, then drag there to rotate around center.
      </div>

      <div style={styles.grid}>
        <NumberField
          label="X (px)"
          value={tx}
          step={1}
          onChange={(v) => sendTransform(v, ty, rot, sx, sy)}
        />
        <NumberField
          label="Y (px)"
          value={ty}
          step={1}
          onChange={(v) => sendTransform(tx, v, rot, sx, sy)}
        />
        <NumberField
          label="Rotate °"
          value={rot}
          step={0.5}
          onChange={(v) => sendTransform(tx, ty, v, sx, sy)}
        />
        <div />
        <NumberField
          label="Scale W %"
          value={Math.round(sx * 100)}
          step={1}
          onChange={(v) => sendTransform(tx, ty, rot, v / 100, sy)}
        />
        <NumberField
          label="Scale H %"
          value={Math.round(sy * 100)}
          step={1}
          onChange={(v) => sendTransform(tx, ty, rot, sx, v / 100)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={styles.numberInput}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontSize: '0.8rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
    marginBottom: '0.75rem',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  numberInput: {
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '4px 6px',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
};
