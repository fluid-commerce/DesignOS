/**
 * ContentEditor — right sidebar container for the slot-driven editor.
 * Renders SlotField components for each field in the slot schema.
 * Integrates with BrushTransform, CarouselSelector, and ExportActions.
 *
 * Connects to the iframe via the editor store's iframeRef and postMessage IPC.
 * On mount, sends a 'readValues' request to extract current template values.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { Iteration } from '../lib/campaign-types';
import {
  collectTransformTargets,
  slotFieldSelFromLayoutPick,
  type GroupField,
  type ImageField,
  type TextField,
  type TransformTargetKind,
} from '../lib/slot-schema';
import { useEditorStore } from '../store/editor';
import { filterFieldsForSlide, brushVisibleForSlide } from '../lib/slot-schema-filter';
import { SlotField } from './SlotField';
import { BrushTransform } from './BrushTransform';
import { TextBoxControls } from './TextBoxControls';
import { CarouselSelector } from './CarouselSelector';
import { ExportActions } from './ExportActions';

const PICK_KINDS: TransformTargetKind[] = ['text', 'image', 'brush', 'group'];

function parsePickKind(v: unknown): TransformTargetKind {
  return typeof v === 'string' && (PICK_KINDS as string[]).includes(v)
    ? (v as TransformTargetKind)
    : 'image';
}

function statusColor(status: string): string {
  switch (status) {
    case 'winner':
      return '#44b574';
    case 'rejected':
      return '#e05555';
    case 'final':
      return '#44B2FF';
    default:
      return '#555';
  }
}

function GroupSection({
  group,
  contentTargetSel,
  contentPickEpoch,
}: {
  group: GroupField;
  contentTargetSel: string | null;
  contentPickEpoch: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      style={{
        marginBottom: '0.5rem',
        border: '1px solid #1e1e1e',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          width: '100%',
          padding: '8px 10px',
          background: '#161618',
          border: 'none',
          color: '#ccc',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            fontSize: '0.6rem',
            color: '#666',
          }}
        >
          &#9654;
        </span>
        {group.label}
      </button>
      {expanded && (
        <div style={{ padding: '4px 10px 8px' }}>
          {group.fields.map((field, i) => (
            <SlotField
              key={`${group.id}-${field.sel}-${i}`}
              field={field}
              contentTargetSel={contentTargetSel}
              contentPickEpoch={contentPickEpoch}
            />
          ))}
        </div>
      )}
    </div>
  );
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
    activeCarouselSlide,
    selectIteration,
    setIframeRef,
    updateSlotValue,
    setPickedTransform,
    saveUserState,
    clearSelection,
  } = useEditorStore();

  const carouselMode =
    slotSchema != null && slotSchema.carouselCount != null && slotSchema.carouselCount > 1;

  const visibleFields = useMemo(
    () =>
      slotSchema ? filterFieldsForSlide(slotSchema.fields, activeCarouselSlide, carouselMode) : [],
    [slotSchema, activeCarouselSlide, carouselMode],
  );

  const showBrush = useMemo(
    () => brushVisibleForSlide(slotSchema?.brush, activeCarouselSlide, carouselMode),
    [slotSchema?.brush, activeCarouselSlide, carouselMode],
  );

  const hasInitialized = useRef(false);
  /** Bumps on each preview pick so the same text field can refocus on repeat clicks. */
  const [contentPickEpoch, setContentPickEpoch] = useState(0);

  const contentTargetSel = useMemo(
    () => slotFieldSelFromLayoutPick(slotSchema, pickedTransform),
    [slotSchema, pickedTransform],
  );

  /** Slot schema field that matches the current artboard pick (text or image content). */
  const selectedSlotField = useMemo(() => {
    if (!slotSchema || !contentTargetSel) return null;
    const f = slotSchema.fields.find(
      (x): x is TextField | ImageField =>
        (x.type === 'text' || x.type === 'image') && x.sel === contentTargetSel,
    );
    return f ?? null;
  }, [slotSchema, contentTargetSel]);

  const hasLayoutPicks = slotSchema != null && collectTransformTargets(slotSchema).length > 0;

  /** Artboard has an active pick — sidebar shows only that layer's controls (not the full slot list). */
  const artboardSelectionActive = Boolean(pickedTransform && hasLayoutPicks);

  const propertiesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickedTransform || !propertiesRef.current) return;
    propertiesRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pickedTransform?.sel, pickedTransform?.kind]);

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
        const kind = parsePickKind(d.kind);
        setPickedTransform({
          sel: d.sel,
          label,
          kind,
        });
        const sch = useEditorStore.getState().slotSchema;
        const fk = slotFieldSelFromLayoutPick(sch, { sel: d.sel, kind });
        if (fk) setContentPickEpoch((n) => n + 1);
        return;
      }

      /** Live text typed directly on the preview (contenteditable); keeps sidebar in sync. */
      if (
        d.type === 'fluidArtboardTextInput' &&
        typeof d.sel === 'string' &&
        typeof d.value === 'string'
      ) {
        if (!iframeEl?.contentWindow || e.source !== iframeEl.contentWindow) return;
        const mode = typeof d.mode === 'string' ? d.mode : 'text';
        updateSlotValue(d.sel, d.value, mode, { skipIframeEcho: true });
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
    [iframeEl, updateSlotValue, setPickedTransform],
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

  // After iframe load/reload, HTML resets to slide 1; re-apply the sidebar's active slide.
  // Without this, tab "02" can be selected while the preview still shows frame 1 (or blank if go(NaN) ran).
  useEffect(() => {
    if (!iframeEl || !carouselMode || !selectedIterationId) return;
    const syncCarouselSlide = () => {
      const slide = useEditorStore.getState().activeCarouselSlide;
      iframeEl.contentWindow?.postMessage({ type: 'setSlide', slide }, '*');
    };
    iframeEl.addEventListener('load', syncCarouselSlide);
    if (iframeEl.contentDocument?.readyState === 'complete') {
      syncCarouselSlide();
    }
    return () => iframeEl.removeEventListener('load', syncCarouselSlide);
  }, [iframeEl, carouselMode, selectedIterationId]);

  // Empty state — nothing selected
  if (!iteration) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Select an iteration to edit its content.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div
        style={
          artboardSelectionActive ? { ...styles.header, ...styles.headerCompact } : styles.header
        }
      >
        <div style={styles.headerInfo}>
          <span style={styles.iterationLabel}>
            {carouselMode && !artboardSelectionActive
              ? `Slide ${String(activeCarouselSlide).padStart(2, '0')}`
              : iteration.source === 'template'
                ? 'Template'
                : 'AI Generated'}
            {artboardSelectionActive && iteration.templateId ? ` · ${iteration.templateId}` : null}
          </span>
          {!artboardSelectionActive && iteration.templateId && (
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
          <CarouselSelector carouselCount={slotSchema.carouselCount} iframeEl={iframeEl} />
        </div>
      )}

      {/* Selection / properties — when a layer is picked, this is the only field block (see Content below). */}
      {slotSchema && (
        <div
          ref={propertiesRef}
          style={
            artboardSelectionActive ? { ...styles.section, ...styles.sectionFocus } : styles.section
          }
        >
          {!(artboardSelectionActive && pickedTransform) && (
            <div style={styles.sectionLabel}>Properties</div>
          )}
          {!hasLayoutPicks ? (
            <div style={styles.panelMutedLine}>No artboard layers — use Content below.</div>
          ) : !pickedTransform ? (
            <div style={styles.panelMutedLine}>Select a layer on the artboard.</div>
          ) : (
            <div style={styles.propertiesCard}>
              <div style={styles.selectionInputsHeader}>
                <span style={styles.selectionInputsTitle}>{pickedTransform.label}</span>
                <button
                  type="button"
                  onClick={() => setPickedTransform(null)}
                  style={styles.clearPickBtn}
                  title="Show all content fields again"
                >
                  All fields
                </button>
              </div>

              <div style={styles.selectionInputsColumn}>
                {selectedSlotField && (
                  <div>
                    <div style={styles.panelSectionLabel}>
                      {selectedSlotField.type === 'text' ? 'Text' : 'Image'}
                    </div>
                    <SlotField
                      field={selectedSlotField}
                      contentTargetSel={contentTargetSel}
                      contentPickEpoch={contentPickEpoch}
                    />
                  </div>
                )}
                {pickedTransform.kind === 'text' ? (
                  <div key={pickedTransform.sel} style={styles.selectionTextLayoutStack}>
                    <div>
                      <div style={styles.panelSectionLabel}>Text frame</div>
                      <TextBoxControls
                        textSel={pickedTransform.sel}
                        textLabel={pickedTransform.label}
                        iframeEl={iframeEl}
                      />
                    </div>
                    <div>
                      <div style={styles.panelSectionLabel}>Position</div>
                      <BrushTransform
                        brushSel={pickedTransform.sel}
                        brushLabel={pickedTransform.label}
                        assetWidth={slotSchema.width}
                        assetHeight={slotSchema.height}
                        iframeEl={iframeEl}
                      />
                    </div>
                  </div>
                ) : (
                  <div key={pickedTransform.sel}>
                    <div style={styles.panelSectionLabel}>Position</div>
                    <BrushTransform
                      brushSel={pickedTransform.sel}
                      brushLabel={pickedTransform.label}
                      assetWidth={slotSchema.width}
                      assetHeight={slotSchema.height}
                      iframeEl={iframeEl}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content fields — hidden while a layer is picked; filtered by carousel slide when in carousel mode */}
      {!artboardSelectionActive && (
        <div style={styles.fieldsContainer}>
          {slotSchema == null ? (
            <div style={styles.noSchema}>No editable slots available for this asset.</div>
          ) : visibleFields.length === 0 ? (
            <div style={styles.noSchema}>
              {carouselMode
                ? 'No fields for this slide.'
                : 'No editable fields defined in the slot schema.'}
            </div>
          ) : (
            <>
              <div style={styles.sectionLabel}>Content</div>
              {visibleFields.map((field, index) => {
                if (field.type === 'group') {
                  return (
                    <GroupSection
                      key={`group-${field.id}-${index}`}
                      group={field}
                      contentTargetSel={contentTargetSel}
                      contentPickEpoch={contentPickEpoch}
                    />
                  );
                }
                return (
                  <SlotField
                    key={
                      field.type === 'divider'
                        ? `divider-${activeCarouselSlide}-${index}`
                        : `${field.sel}-${index}`
                    }
                    field={field}
                    contentTargetSel={contentTargetSel}
                    contentPickEpoch={contentPickEpoch}
                  />
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Schema brush / transform — when not in artboard pick mode */}
      {slotSchema?.brush && showBrush && !artboardSelectionActive && (
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
        <ExportActions iteration={iteration} iframeEl={iframeEl} />
      </div>

      {/* Save button */}
      {isDirty && (
        <div style={styles.saveBar}>
          <button style={styles.saveButton} onClick={() => saveUserState()}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
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
  headerCompact: {
    marginBottom: '0.65rem',
    paddingBottom: '0.5rem',
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
    fontSize: '0.72rem',
    color: '#aaa',
    fontFamily: 'ui-monospace, monospace',
  },
  statusBadge: {
    fontSize: '0.62rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '4px 8px',
    borderRadius: 4,
    color: '#e8e8e8',
    flexShrink: 0,
  },
  section: {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #1e1e1e',
  },
  /** Less separator noise when the sidebar is only the active layer. */
  sectionFocus: {
    borderBottom: 'none',
    marginBottom: '0.65rem',
    paddingBottom: '0.35rem',
  },
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '0.5rem',
  },
  panelMutedLine: {
    fontSize: '0.72rem',
    color: '#666',
    padding: '0.35rem 0',
  },
  panelSectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '0.45rem',
  },
  propertiesCard: {
    borderRadius: 6,
    border: '1px solid #2a2a2e',
    backgroundColor: '#161618',
    padding: '0.6rem 0.7rem',
  },
  selectionInputsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.65rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #222226',
  },
  selectionInputsTitle: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#e8e8e8',
    lineHeight: 1.25,
    wordBreak: 'break-word',
    flex: 1,
    minWidth: 0,
  },
  selectionInputsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  selectionTextLayoutStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
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
