import { BG_PRIMARY, BG_CARD, BORDER, TEXT_PRIMARY } from '../tokens';
import { FADE_WIDTH } from './hooks';

function ChevronLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

interface ScrollArrowProps {
  direction: 'left' | 'right';
  onClick: () => void;
}

export function ScrollArrow({ direction, onClick }: ScrollArrowProps) {
  const isLeft = direction === 'left';
  return (
    <div
      style={{
        position: 'absolute',
        [isLeft ? 'left' : 'right']: 0,
        top: 52,
        bottom: 0,
        width: FADE_WIDTH,
        background: isLeft
          ? `linear-gradient(to right, ${BG_PRIMARY} 0%, transparent 100%)`
          : `linear-gradient(to left, ${BG_PRIMARY} 0%, transparent 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isLeft ? 'flex-start' : 'flex-end',
        [isLeft ? 'paddingLeft' : 'paddingRight']: 8,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        title={isLeft ? 'Scroll left' : 'Scroll right'}
        onClick={onClick}
        style={{
          pointerEvents: 'auto',
          padding: '0.375rem',
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          color: TEXT_PRIMARY,
          cursor: 'pointer',
          display: 'flex',
        }}
      >
        {isLeft ? <ChevronLeftIcon size={18} /> : <ChevronRightIcon size={18} />}
      </button>
    </div>
  );
}
