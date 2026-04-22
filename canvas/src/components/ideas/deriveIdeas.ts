import type { SelectedAsset, TemplateMeta, IdeaItem } from './types';

/** Idea template: creation type, format/dims, and varied title/description/prompt phrasing. */
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
    promptPhrases: [
      'Create an Instagram story from this',
      'Turn this into a story',
      'Remix as an Instagram story',
    ],
    creationType: 'instagram-story',
    videoFormatId: 'story',
    videoDimensionId: '1080-1920',
  },
  {
    id: 'linkedin-post',
    title: 'LinkedIn post (portrait)',
    description: 'Single post.',
    badgeLabel: 'Social Post',
    promptPhrases: [
      'Create a LinkedIn post from this',
      'Turn this into a LinkedIn post',
      'Repurpose for LinkedIn',
    ],
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
    promptPhrases: [
      'Create an Instagram carousel from this',
      'Turn this into a carousel',
      'Remix as a multi-slide carousel',
    ],
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
    promptPhrases: [
      'Repurpose this as a landscape video',
      'Turn this into a landscape video',
      'Create a video from this',
    ],
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
    promptPhrases: [
      'Create a Reel from this',
      'Turn this into a Reel',
      'Remix as a vertical short',
    ],
    creationType: 'instagram-story',
    videoFormatId: 'story',
    videoDimensionId: '1080-1920',
  },
];

const TEMPLATE_PROMPT_PHRASES = [
  'Use the {{name}} template',
  'Start from {{name}} template',
  'Create with {{name}} template',
];

/** Client-side rule-based ideas with variation: rotate asset per idea, vary prompt phrasing. */
export function deriveAssetIdeas(assets: SelectedAsset[]): IdeaItem[] {
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

/** Template-based ideas: one card per template from the library. */
export function deriveTemplateIdeas(templates: TemplateMeta[]): IdeaItem[] {
  return templates.map((t, i) => {
    const phrase = TEMPLATE_PROMPT_PHRASES[i % TEMPLATE_PROMPT_PHRASES.length].replace(
      '{{name}}',
      t.name,
    );
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
