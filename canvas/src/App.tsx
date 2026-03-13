import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react';
import { AppShell } from './components/AppShell';
import { PromptSidebar } from './components/PromptSidebar';
import { ContentEditor } from './components/ContentEditor';
import { CampaignDashboard } from './components/CampaignDashboard';
import { DrillDownGrid, type DrillDownItem, type PreviewDescriptor } from './components/DrillDownGrid';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateCustomizer } from './components/TemplateCustomizer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCampaignStore } from './store/campaign';
import { useEditorStore } from './store/editor';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { Asset, Frame, Iteration } from './lib/campaign-types';
import { TEMPLATE_METADATA, type TemplateMetadata } from './lib/template-configs';
import { buildAssetPreview, buildFramePreview } from './lib/preview-utils';
import { StatusBadge } from './components/StatusBadge';

type CreationFlow = null | 'gallery' | 'customizer';

export function App() {
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeAssetId = useCampaignStore((s) => s.activeAssetId);
  const activeFrameId = useCampaignStore((s) => s.activeFrameId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);
  const assets = useCampaignStore((s) => s.assets);
  const frames = useCampaignStore((s) => s.frames);
  const iterations = useCampaignStore((s) => s.iterations);
  const latestIterationByAssetId = useCampaignStore((s) => s.latestIterationByAssetId);
  const loading = useCampaignStore((s) => s.loading);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);
  const navigateToAsset = useCampaignStore((s) => s.navigateToAsset);
  const navigateToFrame = useCampaignStore((s) => s.navigateToFrame);
  const selectIteration = useCampaignStore((s) => s.selectIteration);
  const setRightSidebarOpen = useCampaignStore((s) => s.setRightSidebarOpen);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);

  const selectedIterationId = useEditorStore((s) => s.selectedIterationId);

  // Template creation flow state
  const [creationFlow, setCreationFlow] = useState<CreationFlow>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMetadata | null>(null);

  // Ref to the active iteration's iframe element for ContentEditor
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // When editing an iteration, we need state so ContentEditor receives the iframe after it mounts
  const [editIframeEl, setEditIframeEl] = useState<HTMLIFrameElement | null>(null);

  // Auto-refresh on filesystem changes (campaign-aware)
  useFileWatcher();

  // Initial data load
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // When an iteration is selected, open the right sidebar
  useEffect(() => {
    if (activeIterationId) {
      setRightSidebarOpen(true);
    }
  }, [activeIterationId, setRightSidebarOpen]);

  // Clear edit iframe ref when leaving edit mode (deselecting iteration)
  useEffect(() => {
    if (!activeIterationId) setEditIframeEl(null);
  }, [activeIterationId]);

  // ── Iteration selection handler ──────────────────────────────────────────
  const handleSelectIteration = useCallback(
    (item: DrillDownItem<Iteration>) => {
      selectIteration(item.id);
    },
    [selectIteration]
  );

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handleSelectAsset = useCallback(
    (item: DrillDownItem<Asset>) => {
      navigateToAsset(item.id);
    },
    [navigateToAsset]
  );

  const handleSelectFrame = useCallback(
    (item: DrillDownItem<Frame>) => {
      navigateToFrame(item.id);
    },
    [navigateToFrame]
  );

  // ── Template creation flow ───────────────────────────────────────────────
  const handleNewAsset = useCallback(() => {
    setCreationFlow('gallery');
    setSelectedTemplate(null);
  }, []);

  const handleSelectTemplate = useCallback((template: TemplateMetadata) => {
    setSelectedTemplate(template);
    setCreationFlow('customizer');
  }, []);

  const handleCloseCreationFlow = useCallback(() => {
    setCreationFlow(null);
    setSelectedTemplate(null);
  }, []);

  const handleBackToGallery = useCallback(() => {
    setSelectedTemplate(null);
    setCreationFlow('gallery');
  }, []);

  // Called by TemplateCustomizer after successfully creating an asset
  const handleAssetCreated = useCallback(
    (campaignId: string) => {
      handleCloseCreationFlow();
      navigateToCampaign(campaignId);
    },
    [handleCloseCreationFlow, navigateToCampaign]
  );

  // ── Derive active iteration object ──────────────────────────────────────
  const activeIteration = activeIterationId
    ? iterations.find((it) => it.id === activeIterationId) ?? null
    : null;

  // ── DrillDownGrid renderPreview helpers ─────────────────────────────────
  // For assets: show iframe preview when a complete iteration exists, else metadata fallback
  const renderAssetPreview = (item: DrillDownItem<Asset>): PreviewDescriptor | null =>
    buildAssetPreview(item.data, latestIterationByAssetId[item.id]) as PreviewDescriptor;

  // For frames: show iframe preview for latest complete iteration, else metadata fallback
  const renderFramePreview = (item: DrillDownItem<Frame>): PreviewDescriptor | null => {
    const frameIterations = iterations.filter((i) => i.frameId === item.id);
    const parentAsset = assets.find((a) => a.id === item.data.assetId);
    return buildFramePreview(item.data, frameIterations, parentAsset) as PreviewDescriptor;
  };

  // For iterations: serve the actual HTML via the API endpoint
  const renderIterationPreview = (item: DrillDownItem<Iteration>): PreviewDescriptor | null => {
    if (!item.data.htmlPath) return null;
    // Look up template dimensions from templateId, or fall back to 1080x1080
    const tmpl = item.data.templateId ? TEMPLATE_METADATA.find((t) => t.templateId === item.data.templateId) : null;
    const width = tmpl?.dimensions.width ?? 1080;
    const height = tmpl?.dimensions.height ?? 1080;
    return {
      src: `/api/iterations/${item.data.id}/html`,
      width,
      height,
    };
  };

  // ── Map store data to DrillDownItem arrays ───────────────────────────────
  const assetItems: DrillDownItem<Asset>[] = assets.map((a) => {
    const latestIter = latestIterationByAssetId[a.id];
    const genStatus = latestIter?.generationStatus;
    return {
      id: a.id,
      title: a.title,
      subtitle: genStatus ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <span>{a.assetType}</span>
          <StatusBadge status={genStatus} />
        </span>
      ) : a.assetType,
      data: a,
    };
  });

  const frameItems: DrillDownItem<Frame>[] = frames.map((f) => ({
    id: f.id,
    title: `Frame ${f.frameIndex + 1}`,
    data: f,
  }));

  const iterationItems: DrillDownItem<Iteration>[] = iterations.map((it) => ({
    id: it.id,
    title: `Iteration ${it.iterationIndex + 1}`,
    subtitle: it.source === 'template' ? `Template: ${it.templateId ?? ''}` : 'AI Generated',
    data: it,
  }));

  // ── Main content area (switches based on currentView) ───────────────────
  const renderMainContent = () => {
    if (loading && currentView !== 'dashboard') {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#555',
          fontSize: '0.9rem',
          gap: '0.75rem',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #2a2a2e', borderTopColor: '#44B2FF',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading...
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <CampaignDashboard />;

      case 'campaign':
        return (
          <DrillDownGrid
            items={assetItems}
            renderPreview={renderAssetPreview}
            onSelect={handleSelectAsset}
            title="Assets"
            emptyState={
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', minHeight: 300,
                gap: '1rem', color: '#444',
              }}>
                <div style={{ fontSize: '0.9rem' }}>No assets yet</div>
                <div style={{ fontSize: '0.8rem', color: '#333' }}>
                  Click &quot;New Asset&quot; to create one
                </div>
              </div>
            }
          />
        );

      case 'asset':
        return (
          <DrillDownGrid
            items={frameItems}
            renderPreview={renderFramePreview}
            onSelect={handleSelectFrame}
            title="Frames"
          />
        );

      case 'frame':
        if (activeIterationId && activeIteration) {
          const tmpl = activeIteration.templateId
            ? TEMPLATE_METADATA.find((t) => t.templateId === activeIteration.templateId)
            : null;
          const editW = tmpl?.dimensions.width ?? 1080;
          const editH = tmpl?.dimensions.height ?? 1080;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderBottom: '1px solid #1e1e1e',
              }}>
                <button
                  type="button"
                  onClick={() => navigateToFrame(activeFrameId!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  ← Back to list
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <IterationEditFrame
                  iterationId={activeIterationId}
                  width={editW}
                  height={editH}
                  onIframeRef={(el) => {
                    iframeRef.current = el;
                    setEditIframeEl(el);
                  }}
                />
              </div>
            </div>
          );
        }
        return (
          <DrillDownGrid
            items={iterationItems}
            renderPreview={renderIterationPreview}
            onSelect={handleSelectIteration}
            title="Iterations"
            emptyState={
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', minHeight: 300,
                gap: '0.75rem', color: '#444',
              }}>
                <div style={{ fontSize: '0.9rem' }}>No iterations yet</div>
                <div style={{ fontSize: '0.8rem', color: '#333' }}>
                  Iterations appear here once generated
                </div>
              </div>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <AppShell
        leftSidebar={<PromptSidebar />}
        rightSidebar={
          <ContentEditor
            iteration={activeIteration}
            iframeEl={currentView === 'frame' && activeIterationId ? editIframeEl : iframeRef.current}
          />
        }
        onNewAsset={activeCampaignId ? handleNewAsset : undefined}
      >
        {renderMainContent()}
      </AppShell>

      {/* Template creation flow — modal overlay */}
      {creationFlow !== null && (
        <TemplateCreationModal
          flow={creationFlow}
          selectedTemplate={selectedTemplate}
          activeCampaignId={activeCampaignId}
          onSelectTemplate={handleSelectTemplate}
          onBack={handleBackToGallery}
          onClose={handleCloseCreationFlow}
          onAssetCreated={handleAssetCreated}
        />
      )}
    </ErrorBoundary>
  );
}

