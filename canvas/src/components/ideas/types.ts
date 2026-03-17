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
export interface TemplateMeta {
  id: string;
  name: string;
  category: 'social' | 'one-pager';
}

export type IdeaItem = {
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
