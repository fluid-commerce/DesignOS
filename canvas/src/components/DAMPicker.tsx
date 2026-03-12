/**
 * DAMPicker — DAM (Digital Asset Management) integration UI component.
 *
 * Provides three ways to select an image for a slot field:
 *   1. Browse Assets via Fluid DAM (requires VITE_FLUID_DAM_TOKEN env var)
 *   2. Upload from local device (FileReader → data URL)
 *   3. Drag-and-drop onto the drop zone
 *
 * If VITE_FLUID_DAM_TOKEN is not set, the "Browse Assets" button shows a
 * "Connect to Fluid DAM" message and falls back to local file selection.
 *
 * Renders the "Fluid DAM" indicator badge when a DAM token is configured.
 * Used by SlotField (ImageField) inside the ContentEditor sidebar.
 */

import { useRef, useState, useCallback } from 'react';

export interface DAMPickerProps {
  /** CSS selector of the target element in the iframe (passed to postMessage). */
  sel: string;
  /** Current image URL or data URL (for preview). */
  currentSrc?: string | null;
  /** Called with the final data URL or DAM asset URL after selection. */
  onSelect: (url: string) => void;
  /** Optional label shown above the control. */
  label?: string;
  /** Recommended dimensions hint text. */
  dims?: string;
}

// ---- Fluid DAM token (set via VITE_FLUID_DAM_TOKEN in .env) ----
// Vite exposes env vars via import.meta.env; the cast handles strict TS settings
const DAM_TOKEN: string = (import.meta.env as Record<string, string | undefined>).VITE_FLUID_DAM_TOKEN ?? '';

// ---- DAMPicker component ─────────────────────────────────────── */
export function DAMPicker({ sel: _sel, currentSrc, onSelect, label, dims }: DAMPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [damMessage, setDamMessage] = useState<string | null>(null);

  // ---- Local file handling ----
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onSelect(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ---- Drag-and-drop handlers ----
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ---- Browse Assets via Fluid DAM ----
  const handleBrowseAssets = async () => {
    if (!DAM_TOKEN) {
      // No token configured — show helpful message, then fall through to local picker
      setDamMessage('Set VITE_FLUID_DAM_TOKEN in .env to connect Fluid DAM. Using local file picker...');
      setTimeout(() => setDamMessage(null), 3000);
      fileInputRef.current?.click();
      return;
    }

    // Dynamically import the DAM picker (avoids bundling if token unused)
    try {
      const { DamPickerModal: _DamPickerModal } = await import('@fluid-commerce/dam-picker/react');
      // Open the modal — managed via state below
      setShowDamModal(true);
    } catch {
      setDamMessage('Failed to load Fluid DAM picker. Using local file picker...');
      setTimeout(() => setDamMessage(null), 3000);
      fileInputRef.current?.click();
    }
  };

  const [showDamModal, setShowDamModal] = useState(false);

  return (
    <div style={styles.wrapper}>
      {/* Label */}
      {label && <label style={styles.label}>{label}</label>}
      {dims && <div style={styles.sublabel}>Recommended: {dims}</div>}

      {/* Fluid DAM indicator badge (shown when token is configured) */}
      {DAM_TOKEN && (
        <div style={styles.damBadge}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="5" r="4" fill="#4ade80" opacity="0.3" />
            <circle cx="5" cy="5" r="2" fill="#4ade80" />
          </svg>
          <span style={styles.damBadgeText}>Fluid DAM connected</span>
        </div>
      )}

      {/* Drag-and-drop zone */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: isDragOver ? '#44B2FF' : '#2a2a2e',
          backgroundColor: isDragOver ? 'rgba(68,178,255,0.06)' : '#141414',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        title="Click or drag an image here"
      >
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={label ?? 'Selected image'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }}
          />
        ) : (
          <div style={styles.dropZoneEmpty}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#444" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={styles.dropZoneHint}>
              {isDragOver ? 'Drop to use' : 'Click or drag image here'}
            </span>
          </div>
        )}
      </div>

      {/* Hidden local file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* Action buttons row */}
      <div style={styles.actions}>
        {/* Browse Assets (DAM or local fallback) */}
        <button
          type="button"
          style={styles.browseBtn}
          onClick={handleBrowseAssets}
          title={DAM_TOKEN ? 'Browse Fluid DAM library' : 'Browse files from this device'}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#44B2FF';
            (e.currentTarget as HTMLButtonElement).style.color = '#44B2FF';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2e';
            (e.currentTarget as HTMLButtonElement).style.color = '#888';
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {DAM_TOKEN ? 'Browse Assets' : 'Browse Assets'}
        </button>

        {/* Upload from device (always available) */}
        <button
          type="button"
          style={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          title="Upload image from device"
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2a2a2e')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
        >
          Upload
        </button>
      </div>

      {/* DAM connection hint message */}
      {damMessage && (
        <div style={styles.hint}>{damMessage}</div>
      )}

      {/* Fluid DAM Modal (only rendered when token is configured and browse is clicked) */}
      {showDamModal && DAM_TOKEN && (
        <DamModalWrapper
          token={DAM_TOKEN}
          onSelect={(url) => {
            onSelect(url);
            setShowDamModal(false);
          }}
          onCancel={() => setShowDamModal(false)}
        />
      )}
    </div>
  );
}

// ---- DamModalWrapper — lazy-loaded to avoid bundling when DAM is unused ----

interface DamModalWrapperProps {
  token: string;
  onSelect: (url: string) => void;
  onCancel: () => void;
}

function DamModalWrapper({ token, onSelect, onCancel }: DamModalWrapperProps) {
  // Dynamically imported DamPickerModal rendered in a portal-like overlay
  // We use React.lazy + Suspense pattern via dynamic import
  const [Modal, setModal] = useState<React.ComponentType<{
    isOpen: boolean;
    token: string;
    onSelect: (asset: { url: string }) => void;
    onCancel: () => void;
  }> | null>(null);

  useState(() => {
    import('@fluid-commerce/dam-picker/react').then((mod) => {
      setModal(() => mod.DamPickerModal);
    });
  });

  if (!Modal) return null;

  return (
    <Modal
      isOpen={true}
      token={token}
      onSelect={(asset) => onSelect(asset.url)}
      onCancel={onCancel}
    />
  );
}

// ---- Styles ────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  sublabel: {
    fontSize: '0.7rem',
    color: '#555',
  },
  damBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    marginBottom: '0.1rem',
  },
  damBadgeText: {
    fontSize: '0.7rem',
    color: '#4ade80',
    fontWeight: 500,
  },
  dropZone: {
    width: '100%',
    height: 80,
    border: '1px dashed #2a2a2e',
    borderRadius: 4,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
    boxSizing: 'border-box',
  },
  dropZoneEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.3rem',
  },
  dropZoneHint: {
    fontSize: '0.68rem',
    color: '#444',
  },
  actions: {
    display: 'flex',
    gap: '0.4rem',
  },
  browseBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '5px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#888',
    fontSize: '0.73rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    transition: 'border-color 0.12s, color 0.12s',
  },
  uploadBtn: {
    padding: '5px 10px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #1e1e1e',
    borderRadius: 4,
    color: '#555',
    fontSize: '0.73rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.12s',
  },
  hint: {
    fontSize: '0.68rem',
    color: '#888',
    fontStyle: 'italic',
    padding: '4px 6px',
    backgroundColor: 'rgba(68,178,255,0.06)',
    border: '1px solid rgba(68,178,255,0.15)',
    borderRadius: 4,
  },
};
