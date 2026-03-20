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

export function parseTransform(transform: string): ParsedTransform {
  const result: ParsedTransform = { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 };
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

export function buildTransformString(tx: number, ty: number, rot: number, sx: number, sy: number): string {
  return `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
}
