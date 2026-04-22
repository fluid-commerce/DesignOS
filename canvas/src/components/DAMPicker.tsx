/**
 * DAMPicker — DAM (Digital Asset Management) integration using the Fluid DAM Picker SDK.
 *
 * Integration follows the official guide:
 * https://docs.fluid.app/docs/guides/dam-picker-sdk-guide
 *
 * Provides three ways to select an image for a slot field:
 *   1. Browse Assets via Fluid DAM (requires VITE_FLUID_DAM_TOKEN — your Fluid API token)
 *   2. Upload from local device (FileReader → data URL)
 *   3. Drag-and-drop onto the drop zone
 *
 * If VITE_FLUID_DAM_TOKEN is not set, the "Browse Assets" button shows a
 * "Connect to Fluid DAM" message and falls back to local file selection.
 *
 * Renders the "Fluid DAM" indicator badge when a DAM token is configured.
 * Used by SlotField (ImageField) inside the ContentEditor sidebar.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

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

// ---- Fluid DAM token (Fluid API token — see https://docs.fluid.app/docs/guides/dam-picker-sdk-guide) ----
const DAM_TOKEN: string =
  (import.meta.env as Record<string, string | undefined>).VITE_FLUID_DAM_TOKEN ?? '';

/** Asset shape passed to onSelect (from SDK SelectedAsset). */
export interface SelectedDAMAsset {
  url: string;
  name?: string;
}

/** Standalone Fluid DAM modal for use outside DAMPicker (e.g. BuildHero plus button). Uses the imperative DamPicker API so React Strict Mode cannot unmount and destroy the picker. */
export interface FluidDAMModalProps {
  isOpen: boolean;
  onSelect: (asset: SelectedDAMAsset) => void;
  onCancel: () => void;
  /** Optional: called on picker error (e.g. AUTHENTICATION_ERROR, NETWORK_ERROR). */
  onError?: (message: string) => void;
}

