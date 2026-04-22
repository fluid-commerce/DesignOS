import { useState, useRef, useEffect } from 'react';
import type { Iteration } from '../lib/campaign-types';
import { useCampaignStore } from '../store/campaign';

interface VersionBarProps {
  iterations: Iteration[];
  activeIterationId: string | null;
}

/**
 * VersionBar — collapsible bottom bar showing iteration thumbnails for the current slide.
 * Only renders when there are 2+ iterations.
 */
export function VersionBar({ iterations, activeIterationId }: VersionBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectIteration = useCampaignStore((s) => s.selectIteration);
  const toggleIterationStatus = useCampaignStore((s) => s.toggleIterationStatus);

  // Sort: winner first, then unmarked/final by index, then rejected last
  const sorted = [...iterations].sort((a, b) => {
    const rank = (it: Iteration) => {
      if (it.status === 'winner') return 0;
      if (it.status === 'rejected') return 2;
      return 1;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.iterationIndex - b.iterationIndex;
  });

  const activeIndex = sorted.findIndex((it) => it.id === activeIterationId);
  const total = sorted.length;

  // Scroll active thumbnail into view when it changes
  useEffect(() => {
    if (!scrollRef.current || activeIndex < 0) return;
    const container = scrollRef.current;
    const thumb = container.children[activeIndex] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  if (iterations.length < 2) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: 'rgba(50, 48, 48, 0.8)',
        borderRadius: '7.027px',
        margin: '0 12px 12px 12px',
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
        maxHeight: collapsed ? 32 : 200,
      }}
    >
      {/* Collapse toggle */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#888"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#aaa',
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.04em',
              }}
            >
              Slide Versions{' '}
              <span style={{ color: '#3ba9ff' }}>
                {activeIndex >= 0 ? activeIndex + 1 : '?'}/{total}
              </span>
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleScrollLeft} style={navBtnStyle} title="Scroll left">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button onClick={handleScrollRight} style={navBtnStyle} title="Scroll right">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div
            ref={scrollRef}
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              paddingBottom: 4,
            }}
          >
            {sorted.map((iter) => {
              const isActive = iter.id === activeIterationId;
              const isWinner = iter.status === 'winner';
              const isRejected = iter.status === 'rejected';

              return (
                <div
                  key={iter.id}
                  onClick={() => selectIteration(iter.id)}
                  style={{
                    position: 'relative',
                    width: 114,
                    height: 114,
                    flexShrink: 0,
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: isActive
                      ? '2px solid #44b2ff'
                      : isWinner
                        ? '2px solid #44b2ff'
                        : '2px solid transparent',
                    boxShadow: isActive ? '0 0 8px rgba(68, 178, 255, 0.3)' : 'none',
                    opacity: isRejected ? 0.4 : 1,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, opacity 0.15s, box-shadow 0.15s',
                    backgroundColor: '#1a1a1a',
                  }}
                >
                  {/* Thumbnail iframe */}
                  <iframe
                    src={`/api/iterations/${iter.id}/html`}
                    sandbox="allow-same-origin"
                    style={{
                      width: 1080,
                      height: 1080,
                      border: 'none',
                      transform: `scale(${114 / 1080})`,
                      transformOrigin: 'top left',
                      pointerEvents: 'none',
                    }}
                    title={`Version ${iter.iterationIndex + 1}`}
                  />

                  {/* Rejected overlay: diagonal X lines */}
                  {isRejected && (
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                      }}
                      viewBox="0 0 114 114"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="114"
                        y2="114"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                      />
                      <line
                        x1="114"
                        y1="0"
                        x2="0"
                        y2="114"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                      />
                    </svg>
                  )}

                  {/* Star button (top-left) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIterationStatus(iter.id, 'winner');
                    }}
                    title={isWinner ? 'Unstar' : 'Star as winner'}
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      padding: 0,
                      color: isWinner ? '#44b2ff' : '#888',
                      fontSize: 12,
                      transition: 'color 0.15s',
                    }}
                  >
                    {isWinner ? '\u2605' : '\u2606'}
                  </button>

                  {/* Reject button (top-right) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIterationStatus(iter.id, 'rejected');
                    }}
                    title={isRejected ? 'Unreject' : 'Reject'}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      padding: 0,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'color 0.15s',
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.06)',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#888',
  padding: 0,
  transition: 'color 0.15s, background 0.15s',
};
