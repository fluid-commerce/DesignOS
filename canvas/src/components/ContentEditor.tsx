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
import { useEditorStore } from '../store/editor';
import { SlotField } from './SlotField';
import { BrushTransform } from './BrushTransform';
import { CarouselSelector } from './CarouselSelector';
import { ExportActions } from './ExportActions';

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
    selectIteration,
    setIframeRef,
    updateSlotValue,
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

  // Listen for postMessage responses from iframe (value extraction on first load)
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'readValuesResult') return;
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
    [updateSlotValue]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // On first load: either request current values from iframe (no saved state) or apply saved state is in HTML on load
  useEffect(() => {
    if (!slotSchema || !iframeEl?.contentWindow || hasInitialized.current) return;
    if (!selectedIterationId) return;
    hasInitialized.current = true;

    // When we have no stored values, ask iframe for current DOM values (selectors from schema)
    if (Object.keys(slotValues).length === 0) {
      const selectors = slotSchema.fields
        .filter((f): f is { type: 'text'; sel: string } | { type: 'image'; sel: string } => f.type === 'text' || f.type === 'image')
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

      {/* Brush / Transform section */}
      {slotSchema?.brush && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            {slotSchema.brushLabel
              ? slotSchema.brushLabel.charAt(0).toUpperCase() + slotSchema.brushLabel.slice(1)
              : 'Transform'}
          </div>
          <BrushTransform
            brushSel={slotSchema.brush}
            brushLabel={slotSchema.brushLabel}
            assetWidth={slotSchema.width}
            assetHeight={slotSchema.height}
            iframeEl={iframeEl}
          />
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