export function FluidDAMModal({ isOpen, onSelect, onCancel, onError }: FluidDAMModalProps) {
  const pickerRef = useRef<InstanceType<
    typeof import('@fluid-commerce/dam-picker').DamPicker
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  onSelectRef.current = onSelect;
  onCancelRef.current = onCancel;
  onErrorRef.current = onError;

  // When isOpen goes false, destroy picker if it exists (e.g. parent closed without going through picker)
  useEffect(() => {
    if (!isOpen && pickerRef.current) {
      pickerRef.current.destroy();
      pickerRef.current = null;
    }
  }, [isOpen]);

  // When isOpen becomes true and we have a token, open the picker via the imperative API (avoids React Strict Mode destroying the overlay)
  useEffect(() => {
    if (!isOpen || !DAM_TOKEN) return;
    setLoadError(null);
    setLoading(true);
    let cancelled = false;
    import('@fluid-commerce/dam-picker')
      .then((mod) => {
        if (cancelled) return;
        const picker = new mod.DamPicker({
          token: DAM_TOKEN,
          zIndex: 10001,
          onSelect: (asset: { url: string; name?: string }) => {
            if (pickerRef.current) {
              pickerRef.current.destroy();
              pickerRef.current = null;
            }
            setLoading(false);
            if (asset?.url) onSelectRef.current({ url: asset.url, name: asset.name });
          },
          onCancel: () => {
            if (pickerRef.current) {
              pickerRef.current.destroy();
              pickerRef.current = null;
            }
            setLoading(false);
            onCancelRef.current();
          },
          onError: (err: { message?: string }) => {
            if (pickerRef.current) {
              pickerRef.current.destroy();
              pickerRef.current = null;
            }
            setLoading(false);
            const msg = err?.message ?? 'Unknown error';
            setLoadError(msg);
            onErrorRef.current?.(msg);
          },
        });
        pickerRef.current = picker;
        picker.open();
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setLoadError(err?.message ?? 'Failed to load DAM picker');
        }
      });
    return () => {
      cancelled = true;
      if (pickerRef.current) {
        pickerRef.current.destroy();
        pickerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Shared overlay + content wrapper for all non-SDK overlay states
  function DAMDialogShell({
    titleText,
    descriptionText,
    onDismiss,
    children,
  }: {
    titleText: string;
    descriptionText: string;
    onDismiss: () => void;
    children: React.ReactNode;
  }) {
    return (
      <Dialog.Root
        open
        onOpenChange={(open) => {
          if (!open) onDismiss();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(0,0,0,0.6)',
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10001,
              background: '#1a1a1e',
              padding: 24,
              borderRadius: 8,
              maxWidth: 360,
              border: '1px solid #2a2a2e',
            }}
          >
            <VisuallyHidden.Root asChild>
              <Dialog.Title>{titleText}</Dialog.Title>
            </VisuallyHidden.Root>
            <VisuallyHidden.Root asChild>
              <Dialog.Description>{descriptionText}</Dialog.Description>
            </VisuallyHidden.Root>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!DAM_TOKEN) {
    return (
      <DAMDialogShell
        titleText="Connect to Fluid DAM"
        descriptionText="Configure your Fluid API token to connect to Fluid DAM."
        onDismiss={onCancel}
      >
        <p style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>
          Add your Fluid API token as VITE_FLUID_DAM_TOKEN in .env to connect to Fluid DAM. See the{' '}
          <a
            href="https://docs.fluid.app/docs/guides/dam-picker-sdk-guide"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#44B2FF' }}
          >
            DAM Picker SDK guide
          </a>
          .
        </p>
        <Dialog.Close asChild>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#2a2a2e',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </Dialog.Close>
      </DAMDialogShell>
    );
  }

  if (loadError) {
    return (
      <DAMDialogShell
        titleText="DAM Picker Error"
        descriptionText="An error occurred while loading the DAM picker."
        onDismiss={() => {
          setLoadError(null);
          onCancel();
        }}
      >
        <p style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>{loadError}</p>
        <Dialog.Close asChild>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#2a2a2e',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </Dialog.Close>
      </DAMDialogShell>
    );
  }

  if (loading) {
    return (
      <DAMDialogShell
        titleText="Loading DAM Picker"
        descriptionText="The DAM picker is loading, please wait."
        onDismiss={onCancel}
      >
        <p style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>Loading DAM picker…</p>
      </DAMDialogShell>
    );
  }

  return null;
}

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
    [onSelect],
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
      setDamMessage(
        'Add VITE_FLUID_DAM_TOKEN (Fluid API token) in .env to connect Fluid DAM. Using local file picker.',
      );
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
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              borderRadius: 4,
            }}
          />
        ) : (
          <div style={styles.dropZoneEmpty}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#444"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
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
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
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
      {damMessage && <div style={styles.hint}>{damMessage}</div>}

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

// ---- DamModalWrapper — lazy-loaded @fluid-commerce/dam-picker/react (SDK guide: https://docs.fluid.app/docs/guides/dam-picker-sdk-guide) ----

interface DamModalWrapperProps {
  token: string;
  onSelect: (url: string) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

function DamModalWrapper({ token, onSelect, onCancel, onError }: DamModalWrapperProps) {
  const [Modal, setModal] = useState<React.ComponentType<{
    isOpen: boolean;
    token: string;
    zIndex?: number;
    onSelect: (asset: { url: string }) => void;
    onCancel: () => void;
    onError?: (error: { code: string; message: string }) => void;
  }> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    import('@fluid-commerce/dam-picker/react')
      .then((mod) => {
        setModal(() => mod.DamPickerModal);
      })
      .catch((err) => {
        setLoadError(err?.message ?? 'Failed to load DAM picker');
      });
  }, []);

  const handleCancel = useCallback(() => onCancel(), [onCancel]);

  const handleSelect = useCallback((url: string) => onSelect(url), [onSelect]);

  if (loadError) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => {
          setLoadError(null);
          onCancel();
        }}
      >
        <div
          style={{
            background: '#1a1a1e',
            padding: 24,
            borderRadius: 8,
            maxWidth: 360,
            border: '1px solid #2a2a2e',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              onCancel();
            }}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#2a2a2e',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!Modal) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e0e0e0',
          fontSize: 14,
        }}
      >
        Loading DAM picker…
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      <Modal
        isOpen={true}
        token={token}
        zIndex={10001}
        onSelect={(asset) => {
          if (asset?.url) handleSelect(asset.url);
        }}
        onCancel={handleCancel}
        onError={onError ? (err) => onError(err?.message ?? 'Unknown error') : undefined}
      />
    </>
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
