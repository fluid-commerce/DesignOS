/**
 * Sidebar controls for text box width (hug vs fixed) and height (auto vs fixed).
 * Syncs with __textbox__: JSON and the TextBoxOverlay handles in the preview.
 */

import { useCallback, useEffect, useState } from 'react';
import { useEditorStore, SLOT_TEXT_BOX_PREFIX } from '../store/editor';

interface TextBoxControlsProps {
  textSel: string;
  textLabel?: string;
  iframeEl: HTMLIFrameElement | null;
}

export function TextBoxControls({ textSel, textLabel, iframeEl }: TextBoxControlsProps) {
  const tbKey = `${SLOT_TEXT_BOX_PREFIX}${textSel}`;
  const saved = useEditorStore((s) => s.slotValues[tbKey] ?? '');
  const updateTextBox = useEditorStore((s) => s.updateTextBox);

  const [widthPx, setWidthPx] = useState(200);
  /** Hug width = box grows to fit content (same idea as Figma “Hug”). */
  const [autoWidth, setAutoWidth] = useState(true);
  const [autoHeight, setAutoHeight] = useState(true);
  const [heightPx, setHeightPx] = useState(80);

  useEffect(() => {
    if (saved) {
      try {
        const o = JSON.parse(saved) as { w?: number | null; h?: number | null };
        if (typeof o.w === 'number' && Number.isFinite(o.w) && o.w >= 1) {
          setAutoWidth(false);
          setWidthPx(Math.round(o.w));
        } else {
          setAutoWidth(true);
        }
        if (o.h == null) {
          setAutoHeight(true);
        } else if (typeof o.h === 'number' && Number.isFinite(o.h)) {
          setAutoHeight(false);
          setHeightPx(Math.round(o.h));
        }
        return;
      } catch {
        /* fall through to DOM */
      }
    }

    const read = (): boolean => {
      try {
        const el = iframeEl?.contentDocument?.querySelector(textSel) as HTMLElement | null;
        if (!el || !iframeEl?.contentWindow) return false;
        const w = Math.round(el.offsetWidth || el.getBoundingClientRect().width);
        setWidthPx(Math.max(32, w));
        setAutoWidth(true);
        const hStyle = el.style.height;
        const isAuto = !hStyle || hStyle === 'auto';
        setAutoHeight(isAuto);
        setHeightPx(Math.max(24, Math.round(el.offsetHeight)));
        return true;
      } catch {
        return false;
      }
    };

    if (read()) return undefined;
    const id = window.setInterval(() => {
      if (read()) window.clearInterval(id);
    }, 50);
    const timeout = window.setTimeout(() => window.clearInterval(id), 4000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(timeout);
    };
  }, [saved, iframeEl, textSel]);

  /**
   * Without a saved `__textbox__` entry the iframe never gets hug/wrap rules — only this sidebar state
   * showed "Hug width" while the preview still used template CSS (often fixed width + clipping).
   */
  useEffect(() => {
    if (saved) return;
    const t = window.setTimeout(() => {
      updateTextBox(textSel, { w: null, h: null });
    }, 50);
    return () => window.clearTimeout(t);
  }, [textSel, saved, updateTextBox]);

  const push = useCallback(
    (w: number | null, autoH: boolean, fixedHeightPx?: number) => {
      const hPx = fixedHeightPx ?? heightPx;
      updateTextBox(textSel, {
        w: w == null ? null : Math.max(32, Math.round(w)),
        h: autoH ? null : Math.max(24, Math.round(hPx)),
      });
    },
    [textSel, updateTextBox, heightPx]
  );

  const fixedW = autoWidth ? null : widthPx;

  const displayName = textLabel ?? 'text';

  return (
    <div style={styles.container}>
      <div style={styles.hint}>
        <strong>Hug width</strong> keeps the template’s width (from the HTML/CSS) so copy wraps in multiple
        lines. Turn it off and use a fixed width (sidebar or side handles) to override with an exact pixel
        width.
      </div>

      <div style={styles.grid}>
        <div style={styles.formGroup}>
          <label style={styles.labelRow}>
            <input
              type="checkbox"
              checked={autoWidth}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoWidth(next);
                push(next ? null : widthPx, autoHeight);
              }}
              style={{ marginRight: 8 }}
            />
            Hug width
          </label>
          <span style={styles.subtle}>Use template width — normal multi-line wrap</span>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.labelRow}>
            <input
              type="checkbox"
              checked={autoHeight}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoHeight(next);
                push(fixedW, next);
              }}
              style={{ marginRight: 8 }}
            />
            Auto height
          </label>
          <span style={styles.subtle}>On = full text visible; resizing width won’t lock height</span>
        </div>
        {!autoWidth && (
          <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Fixed width (px)</label>
            <input
              type="number"
              min={32}
              step={1}
              value={widthPx}
              onChange={(e) => setWidthPx(parseFloat(e.target.value) || 32)}
              onBlur={() => push(widthPx, autoHeight)}
              style={styles.numberInput}
            />
          </div>
        )}
        {!autoHeight && (
          <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Height (px)</label>
            <input
              type="number"
              min={24}
              step={1}
              value={heightPx}
              onChange={(e) => setHeightPx(parseFloat(e.target.value) || 24)}
              onBlur={() => push(fixedW, false, heightPx)}
              style={styles.numberInput}
            />
          </div>
        )}
      </div>

      <div style={styles.chipRow}>
        <span style={styles.chip}>{displayName}</span>
      </div>
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
    alignItems: 'start',
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
  labelRow: {
    fontSize: '0.72rem',
    color: '#aaa',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  subtle: {
    fontSize: '0.65rem',
    color: '#555',
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
  chipRow: {
    marginTop: '0.6rem',
  },
  chip: {
    display: 'inline',
    backgroundColor: 'rgba(68,178,255,0.12)',
    color: '#44B2FF',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: '0.7rem',
    fontWeight: 600,
  },
};
