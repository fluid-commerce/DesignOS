import { useRef, useState, useEffect, useMemo } from 'react';

const BG_PRIMARY = 'var(--bg-primary, #0d0d0d)';
const BG_CARD = 'var(--bg-card, #1a1a1e)';
const BORDER = 'var(--border, #1e1e1e)';
const BORDER_HOVER = 'var(--border-hover, #2a2a2e)';
const TEXT_PRIMARY = 'var(--text-primary, #e0e0e0)';
const TEXT_SECONDARY = 'var(--text-secondary, #888)';

export interface SelectedAsset {
  id: string;
  url: string;
  name?: string;
}

export interface IdeaAction {
  creationType?: string;
  promptSuggestion?: string;
  socialPostFormatId?: string;
  socialPostDimensionId?: string;
  videoFormatId?: string;
  videoDimensionId?: string;
  templateId?: string;
}

export interface IdeasGetStartedProps {
  selectedAssets: SelectedAsset[];
  onApplyIdea?: (idea: IdeaAction) => void;
}

/** Template from GET /api/templates (minimal shape we need). */
interface TemplateMeta {
  id: string;
  name: string;
  category: 'social' | 'one-pager';
}

/** Idea template: creation type, format/dims, and varied title/description/prompt phrasing. No dimensions in UI. */
const IDEA_TEMPLATES: Array<{
  id: string;
  title: string;
  description: string;
  badgeLabel: string;
  promptPhrases: string[];
  creationType: string;
  socialPostFormatId?: string;
  socialPostDimensionId?: string;
  videoFormatId?: string;
  videoDimensionId?: string;
}> = [
  {
    id: 'story',
    title: 'Instagram Story',
    description: 'Story or reel.',
    badgeLabel: 'Story',
    promptPhrases: ['Create an Instagram story from this', 'Turn this into a story', 'Remix as an Instagram story'],
    creationType: 'instagram-story',
    videoFormatId: 'story',
    videoDimensionId: '1080-1920',
  },
  {
    id: 'linkedin-post',
    title: 'LinkedIn post (portrait)',
    description: 'Single post.',
    badgeLabel: 'Social Post',
    promptPhrases: ['Create a LinkedIn post from this', 'Turn this into a LinkedIn post', 'Repurpose for LinkedIn'],
    creationType: 'social-post',
    socialPostFormatId: 'single',
    socialPostDimensionId: 'linkedin-1080-1350',
  },
  {
    id: 'linkedin-banner',
    title: 'LinkedIn banner',
    description: 'Landscape banner.',
    badgeLabel: 'Social Post',
    promptPhrases: ['Create a LinkedIn banner from this', 'Turn this into a LinkedIn banner image'],
    creationType: 'social-post',
    socialPostFormatId: 'single',
    socialPostDimensionId: 'linkedin-1200-627',
  },
  {
    id: 'instagram-4-5',
    title: 'Instagram 4:5 single',
    description: 'Feed post.',
    badgeLabel: 'Social Post',
    promptPhrases: ['Create an Instagram post from this', 'Turn this into an Instagram 4:5 post'],
    creationType: 'social-post',
    socialPostFormatId: 'single',
    socialPostDimensionId: 'instagram-4-5',
  },
  {
    id: 'carousel-4-5',
    title: 'Instagram carousel',
    description: 'Multi-slide carousel.',
    badgeLabel: 'Carousel',
    promptPhrases: ['Create an Instagram carousel from this', 'Turn this into a carousel', 'Remix as a multi-slide carousel'],
    creationType: 'social-post',
    socialPostFormatId: 'carousel',
    socialPostDimensionId: 'instagram-4-5',
  },
  {
    id: 'carousel-linkedin',
    title: 'LinkedIn carousel',
    description: 'Multi-slide carousel.',
    badgeLabel: 'Carousel',
    promptPhrases: ['Create a LinkedIn carousel from this', 'Turn this into a LinkedIn carousel'],
    creationType: 'social-post',
    socialPostFormatId: 'carousel',
    socialPostDimensionId: 'linkedin-1080-1350',
  },
  {
    id: 'video-landscape',
    title: 'Video (landscape)',
    description: 'Landscape video.',
    badgeLabel: 'Video',
    promptPhrases: ['Repurpose this as a landscape video', 'Turn this into a landscape video', 'Create a video from this'],
    creationType: 'instagram-story',
    videoFormatId: 'video',
    videoDimensionId: '1920-1080',
  },
  {
    id: 'video-square',
    title: 'Video (square)',
    description: 'Square video.',
    badgeLabel: 'Video',
    promptPhrases: ['Repurpose this as a square video', 'Turn this into a square video'],
    creationType: 'instagram-story',
    videoFormatId: 'video',
    videoDimensionId: '1080-1080',
  },
  {
    id: 'story-reel',
    title: 'Story / Reel',
    description: 'Vertical for Reels or TikTok.',
    badgeLabel: 'Story',
    promptPhrases: ['Create a Reel from this', 'Turn this into a Reel', 'Remix as a vertical short'],
    creationType: 'instagram-story',
    videoFormatId: 'story',
    videoDimensionId: '1080-1920',
  },
];

type IdeaItem = {
  id: string;
  title: string;
  description: string;
  badgeLabel: string;
  creationType: string;
  promptSuggestion: string;
  socialPostFormatId?: string;
  socialPostDimensionId?: string;
  videoFormatId?: string;
  videoDimensionId?: string;
  thumbnailUrl?: string;
  templateId?: string;
};

