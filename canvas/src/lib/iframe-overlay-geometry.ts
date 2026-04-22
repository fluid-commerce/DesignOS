/**
 * getBoundingClientRect() for nodes inside a sandboxed iframe is inconsistent across engines:
 * - Some report geometry in the **embedding** document’s viewport (aligned with iframe’s border box).
 * - Others (notably Chromium) report in the **iframe document’s** viewport (origin at iframe content;
 *   values are template/layout CSS px and must be scaled by ir.width/iframe.offsetWidth to match the
 *   scaled iframe on screen).
 *
 * Using the wrong mapping puts Transform/TextBox overlays and handles off the actual pixels.
 */

export type IframeClientRectMode = 'embedder' | 'document';

const cachedModeIframe: WeakMap<HTMLIFrameElement, IframeClientRectMode> = new WeakMap();

/**
 * Detect how this browser reports rects for content inside `iframe`.
 * Cached per iframe instance (mode does not change at runtime).
 */
export function getIframeClientRectMode(iframe: HTMLIFrameElement): IframeClientRectMode {
  const hit = cachedModeIframe.get(iframe);
  if (hit) return hit;

  let mode: IframeClientRectMode = 'document';
  try {
    const doc = iframe.contentDocument;
    const root = doc?.documentElement;
    if (root) {
      const ir = iframe.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      /* Embeddng: root’s painted top-left matches the iframe’s border box in the parent frame. */
      const aligned = Math.abs(rr.left - ir.left) < 4 && Math.abs(rr.top - ir.top) < 4;
      mode = aligned ? 'embedder' : 'document';
    }
  } catch {
    mode = 'document';
  }

  cachedModeIframe.set(iframe, mode);
  return mode;
}

/** Invalidate cache (e.g. after navigation). */
export function clearIframeClientRectModeCache(iframe: HTMLIFrameElement): void {
  cachedModeIframe.delete(iframe);
}

/**
 * Map a template element’s rect to coordinates inside `wrap` (same space as snap guides:
 * `ir.left + layoutX * sX - wr.left`).
 */
export function elementRectToWrapOverlay(
  iframe: HTMLIFrameElement,
  wrap: HTMLElement,
  el: Element,
): { x: number; y: number; w: number; h: number } {
  const er = el.getBoundingClientRect();
  const ir = iframe.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const sX = ir.width / (iframe.offsetWidth || 1);
  const sY = ir.height / (iframe.offsetHeight || 1);

  if (getIframeClientRectMode(iframe) === 'embedder') {
    return {
      x: er.left - wr.left,
      y: er.top - wr.top,
      w: er.width,
      h: er.height,
    };
  }

  return {
    x: ir.left + er.left * sX - wr.left,
    y: ir.top + er.top * sY - wr.top,
    w: er.width * sX,
    h: er.height * sY,
  };
}

/**
 * Rotation-aware overlay geometry for an element inside the iframe.
 * Returns the element's un-rotated width/height, visual center in overlay coords,
 * and the rotation angle in degrees.  Used by TransformOverlay to draw a bounding
 * box that rotates with the element instead of an axis-aligned rectangle.
 */
export function elementRotatedOverlayInfo(
  iframe: HTMLIFrameElement,
  wrap: HTMLElement,
  el: HTMLElement,
): { cx: number; cy: number; w: number; h: number; rotDeg: number } | null {
  const ir = iframe.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const sX = ir.width / (iframe.offsetWidth || 1);
  const sY = ir.height / (iframe.offsetHeight || 1);

  /* Un-rotated natural dimensions — offsetWidth/Height are NOT affected by CSS transforms */
  const nW = el.offsetWidth;
  const nH = el.offsetHeight;
  if (!nW || !nH) return null;

  /* Decompose rotation from the current CSS transform */
  let rotDeg = 0;
  try {
    const win = iframe.contentWindow;
    if (win) {
      const cs = win.getComputedStyle(el);
      const t = cs.transform;
      if (t && t !== 'none') {
        const MatrixRO = (win as unknown as { DOMMatrixReadOnly?: typeof DOMMatrixReadOnly })
          .DOMMatrixReadOnly;
        if (typeof MatrixRO === 'function') {
          const m = new MatrixRO(t);
          rotDeg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        }
      }
    }
  } catch {
    /* ignore */
  }

  /* Visual center: getBoundingClientRect gives the AABB of the rotated element.
     The center of the AABB equals the center of the rotated element. */
  const er = el.getBoundingClientRect();
  const mode = getIframeClientRectMode(iframe);
  let cx: number;
  let cy: number;
  if (mode === 'embedder') {
    cx = er.left + er.width / 2 - wr.left;
    cy = er.top + er.height / 2 - wr.top;
  } else {
    cx = ir.left + (er.left + er.width / 2) * sX - wr.left;
    cy = ir.top + (er.top + er.height / 2) * sY - wr.top;
  }

  /* Scale the un-rotated dimensions from iframe layout px → overlay px */
  const w = mode === 'embedder' ? nW : nW * sX;
  const h = mode === 'embedder' ? nH : nH * sY;

  return { cx, cy, w, h, rotDeg };
}

/** Element bbox in iframe **layout** / template CSS pixels (for snapping, move math). */
export function elementLayoutRectInIframe(
  iframe: HTMLIFrameElement,
  el: Element,
): { l: number; t: number; w: number; h: number } {
  const er = el.getBoundingClientRect();
  const ir = iframe.getBoundingClientRect();
  const sX = ir.width / (iframe.offsetWidth || 1);
  const sY = ir.height / (iframe.offsetHeight || 1);

  if (getIframeClientRectMode(iframe) === 'embedder') {
    return {
      l: (er.left - ir.left) / sX,
      t: (er.top - ir.top) / sY,
      w: er.width / sX,
      h: er.height / sY,
    };
  }

  return {
    l: er.left,
    t: er.top,
    w: er.width,
    h: er.height,
  };
}
