/**
 * SlotField — renders the correct input component for a single slot schema field.
 * - TextField: textarea (or single-line input) based on rows hint
 * - ImageField: image preview + file browse + PhotoReposition trigger
 * - DividerField: visual section separator with label
 *
 * Each field change calls the editor store's updateSlotValue, which sends
 * a postMessage to the iframe for live preview.
 */

import { useRef, useEffect } from 'react';
import type { SlotField as SlotFieldType, TextField, ImageField } from '../lib/slot-schema';
import { useEditorStore } from '../store/editor';
import { PhotoReposition } from './PhotoReposition';
import { DAMPicker } from './DAMPicker';
import { useState } from 'react';

interface SlotFieldProps {
  field: SlotFieldType;
  /** Sidebar `field.sel` matching the last preview pick (text or image slot). */
  contentTargetSel: string | null;
  /** Increments on each content-relevant preview pick (refocus / rescroll). */
  contentPickEpoch: number;
}

/* ── Text Field ─────────────────────────────────────────────────────────── */
function TextSlotField({
  field,
  isContentTarget,
  contentPickEpoch,
}: {
  field: TextField;
  isContentTarget: boolean;
  contentPickEpoch: number;
}) {
  const { slotValues, updateSlotValue } = useEditorStore();
  const value = slotValues[field.sel] ?? '';
  const rows = field.rows ?? 3;
  const isMultiline = rows > 1;
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isContentTarget) return;
    const wrap = wrapRef.current;
    const input = isMultiline ? textareaRef.current : inputRef.current;
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const id = window.requestAnimationFrame(() => {
      if (!input) return;
      input.focus({ preventScroll: true });
      // Show insertion caret (do not select-all — user can drag to highlight ranges).
      const len = input.value.length;
      try {
        input.setSelectionRange(len, len);
      } catch {
        /* ignore: rare unsupported input types */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [isContentTarget, field.sel, contentPickEpoch, isMultiline]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    updateSlotValue(field.sel, e.target.value, field.mode);
  };

  const highlight = isContentTarget ? styles.fieldHighlight : undefined;

  return (
    <div ref={wrapRef} style={{ ...styles.formGroup, ...highlight }}>
      <label style={styles.label}>{field.label}</label>
      {isMultiline ? (
        <textarea
          ref={textareaRef}
          className="slot-field-editable"
          rows={rows}
          value={value}
          onChange={handleChange}
          style={styles.textarea}
          placeholder={field.label}
        />
      ) : (
        <input
          ref={inputRef}
          className="slot-field-editable"
          type="text"
          value={value}
          onChange={handleChange}
          style={styles.input}
          placeholder={field.label}
        />
      )}
    </div>
  );
}

/* ── Image Field ─────────────────────────────────────────────────────────── */
function ImageSlotField({
  field,
  isContentTarget,
  contentPickEpoch,
}: {
  field: ImageField;
  isContentTarget: boolean;
  contentPickEpoch: number;
}) {
  const { slotValues, updateSlotValue, iframeRef } = useEditorStore();
  const [showReposition, setShowReposition] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(slotValues[field.sel] ?? null);
  // fileInputRef kept for PhotoReposition (not used by DAMPicker directly)
  const _fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isContentTarget) return;
    wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isContentTarget, field.sel, contentPickEpoch]);

  const handleSelect = (url: string) => {
    setPreviewSrc(url);
    updateSlotValue(field.sel, url, 'img');
    // Send img postMessage for live iframe preview
    if (iframeRef?.contentWindow) {
      iframeRef.contentWindow.postMessage(
        { type: 'tmpl', action: 'img', sel: field.sel, value: url },
        '*',
      );
    }
  };

  const highlight = isContentTarget ? styles.fieldHighlight : undefined;

  return (
    <div ref={wrapRef} style={{ ...styles.formGroup, ...highlight }}>
      {/* DAMPicker handles label, dims hint, drag-drop zone, Browse Assets, and local upload */}
      <DAMPicker
        sel={field.sel}
        currentSrc={previewSrc}
        onSelect={handleSelect}
        label={field.label}
        dims={field.dims}
      />

      {/* Reposition trigger (shown when image is loaded) */}
      {previewSrc && (
        <button
          type="button"
          style={{ ...styles.uploadBtn, marginTop: '0.3rem' }}
          onClick={() => setShowReposition(true)}
        >
          Reposition...
        </button>
      )}

      {/* Photo reposition panel */}
      {showReposition && previewSrc && (
        <PhotoReposition
          sel={field.sel}
          previewSrc={previewSrc}
          onClose={() => setShowReposition(false)}
        />
      )}
    </div>
  );
}

/* ── Divider Field ───────────────────────────────────────────────────────── */
function DividerSlotField({ label }: { label: string }) {
  return (
    <div style={styles.divider}>
      <span style={styles.dividerLabel}>{label}</span>
    </div>
  );
}

/* ── Main SlotField component ────────────────────────────────────────────── */
export function SlotField({ field, contentTargetSel, contentPickEpoch }: SlotFieldProps) {
  if (field.type === 'divider') return <DividerSlotField label={field.label} />;
  const isContentTarget = contentTargetSel != null && field.sel === contentTargetSel;
  if (field.type === 'text') {
    return (
      <TextSlotField
        field={field}
        isContentTarget={isContentTarget}
        contentPickEpoch={contentPickEpoch}
      />
    );
  }
  if (field.type === 'image') {
    return (
      <ImageSlotField
        field={field}
        isContentTarget={isContentTarget}
        contentPickEpoch={contentPickEpoch}
      />
    );
  }
  return null;
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  fieldHighlight: {
    boxShadow: 'inset 0 0 0 1px rgba(68, 178, 255, 0.55)',
    borderRadius: 6,
    padding: '0.35rem',
    marginLeft: '-0.35rem',
    marginRight: '-0.35rem',
    backgroundColor: 'rgba(68, 178, 255, 0.04)',
  },
  formGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#888',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  sublabel: {
    fontSize: '0.7rem',
    color: '#555',
    marginBottom: '0.35rem',
  },
  textarea: {
    width: '100%',
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '6px 8px',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '6px 8px',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  uploadBtn: {
    backgroundColor: '#1e1e1e',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#888',
    padding: '5px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  divider: {
    margin: '1rem 0 0.5rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #1e1e1e',
  },
  dividerLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
  },
};
