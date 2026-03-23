/**
 * Smart alignment when dragging layout transforms in the preview (axis-aligned bbox only).
 *
 * Snaps only:
 * - Edge ↔ edge (incl. artboard left/right or top/bottom)
 * - Mid ↔ mid (element center ↔ element center, or element center ↔ artboard center)
 * - Safe margin lines inset {@link ARTBOARD_SAFE_MARGIN_PX} from artboard edges (layout space)
 */

export const DEFAULT_SNAP_THRESHOLD_PX = 8;

import { elementLayoutRectInIframe } from './iframe-overlay-geometry';
import { ARTBOARD_SAFE_MARGIN_PX } from './preview-utils';

function safeMarginInset(dim: number): number {
  const m = ARTBOARD_SAFE_MARGIN_PX;
  return dim > 2 * m ? m : 0;
}

export interface LRect {
  l: number;
  t: number;
  r: number;
  b: number;
  w: number;
  h: number;
}

/** Element rect in iframe layout CSS pixels (matches TransformOverlay / pointer math). */
export function elementRectInIframeLayout(iframe: HTMLIFrameElement, el: Element): LRect {
  const { l, t, w, h } = elementLayoutRectInIframe(iframe, el);
  return { l, t, r: l + w, b: t + h, w, h };
}

/** Vertical lines for **edge** snapping: artboard left/right + other elements’ left/right only. */
export function collectSnapEdgeLinesX(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardW: number
): number[] {
  const xs = new Set<number>();
  xs.add(0);
  xs.add(artboardW);
  const mx = safeMarginInset(artboardW);
  if (mx > 0) {
    xs.add(mx);
    xs.add(artboardW - mx);
  }
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    xs.add(r.l);
    xs.add(r.r);
  }
  return [...xs];
}

/** Vertical lines for **center** snapping: artboard horizontal mid + other elements’ horizontal mids. */
export function collectSnapMidLinesX(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardW: number
): number[] {
  const xs = new Set<number>();
  xs.add(artboardW / 2);
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    xs.add((r.l + r.r) / 2);
  }
  return [...xs];
}

/** Horizontal lines for **edge** snapping: artboard top/bottom + other elements’ top/bottom. */
export function collectSnapEdgeLinesY(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardH: number
): number[] {
  const ys = new Set<number>();
  ys.add(0);
  ys.add(artboardH);
  const my = safeMarginInset(artboardH);
  if (my > 0) {
    ys.add(my);
    ys.add(artboardH - my);
  }
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    ys.add(r.t);
    ys.add(r.b);
  }
  return [...ys];
}

/** Horizontal lines for **center** snapping: artboard vertical mid + other elements’ vertical mids. */
export function collectSnapMidLinesY(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardH: number
): number[] {
  const ys = new Set<number>();
  ys.add(artboardH / 2);
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    ys.add((r.t + r.b) / 2);
  }
  return [...ys];
}

export interface Snap1DResult {
  /** Amount to add to translate (tx or ty). */
  delta: number;
  /** Target line position for drawing a guide (layout space). */
  guidePos?: number;
  /** Shortest distance to a target; `Infinity` if nothing within threshold. */
  dist: number;
}

/**
 * Pick the smallest-distance snap among allowed position ↔ target pairs within threshold.
 */
export function snapTranslate1D(
  positions: readonly number[],
  targets: readonly number[],
  threshold: number
): Snap1DResult {
  let bestDist = threshold + 1;
  let bestCorr = 0;
  let guidePos: number | undefined;

  for (const pos of positions) {
    for (const t of targets) {
      const dist = Math.abs(pos - t);
      if (dist < bestDist) {
        bestDist = dist;
        bestCorr = t - pos;
        guidePos = t;
      }
    }
  }

  if (bestDist > threshold) return { delta: 0, dist: Infinity };
  return { delta: bestCorr, guidePos, dist: bestDist };
}

/** Prefer the tighter snap when both edge- and mid-based snaps are valid. */
export function pickCloserSnap(a: Snap1DResult, b: Snap1DResult, threshold: number): Snap1DResult {
  const aOk = a.dist <= threshold;
  const bOk = b.dist <= threshold;
  if (aOk && bOk) {
    return a.dist <= b.dist
      ? { delta: a.delta, guidePos: a.guidePos, dist: a.dist }
      : { delta: b.delta, guidePos: b.guidePos, dist: b.dist };
  }
  if (aOk) return { delta: a.delta, guidePos: a.guidePos, dist: a.dist };
  if (bOk) return { delta: b.delta, guidePos: b.guidePos, dist: b.dist };
  return { delta: 0, dist: Infinity };
}

export function canSnapAxisAlignedTransform(rotDeg: number, sx: number, sy: number): boolean {
  return (
    Math.abs(rotDeg) < 0.75 &&
    Math.abs(sx - 1) < 0.04 &&
    Math.abs(sy - 1) < 0.04
  );
}

const MIN_SNAP_WIDTH = 32;
const MIN_SNAP_HEIGHT = 24;

/** Other elements’ rounded widths + full artboard width (for “same width” resize snaps). */
export function collectSnapWidths(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardW: number
): number[] {
  const ws = new Set<number>();
  ws.add(Math.round(artboardW));
  const mx = safeMarginInset(artboardW);
  if (mx > 0) ws.add(Math.round(artboardW - 2 * mx));
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    if (r.w >= MIN_SNAP_WIDTH) ws.add(Math.round(r.w));
  }
  return [...ws];
}

