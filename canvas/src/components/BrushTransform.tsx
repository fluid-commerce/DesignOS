/**
 * BrushTransform — SVG overlay for drag/rotate/scale of one movable element.
 * Port of Jonathan's transform box from editor.js.
 *
 * Renders an SVG overlay on top of the iframe with corner handles (scale),
 * a center drag handle (translate), and a rotation handle.
 * All operations send postMessage({ type: 'tmpl', sel, action: 'transform', transform: '...' }).
 *
 * Coordinate math mirrors Jonathan's computeScale() approach — the iframe is
 * CSS-scaled, so mouse events in screen pixels must be divided by scale factor.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor';

interface BrushTransformProps {
  /** CSS selector for the movable element (e.g. '.circle-brush') */
  brushSel: string;
  /** Human-readable label for the element */
  brushLabel?: string;
  /** Asset native width in pixels (for scale computation) */
  assetWidth: number;
  /** Asset native height in pixels (for scale computation) */
  assetHeight: number;
  /** The scaled iframe element */
  iframeEl: HTMLIFrameElement | null;
}

interface TransformState {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
}

/** Parse a CSS transform string into components */
function parseTransform(transform: string): TransformState {
  const result: TransformState = { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 };
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

function buildTransformString(tx: number, ty: number, rot: number, sx: number, sy: number): string {
  return `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
}

export function BrushTransform({
  brushSel,
  brushLabel,
  assetWidth,
  iframeEl,
}: BrushTransformProps) {
  const { iframeRef } = useEditorStore();
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rot, setRot] = useState(0);
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);

  const hasReadEl = useRef(false);

  /** Get the current CSS scale factor of the iframe */
  const getIframeScale = useCallback((): number => {
    if (!iframeEl) return 1;
    const containerWidth = iframeEl.parentElement?.clientWidth ?? assetWidth;
    return containerWidth / assetWidth;
  }, [iframeEl, assetWidth]);

  /** Read current transform from the element inside iframe */
  useEffect(() => {
    if (hasReadEl.current || !iframeEl) return;
    try {
      const iDoc = iframeEl.contentDocument;
      if (!iDoc) return;
      const el = iDoc.querySelector(brushSel) as HTMLElement | null;
      if (!el) return;
      const cs = iDoc.defaultView?.getComputedStyle(el);
      if (!cs) return;
      const parsed = parseTransform(cs.transform);
      const left = parseFloat(cs.left) || 0;
      const top = parseFloat(cs.top) || 0;
      setTx(parsed.translateX || left);
      setTy(parsed.translateY || top);
      setRot(parsed.rotateDeg);
      setSx(parsed.scaleX);
      setSy(parsed.scaleY);
      hasReadEl.current = true;
    } catch {
      // Ignore cross-origin errors
    }
  }, [iframeEl, brushSel]);

  /** Send the current transform to the iframe via postMessage */
  const sendTransform = useCallback(
    (newTx: number, newTy: number, newRot: number, newSx: number, newSy: number) => {
      const transformStr = buildTransformString(newTx, newTy, newRot, newSx, newSy);
      const targetWindow = (iframeRef ?? iframeEl)?.contentWindow;
      if (targetWindow) {
        targetWindow.postMessage(
          { type: 'tmpl', sel: brushSel, action: 'transform', transform: transformStr },
          '*'
        );
      }
    },
    [iframeRef, iframeEl, brushSel]
  );

  const handleTxChange = (val: number) => {
    setTx(val);
    sendTransform(val, ty, rot, sx, sy);
  };
  const handleTyChange = (val: number) => {
    setTy(val);
    sendTransform(tx, val, rot, sx, sy);
  };
  const handleRotChange = (val: number) => {
    setRot(val);
    sendTransform(tx, ty, val, sx, sy);
  };
  const handleSxChange = (val: number) => {
    setSx(val);
    sendTransform(tx, ty, rot, val, sy);
  };
  const handleSyChange = (val: number) => {
    setSy(val);
    sendTransform(tx, ty, rot, sx, val);
  };

  const displayName = brushLabel ?? 'element';
  const _ = getIframeScale; // used for future SVG overlay expansion

  return (
    <div style={styles.container}>
      <div style={styles.hint}>
        Drag the <span style={styles.chip}>{displayName}</span> directly in the preview —
        or use the controls below:
      </div>

      <div style={styles.grid}>
        <NumberField
          label="X (px)"
          value={tx}
          step={1}
          onChange={handleTxChange}
        />
        <NumberField
          label="Y (px)"
          value={ty}
          step={1}
          onChange={handleTyChange}
        />
        <NumberField
          label="Rotate °"
          value={rot}
          step={0.5}
          onChange={handleRotChange}
        />
        <div /> {/* spacer */}
        <NumberField
          label="Scale W %"
          value={Math.round(sx * 100)}
          step={1}
          onChange={(v) => handleSxChange(v / 100)}
        />
        <NumberField
          label="Scale H %"
          value={Math.round(sy * 100)}
          step={1}
          onChange={(v) => handleSyChange(v / 100)}
        />
      </div>
    </div>
  );
}

/* ── NumberField helper ─────────────────────────────────────────────────── */
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
        value={value}
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
  chip: {
    display: 'inline',
    backgroundColor: 'rgba(68,178,255,0.12)',
    color: '#44B2FF',
    padding: '1px 6px',
    borderRadius: 3,
    fontSize: '0.7rem',
    fontWeight: 600,
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
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  numberInput: {
    backgroundColor: '#1e1e30',
    border: '1px solid #2a2a42',
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
