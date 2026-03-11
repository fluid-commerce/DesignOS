import { useState, useCallback } from 'react';
import { ASSET_DIMENSIONS } from '../lib/types';
import type { Annotation, VariationStatus } from '../lib/types';
import { AnnotationPin } from './AnnotationPin';
import { AnnotationThread } from './AnnotationThread';

interface AssetFrameProps {
  html: string;
  name: string;
  path: string;
  platform: string;
  status: VariationStatus;
  displayWidth?: number;
  pins: Annotation[];
  activePin: string | null;
  onPinClick: (id: string) => void;
  onAddPin: (variationPath: string, x: number, y: number, text: string) => void;
  onReply: (annotationId: string, text: string) => void;
  onStatusChange: (variationPath: string, status: VariationStatus) => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#facc15' : 'none'}
         stroke={filled ? '#facc15' : '#666'} strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function AssetFrame({
  html,
  name,
  path: variationPath,
  platform,
  status,
  displayWidth = 400,
  pins,
  activePin,
  onPinClick,
  onAddPin,
  onReply,
  onStatusChange,
}: AssetFrameProps) {
  const dims = ASSET_DIMENSIONS[platform] ?? { width: 1080, height: 1080 };
  const scale = displayWidth / dims.width;
  const displayHeight = dims.height * scale;

  const [showPinInput, setShowPinInput] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinText, setPinText] = useState('');

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPendingPin({ x, y });
      setPinText('');
      setShowPinInput(true);
    },
    []
  );

  const handlePinSubmit = () => {
    const text = pinText.trim();
    if (!text || !pendingPin) return;
    onAddPin(variationPath, pendingPin.x, pendingPin.y, text);
    setShowPinInput(false);
    setPendingPin(null);
    setPinText('');
  };

  const toggleStar = () => {
    onStatusChange(variationPath, status === 'winner' ? 'unmarked' : 'winner');
  };

  const activePinData = activePin ? pins.find((p) => p.id === activePin) : null;

  return (
    <div data-testid="asset-frame" style={{ position: 'relative' }}>
      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <div style={{
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        borderRadius: '6px',
        border: status === 'winner' ? '2px solid #22c55e' : '1px solid #333',
        position: 'relative',
      }}>
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{
            width: dims.width,
            height: dims.height,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          title={name}
        />
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
              backgroundColor: '#1e1e30',
              border: '1px solid #3a3a52',
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
                if (e.key === 'Escape') { setShowPinInput(false); setPendingPin(null); }
              }}
              style={{
                width: 180,
                backgroundColor: '#252540',
                border: '1px solid #3a3a52',
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
                backgroundColor: '#3b82f6',
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
  );
}