/** Other elements’ rounded heights + full artboard height. */
export function collectSnapHeights(
  doc: Document,
  iframe: HTMLIFrameElement,
  targetSels: readonly string[],
  excludeSel: string | null,
  artboardH: number
): number[] {
  const hs = new Set<number>();
  hs.add(Math.round(artboardH));
  const my = safeMarginInset(artboardH);
  if (my > 0) hs.add(Math.round(artboardH - 2 * my));
  for (const s of targetSels) {
    if (!s || s === excludeSel) continue;
    const el = doc.querySelector(s);
    if (!el) continue;
    const r = elementRectInIframeLayout(iframe, el);
    if (r.h >= MIN_SNAP_HEIGHT) hs.add(Math.round(r.h));
  }
  return [...hs];
}

export interface SnapDimensionResult {
  value: number;
  snappedTo?: number;
  dist: number;
}

/** Snap a raw width/height to the nearest target (px). */
export function snapDimensionToTargets(
  raw: number,
  targets: readonly number[],
  threshold: number,
  min: number
): SnapDimensionResult {
  let bestDist = threshold + 1;
  let best = raw;
  let snappedTo: number | undefined;
  for (const t of targets) {
    if (t < min) continue;
    const d = Math.abs(raw - t);
    if (d < bestDist) {
      bestDist = d;
      best = t;
      snappedTo = t;
    }
  }
  if (bestDist > threshold) return { value: raw, dist: Infinity };
  return { value: best, snappedTo, dist: bestDist };
}

interface ScalarSnapCandidate {
  dist: number;
}

export function pickBestScalarSnap<T extends ScalarSnapCandidate>(
  candidates: readonly (T | null | undefined)[],
  threshold: number
): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (!c || c.dist > threshold) continue;
    if (!best || c.dist < best.dist) best = c;
  }
  return best;
}

/**
 * Horizontal scale snap (axis-aligned, scale from center): match width or moving vertical edge.
 * `side` = which side of the box moves when sx increases (east = right side out, west = left side out).
 */
export function snapScaleSx(
  nW: number,
  rawSx: number,
  scaleCX: number,
  side: 'east' | 'west',
  widthTargets: readonly number[],
  edgeX: readonly number[],
  threshold: number,
  minScale: number
): number {
  const hypoW = nW * rawSx;
  const minW = nW * minScale;

  const dim = snapDimensionToTargets(hypoW, widthTargets, threshold, minW);
  const candDim =
    dim.dist <= threshold ? { dist: dim.dist, sx: dim.value / nW } : null;

  if (side === 'east') {
    const hypoR = scaleCX + hypoW / 2;
    const edge = snapTranslate1D([hypoR], edgeX, threshold);
    const newW = hypoW + 2 * edge.delta;
    const candEdge =
      edge.dist <= threshold && newW >= minW ? { dist: edge.dist, sx: newW / nW } : null;
    const best = pickBestScalarSnap([candDim, candEdge], threshold);
    return best ? best.sx : rawSx;
  }

  const hypoL = scaleCX - hypoW / 2;
  const edge = snapTranslate1D([hypoL], edgeX, threshold);
  const newL = hypoL + edge.delta;
  const newW = 2 * (scaleCX - newL);
  const candEdge =
    edge.dist <= threshold && newW >= minW ? { dist: edge.dist, sx: newW / nW } : null;
  const best = pickBestScalarSnap([candDim, candEdge], threshold);
  return best ? best.sx : rawSx;
}

/** Vertical scale snap (scale from center). */
export function snapScaleSy(
  nH: number,
  rawSy: number,
  scaleCY: number,
  side: 'south' | 'north',
  heightTargets: readonly number[],
  edgeY: readonly number[],
  threshold: number,
  minScale: number
): number {
  const hypoH = nH * rawSy;
  const minH = nH * minScale;

  const dim = snapDimensionToTargets(hypoH, heightTargets, threshold, minH);
  const candDim =
    dim.dist <= threshold ? { dist: dim.dist, sy: dim.value / nH } : null;

  if (side === 'south') {
    const hypoB = scaleCY + hypoH / 2;
    const edge = snapTranslate1D([hypoB], edgeY, threshold);
    const newH = hypoH + 2 * edge.delta;
    const candEdge =
      edge.dist <= threshold && newH >= minH ? { dist: edge.dist, sy: newH / nH } : null;
    const best = pickBestScalarSnap([candDim, candEdge], threshold);
    return best ? best.sy : rawSy;
  }

  const hypoT = scaleCY - hypoH / 2;
  const edge = snapTranslate1D([hypoT], edgeY, threshold);
  const newT = hypoT + edge.delta;
  const newH = 2 * (scaleCY - newT);
  const candEdge =
    edge.dist <= threshold && newH >= minH ? { dist: edge.dist, sy: newH / nH } : null;
  const best = pickBestScalarSnap([candDim, candEdge], threshold);
  return best ? best.sy : rawSy;
}

/** Map one iframe-layout X to parent overlay SVG coordinates. */
export function layoutScalarToOverlayX(
  iframe: HTMLIFrameElement,
  wrap: HTMLElement,
  lxLayout: number
): number {
  const ir = iframe.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const sX = ir.width / (iframe.offsetWidth || 1);
  return ir.left + lxLayout * sX - wr.left;
}

/** Map one iframe-layout Y to parent overlay SVG coordinates. */
export function layoutScalarToOverlayY(
  iframe: HTMLIFrameElement,
  wrap: HTMLElement,
  lyLayout: number
): number {
  const ir = iframe.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const sY = ir.height / (iframe.offsetHeight || 1);
  return ir.top + lyLayout * sY - wr.top;
}
