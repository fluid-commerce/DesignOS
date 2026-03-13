import { useState, useRef, useEffect, useCallback } from 'react';
import { useCampaignStore } from '../store/campaign';
import { getCreationDimensions } from '../lib/preview-utils';
import { Breadcrumb } from './Breadcrumb';
import { VersionBar } from './VersionBar';

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top: Breadcrumb bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 1.25rem',
        flexShrink: 0,
        borderBottom: '1px solid #1e1e1e',
      }}>
        <Breadcrumb />
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
            <div style={{
              width: dims.width * scale,
              height: dims.height * scale,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 4,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <iframe
                ref={(el) => onIframeRef(el)}
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
