/**
 * Sidebar controls for text box width (hug vs fixed) and height (auto vs fixed).
 * Syncs with __textbox__: JSON and the TextBoxOverlay handles in the preview.
 */

import { useCallback, useEffect, useId, useState } from 'react';
import {
  useEditorStore,
  SLOT_TEXT_BOX_PREFIX,
  type TextBoxAlign,
  type TextBoxFontPreset,
} from '../store/editor';
import { TEXTBOX_FONT_PRESET_PX } from '../lib/textbox-typography';

const FONT_PRESET_ORDER = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p1',
  'p2',
  'p3',
] as const satisfies readonly (keyof typeof TEXTBOX_FONT_PRESET_PX)[];

function labelForPreset(p: (typeof FONT_PRESET_ORDER)[number]): string {
  if (p.startsWith('h')) return `${p.toUpperCase()} · ${TEXTBOX_FONT_PRESET_PX[p]}px`;
  return `${p.toUpperCase()} · ${TEXTBOX_FONT_PRESET_PX[p]}px`;
}

function detectAlign(el: HTMLElement | null): TextBoxAlign {
  if (!el) return 'left';
  const win = el.ownerDocument.defaultView;
  const ta = win ? win.getComputedStyle(el).textAlign : '';
  if (ta === 'center') return 'center';
  if (ta === 'right' || ta === 'end') return 'right';
  return 'left';
}

interface TextBoxControlsProps {
  textSel: string;
  textLabel?: string;
  iframeEl: HTMLIFrameElement | null;
}

export function TextBoxControls({ textSel, textLabel: _textLabel, iframeEl }: TextBoxControlsProps) {
  const fontFieldId = useId();
  const tbKey = `${SLOT_TEXT_BOX_PREFIX}${textSel}`;
  const saved = useEditorStore((s) => s.slotValues[tbKey] ?? '');
  const updateTextBox = useEditorStore((s) => s.updateTextBox);

  const [widthPx, setWidthPx] = useState(200);
  /** Hug width = box grows to fit content (same idea as Figma “Hug”). */
  const [autoWidth, setAutoWidth] = useState(true);
  const [autoHeight, setAutoHeight] = useState(true);
  const [heightPx, setHeightPx] = useState(80);
  const [align, setAlign] = useState<TextBoxAlign>('left');
  const [fontPreset, setFontPreset] = useState<TextBoxFontPreset>('inherit');
  const [customPx, setCustomPx] = useState(24);

  useEffect(() => {
    if (saved) {
      try {
        const o = JSON.parse(saved) as {
          w?: number | null;
          h?: number | null;
          align?: string;
          fontPreset?: string;
          fontSizePx?: number;
        };
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
        if (o.align === 'left' || o.align === 'center' || o.align === 'right') {
          setAlign(o.align);
        } else {
          const el = iframeEl?.contentDocument?.querySelector(textSel) as HTMLElement | null;
          setAlign(detectAlign(el));
        }
        if (
          o.fontPreset === 'h1' ||
          o.fontPreset === 'h2' ||
          o.fontPreset === 'h3' ||
          o.fontPreset === 'h4' ||
          o.fontPreset === 'h5' ||
          o.fontPreset === 'h6' ||
          o.fontPreset === 'p1' ||
          o.fontPreset === 'p2' ||
          o.fontPreset === 'p3'
        ) {
          setFontPreset(o.fontPreset);
        } else if (o.fontPreset === 'custom') {
          setFontPreset('custom');
          if (typeof o.fontSizePx === 'number' && Number.isFinite(o.fontSizePx)) {
            setCustomPx(Math.round(o.fontSizePx));
          }
        } else {
          setFontPreset('inherit');
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
        setAlign(detectAlign(el));
        setFontPreset('inherit');
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

  return (
    <div style={styles.container}>
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
        <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
          <label style={styles.label} htmlFor={fontFieldId}>
            Font size
          </label>
          <select
            id={fontFieldId}
            value={fontPreset}
            onChange={(e) => {
              const v = e.target.value as TextBoxFontPreset;
              setFontPreset(v);
              if (v === 'inherit') {
                updateTextBox(textSel, { fontPreset: 'inherit' });
              } else if (v === 'custom') {
                updateTextBox(textSel, {
                  fontPreset: 'custom',
                  fontSizePx: Math.min(500, Math.max(8, customPx)),
                });
              } else {
                updateTextBox(textSel, { fontPreset: v });
              }
            }}
            style={styles.select}
          >
            <option value="inherit">Template default</option>
            {FONT_PRESET_ORDER.map((p) => (
              <option key={p} value={p}>
                {labelForPreset(p)}
              </option>
            ))}
            <option value="custom">Custom (px)</option>
          </select>
          {fontPreset === 'custom' && (
            <input
              type="number"
              min={8}
              max={500}
              step={1}
              value={customPx}
              onChange={(e) => setCustomPx(parseFloat(e.target.value) || 8)}
              onBlur={() =>
                updateTextBox(textSel, {
                  fontPreset: 'custom',
                  fontSizePx: Math.min(500, Math.max(8, Math.round(customPx))),
                })
              }
              style={{ ...styles.numberInput, marginTop: 6 }}
            />
          )}
        </div>
        <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
          <span style={styles.label}>Text align</span>
          <div style={styles.alignRow}>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                style={{
                  ...styles.alignBtn,
                  ...(align === a ? styles.alignBtnActive : {}),
                }}
                onClick={() => {
                  setAlign(a);
                  updateTextBox(textSel, { align: a });
                }}
                title={a === 'left' ? 'Align left' : a === 'center' ? 'Align center' : 'Align right'}
              >
                {a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}
              </button>
            ))}
          </div>
        </div>
      </div>
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
  alignRow: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  alignBtn: {
    flex: 1,
    padding: '6px 4px',
    fontSize: '0.68rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    color: '#aaa',
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    cursor: 'pointer',
  },
  alignBtnActive: {
    color: '#fff',
    borderColor: '#44B2FF',
    backgroundColor: '#1e2a33',
  },
  select: {
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '6px 8px',
    fontSize: '0.72rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 4,
    cursor: 'pointer',
  },
};
