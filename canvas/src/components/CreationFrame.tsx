import { useState, useCallback } from 'react';
import { CREATION_DIMENSIONS } from '../lib/types';
import { PREVIEW_CHROME_PADDING_PX } from '../lib/preview-utils';
import type { Annotation, VersionStatus } from '../lib/types';
import { AnnotationPin } from './AnnotationPin';
import { AnnotationThread } from './AnnotationThread';

interface CreationFrameProps {
  html?: string; // Deprecated: kept for backward compat with session views
  iterationId?: string; // Preferred: iframe loads via src URL
  name: string;
  path: string;
  platform: string;
  status: VersionStatus;
  displayWidth?: number;
  pins: Annotation[];
  activePin: string | null;
  onPinClick: (id: string) => void;
  onAddPin: (versionPath: string, x: number, y: number, text: string) => void;
  onReply: (annotationId: string, text: string) => void;
  onStatusChange: (versionPath: string, status: VersionStatus) => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? '#facc15' : 'none'}
      stroke={filled ? '#facc15' : '#666'}
      strokeWidth="2"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function CreationFrame({
  html,
  iterationId,
  name,
  path: versionPath,
  platform,
  status,
  displayWidth = 400,
  pins,
  activePin,
  onPinClick,
  onAddPin,
  onReply,
  onStatusChange,
}: CreationFrameProps) {
  const dims = CREATION_DIMENSIONS[platform] ?? { width: 1080, height: 1080 };
  const m = PREVIEW_CHROME_PADDING_PX;
  const innerW = Math.max(1, displayWidth - 2 * m);
  const scale = innerW / dims.width;
  const innerH = dims.height * scale;
  const displayHeight = innerH + 2 * m;

  // Determine rendering mode: prefer iterationId (src), fallback to html (srcDoc)
  const useSrcMode = !!iterationId;
  const iframeSrc = iterationId ? `/api/iterations/${iterationId}/html` : undefined;

  // Guard: if no content available at all
  const hasContent = useSrcMode || (html && html.length > 0);

  const [showPinInput, setShowPinInput] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinText, setPinText] = useState('');

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setPinText('');
    setShowPinInput(true);
  }, []);

  const handlePinSubmit = () => {
    const text = pinText.trim();
    if (!text || !pendingPin) return;
    onAddPin(versionPath, pendingPin.x, pendingPin.y, text);
    setShowPinInput(false);
    setPendingPin(null);
    setPinText('');
  };

  const toggleStar = () => {
    onStatusChange(versionPath, status === 'winner' ? 'unmarked' : 'winner');
  };

  const activePinData = activePin ? pins.find((p) => p.id === activePin) : null;

  return (
    <div data-testid="creation-frame" style={{ position: 'relative' }}>
      <div
        style={{
          marginBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{name}</span>
        <button
          data-testid="star-toggle"
          onClick={toggleStar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          title={status === 'winner' ? 'Remove winner' : 'Mark as winner'}
        >
          <StarIcon filled={status === 'winner'} />
        </button>
      </div>
      <div
        style={{
          width: displayWidth,
          height: displayHeight,
          overflow: 'hidden',
          borderRadius: '6px',
          border: status === 'winner' ? '2px solid #22c55e' : '1px solid #333',
          position: 'relative',
          padding: m,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: innerW,
            height: innerH,
            position: 'relative',
            overflow: 'visible',
            borderRadius: 4,
          }}
        >
          {!hasContent ? (
            <div
              style={{
                width: dims.width,
                height: dims.height,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1e1e1e',
                color: '#888',
                fontSize: '14px',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '1.2rem' }}>No preview available</div>
            </div>
          ) : useSrcMode ? (
            <iframe
              src={iframeSrc}
              sandbox="allow-same-origin allow-scripts"
              style={{
                width: dims.width,
                height: dims.height,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              title={name}
            />
          ) : (
            <iframe
              srcDoc={html}
              sandbox="allow-same-origin allow-scripts"
              style={{
                width: dims.width,
                height: dims.height,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              title={name}
            />
          )}
          {/* Clickable overlay for placing pins */}
          <div
            data-testid="pin-overlay"
            onClick={handleOverlayClick}
            style={{
              position: 'absolute',
              inset: 0,
              cursor: 'crosshair',
            }}
          >
            {/* Render existing pins */}
            {pins.map((pin) => (
              <AnnotationPin
                key={pin.id}
                annotation={pin}
                isActive={activePin === pin.id}
                onClick={onPinClick}
              />
            ))}

            {/* Active thread popover */}
            {activePinData && (
              <AnnotationThread
                annotation={activePinData}
                onReply={onReply}
                onClose={() => onPinClick(activePinData.id)}
              />
            )}
          </div>

          {/* Pin text input popup */}
          {showPinInput && pendingPin && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${pendingPin.x}%`,
                top: `${pendingPin.y}%`,
                transform: 'translate(-50%, 8px)',
                zIndex: 30,
                backgroundColor: '#1e1e1e',
                border: '1px solid #2a2a2e',
                borderRadius: 6,
                padding: '0.5rem',
                display: 'flex',
                gap: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              <input
                data-testid="pin-text-input"
                autoFocus
                type="text"
                placeholder="Add annotation..."
                value={pinText}
                onChange={(e) => setPinText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePinSubmit();
                  if (e.key === 'Escape') {
                    setShowPinInput(false);
                    setPendingPin(null);
                  }
                }}
                style={{
                  width: 180,
                  backgroundColor: '#1a1a1e',
                  border: '1px solid #2a2a2e',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={handlePinSubmit}
                style={{
                  backgroundColor: '#44B2FF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Pin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
