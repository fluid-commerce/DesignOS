/**
 * CarouselSelector — slide tab strip for multi-frame assets.
 * Shown when slotSchema.carouselCount > 1.
 *
 * Clicking a slide tab sends postMessage({ type: 'setSlide', slide: N }) to
 * the iframe to navigate to that frame.
 */

import { useState } from 'react';
import { useEditorStore } from '../store/editor';

interface CarouselSelectorProps {
  carouselCount: number;
  /** The scaled iframe element (used for postMessage) */
  iframeEl: HTMLIFrameElement | null;
}

export function CarouselSelector({ carouselCount, iframeEl }: CarouselSelectorProps) {
  const { iframeRef } = useEditorStore();
  const [activeSlide, setActiveSlide] = useState(1);

  const navigateToSlide = (slideIndex: number) => {
    setActiveSlide(slideIndex);
    const targetWindow = (iframeRef ?? iframeEl)?.contentWindow;
    if (targetWindow) {
      targetWindow.postMessage({ type: 'setSlide', slide: slideIndex }, '*');
    }
  };

  if (carouselCount <= 1) return null;

  return (
    <div style={styles.container}>
      <div style={styles.label}>Slides</div>
      <div style={styles.tabs}>
        {Array.from({ length: carouselCount }, (_, i) => {
          const slideNum = i + 1;
          const isActive = activeSlide === slideNum;
          return (
            <button
              key={slideNum}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => navigateToSlide(slideNum)}
              title={`Slide ${slideNum}`}
            >
              {String(slideNum).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '0.5rem',
  },
  label: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: '0.4rem',
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  tab: {
    flex: '1 0 36px',
    minWidth: 36,
    padding: '5px 4px',
    border: '1px solid #1a1a2e',
    borderRadius: 2,
    backgroundColor: 'transparent',
    color: '#444',
    fontFamily: 'inherit',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'color 0.12s, border-color 0.12s, background 0.12s',
    textAlign: 'center',
  },
  tabActive: {
    color: '#44B2FF',
    borderColor: 'rgba(68,178,255,0.35)',
    backgroundColor: 'rgba(68,178,255,0.06)',
  },
};
