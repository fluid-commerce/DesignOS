/**
 * PhotoReposition — Fit/Fill toggle + focus point drag for image slots.
 * Port of Jonathan's image field photo controls.
 *
 * Sends postMessage({ type: 'tmpl', sel, action: 'imgStyle', objectFit, objectPosition })
 * to the iframe via the editor store's iframeRef.
 */

import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editor';

interface PhotoRepositionProps {
  /** CSS selector for the <img> element in the template */
  sel: string;
  /** Data URL or image src for the preview thumbnail */
  previewSrc: string;
  onClose: () => void;
}

type FitMode = 'cover' | 'contain';

export function PhotoReposition({ sel, previewSrc, onClose }: PhotoRepositionProps) {
  const { iframeRef } = useEditorStore();
  const [mode, setMode] = useState<FitMode>('cover');
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const isDragging = useRef(false);
  const thumbRef = useRef<HTMLDivElement>(null);

  /** Send imgStyle postMessage to iframe */
  const applyStyle = useCallback(
    (objectFit: string, objectPosition: string) => {
      if (iframeRef?.contentWindow) {
        iframeRef.contentWindow.postMessage(
          { type: 'tmpl', sel, action: 'imgStyle', objectFit, objectPosition },
          '*',
        );
      }
    },
    [iframeRef, sel],
  );

  const applyFocus = useCallback(
    (clientX: number, clientY: number) => {
      if (!thumbRef.current) return;
      const rect = thumbRef.current.getBoundingClientRect();
      const x = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)));
      setFocusX(x);
      setFocusY(y);
      applyStyle('cover', `${x}% ${y}%`);
    },
    [applyStyle],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'cover') return;
      isDragging.current = true;
      applyFocus(e.clientX, e.clientY);
      e.preventDefault();
    },
    [mode, applyFocus],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      applyFocus(e.clientX, e.clientY);
    },
    [applyFocus],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const setFit = () => {
    setMode('contain');
    applyStyle('contain', '');
  };

  const setFill = () => {
    setMode('cover');
    applyStyle('cover', `${focusX}% ${focusY}%`);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>Reposition Photo</span>
          <button style={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Fit / Fill toggle */}
        <div style={styles.toggleRow}>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'contain' ? styles.toggleActive : {}) }}
            onClick={setFit}
          >
            Fit
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'cover' ? styles.toggleActive : {}) }}
            onClick={setFill}
          >
            Fill
          </button>
        </div>

        {/* Thumbnail with draggable focus point */}
        <div
          ref={thumbRef}
          style={{
            ...styles.thumb,
            cursor: mode === 'cover' ? 'crosshair' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={previewSrc}
            alt="Preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: mode,
              objectPosition: mode === 'cover' ? `${focusX}% ${focusY}%` : 'center',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
          {/* Focus crosshair dot */}
          {mode === 'cover' && (
            <div
              style={{
                ...styles.focusDot,
                left: `${focusX}%`,
                top: `${focusY}%`,
              }}
            />
          )}
        </div>

        <div style={styles.hint}>
          {mode === 'cover' ? 'Drag to set the focal point' : 'Full image visible (letterboxed)'}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#141414',
    border: '1px solid #2a2a2e',
    borderRadius: 8,
    padding: '1rem',
    width: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#ccc',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  toggleRow: {
    display: 'flex',
    gap: 4,
    marginBottom: '0.75rem',
  },
  toggleBtn: {
    flex: 1,
    padding: '5px 0',
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#666',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'color 0.12s, border-color 0.12s, background 0.12s',
  },
  toggleActive: {
    color: '#44B2FF',
    borderColor: 'rgba(68,178,255,0.35)',
    backgroundColor: 'rgba(68,178,255,0.06)',
  },
  thumb: {
    width: '100%',
    height: 180,
    backgroundColor: '#1a1a1e',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    userSelect: 'none',
  },
  focusDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: 'rgba(68,178,255,0.9)',
    border: '2px solid #fff',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    boxShadow: '0 0 4px rgba(0,0,0,0.6)',
  },
  hint: {
    marginTop: '0.5rem',
    fontSize: '0.7rem',
    color: '#555',
    textAlign: 'center',
  },
};