/** Client-side rule-based ideas with variation: rotate asset per idea, vary prompt phrasing. */
function deriveAssetIdeas(assets: SelectedAsset[]): IdeaItem[] {
  if (assets.length === 0) return [];
  return IDEA_TEMPLATES.map((tpl, i) => {
    const asset = assets[i % assets.length];
    const label = asset.name || 'your asset';
    const phraseIndex = i % tpl.promptPhrases.length;
    const promptPhrase = tpl.promptPhrases[phraseIndex];
    const promptSuggestion = `${promptPhrase}: ${label}`;
    return {
      id: `idea-${tpl.id}-${i}`,
      title: tpl.title,
      description: tpl.description,
      badgeLabel: tpl.badgeLabel,
      creationType: tpl.creationType,
      promptSuggestion,
      socialPostFormatId: tpl.socialPostFormatId,
      socialPostDimensionId: tpl.socialPostDimensionId,
      videoFormatId: tpl.videoFormatId,
      videoDimensionId: tpl.videoDimensionId,
      thumbnailUrl: asset.url,
    };
  });
}

const TEMPLATE_PROMPT_PHRASES = [
  'Use the {{name}} template',
  'Start from {{name}} template',
  'Create with {{name}} template',
];

/** Template-based ideas: one card per template from the library. */
function deriveTemplateIdeas(templates: TemplateMeta[]): IdeaItem[] {
  return templates.map((t, i) => {
    const phrase = TEMPLATE_PROMPT_PHRASES[i % TEMPLATE_PROMPT_PHRASES.length].replace('{{name}}', t.name);
    const creationType = t.category === 'social' ? 'social-post' : 'one-pager';
    const badgeLabel = t.category === 'social' ? 'Template' : 'One-pager';
    return {
      id: `template-${t.id}`,
      title: t.name,
      description: t.category === 'social' ? 'Social post template' : 'One-pager template',
      badgeLabel,
      creationType,
      promptSuggestion: phrase,
      templateId: t.id,
    };
  });
}

const SCROLL_EDGE = 4;
const FADE_WIDTH = 96;

function useCardsScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeft(scrollLeft > SCROLL_EDGE);
    setShowRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' });

  return { scrollRef, showLeft, showRight, scrollLeft, scrollRight };
}

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

export function IdeasGetStarted({ selectedAssets, onApplyIdea }: IdeasGetStartedProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TemplateMeta[]) => {
        if (!cancelled && Array.isArray(data)) {
          setTemplates(data.map((t) => ({ id: t.id, name: t.name, category: t.category })));
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => { cancelled = true; };
  }, []);

  const ideas = useMemo(
    () => [...deriveAssetIdeas(selectedAssets), ...deriveTemplateIdeas(templates)],
    [selectedAssets, templates]
  );
  const { scrollRef, showLeft, showRight, scrollLeft, scrollRight } = useCardsScroll();

  const hasAnyIdeas = ideas.length > 0;
  if (!hasAnyIdeas) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 896,
          paddingTop: '2.5rem',
          paddingBottom: '2rem',
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: '0.5rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: TEXT_PRIMARY,
          }}
        >
          Ideas Get Started
        </h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: TEXT_SECONDARY }}>
          Add assets above with the + button or save assets in the Assets tab. Templates will appear here when available.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 896,
        position: 'relative',
        paddingTop: '2.5rem',
        paddingBottom: '2rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            color: TEXT_PRIMARY,
          }}
        >
          Discover and remix ideas
        </h2>
      </div>
      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingLeft: showLeft ? FADE_WIDTH : 0,
          paddingRight: showRight ? FADE_WIDTH : 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          transition: 'padding 0.2s ease',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto auto',
            gridAutoFlow: 'column',
            gridAutoColumns: '260px',
            gap: '1rem',
            width: 'fit-content',
            minWidth: '100%',
          }}
        >
        {ideas.map((idea) => (
          <button
            key={idea.id}
            type="button"
            onClick={() => onApplyIdea?.({
              creationType: idea.creationType,
              promptSuggestion: idea.promptSuggestion,
              socialPostFormatId: idea.socialPostFormatId,
              socialPostDimensionId: idea.socialPostDimensionId,
              videoFormatId: idea.videoFormatId,
              videoDimensionId: idea.videoDimensionId,
              templateId: idea.templateId,
            })}
            style={{
              width: '100%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              textAlign: 'left',
              padding: 0,
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = BORDER_HOVER;
              e.currentTarget.style.backgroundColor = BORDER_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.backgroundColor = BG_CARD;
            }}
          >
            <div
              style={{
                height: 120,
                background: BG_PRIMARY,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {idea.thumbnailUrl && (idea.thumbnailUrl.startsWith('data:image/') || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(idea.thumbnailUrl)) ? (
                <img
                  src={idea.thumbnailUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
            <div style={{ padding: '0.75rem 1rem' }}>
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
                  fontSize: '0.9375rem',
                  fontWeight: 600,
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
        ))}
        </div>
      </div>
      {showLeft && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 52,
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
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: TEXT_PRIMARY,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <ChevronLeftIcon size={18} />
          </button>
        </div>
      )}
      {showRight && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 52,
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
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: TEXT_PRIMARY,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
