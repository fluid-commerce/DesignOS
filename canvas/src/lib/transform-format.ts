/**
 * Shared CSS transform string helpers for template element editing.
 */

export interface ParsedTransform {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
}

/** Whole layout pixels — avoids 892.478… in sidebar and user-state after drag / matrix parse. */
export function roundLayoutTranslatePx(n: number): number {
  return Math.round(n);
}

/** Enough precision for rotate handle; strips float noise from atan2 / matrix. */
export function roundLayoutRotateDeg(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseTransform(transform: string): ParsedTransform {
  const result: ParsedTransform = {
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
  if (!transform || transform === 'none') return result;
  const tx = transform.match(/translate\(([^,)]+),\s*([^)]+)\)/);
  if (tx) {
    result.translateX = roundLayoutTranslatePx(parseFloat(tx[1]) || 0);
    result.translateY = roundLayoutTranslatePx(parseFloat(tx[2]) || 0);
  }
  const rot = transform.match(/rotate\(([^)]+)deg\)/);
  if (rot) result.rotateDeg = roundLayoutRotateDeg(parseFloat(rot[1]) || 0);
  const sc = transform.match(/scale\(([^,)]+)(?:,\s*([^)]+))?\)/);
  if (sc) {
    result.scaleX = parseFloat(sc[1]) || 1;
    result.scaleY = sc[2] != null ? parseFloat(sc[2]) || 1 : result.scaleX;
  }
  return result;
}

function getDOMMatrixReadOnlyCtor(win?: Window | null): typeof DOMMatrixReadOnly | null {
  const g = win ?? (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!g) return null;
  const Ctor = (g as unknown as { DOMMatrixReadOnly?: typeof DOMMatrixReadOnly }).DOMMatrixReadOnly;
  return typeof Ctor === 'function' ? Ctor : null;
}

/**
 * Parse a **computed** `transform` from the browser (often `matrix(...)` / `matrix3d(...)`).
 * Regex-only {@link parseTransform} misses rotation/scale for those, which caused the editor to
 * apply `rotate(0deg)` on first move and wipe template CSS like `rotate(90deg)` on side labels.
 */
export function parseTransformComputed(transform: string, win?: Window | null): ParsedTransform {
  const identity: ParsedTransform = {
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
  const t = transform?.trim() || '';
  if (!t || t === 'none') return identity;

  const MatrixRO = getDOMMatrixReadOnlyCtor(win);
  if (MatrixRO) {
    try {
      const m = new MatrixRO(t);
      const scaleX = Math.hypot(m.a, m.b) || 1;
      const scaleY = Math.hypot(m.c, m.d) || 1;
      const rotateDeg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      return {
        translateX: roundLayoutTranslatePx(m.e),
        translateY: roundLayoutTranslatePx(m.f),
        rotateDeg: roundLayoutRotateDeg(rotateDeg),
        scaleX,
        scaleY,
      };
    } catch {
      /* fall through */
    }
  }

  return parseTransform(t);
}

export function buildTransformString(
  tx: number,
  ty: number,
  rot: number,
  sx: number,
  sy: number,
): string {
  const rtx = roundLayoutTranslatePx(tx);
  const rty = roundLayoutTranslatePx(ty);
  const rrot = roundLayoutRotateDeg(rot);
  return `translate(${rtx}px, ${rty}px) rotate(${rrot}deg) scale(${sx}, ${sy})`;
}
