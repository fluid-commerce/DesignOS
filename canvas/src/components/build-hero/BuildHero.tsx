import { useState, useCallback, useMemo } from 'react';
import { IdeasGetStarted, type IdeaAction } from '../IdeasGetStarted';
import { BG_PRIMARY, TEXT_PRIMARY } from '../tokens';
import { useAssets } from '../../hooks/useAssets';
import { useChatStore } from '../../store/chat';
import { useCampaignStore } from '../../store/campaign';
import { SparklesIcon } from './Icons';
import { PromptInput } from './PromptInput';
import { SuggestionPills } from './SuggestionPills';
import {
  CREATION_TYPES,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_DIMENSIONS,
  VIDEO_FORMATS,
  VIDEO_DIMENSIONS,
} from './constants';
import type { SelectedDamAsset } from './SelectedAssetsList';

export function BuildHero() {
  const [inputValue, setInputValue] = useState('');
  const [creationTypeId, setCreationTypeId] = useState<string>('');
  const [socialPostFormatId, setSocialPostFormatId] = useState<string>(SOCIAL_POST_FORMATS[0].id);
  const [socialPostDimensionId, setSocialPostDimensionId] = useState<string>(
    SOCIAL_POST_DIMENSIONS[0].id,
  );
  const [videoFormatId, setVideoFormatId] = useState<string>(VIDEO_FORMATS[0].id);
  const [videoDimensionId, setVideoDimensionId] = useState<string>(VIDEO_DIMENSIONS[0].id);
  const [selectedDamAssets, setSelectedDamAssets] = useState<SelectedDamAsset[]>([]);
  const [_selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const sendMessage = useChatStore((s) => s.sendMessage);
  const isGenerating = useChatStore((s) => s.isStreaming);
  const toggleChatSidebar = useCampaignStore((s) => s.toggleChatSidebar);
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);

  const { assets: savedAssetsRaw } = useAssets();

  const savedAssets = useMemo(
    () => savedAssetsRaw.map((a) => ({ id: a.id, url: a.url, name: a.name ?? undefined })),
    [savedAssetsRaw],
  );

  const ideasAssets = useMemo(
    () => [...selectedDamAssets, ...savedAssets],
    [selectedDamAssets, savedAssets],
  );

  const handleBuild = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isGenerating) return;
    const creationType = CREATION_TYPES.find((t) => t.id === creationTypeId);
    const prefix = creationType ? `[${creationType.label}] ` : '';
    const fullPrompt = `${prefix}${text}`;
    if (!chatSidebarOpen) toggleChatSidebar();
    sendMessage(fullPrompt, {
      currentView,
      activeCampaignId,
      activeCreationId,
      activeIterationId,
    });
    setInputValue('');
  }, [
    inputValue,
    isGenerating,
    creationTypeId,
    sendMessage,
    chatSidebarOpen,
    toggleChatSidebar,
    currentView,
    activeCampaignId,
    activeCreationId,
    activeIterationId,
  ]);

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
        height: '100%',
        minHeight: 0,
        background: BG_PRIMARY,
        color: TEXT_PRIMARY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 'min(240px, 20vh)',
        paddingBottom: '40px',
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        gap: 0,
        fontFamily: 'inherit',
        overflowY: 'auto',
      }}
    >
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
        <div
          style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
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

        {/* Main prompt input with dropdowns and toolbar */}
        <PromptInput
          inputValue={inputValue}
          onInputChange={setInputValue}
          creationTypeId={creationTypeId}
          onCreationTypeChange={setCreationTypeId}
          socialPostFormatId={socialPostFormatId}
          onSocialPostFormatChange={setSocialPostFormatId}
          socialPostDimensionId={socialPostDimensionId}
          onSocialPostDimensionChange={setSocialPostDimensionId}
          videoFormatId={videoFormatId}
          onVideoFormatChange={setVideoFormatId}
          videoDimensionId={videoDimensionId}
          onVideoDimensionChange={setVideoDimensionId}
          selectedDamAssets={selectedDamAssets}
          onDamAssetsChange={setSelectedDamAssets}
          onBuild={handleBuild}
          isGenerating={isGenerating}
        />

        {/* Suggestion pills */}
        <SuggestionPills />

        {/* Discover and remix ideas */}
        <div
          style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '2rem' }}
        >
          <IdeasGetStarted selectedAssets={ideasAssets} onApplyIdea={handleApplyIdea} />
        </div>
      </div>
    </div>
  );
}
