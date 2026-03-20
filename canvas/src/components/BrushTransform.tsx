/**
 * BrushTransform — numeric fields for translate / rotate / scale of one template element.
 * Interactive dragging is handled by TransformOverlay on the preview; this stays in sync.
 */

import { useState, useCallback, useEffect } from 'react';
import { useEditorStore, SLOT_TRANSFORM_PREFIX } from '../store/editor';
import {
  buildTransformString,
  parseTransform,
  parseTransformComputed,
  roundLayoutRotateDeg,
  roundLayoutTranslatePx,
} from '../lib/transform-format';

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
  /**
   * Text: only translate + rotate — CSS scale stretches glyphs.
   * Scale fields hidden and persisted transform uses scale 1,1.
   */
  layoutOnly?: boolean;
}

export function BrushTransform({
  brushSel,
  brushLabel: _brushLabel,
  assetWidth,
  iframeEl,
  layoutOnly = false,
}: BrushTransformProps) {
  const transformKey = `${SLOT_TRANSFORM_PREFIX}${brushSel}`;
  const savedTransform = useEditorStore((s) => s.slotValues[transformKey] ?? '');

  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rot, setRot] = useState(0);
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);

  /** Get the current CSS scale factor of the iframe */
  const getIframeScale = useCallback((): number => {
    if (!iframeEl) return 1;
    const containerWidth = iframeEl.parentElement?.clientWidth ?? assetWidth;
    return containerWidth / assetWidth;
  }, [iframeEl, assetWidth]);

  /** Load from saved user-state, or from DOM once iframe is ready */
  useEffect(() => {
    if (!iframeEl) return;

    const applyParsed = (
      parsed: ReturnType<typeof parseTransform>,
      cs: CSSStyleDeclaration | null
    ) => {
      const left = cs ? parseFloat(cs.left) : NaN;
      const top = cs ? parseFloat(cs.top) : NaN;
      const lx = Number.isFinite(left) ? left : 0;
      const ly = Number.isFinite(top) ? top : 0;
      const tx0 = roundLayoutTranslatePx(parsed.translateX + lx);
      const ty0 = roundLayoutTranslatePx(parsed.translateY + ly);
      setTx(tx0);
      setTy(ty0);
      setRot(roundLayoutRotateDeg(parsed.rotateDeg));
      if (layoutOnly) {
        setSx(1);
        setSy(1);
        const badScale =
          Math.abs(parsed.scaleX - 1) > 0.001 || Math.abs(parsed.scaleY - 1) > 0.001;
        if (badScale) {
          useEditorStore
            .getState()
            .updateElementTransform(
              brushSel,
              buildTransformString(tx0, ty0, parsed.rotateDeg, 1, 1)
            );
        }
      } else {
        setSx(parsed.scaleX);
        setSy(parsed.scaleY);
      }
    };

    const tryRead = (): boolean => {
      try {
        const iDoc = iframeEl.contentDocument;
        if (!iDoc?.body) return false;
        const el = iDoc.querySelector(brushSel) as HTMLElement | null;
        if (!el) return false;
        const cs = iDoc.defaultView?.getComputedStyle(el);
        if (!cs) return false;
        const saved = useEditorStore.getState().slotValues[transformKey];
        if (saved) {
          applyParsed(parseTransform(saved), cs);
        } else {
          applyParsed(parseTransformComputed(cs.transform, iDoc.defaultView ?? undefined), cs);
        }
        return true;
      } catch {
        return false;
      }
    };

    if (savedTransform) {
      tryRead();
      return;
    }

    if (tryRead()) return undefined;

    const id = window.setInterval(() => {
      if (tryRead()) window.clearInterval(id);
    }, 50);
    const timeout = window.setTimeout(() => window.clearInterval(id), 4000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(timeout);
    };
  }, [iframeEl, brushSel, transformKey, savedTransform, layoutOnly]);

  const sendTransform = useCallback(
    (newTx: number, newTy: number, newRot: number, newSx: number, newSy: number) => {
      const sxF = layoutOnly ? 1 : newSx;
      const syF = layoutOnly ? 1 : newSy;
      const transformStr = buildTransformString(newTx, newTy, newRot, sxF, syF);
      useEditorStore.getState().updateElementTransform(brushSel, transformStr);
    },
    [brushSel, layoutOnly]
  );

  const handleTxChange = (val: number) => {
    const v = roundLayoutTranslatePx(val);
    setTx(v);
    sendTransform(v, ty, rot, sx, sy);
  };
  const handleTyChange = (val: number) => {
    const v = roundLayoutTranslatePx(val);
    setTy(v);
    sendTransform(tx, v, rot, sx, sy);
  };
  const handleRotChange = (val: number) => {
    const v = roundLayoutRotateDeg(val);
    setRot(v);
    sendTransform(tx, ty, v, sx, sy);
  };
  const handleSxChange = (val: number) => {
    setSx(val);
    sendTransform(tx, ty, rot, val, sy);
  };
  const handleSyChange = (val: number) => {
    setSy(val);
    sendTransform(tx, ty, rot, sx, val);
  };

  const _ = getIframeScale;

  return (
    <div style={styles.container}>
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
        <div />
        {!layoutOnly && (
          <>
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
          </>
        )}
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
