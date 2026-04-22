import type { ReactNode } from 'react';
import { Breadcrumb } from './Breadcrumb';
import { PREVIEW_CHROME_PADDING_PX } from '../lib/preview-utils';

/**
 * Preview descriptor returned by the `renderPreview` prop.
 * Provide either `html` (srcDoc) or `src` (URL) for the iframe.
 * If neither is set, a metadata-only card is shown using `meta`.
 */
export interface PreviewDescriptor {
  html?: string;
  src?: string;
  width: number;
  height: number;
  /** Optional metadata to display instead of an iframe preview */
  meta?: {
    badges?: string[];
    detail?: string;
    icon?: 'campaign' | 'asset' | 'frame';
  };
}

/**
 * A generic item shown in the drill-down grid.
 * The caller supplies typed items and a renderPreview function that maps each
 * item to an iframe preview.
 */
export interface DrillDownItem<T> {
  id: string;
  title: string;
  subtitle?: ReactNode;
  data: T;
}

interface DrillDownGridProps<T> {
  items: DrillDownItem<T>[];
  /** Returns the html + native dimensions for an item's preview iframe */
  renderPreview: (item: DrillDownItem<T>) => PreviewDescriptor | null;
  onSelect: (item: DrillDownItem<T>) => void;
  /** Optional context-menu actions for each item */
  onAction?: (item: DrillDownItem<T>, action: string) => void;
  emptyState?: ReactNode;
  title?: string;
  /** When true, show breadcrumb in the header for navigating back to the index */
  showBreadcrumb?: boolean;
  /** Optional slot rendered after the title (e.g., "New Campaign" button) */
  headerActions?: ReactNode;
}

const PREVIEW_DISPLAY_WIDTH = 320;

function ItemCard<T>({
  item,
  renderPreview,
  onSelect,
  onAction,
}: {
  item: DrillDownItem<T>;
  renderPreview: (item: DrillDownItem<T>) => PreviewDescriptor | null;
  onSelect: (item: DrillDownItem<T>) => void;
  onAction?: (item: DrillDownItem<T>, action: string) => void;
}) {
  const preview = renderPreview(item);
  const hasIframe = preview && (preview.html || preview.src);
  const m = PREVIEW_CHROME_PADDING_PX;
  const innerW = Math.max(1, PREVIEW_DISPLAY_WIDTH - 2 * m);
  const scale = hasIframe ? innerW / preview!.width : 1;
  const innerH = hasIframe ? preview!.height * scale : Math.max(1, 180 - 2 * m);
  const displayHeight = hasIframe ? innerH + 2 * m : 180;

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        border: '1px solid #1e1e1e',
        backgroundColor: '#141414',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#44B2FF';
        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(68, 178, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1e1e1e';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Preview area */}
      <div
        style={{
          width: PREVIEW_DISPLAY_WIDTH,
          height: displayHeight,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#111111',
          flexShrink: 0,
          padding: m,
          boxSizing: 'border-box',
        }}
      >
        {hasIframe ? (
          <div
            style={{
              width: innerW,
              height: innerH,
              overflow: 'hidden',
              position: 'relative',
              borderRadius: 4,
            }}
          >
            <iframe
              {...(preview.html ? { srcDoc: preview.html } : { src: preview.src })}
              sandbox="allow-same-origin"
              style={{
                width: preview.width,
                height: preview.height,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
              }}
              title={item.title}
            />
          </div>
        ) : preview?.meta ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '0.625rem',
              padding: '1rem',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Icon */}
            {preview.meta.icon === 'campaign' && (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2a2a2e"
                strokeWidth="1.25"
                strokeLinecap="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
            {preview.meta.icon === 'asset' && (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2a2a2e"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
            {preview.meta.icon === 'frame' && (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2a2a2e"
                strokeWidth="1.25"
                strokeLinecap="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            )}
            {/* Badges */}
            {preview.meta.badges && preview.meta.badges.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.3rem',
                  justifyContent: 'center',
                }}
              >
                {preview.meta.badges.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.6rem',
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(68,178,255,0.1)',
                      color: '#44B2FF',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
            {/* Detail */}
            {preview.meta.detail && (
              <span style={{ fontSize: '0.7rem', color: '#3a3a3a', textAlign: 'center' }}>
                {preview.meta.detail}
              </span>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '0.5rem',
              color: '#3a3a3a',
              fontSize: '0.75rem',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2a2a2e"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ color: '#2e2e2e' }}>No preview</span>
          </div>
        )}
      </div>

      {/* Title overlay bar */}
      <div
        style={{
          padding: '0.625rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #1e1e1e',
          gap: '0.5rem',
        }}
      >
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#e0e0e0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {item.title}
          </div>
          {item.subtitle && (
            <div
              style={{
                fontSize: '0.7rem',
                color: '#666',
                marginTop: '0.125rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {item.subtitle}
            </div>
          )}
        </div>

        {/* Context menu trigger */}
        {onAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction(item, 'menu');
            }}
            title="More actions"
            style={{
              background: 'none',
              border: 'none',
              color: '#444',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              fontSize: '1rem',
              lineHeight: 1,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
          >
            ···
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * DrillDownGrid — reusable grid for all navigation levels.
 *
 * Full-size iframe previews at native dimensions (not thumbnails).
 * Handles empty state gracefully.
 */
export function DrillDownGrid<T>({
  items,
  renderPreview,
  onSelect,
  onAction,
  emptyState,
  title,
  showBreadcrumb = false,
  headerActions,
}: DrillDownGridProps<T>) {
  const defaultEmpty = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        color: '#555',
        fontSize: '0.9rem',
        gap: '0.5rem',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2a2a2e"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <div>Nothing here yet</div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Section header: breadcrumb and/or title for navigation */}
      {(showBreadcrumb || title || headerActions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem 0.75rem',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {showBreadcrumb && <Breadcrumb />}
            {title && !showBreadcrumb && (
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#fff',
                  letterSpacing: '-0.01em',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {headerActions && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Grid or empty state */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
        {items.length === 0 ? (
          (emptyState ?? defaultEmpty)
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${PREVIEW_DISPLAY_WIDTH}px, 1fr))`,
              gap: '1rem',
            }}
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                renderPreview={renderPreview}
                onSelect={onSelect}
                onAction={onAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
