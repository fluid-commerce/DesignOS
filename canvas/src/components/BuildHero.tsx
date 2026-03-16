import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { FluidDAMModal } from './DAMPicker';
import { IdeasGetStarted, type IdeaAction } from './IdeasGetStarted';

/** Saved asset from /api/assets (same shape as IdeasGetStarted.SelectedAsset). */
interface SavedAssetForIdeas {
  id: string;
  url: string;
  name?: string | null;
}

// Project design tokens (from index.css)
const BG_PRIMARY = 'var(--bg-primary, #0d0d0d)';
const BG_CARD = 'var(--bg-card, #1a1a1e)';
const BG_SECONDARY = 'var(--bg-secondary, #141414)';
const BORDER = 'var(--border, #1e1e1e)';
const BORDER_HOVER = 'var(--border-hover, #2a2a2e)';
const ACCENT = 'var(--accent, #44B2FF)';
const TEXT_PRIMARY = 'var(--text-primary, #e0e0e0)';
const TEXT_SECONDARY = 'var(--text-secondary, #888)';
const TEXT_MUTED = 'var(--text-muted, #555)';

const CREATION_TYPES = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'social-post', label: 'Social Post' },
  { id: 'instagram-story', label: 'Instagram Story or video' },
  { id: 'blog-post', label: 'Blog Post' },
  { id: 'one-pager', label: 'One Pager' },
  { id: 'press-release', label: 'Press Release' },
  { id: 'ad', label: 'AD' },
] as const;

const SOCIAL_POST_FORMATS = [
  { id: 'single', label: 'Single post' },
  { id: 'carousel', label: 'Carousel' },
] as const;

const SOCIAL_POST_DIMENSIONS = [
  { id: 'instagram-4-5', dimensions: '1080×1350', sublabel: 'Instagram 4:5' },
  { id: 'linkedin-1080-1350', dimensions: '1080×1350', sublabel: 'LinkedIn' },
  { id: 'linkedin-1200-627', dimensions: '1200×627', sublabel: 'LinkedIn' },
] as const;

const VIDEO_FORMATS = [
  { id: 'story', label: 'Story' },
  { id: 'video', label: 'Video' },
] as const;

const VIDEO_DIMENSIONS = [
  { id: '1080-1920', dimensions: '1080×1920', sublabel: 'Story / Reel / TikTok', formats: ['story', 'video'] as const },
  { id: '1920-1080', dimensions: '1920×1080', sublabel: 'Landscape', formats: ['video'] as const },
  { id: '1080-1080', dimensions: '1080×1080', sublabel: 'Square', formats: ['video'] as const },
] as const;

const SUGGESTIONS = [
  { id: 'db-auth', text: 'Add database and auth', icon: 'flame' },
  { id: 'nano-banana', text: 'Nano Banana 2', icon: 'brain' },
  { id: 'voice-apps', text: 'Create conversational voice apps', icon: 'sparkles' },
  { id: 'animate', text: 'Animate images with...', icon: 'image' },
];

function SparklesIcon({ size = 20, accent = false }: { size?: number; accent?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={accent ? ACCENT : 'none'} stroke={accent ? ACCENT : 'currentColor'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SuggestionIcon({ type }: { type: string }) {
  const size = 16;
  const flame = '#fb923c';
  const brain = ACCENT;
  const sparkles = '#a78bfa';
  const image = '#93c5fd';
  const color = type === 'flame' ? flame : type === 'brain' ? brain : type === 'sparkles' ? sparkles : image;
  if (type === 'flame') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    );
  }
  if (type === 'brain') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
      </svg>
    );
  }
  if (type === 'sparkles') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

const SCROLL_EDGE = 4;
const FADE_WIDTH = 96;

function usePillsOverflow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setLeft(scrollLeft > SCROLL_EDGE);
    setRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE);
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

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  };
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  };

  return { scrollRef, showLeft: left, showRight: right, scrollLeft, scrollRight };
}