// ─── Template Creation Modal ─────────────────────────────────────────────────

interface TemplateCreationModalProps {
  flow: 'gallery' | 'customizer';
  selectedTemplate: TemplateMetadata | null;
  activeCampaignId: string | null;
  onSelectTemplate: (t: TemplateMetadata) => void;
  onBack: () => void;
  onClose: () => void;
  onAssetCreated: (campaignId: string) => void;
}

// ── Shared style constants ───────────────────────────────────────────────────
const BLUE = '#44B2FF';
const BG_MODAL = '#0d0d0d';
const BG_PANEL = '#1a1a1e';
const BORDER = '#2a2a2e';
const LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  color: '#888',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
};
const INPUT_STYLE: CSSProperties = {
  width: '100%',
  backgroundColor: '#141414',
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  color: '#e0e0e0',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

// ── Skill card data ──────────────────────────────────────────────────────────
const SKILLS = [
  {
    id: 'ad-creative',
    label: 'Ad Creative',
    description: 'Paid ad visuals — Instagram, Facebook, LinkedIn',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
  },
  {
    id: 'social-content',
    label: 'Social Content',
    description: 'Organic posts — quotes, highlights, announcements',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'copywriting',
    label: 'Copywriting',
    description: 'Marketing copy — headlines, CTAs, taglines',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

// ── NEW ASSET tab ─────────────────────────────────────────────────────────────
interface NewAssetTabProps {
  selectedTemplate: TemplateMetadata | null;
  onSelectTemplate: (t: TemplateMetadata) => void;
  activeCampaignId: string | null;
  onAssetCreated: (campaignId: string) => void;
}

function NewAssetTab({ selectedTemplate, onSelectTemplate, activeCampaignId, onAssetCreated }: NewAssetTabProps) {
  const [selectedSkill, setSelectedSkill] = useState('ad-creative');
  const [brief, setBrief] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const handleAddReference = () => {
    const url = referenceUrl.trim();
    if (url && !references.includes(url)) {
      setReferences((prev) => [...prev, url]);
      setReferenceUrl('');
    }
  };

  const handleGeneratePrompt = async () => {
    if (!selectedTemplate || !activeCampaignId) return;
    setGenerating(true);
    try {
      onSelectTemplate(selectedTemplate);
    } finally {
      setGenerating(false);
    }
  };

  // Preview URL for selected template
  const previewUrl = selectedTemplate && selectedTemplate.templateId !== 'scratch'
    ? `/templates/${selectedTemplate.templateId}.html`
    : null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* ── Left column ── */}
      <div style={{
        width: 340,
        flexShrink: 0,
        borderRight: `1px solid ${BORDER}`,
        overflowY: 'auto',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* SKILL section */}
        <section>
          <div style={LABEL_STYLE}>Skill</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {SKILLS.map((skill) => {
              const isActive = selectedSkill === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: isActive ? 'rgba(68,178,255,0.08)' : BG_PANEL,
                    border: `1px solid ${isActive ? BLUE : BORDER}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    outline: 'none',
                    color: isActive ? BLUE : '#aaa',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = '#444';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = BORDER;
                  }}
                >
                  <span style={{ marginTop: 1, flexShrink: 0 }}>{skill.icon}</span>
                  <div>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: isActive ? BLUE : '#ddd',
                      marginBottom: '0.2rem',
                      letterSpacing: '0.02em',
                    }}>
                      {skill.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', lineHeight: 1.4 }}>
                      {skill.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* BASE TEMPLATE section */}
        <section>
          <div style={LABEL_STYLE}>Base Template</div>
          <div style={{
            backgroundColor: BG_PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <TemplateGallery
              onSelectTemplate={onSelectTemplate}
              mode="modal"
              selectedTemplateId={selectedTemplate?.templateId ?? null}
            />
          </div>
        </section>

        {/* BRIEF section */}
        <section>
          <label htmlFor="asset-brief" style={LABEL_STYLE}>Brief</label>
          <textarea
            id="asset-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you want to create..."
            rows={4}
            style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 80 }}
            onFocus={(e) => (e.target.style.borderColor = BLUE)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </section>

        {/* REFERENCES section */}
        <section>
          <div style={LABEL_STYLE}>References</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddReference(); }}
              placeholder="https://..."
              style={{ ...INPUT_STYLE, flex: 1 }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>
          <button
            onClick={handleAddReference}
            style={{
              background: 'none',
              border: 'none',
              color: BLUE,
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.375rem 0',
              fontFamily: 'inherit',
            }}
          >
            + Add Reference
          </button>
          {references.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              {references.map((ref, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ref}
                  </span>
                  <button
                    onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 2px', fontSize: '0.85rem' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* GENERATE PROMPT button */}
        <button
          onClick={handleGeneratePrompt}
          disabled={generating || !selectedTemplate}
          style={{
            backgroundColor: generating || !selectedTemplate ? '#1e2020' : BLUE,
            color: generating || !selectedTemplate ? '#444' : '#000',
            border: 'none',
            borderRadius: 6,
            padding: '0.65rem 1.5rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: generating || !selectedTemplate ? 'not-allowed' : 'pointer',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            transition: 'background-color 0.15s',
            marginTop: 'auto',
          }}
          onMouseEnter={(e) => {
            if (!generating && selectedTemplate) e.currentTarget.style.backgroundColor = '#65C5FF';
          }}
          onMouseLeave={(e) => {
            if (!generating && selectedTemplate) e.currentTarget.style.backgroundColor = BLUE;
          }}
        >
          {generating ? 'Opening...' : 'Generate Prompt'}
        </button>
      </div>

      {/* ── Right column: PREVIEW ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#0d0d0d',
      }}>
        {/* Preview header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.75rem 1.25rem',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <span style={{ ...LABEL_STYLE, marginBottom: 0 }}>Preview</span>
          {selectedTemplate && (
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.7rem',
              color: '#555',
              fontStyle: 'italic',
            }}>
              {selectedTemplate.name}
            </span>
          )}
        </div>

        {/* Preview content */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '1.5rem',
        }}>
          {previewUrl ? (
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <PreviewFrame
                src={previewUrl}
                width={selectedTemplate!.dimensions.width}
                height={selectedTemplate!.dimensions.height}
              />
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#333',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: '0.8rem' }}>Select a template to preview</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Iteration edit view: large iframe loading /api/iterations/:id/html (same URL as preview cards) ──
function IterationEditFrame({
  iterationId,
  width,
  height,
  onIframeRef,
}: {
  iterationId: string;
  width: number;
  height: number;
  onIframeRef: (el: HTMLIFrameElement | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const scaleX = cw / width;
      const scaleY = ch / height;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'relative',
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        border: '1px solid #2a2a2e',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        backgroundColor: '#000',
      }}>
        <iframe
          ref={onIframeRef}
          src={`/api/iterations/${iterationId}/html`}
          width={width}
          height={height}
          style={{ border: 'none', display: 'block' }}
          title="Edit preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

// ── Scaled iframe preview ────────────────────────────────────────────────────
function PreviewFrame({ src, width, height }: { src: string; width: number; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const scaleX = cw / width;
      const scaleY = ch / height;
      setScale(Math.min(scaleX, scaleY, 1) * 0.95);
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        width,
        height,
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backgroundColor: '#fff',
      }}>
        <iframe
          src={src}
          width={width}
          height={height}
          style={{ border: 'none', display: 'block', pointerEvents: 'none' }}
          title="Template preview"
        />
      </div>
    </div>
  );
}

// ── NEW CAMPAIGN tab ──────────────────────────────────────────────────────────
interface NewCampaignTabProps {
  onClose: () => void;
}

function NewCampaignTab({ onClose }: NewCampaignTabProps) {
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);

  const [campaignName, setCampaignName] = useState('');
  const [brief, setBrief] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddReference = () => {
    const url = referenceUrl.trim();
    if (url && !references.includes(url)) {
      setReferences((prev) => [...prev, url]);
      setReferenceUrl('');
    }
  };

  const handleSave = async () => {
    if (!campaignName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName.trim(), brief: brief.trim() }),
      });
      if (!res.ok) throw new Error(`Failed to create campaign: ${res.status}`);
      const campaign = await res.json();
      await fetchCampaigns();
      navigateToCampaign(campaign.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
      setSaving(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '1.75rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      maxWidth: 560,
    }}>

      {/* CAMPAIGN NAME */}
      <section>
        <label htmlFor="campaign-name" style={LABEL_STYLE}>Campaign Name</label>
        <input
          id="campaign-name"
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="e.g. Q2 Product Launch"
          style={INPUT_STYLE}
          onFocus={(e) => (e.target.style.borderColor = BLUE)}
          onBlur={(e) => (e.target.style.borderColor = BORDER)}
        />
      </section>

      {/* BRIEF */}
      <section>
        <label htmlFor="campaign-brief" style={LABEL_STYLE}>Brief</label>
        <textarea
          id="campaign-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe the campaign goals, audience, and tone..."
          rows={5}
          style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 100 }}
          onFocus={(e) => (e.target.style.borderColor = BLUE)}
          onBlur={(e) => (e.target.style.borderColor = BORDER)}
        />
      </section>

      {/* RESOURCES */}
      <section>
        <div style={LABEL_STYLE}>Resources</div>

        {/* Reference links */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.4rem' }}>Reference Links</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddReference(); }}
              placeholder="https://..."
              style={{ ...INPUT_STYLE, flex: 1 }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>
          <button
            onClick={handleAddReference}
            style={{
              background: 'none', border: 'none', color: BLUE, cursor: 'pointer',
              fontSize: '0.75rem', padding: '0.35rem 0', fontFamily: 'inherit',
            }}
          >
            + Add Link
          </button>
          {references.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {references.map((ref, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ref}
                  </span>
                  <button
                    onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 2px', fontSize: '0.85rem' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attach files */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.4rem' }}>Attach Files</div>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 1rem',
            backgroundColor: BG_PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: '#aaa',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Choose Files
            <input type="file" multiple style={{ display: 'none' }} />
          </label>
        </div>

        {/* Fluid DAM */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.4rem' }}>Fluid DAM</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: BG_PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
          }}>
            <span style={{ fontSize: '0.8rem', color: BLUE, flexShrink: 0 }}>✦</span>
            <span style={{ fontSize: '0.8rem', color: '#aaa', flex: 1 }}>Fluid DAM connected</span>
            <button style={{
              backgroundColor: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: 5,
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '0.3rem 0.75rem',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = BLUE)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
            >
              Browse Assets
            </button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.625rem 0.875rem',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 6,
          fontSize: '0.8rem',
          color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving || !campaignName.trim()}
          style={{
            backgroundColor: saving || !campaignName.trim() ? '#1e2020' : BLUE,
            color: saving || !campaignName.trim() ? '#444' : '#000',
            border: 'none',
            borderRadius: 6,
            padding: '0.65rem 1.75rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: saving || !campaignName.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!saving && campaignName.trim()) e.currentTarget.style.backgroundColor = '#65C5FF';
          }}
          onMouseLeave={(e) => {
            if (!saving && campaignName.trim()) e.currentTarget.style.backgroundColor = BLUE;
          }}
        >
          {saving ? 'Saving...' : 'Save Campaign'}
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
function TemplateCreationModal({
  flow,
  selectedTemplate,
  activeCampaignId,
  onSelectTemplate,
  onBack,
  onClose,
  onAssetCreated,
}: TemplateCreationModalProps) {
  // 'asset' = "+ NEW ASSET" tab, 'campaign' = "+ NEW CAMPAIGN" tab
  const [activeTab, setActiveTab] = useState<'asset' | 'campaign'>('asset');

  const tabStyle = (isActive: boolean): CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
    color: isActive ? '#fff' : '#555',
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: isActive ? 700 : 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.75rem 0',
    marginRight: '1.5rem',
    fontFamily: 'inherit',
    transition: 'color 0.15s, border-color 0.15s',
    outline: 'none',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      {/* Dialog panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw',
          maxWidth: 900,
          height: '85vh',
          backgroundColor: BG_MODAL,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 64px rgba(0,0,0,0.85)',
        }}
      >
        {/* ── Header: tabs + close ── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          backgroundColor: BG_MODAL,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              style={tabStyle(activeTab === 'asset')}
              onClick={() => setActiveTab('asset')}
              onMouseEnter={(e) => { if (activeTab !== 'asset') e.currentTarget.style.color = '#aaa'; }}
              onMouseLeave={(e) => { if (activeTab !== 'asset') e.currentTarget.style.color = '#555'; }}
            >
              + New Asset
            </button>
            <button
              style={tabStyle(activeTab === 'campaign')}
              onClick={() => setActiveTab('campaign')}
              onMouseEnter={(e) => { if (activeTab !== 'campaign') e.currentTarget.style.color = '#aaa'; }}
              onMouseLeave={(e) => { if (activeTab !== 'campaign') e.currentTarget.style.color = '#555'; }}
            >
              + New Campaign
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#555',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: '0.75rem 0 0.75rem 4px',
              marginBottom: '2px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {activeTab === 'asset' && (
            <>
              {/* When flow = 'gallery': show new design */}
              {flow === 'gallery' && (
                <NewAssetTab
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={onSelectTemplate}
                  activeCampaignId={activeCampaignId}
                  onAssetCreated={onAssetCreated}
                />
              )}
              {/* When flow = 'customizer': show the customizer inline */}
              {flow === 'customizer' && selectedTemplate && activeCampaignId && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <TemplateCustomizer
                    template={selectedTemplate}
                    campaignId={activeCampaignId}
                    onBack={onBack}
                    onCreated={onAssetCreated}
                  />
                </div>
              )}
              {flow === 'customizer' && !activeCampaignId && (
                <div style={{ padding: '2rem', color: '#555', textAlign: 'center', flex: 1 }}>
                  No campaign selected. Please navigate to a campaign first.
                </div>
              )}
            </>
          )}

          {activeTab === 'campaign' && (
            <NewCampaignTab onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
