export const CREATION_TYPES = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'social-post', label: 'Social Post' },
  { id: 'instagram-story', label: 'Instagram Story or video' },
  { id: 'blog-post', label: 'Blog Post' },
  { id: 'one-pager', label: 'One Pager' },
  { id: 'press-release', label: 'Press Release' },
  { id: 'ad', label: 'AD' },
] as const;

export const SOCIAL_POST_FORMATS = [
  { id: 'single', label: 'Single post' },
  { id: 'carousel', label: 'Carousel' },
] as const;

export const SOCIAL_POST_DIMENSIONS = [
  { id: 'instagram-4-5', dimensions: '1080\u00d71350', sublabel: 'Instagram 4:5' },
  { id: 'linkedin-1080-1350', dimensions: '1080\u00d71350', sublabel: 'LinkedIn' },
  { id: 'linkedin-1200-627', dimensions: '1200\u00d7627', sublabel: 'LinkedIn' },
] as const;

export const VIDEO_FORMATS = [
  { id: 'story', label: 'Story' },
  { id: 'video', label: 'Video' },
] as const;

export type VideoFormatTag = 'story' | 'video';

export const VIDEO_DIMENSIONS = [
  {
    id: '1080-1920',
    dimensions: '1080\u00d71920',
    sublabel: 'Story / Reel / TikTok',
    formats: ['story', 'video'] as VideoFormatTag[],
  },
  {
    id: '1920-1080',
    dimensions: '1920\u00d71080',
    sublabel: 'Landscape',
    formats: ['video'] as VideoFormatTag[],
  },
  {
    id: '1080-1080',
    dimensions: '1080\u00d71080',
    sublabel: 'Square',
    formats: ['video'] as VideoFormatTag[],
  },
] as const;

export const SUGGESTIONS = [
  { id: 'db-auth', text: 'Add database and auth', icon: 'flame' },
  { id: 'nano-banana', text: 'Nano Banana 2', icon: 'brain' },
  { id: 'voice-apps', text: 'Create conversational voice apps', icon: 'sparkles' },
  { id: 'animate', text: 'Animate images with...', icon: 'image' },
] as const;

export const SCROLL_EDGE = 4;
export const FADE_WIDTH = 96;
