/**
 * ContentEditor — right sidebar container for the slot-driven editor.
 * Renders SlotField components for each field in the slot schema.
 * Integrates with BrushTransform, CarouselSelector, and ExportActions.
 *
 * Connects to the iframe via the editor store's iframeRef and postMessage IPC.
 * On mount, sends a 'readValues' request to extract current template values.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Iteration } from '../lib/campaign-types';
import {
  collectTransformTargets,
  type ImageField,
  type TextField,
  type TransformTargetKind,
} from '../lib/slot-schema';
import { useEditorStore } from '../store/editor';
import { SlotField } from './SlotField';
import { BrushTransform } from './BrushTransform';
import { TextBoxControls } from './TextBoxControls';
import { CarouselSelector } from './CarouselSelector';
import { ExportActions } from './ExportActions';

const PICK_KINDS: TransformTargetKind[] = ['text', 'image', 'brush'];

function parsePickKind(v: unknown): TransformTargetKind {
  return typeof v === 'string' && (PICK_KINDS as string[]).includes(v)
    ? (v as TransformTargetKind)
    : 'image';
}

interface ContentEditorProps {
  iteration: Iteration | null;
  /** The scaled iframe element rendered in the preview pane */
  iframeEl: HTMLIFrameElement | null;
}

export function ContentEditor({ iteration, iframeEl }: ContentEditorProps) {
  const {
    selectedIterationId,
    slotSchema,
    slotValues,
    isDirty,
    pickedTransform,
    selectIteration,
    setIframeRef,
    updateSlotValue,
    setPickedTransform,
    saveUserState,
    clearSelection,
  } = useEditorStore();

  const hasInitialized = useRef(false);

  // Register the iframe with the editor store so postMessage works
  useEffect(() => {
    setIframeRef(iframeEl);
  }, [iframeEl, setIframeRef]);

  // Load iteration into editor store when selection changes
  useEffect(() => {
    if (!iteration) {
      clearSelection();
      hasInitialized.current = false;
      return;
    }
    if (iteration.id !== selectedIterationId) {
      hasInitialized.current = false;
      selectIteration(iteration.id);
    }
  }, [iteration?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for postMessage from iframe: initial values + click-to-pick targets
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const d = e.data;
      if (!d) return;

      if (d.type === 'fluidPickElement' && typeof d.sel === 'string') {
        if (!iframeEl?.contentWindow || e.source !== iframeEl.contentWindow) return;
        const label = typeof d.label === 'string' && d.label ? d.label : d.sel;
        setPickedTransform({
          sel: d.sel,
          label,
          kind: parsePickKind(d.kind),
        });
        return;
      }

      if (iframeEl?.contentWindow && e.source !== iframeEl.contentWindow) return;
      if (d.type !== 'readValuesResult') return;
      // iframe returns { type: 'readValuesResult', values: Record<string, string> }
      if (d.values && typeof d.values === 'object') {
        for (const [sel, value] of Object.entries(d.values)) {
          if (typeof value === 'string') {
            // Update store without marking dirty (these are the current template values)
            updateSlotValue(sel, value);
          }
        }
        // Reset dirty after loading initial values
        useEditorStore.setState({ isDirty: false });
      }
    },
    [iframeEl, updateSlotValue, setPickedTransform]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Clear blue pick outline in iframe when nothing is selected for transform
  useEffect(() => {
    if (!iframeEl?.contentWindow) return;
    if (!pickedTransform) {
      iframeEl.contentWindow.postMessage({ type: 'fluidClearPick' }, '*');
    }
  }, [pickedTransform, iframeEl]);

  // On first load: either request current values from iframe (no saved state) or apply saved state is in HTML on load
  useEffect(() => {
    if (!slotSchema || !iframeEl?.contentWindow || hasInitialized.current) return;
    if (!selectedIterationId) return;
    hasInitialized.current = true;

    // When we have no stored values, ask iframe for current DOM values (selectors from schema)
    if (Object.keys(slotValues).length === 0) {
      const selectors = slotSchema.fields
        .filter((f): f is TextField | ImageField => f.type === 'text' || f.type === 'image')
        .map((f) => f.sel);
      if (selectors.length) {
        iframeEl.contentWindow.postMessage({ type: 'readValues', selectors }, '*');
      }
    }
  }, [slotSchema, selectedIterationId, iframeEl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Empty state — nothing selected
  if (!iteration) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          Select an iteration to edit its content.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <span style={styles.iterationLabel}>
            {iteration.source === 'template' ? 'Template' : 'AI Generated'}
          </span>
          {iteration.templateId && (
            <span style={styles.templateId}>{iteration.templateId}</span>
          )}
        </div>
        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: statusColor(iteration.status),
          }}
        >
          {iteration.status}
        </div>
      </div>

      {/* Carousel selector (shown when carouselCount > 1) */}
      {slotSchema && slotSchema.carouselCount != null && slotSchema.carouselCount > 1 && (
        <div style={styles.section}>
          <CarouselSelector
            carouselCount={slotSchema.carouselCount}
            iframeEl={iframeEl}
          />
        </div>
      )}

      {/* Slot fields */}
      <div style={styles.fieldsContainer}>
        {slotSchema == null ? (
          <div style={styles.noSchema}>
            No editable slots available for this asset.
          </div>
        ) : slotSchema.fields.length === 0 ? (
          <div style={styles.noSchema}>
            No editable fields defined in the slot schema.
          </div>
        ) : (
          slotSchema.fields.map((field, index) => (
            <SlotField
              key={field.type === 'divider' ? `divider-${index}` : field.sel}
              field={field}
            />
          ))
        )}
      </div>

      {/* Position / scale / rotate — click text or image in the preview to select */}
      {slotSchema && collectTransformTargets(slotSchema).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Layout in preview</div>
          <p style={styles.pickHint}>
            Click any editable text or image in the preview. A blue outline shows the selection.
            <strong> Text:</strong> drag the filled frame to move (snaps when edges line up with other edges,
            or centers with centers — including artboard center; hold <strong>Shift</strong> to disable) or
            use the top handle to rotate; use the
            dashed box edges for width (fixed width wraps copy; Hug width grows to fit) and bottom for
            height — those snaps match other slots’ widths/heights and edges (hold <strong>Shift</strong> to
            disable). Corner scaling
            would stretch type — use the dashed box instead.
            <strong> Image / photo:</strong> click the picture in the preview, then drag the blue frame to
            move — edge-to-edge and center-to-center snapping vs other slots and the artboard (hold{' '}
            <strong>Shift</strong> to move freely). Corner scaling snaps to the same sizes and edges when
            axis-aligned. Use the top handle to rotate (or use the fields below).{' '}
            <strong> Brush:</strong> same as image.
          </p>
          {pickedTransform && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={styles.pickedRow}>
                <span style={styles.pickedLabel}>Selected:</span>
                <span style={styles.pickedName}>{pickedTransform.label}</span>
                <button
                  type="button"
                  onClick={() => setPickedTransform(null)}
                  style={styles.clearPickBtn}
                >
                  Clear
                </button>
              </div>
              {pickedTransform.kind === 'text' ? (
                <div key={pickedTransform.sel}>
                  <TextBoxControls
                    textSel={pickedTransform.sel}
                    textLabel={pickedTransform.label}
                    iframeEl={iframeEl}
                  />
                  <div style={{ marginTop: '0.85rem' }}>
                    <BrushTransform
                      brushSel={pickedTransform.sel}
                      brushLabel={pickedTransform.label}
                      assetWidth={slotSchema.width}
                      assetHeight={slotSchema.height}
                      iframeEl={iframeEl}
                      layoutOnly
                    />
                  </div>
                </div>
              ) : (
                <BrushTransform
                  key={pickedTransform.sel}
                  brushSel={pickedTransform.sel}
                  brushLabel={pickedTransform.label}
                  assetWidth={slotSchema.width}
                  assetHeight={slotSchema.height}
                  iframeEl={iframeEl}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Export section */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Export</div>
        <ExportActions
          iteration={iteration}
          iframeEl={iframeEl}
        />
      </div>

      {/* Save button */}
      {isDirty && (
        <div style={styles.saveBar}>
          <button
            style={styles.saveButton}
            onClick={() => saveUserState()}
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

function statusColor(status: Iteration['status']): string {
  switch (status) {
    case 'winner': return 'rgba(34, 197, 94, 0.2)';
    case 'rejected': return 'rgba(239, 68, 68, 0.2)';
    case 'final': return 'rgba(68, 178, 255, 0.2)';
    default: return 'rgba(100, 100, 120, 0.2)';
  }
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    padding: '0.75rem',
    boxSizing: 'border-box',
    backgroundColor: '#111111',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #1e1e1e',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  iterationLabel: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  templateId: {
    fontSize: '0.65rem',
    color: '#555',
  },
  statusBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#ccc',
  },
  section: {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #1e1e1e',
  },
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '0.5rem',
  },
  pickHint: {
    fontSize: '0.75rem',
    color: '#777',
    lineHeight: 1.5,
    margin: '0 0 0.75rem 0',
  },
  pickedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem',
  },
  pickedLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  pickedName: {
    fontSize: '0.78rem',
    color: '#44B2FF',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clearPickBtn: {
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid #333',
    background: '#1a1a1e',
    color: '#aaa',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  fieldsContainer: {
    flex: 1,
    marginBottom: '1rem',
  },
  noSchema: {
    fontSize: '0.8rem',
    color: '#555',
    fontStyle: 'italic',
    padding: '1rem 0',
    textAlign: 'center',
  },
  empty: {
    fontSize: '0.8rem',
    color: '#555',
    fontStyle: 'italic',
    padding: '2rem 0',
    textAlign: 'center',
  },
  saveBar: {
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#111111',
    paddingTop: '0.75rem',
    paddingBottom: '0.5rem',
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#44B2FF',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
};
