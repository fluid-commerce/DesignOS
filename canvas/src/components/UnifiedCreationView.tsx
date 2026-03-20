import { useState, useRef, useEffect, useCallback } from 'react';
import { useCampaignStore } from '../store/campaign';
import { useEditorStore } from '../store/editor';
import { getCreationDimensions } from '../lib/preview-utils';
import { clearIframeClientRectModeCache } from '../lib/iframe-overlay-geometry';
import { slotMapsEqual } from '../lib/editor-history';
import { Breadcrumb } from './Breadcrumb';
import { VersionBar } from './VersionBar';
import { TransformOverlay } from './TransformOverlay';
import { TextBoxOverlay } from './TextBoxOverlay';

interface UnifiedCreationViewProps {
  onIframeRef: (el: HTMLIFrameElement | null) => void;
}

/**
 * UnifiedCreationView — replaces both slide grid and iteration grid views.
 * Shows the active iteration full-size with slide carousel navigation
 * and a collapsible VersionBar at the bottom.
 */
export function UnifiedCreationView({ onIframeRef }: UnifiedCreationViewProps) {
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const activeSlideId = useCampaignStore((s) => s.activeSlideId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);
  const creations = useCampaignStore((s) => s.creations);
  const slides = useCampaignStore((s) => s.slides);
  const iterations = useCampaignStore((s) => s.iterations);
  const setActiveSlide = useCampaignStore((s) => s.setActiveSlide);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [hoverArrow, setHoverArrow] = useState<'left' | 'right' | null>(null);

  const creation = creations.find((c) => c.id === activeCreationId);
  const dims = getCreationDimensions(creation?.creationType ?? 'instagram');
  const isMultiSlide = slides.length > 1;

  // Current slide index (0-based)
  const currentSlideIndex = slides.findIndex((s) => s.id === activeSlideId);

  // Iterations for the current slide
  const slideIterations = iterations.filter((it) => it.slideId === activeSlideId);

  // Compute scale to fit
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      // Reserve space for slide tabs if multi-slide
      const availW = isMultiSlide ? cw - 60 : cw;
      const scaleX = availW / dims.width;
      const scaleY = ch / dims.height;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [dims.width, dims.height, isMultiSlide]);

  // Navigate slides
  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    setActiveSlide(slides[index].id);
  }, [slides, setActiveSlide]);

  const goPrev = useCallback(() => {
    if (currentSlideIndex > 0) goToSlide(currentSlideIndex - 1);
  }, [currentSlideIndex, goToSlide]);

  const goNext = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) goToSlide(currentSlideIndex + 1);
  }, [currentSlideIndex, slides.length, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  /** Enter — start artboard inline text edit when a text slot is selected (overlay blocks dblclick on text). */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.tagName === 'BUTTON' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!iframeEl?.contentWindow || !activeIterationId) return;
      const picked = useEditorStore.getState().pickedTransform;
      if (!picked || picked.kind !== 'text') return;
      e.preventDefault();
      iframeEl.contentWindow.postMessage({ type: 'fluidStartArtboardEdit', sel: picked.sel }, '*');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [iframeEl, activeIterationId]);

  // Undo / redo — avoid stealing native Cmd+Z from inputs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) useEditorStore.getState().redo();
      else useEditorStore.getState().undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top: Breadcrumb bar + edit history */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0.75rem 1.25rem',
        flexShrink: 0,
        borderBottom: '1px solid #1e1e1e',
      }}>
        <Breadcrumb />
        <CreationEditHistoryToolbar />
      </div>

      {/* Middle: Main preview area */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Slide tabs (left strip) — only for multi-slide */}
        {isMultiSlide && (
          <div style={{
            width: 48,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            paddingTop: 16,
            borderRight: '1px solid #1a1a1a',
            overflowY: 'auto',
          }}>
            {slides.map((slide, i) => {
              const isActiveSlide = slide.id === activeSlideId;
              return (
                <button
                  key={slide.id}
                  onClick={() => goToSlide(i)}
                  title={`Slide ${i + 1}`}
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRadius: 6,
                    background: isActiveSlide ? 'rgba(68, 178, 255, 0.15)' : 'transparent',
                    color: isActiveSlide ? '#44B2FF' : '#666',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                    fontFamily: "'Inter', sans-serif",
                    position: 'relative',
                    padding: 0,
                  }}
                >
                  {/* Blue indicator bar */}
                  {isActiveSlide && (
                    <div style={{
                      position: 'absolute',
                      left: -1,
                      top: 4,
                      bottom: 4,
                      width: 3,
                      borderRadius: 2,
                      backgroundColor: '#44B2FF',
                    }} />
                  )}
                  {String(i + 1).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        )}

        {/* Preview container */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: 24,
            minWidth: 0,
          }}
        >
          {activeIterationId ? (
            <div
              ref={previewWrapRef}
              style={{
              width: dims.width * scale,
              height: dims.height * scale,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 4,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
            >
              <iframe
                ref={(el) => {
                  setIframeEl(el);
                  onIframeRef(el);
                }}
                onLoad={(e) => clearIframeClientRectModeCache(e.currentTarget)}
                src={`/api/iterations/${activeIterationId}/html`}
                sandbox="allow-same-origin allow-scripts"
                style={{
                  width: dims.width,
                  height: dims.height,
                  border: 'none',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
                title="Creation preview"
              />
              <TransformOverlay
                iframeEl={iframeEl}
                previewScale={scale}
                wrapRef={previewWrapRef}
              />
              <TextBoxOverlay iframeEl={iframeEl} wrapRef={previewWrapRef} />
            </div>
          ) : (
            <div style={{
              color: '#555',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}>
              No iterations available for this slide
            </div>
          )}

          {/* Carousel arrows — only for multi-slide, appear on hover */}
          {isMultiSlide && currentSlideIndex > 0 && (
            <button
              onClick={goPrev}
              onMouseEnter={() => setHoverArrow('left')}
              onMouseLeave={() => setHoverArrow(null)}
              style={{
                ...arrowStyle,
                left: isMultiSlide ? 60 : 12,
                opacity: hoverArrow === 'left' ? 0.9 : 0.4,
              }}
              title="Previous slide"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {isMultiSlide && currentSlideIndex < slides.length - 1 && (
            <button
              onClick={goNext}
              onMouseEnter={() => setHoverArrow('right')}
              onMouseLeave={() => setHoverArrow(null)}
              style={{
                ...arrowStyle,
                right: 12,
                opacity: hoverArrow === 'right' ? 0.9 : 0.4,
              }}
              title="Next slide"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Bottom: Version bar */}
      <VersionBar
        iterations={slideIterations}
        activeIterationId={activeIterationId}
      />
    </div>
  );
}

/** Undo / redo / reset — mirrors editor slotValues; iteration must be selected in editor */
function CreationEditHistoryToolbar() {
  const selectedIterationId = useEditorStore((s) => s.selectedIterationId);
  const undoStackLen = useEditorStore((s) => s.undoStack.length);
  const redoStackLen = useEditorStore((s) => s.redoStack.length);
  const slotValues = useEditorStore((s) => s.slotValues);
  const baselineSlotValues = useEditorStore((s) => s.baselineSlotValues);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const resetToBaseline = useEditorStore((s) => s.resetToBaseline);

  const canUndo = undoStackLen > 0;
  const canRedo = redoStackLen > 0;
  const canReset =
    selectedIterationId != null && !slotMapsEqual(slotValues, baselineSlotValues);
  const disabled = !selectedIterationId;

  const btnBase: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #2a2a2e',
    background: '#1a1a1e',
    color: '#ccc',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    opacity: disabled ? 0.45 : 1,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}
      aria-label="Edit history"
    >
      <button
        type="button"
        style={{
          ...btnBase,
          opacity: disabled || !canUndo ? 0.45 : 1,
          cursor: disabled || !canUndo ? 'not-allowed' : 'pointer',
        }}
        disabled={disabled || !canUndo}
        onClick={() => undo()}
        title="Undo (⌘Z)"
      >
        Undo
      </button>
      <button
        type="button"
        style={{
          ...btnBase,
          opacity: disabled || !canRedo ? 0.45 : 1,
          cursor: disabled || !canRedo ? 'not-allowed' : 'pointer',
        }}
        disabled={disabled || !canRedo}
        onClick={() => redo()}
        title="Redo (⇧⌘Z)"
      >
        Redo
      </button>
      <button
        type="button"
        style={{
          ...btnBase,
          borderColor: '#3d3a2a',
          color: '#ddb',
          opacity: disabled || !canReset ? 0.45 : 1,
          cursor: disabled || !canReset ? 'not-allowed' : 'pointer',
        }}
        disabled={disabled || !canReset}
        onClick={() => resetToBaseline()}
        title="Discard unsaved edits since load or last save"
      >
        Reset
      </button>
    </div>
  );
}

const arrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(20, 20, 20, 0.7)',
  border: '1px solid #2a2a2e',
  borderRadius: 8,
  color: '#ccc',
  cursor: 'pointer',
  padding: 0,
  transition: 'opacity 0.15s ease',
  zIndex: 10,
};