export function BuildHero() {
  const [inputValue, setInputValue] = useState('');
  const [creationTypeId, setCreationTypeId] = useState<string>('');
  const [creationDropdownOpen, setCreationDropdownOpen] = useState(false);
  const [socialPostFormatId, setSocialPostFormatId] = useState<string>(SOCIAL_POST_FORMATS[0].id);
  const [socialPostFormatDropdownOpen, setSocialPostFormatDropdownOpen] = useState(false);
  const [socialPostDimensionId, setSocialPostDimensionId] = useState<string>(SOCIAL_POST_DIMENSIONS[0].id);
  const [socialPostDimensionDropdownOpen, setSocialPostDimensionDropdownOpen] = useState(false);
  const [videoFormatId, setVideoFormatId] = useState<string>(VIDEO_FORMATS[0].id);
  const [videoFormatDropdownOpen, setVideoFormatDropdownOpen] = useState(false);
  const [videoDimensionId, setVideoDimensionId] = useState<string>(VIDEO_DIMENSIONS[0].id);
  const [videoDimensionDropdownOpen, setVideoDimensionDropdownOpen] = useState(false);
  const [damModalOpen, setDamModalOpen] = useState(false);
  const [selectedDamAssets, setSelectedDamAssets] = useState<Array<{ id: string; url: string; name?: string }>>([]);
  const [savedAssets, setSavedAssets] = useState<SavedAssetForIdeas[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const creationDropdownRef = useRef<HTMLDivElement>(null);
  const socialPostFormatDropdownRef = useRef<HTMLDivElement>(null);
  const socialPostDimensionDropdownRef = useRef<HTMLDivElement>(null);
  const videoFormatDropdownRef = useRef<HTMLDivElement>(null);
  const videoDimensionDropdownRef = useRef<HTMLDivElement>(null);
  const { scrollRef, showLeft, showRight, scrollLeft, scrollRight } = usePillsOverflow();

  useEffect(() => {
    if (!creationDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (creationDropdownRef.current && !creationDropdownRef.current.contains(e.target as Node)) {
        setCreationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [creationDropdownOpen]);

  useEffect(() => {
    if (!socialPostFormatDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (socialPostFormatDropdownRef.current && !socialPostFormatDropdownRef.current.contains(e.target as Node)) {
        setSocialPostFormatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [socialPostFormatDropdownOpen]);

  useEffect(() => {
    if (!socialPostDimensionDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (socialPostDimensionDropdownRef.current && !socialPostDimensionDropdownRef.current.contains(e.target as Node)) {
        setSocialPostDimensionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [socialPostDimensionDropdownOpen]);

  useEffect(() => {
    if (!videoFormatDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (videoFormatDropdownRef.current && !videoFormatDropdownRef.current.contains(e.target as Node)) {
        setVideoFormatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [videoFormatDropdownOpen]);

  useEffect(() => {
    if (!videoDimensionDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (videoDimensionDropdownRef.current && !videoDimensionDropdownRef.current.contains(e.target as Node)) {
        setVideoDimensionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [videoDimensionDropdownOpen]);

  // Load saved assets (from Assets tab) so Ideas Get Started can suggest remixes
  useEffect(() => {
    let cancelled = false;
    fetch('/api/assets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; url: string; name?: string | null }>) => {
        if (!cancelled && Array.isArray(data)) {
          setSavedAssets(data.map((a) => ({ id: a.id, url: a.url, name: a.name ?? undefined })));
        }
      })
      .catch(() => {
        if (!cancelled) setSavedAssets([]);
      });
    return () => { cancelled = true; };
  }, []);

  const videoDimensionsForFormat = VIDEO_DIMENSIONS.filter((d) =>
    d.formats.includes(videoFormatId as 'story' | 'video')
  );
  useEffect(() => {
    if (videoFormatId === 'story' && videoDimensionId !== '1080-1920') {
      setVideoDimensionId('1080-1920');
    }
  }, [videoFormatId, videoDimensionId]);

  const selectedCreation = creationTypeId ? CREATION_TYPES.find((t) => t.id === creationTypeId) ?? null : null;
  const selectedSocialPostFormat = SOCIAL_POST_FORMATS.find((f) => f.id === socialPostFormatId) ?? SOCIAL_POST_FORMATS[0];
  const selectedSocialPostDimension = SOCIAL_POST_DIMENSIONS.find((d) => d.id === socialPostDimensionId) ?? SOCIAL_POST_DIMENSIONS[0];
  const selectedVideoFormat = VIDEO_FORMATS.find((f) => f.id === videoFormatId) ?? VIDEO_FORMATS[0];
  const selectedVideoDimension =
    videoDimensionsForFormat.find((d) => d.id === videoDimensionId) ?? videoDimensionsForFormat[0];
  const isSocialPost = creationTypeId === 'social-post';
  const isVideo = creationTypeId === 'instagram-story';

  const ideasAssets = useMemo(
    () => [...selectedDamAssets, ...savedAssets],
    [selectedDamAssets, savedAssets]
  );

  const handleApplyIdea = useCallback((idea: IdeaAction) => {
    if (idea.creationType) setCreationTypeId(idea.creationType);
    if (idea.promptSuggestion) setInputValue(idea.promptSuggestion);
    if (idea.socialPostFormatId) setSocialPostFormatId(idea.socialPostFormatId);
    if (idea.socialPostDimensionId) setSocialPostDimensionId(idea.socialPostDimensionId);
    if (idea.videoFormatId) setVideoFormatId(idea.videoFormatId);
    if (idea.videoDimensionId) setVideoDimensionId(idea.videoDimensionId);
    if (idea.templateId != null) setSelectedTemplateId(idea.templateId);
  }, []);

  return (
    <div
      style={{
        height: 924,
        minHeight: 0,
        background: BG_PRIMARY,
        color: TEXT_PRIMARY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '24px 1.5rem',
        gap: 0,
        fontFamily: 'inherit',
        overflowY: 'auto',
      }}
    >
      {/* Single centered column: title + input + chips + Discover (screenshot layout) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          flexShrink: 0,
        }}
      >
      {/* Header */}
      <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '2.25rem',
            fontWeight: 400,
            color: TEXT_PRIMARY,
            letterSpacing: '-0.025em',
            fontFamily: 'inherit',
          }}
        >
          What do you want to create today?
        </h1>
        <div style={{ opacity: 0.5 }}>
          <SparklesIcon size={40} />
        </div>
      </div>

      {/* Main Input Container */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 896 }}>
        {/* Gradient border glow (kept per request) */}
        <div
          style={{
            position: 'absolute',
            inset: -1,
            borderRadius: 10,
            background: 'linear-gradient(90deg, rgba(255,102,20,0.35) 0%, rgba(239,68,68,0.2) 50%, rgba(68,178,255,0.35) 100%)',
            filter: 'blur(8px)',
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            background: BG_CARD,
            borderRadius: 8,
            padding: '1.5rem',
            border: `1px solid ${BORDER}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minHeight: 184,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe an app and let Gemini do the rest"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '1.25rem',
              lineHeight: 1.5,
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
              paddingTop: '0.5rem',
              height: 96,
              boxSizing: 'border-box',
            }}
            rows={3}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div ref={creationDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setCreationDropdownOpen((o) => !o)}
                title="Select what you're creating"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: creationDropdownOpen ? BORDER_HOVER : BG_SECONDARY,
                  border: `1px solid ${creationDropdownOpen ? BORDER_HOVER : BORDER}`,
                  borderRadius: 5,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: TEXT_PRIMARY,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!creationDropdownOpen) {
                    e.currentTarget.style.backgroundColor = BORDER_HOVER;
                    e.currentTarget.style.borderColor = BORDER_HOVER;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creationDropdownOpen) {
                    e.currentTarget.style.backgroundColor = BG_SECONDARY;
                    e.currentTarget.style.borderColor = BORDER;
                  }
                }}
              >
                <SettingsIcon />
                <span>{selectedCreation?.label ?? 'Tools'}</span>
                <ChevronDownIcon size={14} />
              </button>
              {creationDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '100%',
                    marginTop: 4,
                    minWidth: 320,
                    maxHeight: 320,
                    overflowY: 'auto',
                    background: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 5,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                  }}
                >
                  {CREATION_TYPES.map((opt, idx) => {
                    const isSelected = opt.id === creationTypeId;
                    const isLast = idx === CREATION_TYPES.length - 1;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCreationTypeId(opt.id);
                          setCreationDropdownOpen(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.5rem 0.75rem',
                          background: isSelected ? BORDER_HOVER : 'transparent',
                          border: 'none',
                          ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                          color: TEXT_PRIMARY,
                          fontSize: '0.875rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span style={{ display: 'block' }}>{opt.label}</span>
                        {opt.sublabel && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: TEXT_SECONDARY, marginTop: 2 }}>
                            {opt.sublabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {isSocialPost && (
              <>
                <div ref={socialPostFormatDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setSocialPostFormatDropdownOpen((o) => !o)}
                    title="Single post or Carousel"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: socialPostFormatDropdownOpen ? BORDER_HOVER : BG_SECONDARY,
                      border: `1px solid ${socialPostFormatDropdownOpen ? BORDER_HOVER : BORDER}`,
                      borderRadius: 5,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!socialPostFormatDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BORDER_HOVER;
                        e.currentTarget.style.borderColor = BORDER_HOVER;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!socialPostFormatDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BG_SECONDARY;
                        e.currentTarget.style.borderColor = BORDER;
                      }
                    }}
                  >
                    <span>{selectedSocialPostFormat.label}</span>
                    <ChevronDownIcon size={14} />
                  </button>
                  {socialPostFormatDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '100%',
                        marginTop: 4,
                        minWidth: 160,
                        background: BG_CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 5,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                      }}
                    >
                      {SOCIAL_POST_FORMATS.map((opt, idx) => {
                        const isSelected = opt.id === socialPostFormatId;
                        const isLast = idx === SOCIAL_POST_FORMATS.length - 1;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSocialPostFormatId(opt.id);
                              setSocialPostFormatDropdownOpen(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              background: isSelected ? BORDER_HOVER : 'transparent',
                              border: 'none',
                              ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                              color: TEXT_PRIMARY,
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div ref={socialPostDimensionDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setSocialPostDimensionDropdownOpen((o) => !o)}
                    title="Select dimensions"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: socialPostDimensionDropdownOpen ? BORDER_HOVER : BG_SECONDARY,
                      border: `1px solid ${socialPostDimensionDropdownOpen ? BORDER_HOVER : BORDER}`,
                      borderRadius: 5,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!socialPostDimensionDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BORDER_HOVER;
                        e.currentTarget.style.borderColor = BORDER_HOVER;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!socialPostDimensionDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BG_SECONDARY;
                        e.currentTarget.style.borderColor = BORDER;
                      }
                    }}
                  >
                    <span>{selectedSocialPostDimension.dimensions}</span>
                    <ChevronDownIcon size={14} />
                  </button>
                  {socialPostDimensionDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '100%',
                        marginTop: 4,
                        minWidth: 200,
                        background: BG_CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 5,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                      }}
                    >
                      {SOCIAL_POST_DIMENSIONS.map((opt, idx) => {
                        const isSelected = opt.id === socialPostDimensionId;
                        const isLast = idx === SOCIAL_POST_DIMENSIONS.length - 1;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSocialPostDimensionId(opt.id);
                              setSocialPostDimensionDropdownOpen(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              background: isSelected ? BORDER_HOVER : 'transparent',
                              border: 'none',
                              ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                              color: TEXT_PRIMARY,
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{ display: 'block' }}>{opt.dimensions}</span>
                            {opt.sublabel && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: TEXT_SECONDARY, marginTop: 2 }}>
                                {opt.sublabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
            {isVideo && (
              <>
                <div ref={videoFormatDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setVideoFormatDropdownOpen((o) => !o)}
                    title="Story or Video"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: videoFormatDropdownOpen ? BORDER_HOVER : BG_SECONDARY,
                      border: `1px solid ${videoFormatDropdownOpen ? BORDER_HOVER : BORDER}`,
                      borderRadius: 5,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!videoFormatDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BORDER_HOVER;
                        e.currentTarget.style.borderColor = BORDER_HOVER;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!videoFormatDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BG_SECONDARY;
                        e.currentTarget.style.borderColor = BORDER;
                      }
                    }}
                  >
                    <span>{selectedVideoFormat.label}</span>
                    <ChevronDownIcon size={14} />
                  </button>
                  {videoFormatDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '100%',
                        marginTop: 4,
                        minWidth: 160,
                        background: BG_CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 5,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                      }}
                    >
                      {VIDEO_FORMATS.map((opt, idx) => {
                        const isSelected = opt.id === videoFormatId;
                        const isLast = idx === VIDEO_FORMATS.length - 1;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setVideoFormatId(opt.id);
                              setVideoFormatDropdownOpen(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              background: isSelected ? BORDER_HOVER : 'transparent',
                              border: 'none',
                              ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                              color: TEXT_PRIMARY,
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div ref={videoDimensionDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setVideoDimensionDropdownOpen((o) => !o)}
                    title="Select dimensions"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: videoDimensionDropdownOpen ? BORDER_HOVER : BG_SECONDARY,
                      border: `1px solid ${videoDimensionDropdownOpen ? BORDER_HOVER : BORDER}`,
                      borderRadius: 5,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!videoDimensionDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BORDER_HOVER;
                        e.currentTarget.style.borderColor = BORDER_HOVER;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!videoDimensionDropdownOpen) {
                        e.currentTarget.style.backgroundColor = BG_SECONDARY;
                        e.currentTarget.style.borderColor = BORDER;
                      }
                    }}
                  >
                    <span>{selectedVideoDimension.dimensions}</span>
                    <ChevronDownIcon size={14} />
                  </button>
                  {videoDimensionDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '100%',
                        marginTop: 4,
                        minWidth: 200,
                        background: BG_CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 5,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                      }}
                    >
                      {videoDimensionsForFormat.map((opt, idx) => {
                        const isSelected = opt.id === videoDimensionId;
                        const isLast = idx === videoDimensionsForFormat.length - 1;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setVideoDimensionId(opt.id);
                              setVideoDimensionDropdownOpen(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              background: isSelected ? BORDER_HOVER : 'transparent',
                              border: 'none',
                              ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                              color: TEXT_PRIMARY,
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{ display: 'block' }}>{opt.dimensions}</span>
                            {opt.sublabel && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: TEXT_SECONDARY, marginTop: 2 }}>
                                {opt.sublabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                title="Voice input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  padding: '0.625rem',
                  background: BG_SECONDARY,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 5,
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BORDER_HOVER;
                  e.currentTarget.style.borderColor = BORDER_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BG_SECONDARY;
                  e.currentTarget.style.borderColor = BORDER;
                }}
              >
                <MicIcon size={20} />
              </button>
              <button
                type="button"
                title="Browse Fluid DAM"
                onClick={() => setDamModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  padding: '0.625rem',
                  background: BG_SECONDARY,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 5,
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BORDER_HOVER;
                  e.currentTarget.style.borderColor = BORDER_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BG_SECONDARY;
                  e.currentTarget.style.borderColor = BORDER;
                }}
              >
                <PlusIcon size={20} />
              </button>
              <FluidDAMModal
                isOpen={damModalOpen}
                onSelect={(asset) => {
                  setSelectedDamAssets((prev) => [...prev, { id: nanoid(), ...asset }]);
                  setDamModalOpen(false);
                }}
                onCancel={() => setDamModalOpen(false)}
              />
              <button
                type="button"
                disabled={!inputValue.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.5rem',
                  borderRadius: 5,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.15s, border-color 0.15s',
                  ...(inputValue.trim()
                    ? { background: ACCENT, color: '#000', border: `1px solid ${ACCENT}` }
                    : { background: BG_SECONDARY, color: TEXT_MUTED, border: `1px solid ${BORDER}` }),
                }}
                onMouseEnter={(e) => {
                  if (inputValue.trim()) {
                    e.currentTarget.style.backgroundColor = '#5cc0ff';
                    e.currentTarget.style.borderColor = '#5cc0ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (inputValue.trim()) {
                    e.currentTarget.style.backgroundColor = ACCENT;
                    e.currentTarget.style.borderColor = ACCENT;
                  }
                }}
              >
                Build <ArrowRightIcon />
              </button>
            </div>
          </div>
          {selectedDamAssets.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              {selectedDamAssets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.5rem 0.375rem 0.5rem',
                    background: BG_SECONDARY,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6,
                    fontSize: '0.8125rem',
                    color: TEXT_PRIMARY,
                    maxWidth: 220,
                  }}
                >
                  {asset.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
                    <img
                      src={asset.url}
                      alt=""
                      style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: TEXT_SECONDARY }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    </span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name || asset.url.replace(/^.*\//, '').slice(0, 20) || 'Asset'}
                  </span>
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => setSelectedDamAssets((prev) => prev.filter((a) => a.id !== asset.id))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      padding: 0,
                      marginLeft: 2,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: TEXT_SECONDARY,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = TEXT_PRIMARY;
                      e.currentTarget.style.background = BORDER_HOVER;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = TEXT_SECONDARY;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>×</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggestion Pills */}
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

        {/* Left fade + chevron (scroll back) */}
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

        {/* Right fade + chevron (scroll more) */}
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

      {/* Discover and remix ideas — part of the same centered block as in screenshot */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
        <IdeasGetStarted selectedAssets={ideasAssets} onApplyIdea={handleApplyIdea} />
      </div>
      </div>
    </div>
  );
}
