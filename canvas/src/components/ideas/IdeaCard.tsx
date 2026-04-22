import { BG_PRIMARY, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '../tokens';
import type { IdeaItem, IdeaAction } from './types';

interface IdeaCardProps {
  idea: IdeaItem;
  onApply?: (action: IdeaAction) => void;
}

export function IdeaCard({ idea, onApply }: IdeaCardProps) {
  return (
    <button
      type="button"
      onClick={() =>
        onApply?.({
          creationType: idea.creationType,
          promptSuggestion: idea.promptSuggestion,
          socialPostFormatId: idea.socialPostFormatId,
          socialPostDimensionId: idea.socialPostDimensionId,
          videoFormatId: idea.videoFormatId,
          videoDimensionId: idea.videoDimensionId,
          templateId: idea.templateId,
        })
      }
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        padding: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        overflow: 'visible',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {/* Preview thumbnail */}
      <div
        style={{
          height: 140,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          background: BG_PRIMARY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '0.75rem',
        }}
      >
        {idea.thumbnailUrl &&
        (idea.thumbnailUrl.startsWith('data:image/') ||
          /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(idea.thumbnailUrl)) ? (
          <img
            src={idea.thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }}
          />
        ) : idea.templateId ? (
          <svg
            width={48}
            height={48}
            viewBox="0 0 24 24"
            fill="none"
            stroke={TEXT_SECONDARY}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="9" x2="9" y2="21" />
          </svg>
        ) : (
          <svg
            width={48}
            height={48}
            viewBox="0 0 24 24"
            fill="none"
            stroke={TEXT_SECONDARY}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        )}
      </div>

      {/* Badge, title, description */}
      <div style={{ padding: 0 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '3px 8px',
            borderRadius: 4,
            marginBottom: '0.5rem',
          }}
        >
          {idea.badgeLabel}
        </span>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: TEXT_PRIMARY,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {idea.title}
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            color: TEXT_SECONDARY,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {idea.description}
        </div>
      </div>
    </button>
  );
}
