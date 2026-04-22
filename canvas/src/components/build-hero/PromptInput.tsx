import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { FluidDAMModal } from '../DAMPicker';
import {
  BG_PRIMARY,
  BG_CARD,
  BG_SECONDARY,
  BORDER,
  BORDER_HOVER,
  ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from '../tokens';
import {
  CREATION_TYPES,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_DIMENSIONS,
  VIDEO_FORMATS,
  VIDEO_DIMENSIONS,
  type VideoFormatTag,
} from './constants';
import { Dropdown } from './Dropdown';
import { SparklesIcon, MicIcon, PlusIcon, ArrowRightIcon, SettingsIcon } from './Icons';
import { SelectedAssetsList, type SelectedDamAsset } from './SelectedAssetsList';

interface PromptInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  creationTypeId: string;
  onCreationTypeChange: (id: string) => void;
  socialPostFormatId: string;
  onSocialPostFormatChange: (id: string) => void;
  socialPostDimensionId: string;
  onSocialPostDimensionChange: (id: string) => void;
  videoFormatId: string;
  onVideoFormatChange: (id: string) => void;
  videoDimensionId: string;
  onVideoDimensionChange: (id: string) => void;
  selectedDamAssets: SelectedDamAsset[];
  onDamAssetsChange: (assets: SelectedDamAsset[]) => void;
  /** Called when user clicks Build — parent handles generation */
  onBuild?: () => void;
  /** Whether generation is currently in progress */
  isGenerating?: boolean;
}

export function PromptInput({
  inputValue,
  onInputChange,
  creationTypeId,
  onCreationTypeChange,
  socialPostFormatId,
  onSocialPostFormatChange,
  socialPostDimensionId,
  onSocialPostDimensionChange,
  videoFormatId,
  onVideoFormatChange,
  videoDimensionId,
  onVideoDimensionChange,
  selectedDamAssets,
  onDamAssetsChange,
  onBuild,
  isGenerating = false,
}: PromptInputProps) {
  const [damModalOpen, setDamModalOpen] = useState(false);

  const isSocialPost = creationTypeId === 'social-post';
  const isVideo = creationTypeId === 'instagram-story';

  const videoDimensionsForFormat = VIDEO_DIMENSIONS.filter((d) =>
    (d.formats as readonly VideoFormatTag[]).includes(videoFormatId as VideoFormatTag),
  );

  useEffect(() => {
    if (videoFormatId === 'story' && videoDimensionId !== '1080-1920') {
      onVideoDimensionChange('1080-1920');
    }
  }, [videoFormatId, videoDimensionId, onVideoDimensionChange]);

  const selectedCreation = creationTypeId
    ? (CREATION_TYPES.find((t) => t.id === creationTypeId) ?? null)
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 896 }}>
      {/* Gradient border glow */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 10,
          background:
            'linear-gradient(90deg, rgba(255,102,20,0.35) 0%, rgba(239,68,68,0.2) 50%, rgba(68,178,255,0.35) 100%)',
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
          onChange={(e) => onInputChange(e.target.value)}
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
            <Dropdown
              value={creationTypeId}
              options={CREATION_TYPES as unknown as { id: string; label: string }[]}
              onChange={onCreationTypeChange}
              title="Select what you're creating"
              minWidth={320}
              icon={<SettingsIcon />}
              displayText={selectedCreation?.label ?? 'Tools'}
            />
            {isSocialPost && (
              <>
                <Dropdown
                  value={socialPostFormatId}
                  options={SOCIAL_POST_FORMATS as unknown as { id: string; label: string }[]}
                  onChange={onSocialPostFormatChange}
                  title="Single post or Carousel"
                />
                <Dropdown
                  value={socialPostDimensionId}
                  options={
                    SOCIAL_POST_DIMENSIONS as unknown as {
                      id: string;
                      label: string;
                      dimensions?: string;
                      sublabel?: string;
                    }[]
                  }
                  onChange={onSocialPostDimensionChange}
                  title="Select dimensions"
                  minWidth={200}
                />
              </>
            )}
            {isVideo && (
              <>
                <Dropdown
                  value={videoFormatId}
                  options={VIDEO_FORMATS as unknown as { id: string; label: string }[]}
                  onChange={onVideoFormatChange}
                  title="Story or Video"
                />
                <Dropdown
                  value={videoDimensionId}
                  options={
                    videoDimensionsForFormat as unknown as {
                      id: string;
                      label: string;
                      dimensions?: string;
                      sublabel?: string;
                    }[]
                  }
                  onChange={onVideoDimensionChange}
                  title="Select dimensions"
                  minWidth={200}
                />
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
                onDamAssetsChange([...selectedDamAssets, { id: nanoid(), ...asset }]);
                setDamModalOpen(false);
              }}
              onCancel={() => setDamModalOpen(false)}
            />
            <button
              type="button"
              disabled={!inputValue.trim() || isGenerating}
              onClick={onBuild}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.5rem',
                borderRadius: 5,
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: inputValue.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.15s, border-color 0.15s',
                ...(inputValue.trim() && !isGenerating
                  ? { background: ACCENT, color: '#000', border: `1px solid ${ACCENT}` }
                  : { background: BG_SECONDARY, color: TEXT_MUTED, border: `1px solid ${BORDER}` }),
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isGenerating) {
                  e.currentTarget.style.backgroundColor = '#5cc0ff';
                  e.currentTarget.style.borderColor = '#5cc0ff';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim() && !isGenerating) {
                  e.currentTarget.style.backgroundColor = ACCENT;
                  e.currentTarget.style.borderColor = ACCENT;
                }
              }}
            >
              {isGenerating ? 'Building...' : 'Build'} {!isGenerating && <ArrowRightIcon />}
            </button>
          </div>
        </div>
        <SelectedAssetsList
          assets={selectedDamAssets}
          onRemove={(id) => onDamAssetsChange(selectedDamAssets.filter((a) => a.id !== id))}
        />
      </div>
    </div>
  );
}
