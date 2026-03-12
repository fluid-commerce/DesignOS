import type { ReactNode } from 'react';

/**
 * Preview descriptor returned by the `renderPreview` prop.
 * html is used in an iframe at native dimensions (width x height).
 */
export interface PreviewDescriptor {
  html: string;
  width: number;
  height: number;
}

/**
 * A generic item shown in the drill-down grid.
 * The caller supplies typed items and a renderPreview function that maps each
 * item to an iframe preview.
 */
export interface DrillDownItem<T> {
  id: string;
  title: string;
  subtitle?: string;
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
  const scale = preview ? PREVIEW_DISPLAY_WIDTH / preview.width : 1;
  const displayHeight = preview ? preview.height * scale : 180;

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        border: '1px solid #1e1e30',
        backgroundColor: '#0d0d1a',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6';
        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1e1e30';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Preview area — full-size iframe at native dimensions, scaled to fit */}
      <div style={{
        width: PREVIEW_DISPLAY_WIDTH,
        height: displayHeight,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0a0a14',
        flexShrink: 0,
      }}>
        {preview ? (
          <iframe
            srcDoc={preview.html}
            sandbox="allow-same-origin"
            style={{
              width: preview.width,
              height: preview.height,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none', // prevent iframe from capturing click
            }}
            title={item.title}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#333',
            fontSize: '0.8rem',
          }}>
            No preview
          </div>
        )}
      </div>

      {/* Title overlay bar */}
      <div style={{
        padding: '0.625rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #1a1a28',
        gap: '0.5rem',
      }}>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#d0d0e0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.title}
          </div>
          {item.subtitle && (
            <div style={{
              fontSize: '0.7rem',
              color: '#555',
              marginTop: '0.125rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
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
  headerActions,
}: DrillDownGridProps<T>) {
  const defaultEmpty = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 300,
      color: '#444',
      fontSize: '0.9rem',
      gap: '0.5rem',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
           stroke="#333" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <div>Nothing here yet</div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Section header */}
      {(title || headerActions) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem 0.75rem',
          flexShrink: 0,
        }}>
          {title && (
            <h2 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h2>
          )}
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
          emptyState ?? defaultEmpty
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${PREVIEW_DISPLAY_WIDTH}px, 1fr))`,
            gap: '1rem',
          }}>
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
