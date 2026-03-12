/**
 * SlotField — renders the correct input component for a single slot schema field.
 * - TextField: textarea (or single-line input) based on rows hint
 * - ImageField: image preview + file browse + PhotoReposition trigger
 * - DividerField: visual section separator with label
 *
 * Each field change calls the editor store's updateSlotValue, which sends
 * a postMessage to the iframe for live preview.
 */

import { useRef } from 'react';
import type { SlotField as SlotFieldType, TextField, ImageField } from '../lib/slot-schema';
import { useEditorStore } from '../store/editor';
import { PhotoReposition } from './PhotoReposition';
import { useState } from 'react';

interface SlotFieldProps {
  field: SlotFieldType;
}

/* ── Text Field ─────────────────────────────────────────────────────────── */
function TextSlotField({ field }: { field: TextField }) {
  const { slotValues, updateSlotValue } = useEditorStore();
  const value = slotValues[field.sel] ?? '';
  const rows = field.rows ?? 3;
  const isMultiline = rows > 1;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    updateSlotValue(field.sel, e.target.value, field.mode);
  };

  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{field.label}</label>
      {isMultiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={handleChange}
          style={styles.textarea}
          placeholder={field.label}
        />
      ) : (
        <input
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
function ImageSlotField({ field }: { field: ImageField }) {
  const { slotValues, updateSlotValue, iframeRef } = useEditorStore();
  const [showReposition, setShowReposition] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(slotValues[field.sel] ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewSrc(dataUrl);
      updateSlotValue(field.sel, dataUrl, 'img');
      // Also send img action for src update
      if (iframeRef?.contentWindow) {
        iframeRef.contentWindow.postMessage(
          { type: 'tmpl', action: 'img', sel: field.sel, value: dataUrl },
          '*'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{field.label}</label>
      {field.dims && (
        <div style={styles.sublabel}>Recommended: {field.dims}</div>
      )}

      {/* Thumbnail preview */}
      <div
        style={styles.imageThumbnail}
        onClick={() => previewSrc && setShowReposition(true)}
        title={previewSrc ? 'Click to reposition' : undefined}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={field.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={styles.imageEmpty}>No image loaded</div>
        )}
      </div>

      {/* File browse button */}
      <button
        type="button"
        style={styles.uploadBtn}
        onClick={() => fileInputRef.current?.click()}
      >
        Browse...
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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
export function SlotField({ field }: SlotFieldProps) {
  if (field.type === 'text') return <TextSlotField field={field} />;
  if (field.type === 'image') return <ImageSlotField field={field} />;
  if (field.type === 'divider') return <DividerSlotField label={field.label} />;
  return null;
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  formGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#aaa',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sublabel: {
    fontSize: '0.7rem',
    color: '#666',
    marginBottom: '0.35rem',
  },
  textarea: {
    width: '100%',
    backgroundColor: '#1e1e30',
    border: '1px solid #2a2a42',
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
    backgroundColor: '#1e1e30',
    border: '1px solid #2a2a42',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '6px 8px',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  imageThumbnail: {
    width: '100%',
    height: 80,
    backgroundColor: '#15152a',
    border: '1px solid #2a2a42',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: '0.4rem',
    cursor: 'pointer',
  },
  imageEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '0.75rem',
    color: '#555',
  },
  uploadBtn: {
    backgroundColor: '#252540',
    border: '1px solid #3a3a52',
    borderRadius: 4,
    color: '#aaa',
    padding: '5px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  divider: {
    margin: '1rem 0 0.5rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #1a1a2e',
  },
  dividerLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#444',
  },
};
