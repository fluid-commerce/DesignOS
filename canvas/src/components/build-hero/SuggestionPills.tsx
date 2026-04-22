import {
  BG_PRIMARY,
  BG_CARD,
  BG_SECONDARY,
  BORDER,
  BORDER_HOVER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../tokens';
import { SUGGESTIONS, FADE_WIDTH } from './constants';
import { SuggestionIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { usePillsOverflow } from './hooks';

export function SuggestionPills() {
  const { scrollRef, showLeft, showRight, scrollLeft, scrollRight } = usePillsOverflow();

  return (
    <div
      style={{
        marginTop: '2rem',
        width: '100%',
        maxWidth: 896,
        position: 'relative',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflowX: 'auto',
          paddingLeft: showLeft ? FADE_WIDTH : 0,
          paddingRight: showRight ? FADE_WIDTH : 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          transition: 'padding 0.2s ease',
        }}
      >
        {SUGGESTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 5,
              fontSize: '0.875rem',
              color: TEXT_PRIMARY,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = BG_SECONDARY;
              e.currentTarget.style.borderColor = BORDER_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BG_CARD;
              e.currentTarget.style.borderColor = BORDER;
            }}
          >
            <SuggestionIcon type={item.icon} />
            {item.text}
          </button>
        ))}
      </div>

      {showLeft && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: FADE_WIDTH,
            background: `linear-gradient(to right, ${BG_PRIMARY} 0%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: 8,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            title="Scroll left"
            onClick={scrollLeft}
            style={{
              pointerEvents: 'auto',
              padding: '0.375rem',
              borderRadius: 5,
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = BORDER_HOVER;
              e.currentTarget.style.borderColor = BORDER_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BG_CARD;
              e.currentTarget.style.borderColor = BORDER;
            }}
          >
            <ChevronLeftIcon size={16} />
          </button>
        </div>
      )}

      {showRight && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: FADE_WIDTH,
            background: `linear-gradient(to left, ${BG_PRIMARY} 0%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 8,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            title="Scroll right"
            onClick={scrollRight}
            style={{
              pointerEvents: 'auto',
              padding: '0.375rem',
              borderRadius: 5,
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = BORDER_HOVER;
              e.currentTarget.style.borderColor = BORDER_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BG_CARD;
              e.currentTarget.style.borderColor = BORDER;
            }}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
