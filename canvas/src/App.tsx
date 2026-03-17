import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react';
import { AppShell } from './components/AppShell';
import { PromptSidebar } from './components/PromptSidebar';
import { ContentEditor } from './components/ContentEditor';
import { CampaignDashboard, FilterSortBar, type SortKey } from './components/CampaignDashboard';
import { DrillDownGrid, type DrillDownItem, type PreviewDescriptor } from './components/DrillDownGrid';
// TemplateGallery no longer used — template cards are rendered inline in the modal
// import { TemplateGallery } from './components/TemplateGallery';
import { TemplateCustomizer } from './components/TemplateCustomizer';
import { UnifiedCreationView } from './components/UnifiedCreationView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCampaignStore } from './store/campaign';
import { useEditorStore } from './store/editor';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { Creation, Slide, Iteration } from './lib/campaign-types';
import { TEMPLATE_METADATA, type TemplateMetadata } from './lib/template-configs';
import { buildCreationPreview, buildSlidePreview } from './lib/preview-utils';
// Note: iteration previews always try the API — the server handles path resolution with multiple fallback strategies
import { StatusBadge } from './components/StatusBadge';

type CreationFlow = null | 'gallery' | 'customizer';

/**
 * Shows standalone creations (single-asset prompts) in the Creations tab.
 * Fetches the __standalone__ campaign's creations and renders them as a grid.
 */
function StandaloneCreationsView() {
  const navigateToCreation = useCampaignStore((s) => s.navigateToCreation);
  const [standaloneCreations, setStandaloneCreations] = useState<Creation[]>([]);
  const [standaloneLoading, setStandaloneLoading] = useState(true);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Find the __standalone__ campaign
        const campaignsRes = await fetch('/api/campaigns');
        if (!campaignsRes.ok || cancelled) return;
        const campaigns = await campaignsRes.json();
        const standalone = campaigns.find((c: { title: string }) => c.title === '__standalone__');
        if (!standalone || cancelled) { setStandaloneLoading(false); return; }

        // Fetch its creations
        const crRes = await fetch(`/api/campaigns/${standalone.id}/creations`);
        if (!crRes.ok || cancelled) { setStandaloneLoading(false); return; }
        const creations: Creation[] = await crRes.json();
        if (cancelled) return;
        setStandaloneCreations(creations);
        setStandaloneLoading(false);

        // Fetch latest iteration preview for each creation
        const prevMap: Record<string, string> = {};
        await Promise.all(creations.map(async (cr) => {
          try {
            const slidesRes = await fetch(`/api/creations/${cr.id}/slides`);
            if (!slidesRes.ok) return;
            const slides = await slidesRes.json();
            if (slides.length === 0) return;
            const itersRes = await fetch(`/api/slides/${slides[0].id}/iterations`);
            if (!itersRes.ok) return;
            const iters = await itersRes.json();
            if (iters.length === 0) return;
            const latest = iters.reduce((best: any, it: any) =>
              it.iterationIndex > best.iterationIndex ? it : best
            );
            prevMap[cr.id] = latest.id;
          } catch { /* skip */ }
        }));
        if (!cancelled) setPreviews(prevMap);
      } catch {
        if (!cancelled) setStandaloneLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (standaloneLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '0.85rem' }}>
        Loading creations...
      </div>
    );
  }

  if (standaloneCreations.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', minHeight: 280, padding: '2rem', color: '#666', fontSize: '0.85rem',
        fontFamily: "'Inter', sans-serif", textAlign: 'center',
      }}>
        <p style={{ margin: 0, maxWidth: 320 }}>
          No standalone creations yet. Use the prompt to generate a single post.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '1rem',
      padding: '1rem',
      overflowY: 'auto',
    }}>
      {standaloneCreations.map((cr) => (
        <div
          key={cr.id}
          onClick={() => navigateToCreation(cr.id)}
          style={{
            backgroundColor: '#1a1a1e',
            borderRadius: 8,
            overflow: 'hidden',
            cursor: 'pointer',
            border: '1px solid #2a2a2e',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#44B2FF')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2e')}
        >
          <div style={{ aspectRatio: '1', backgroundColor: '#111', position: 'relative', overflow: 'hidden' }}>
            {previews[cr.id] ? (
              <iframe
                src={`/api/iterations/${previews[cr.id]}/html`}
                style={{
                  transform: 'scale(0.2)',
                  transformOrigin: 'top left',
                  width: '500%',
                  height: '500%',
                  pointerEvents: 'none',
                  border: 'none',
                }}
                sandbox="allow-same-origin"
                title={cr.title}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: '0.75rem' }}>
                No preview
              </div>
            )}
          </div>
          <div style={{ padding: '0.5rem 0.65rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cr.title}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#666', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {cr.creationType}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const activeSlideId = useCampaignStore((s) => s.activeSlideId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);
  const creations = useCampaignStore((s) => s.creations);
  const slides = useCampaignStore((s) => s.slides);
  const iterations = useCampaignStore((s) => s.iterations);
  const latestIterationByCreationId = useCampaignStore((s) => s.latestIterationByCreationId);
  const loading = useCampaignStore((s) => s.loading);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);
  const navigateToCreation = useCampaignStore((s) => s.navigateToCreation);
  const selectIteration = useCampaignStore((s) => s.selectIteration);
  const setRightSidebarOpen = useCampaignStore((s) => s.setRightSidebarOpen);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const createViewportTab = useCampaignStore((s) => s.createViewportTab);

  const selectedIterationId = useEditorStore((s) => s.selectedIterationId);

  // Template creation flow state
  const [creationFlow, setCreationFlow] = useState<CreationFlow>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMetadata | null>(null);

  // Creations tab filter/sort (when viewing creations in a campaign)
  const [filterCreationType, setFilterCreationType] = useState('all');
  const [sortCreationKey, setSortCreationKey] = useState<SortKey>('updatedAt');

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
  const handleSelectCreation = useCallback(
    (item: DrillDownItem<Creation>) => {
      navigateToCreation(item.id);
    },
    [navigateToCreation]
  );

  // ── Template creation flow ───────────────────────────────────────────────
  const handleNewCreation = useCallback(() => {
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

  // Called by TemplateCustomizer after successfully creating a creation
  const handleCreationCreated = useCallback(
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
  // For creations: show iframe preview when a complete iteration exists, else metadata fallback
  const renderCreationPreview = (item: DrillDownItem<Creation>): PreviewDescriptor | null =>
    buildCreationPreview(item.data, latestIterationByCreationId[item.id]) as PreviewDescriptor;

  // For slides: show iframe preview for latest complete iteration, else metadata fallback
  const renderSlidePreview = (item: DrillDownItem<Slide>): PreviewDescriptor | null => {
    const slideIterations = iterations.filter((i) => i.slideId === item.id);
    const parentCreation = creations.find((a) => a.id === item.data.creationId);
    return buildSlidePreview(item.data, slideIterations, parentCreation) as PreviewDescriptor;
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
  const creationItems: DrillDownItem<Creation>[] = creations.map((a) => {
    const latestIter = latestIterationByCreationId[a.id];
    const genStatus = latestIter?.generationStatus;
    return {
      id: a.id,
      title: a.title,
      subtitle: genStatus ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <span>{a.creationType}</span>
          <StatusBadge status={genStatus} />
        </span>
      ) : a.creationType,
      data: a,
    };
  });

  // Filter/sort for Creations tab (by type and sort key; Creation has createdAt, no updatedAt)
  const creationTypes = Array.from(new Set(creations.map((c) => c.creationType)));
  const filteredCreationItems = filterCreationType === 'all'
    ? creationItems
    : creationItems.filter((item) => item.data.creationType === filterCreationType);
  const sortedCreationItems = [...filteredCreationItems].sort((a, b) => {
    if (sortCreationKey === 'title') return a.data.title.localeCompare(b.data.title);
    const aTime = a.data.createdAt;
    const bTime = b.data.createdAt;
    return sortCreationKey === 'updatedAt' || sortCreationKey === 'createdAt' ? bTime - aTime : bTime - aTime;
  });

  const slideItems: DrillDownItem<Slide>[] = slides.map((f) => ({
    id: f.id,
    title: `Slide ${f.slideIndex + 1}`,
    data: f,
  }));

  const iterationItems: DrillDownItem<Iteration>[] = iterations.map((it) => ({
    id: it.id,
    title: `Iteration ${it.iterationIndex + 1}`,
    subtitle: it.source === 'template' ? `Template: ${it.templateId ?? ''}` : 'AI Generated',
    data: it,
  }));

  // ── Main content area ───────────────────────────────────────────────────
  // Campaigns tab: only campaign folders (no creations). Creations tab: creations hierarchy.
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

    // Campaigns tab: show campaign list only at dashboard; when a campaign is selected, show drill-down in same tab.
    if (createViewportTab === 'campaigns' && currentView === 'dashboard') {
      return <CampaignDashboard />;
    }

    // Creations tab at dashboard, or either tab when drilled in: show creations hierarchy (creations → slides → iterations)
    switch (currentView) {
      case 'dashboard':
        return <StandaloneCreationsView />;

      case 'campaign':
        return (
          <DrillDownGrid
            items={sortedCreationItems}
            renderPreview={renderCreationPreview}
            onSelect={handleSelectCreation}
            title="Creations"
            showBreadcrumb
            headerActions={
              <FilterSortBar
                filterChannel={filterCreationType}
                onFilterChannel={setFilterCreationType}
                sortKey={sortCreationKey}
                onSort={setSortCreationKey}
                channels={creationTypes}
              />
            }
            emptyState={
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', minHeight: 300,
                gap: '1rem', color: '#444',
              }}>
                <div style={{ fontSize: '0.9rem' }}>No creations in this campaign yet</div>
                <div style={{ fontSize: '0.8rem', color: '#333' }}>
                  Add a creation with &quot;create New&quot; above
                </div>
              </div>
            }
          />
        );

      case 'creation':
        return (
          <UnifiedCreationView
            onIframeRef={(el) => {
              iframeRef.current = el;
              setEditIframeEl(el);
            }}
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
            iframeEl={currentView === 'creation' && activeIterationId ? editIframeEl : iframeRef.current}
          />
        }
        onNewCreation={handleNewCreation}
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
          onCreationCreated={handleCreationCreated}
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
  onCreationCreated: (campaignId: string) => void;
}

// ── Shared style constants (matching Jonathan's original) ─────────────────────
const BLUE = '#44B2FF';
const BG_MODAL = '#111';
const BG_DARK = '#0a0a0a';
const BORDER = '#1a1a1a';
const BORDER_LIGHT = '#1e1e1e';
const LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: '#444',
  marginBottom: 10,
};
const SUBLABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: '#2a2a2a',
  marginBottom: 12,
};
const INPUT_STYLE: CSSProperties = {
  width: '100%',
  backgroundColor: BG_DARK,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  color: '#ccc',
  padding: '9px 12px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  transition: 'border-color 0.15s',
};
const TEXTAREA_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  minHeight: 100,
  padding: '12px 14px',
  fontSize: 13,
  lineHeight: 1.6,
  resize: 'vertical',
};

// ── Skill card data (3-column grid matching Jonathan's design) ──────────────
const SKILLS = [
  {
    id: 'ad-creative',
    label: 'Ad Creative',
    description: 'Paid ad visuals — Instagram, Facebook, LinkedIn',
    emoji: '\uD83D\uDCE3',
  },
  {
    id: 'social-content',
    label: 'Social Content',
    description: 'Organic posts — quotes, highlights, announcements',
    emoji: '\uD83D\uDCF1',
  },
  {
    id: 'copywriting',
    label: 'Copywriting',
    description: 'Marketing copy — headlines, CTAs, taglines',
    emoji: '\u270D\uFE0F',
  },
];

// ── NEW CREATION tab ─────────────────────────────────────────────────────────────
interface NewCreationTabProps {
  selectedTemplate: TemplateMetadata | null;
  onSelectTemplate: (t: TemplateMetadata) => void;
  activeCampaignId: string | null;
  onCreationCreated: (campaignId: string) => void;
}

function NewCreationTab({ selectedTemplate, onSelectTemplate, activeCampaignId, onCreationCreated }: NewCreationTabProps) {
  const [localTemplate, setLocalTemplate] = useState<TemplateMetadata | null>(selectedTemplate);
  const [selectedSkill, setSelectedSkill] = useState('ad-creative');
  const [brief, setBrief] = useState('');
  const [references, setReferences] = useState<string[]>(['']);
  const [generating, setGenerating] = useState(false);

  const handleGeneratePrompt = async () => {
    if (!localTemplate || !activeCampaignId) return;
    setGenerating(true);
    try {
      onSelectTemplate(localTemplate);
    } finally {
      setGenerating(false);
    }
  };

  const addRef = () => setReferences((prev) => [...prev, '']);
  const removeRef = (idx: number) => setReferences((prev) => prev.filter((_, i) => i !== idx));
  const updateRef = (idx: number, val: string) =>
    setReferences((prev) => prev.map((r, i) => (i === idx ? val : r)));

  // Preview URL for locally selected template
  const previewUrl = localTemplate && localTemplate.templateId !== 'scratch'
    ? `/templates/${localTemplate.templateId}.html`
    : null;

  // Determine dimension badge for a template
  const getDimBadge = (t: TemplateMetadata) => {
    const { width, height } = t.dimensions;
    if (width === height) return `${width}\u00B2`;
    return `${width}\u00D7${height}`;
  };

  // Check for carousel
  const getCarouselBadge = (t: TemplateMetadata) => {
    if (t.templateId === 't7-carousel' || t.templateId === 't8-quarterly-stats') return '4 slides';
    return getDimBadge(t);
  };

  const isLandscape = localTemplate?.platform === 'linkedin-landscape';

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* ── Left column: Form ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 36px 36px 36px',
      }}>
        {/* SKILL section — 3-column grid */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>Skill</label>
          <div style={SUBLABEL_STYLE}>Choose what type of asset to create</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}>
            {SKILLS.map((skill) => {
              const isActive = selectedSkill === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill.id)}
                  style={{
                    padding: '14px 12px',
                    border: `1px solid ${isActive ? BLUE : BORDER}`,
                    borderRadius: 4,
                    background: isActive ? '#0c1a28' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#2a2a2a';
                      e.currentTarget.style.background = '#0e0e0e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{skill.emoji}</div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isActive ? '#fff' : '#ccc',
                    marginBottom: 3,
                  }}>
                    {skill.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: isActive ? '#4a6a80' : '#3a3a3a',
                    lineHeight: 1.4,
                  }}>
                    {skill.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BASE TEMPLATE — 2-column grid of compact cards */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>Base Template</label>
          <div style={SUBLABEL_STYLE}>Start from an existing layout or from scratch</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            {/* From Scratch card */}
            <button
              onClick={() => setLocalTemplate({
                templateId: 'scratch',
                name: 'From Scratch',
                description: 'Start with a blank canvas',
                thumbnailPath: '',
                platform: 'unknown',
                dimensions: { width: 1080, height: 1080 },
              })}
              style={{
                padding: '10px 12px',
                border: `1px solid ${localTemplate?.templateId === 'scratch' ? BLUE : BORDER}`,
                borderRadius: 4,
                background: localTemplate?.templateId === 'scratch' ? '#0c1a28' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'border-color 0.15s, background 0.15s',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (localTemplate?.templateId !== 'scratch') {
                  e.currentTarget.style.borderColor = '#2a2a2a';
                  e.currentTarget.style.background = '#0e0e0e';
                }
              }}
              onMouseLeave={(e) => {
                if (localTemplate?.templateId !== 'scratch') {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: BLUE,
                letterSpacing: '0.08em',
                flexShrink: 0,
                width: 20,
              }}>
                ✦
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: localTemplate?.templateId === 'scratch' ? '#fff' : '#888',
              }}>
                From Scratch
              </span>
              <span style={{
                fontSize: 9,
                color: '#2a2a2a',
                marginLeft: 'auto',
                flexShrink: 0,
              }}>
                AI picks
              </span>
            </button>

            {/* Template cards */}
            {TEMPLATE_METADATA.map((template, index) => {
              const num = String(index + 1).padStart(2, '0');
              const isSelected = localTemplate?.templateId === template.templateId;
              return (
                <button
                  key={template.templateId}
                  onClick={() => setLocalTemplate(template)}
                  style={{
                    padding: '10px 12px',
                    border: `1px solid ${isSelected ? BLUE : BORDER}`,
                    borderRadius: 4,
                    background: isSelected ? '#0c1a28' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#2a2a2a';
                      e.currentTarget.style.background = '#0e0e0e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: BLUE,
                    letterSpacing: '0.08em',
                    flexShrink: 0,
                    width: 20,
                  }}>
                    {num}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSelected ? '#fff' : '#888',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'left',
                  }}>
                    {template.name.replace(' / ', ' / ').replace(' (Landscape)', '').replace(' — Instagram Ad', '').replace(' — Insights', '').replace(' — Carousel', '')}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: '#2a2a2a',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}>
                    {getCarouselBadge(template)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BRIEF */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="creation-brief" style={LABEL_STYLE}>Brief</label>
          <div style={SUBLABEL_STYLE}>Describe the goal, audience, and what the asset should communicate</div>
          <textarea
            id="creation-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Create an Instagram ad promoting Fluid's new analytics dashboard. Target: independent sales reps. Goal: drive app downloads. Tone: bold, modern. Highlight the real-time commission tracking feature."
            style={TEXTAREA_STYLE}
            onFocus={(e) => (e.target.style.borderColor = BLUE)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>

        {/* REFERENCES */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>
            References <span style={{ color: '#2a2a2a', fontWeight: 500, letterSpacing: 0 }}>(optional)</span>
          </label>
          <div style={SUBLABEL_STYLE}>Add URLs, Figma links, or file paths for visual or copy reference</div>
          {references.map((ref, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={ref}
                onChange={(e) => updateRef(i, e.target.value)}
                placeholder="https://figma.com/... or /path/to/file.png"
                style={{ ...INPUT_STYLE, flex: 1 }}
                onFocus={(e) => (e.target.style.borderColor = BLUE)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
              <button
                onClick={() => removeRef(i)}
                title="Remove"
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#333',
                  fontSize: 14,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#333';
                  e.currentTarget.style.color = '#888';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.color = '#333';
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addRef}
            style={{
              padding: '6px 12px',
              border: `1px dashed ${BORDER}`,
              borderRadius: 4,
              background: 'transparent',
              color: '#333',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#333';
              e.currentTarget.style.color = '#666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.color = '#333';
            }}
          >
            + Add Reference
          </button>
        </div>

        {/* FOOTER — hint + Generate button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 32,
          paddingTop: 24,
          borderTop: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontSize: 10,
            color: '#2a2a2a',
            lineHeight: 1.5,
          }}>
            Generates a formatted prompt for Claude.<br />Copies to clipboard — paste into Claude Code to create.
          </div>
          <button
            onClick={handleGeneratePrompt}
            disabled={generating || !localTemplate}
            style={{
              padding: '11px 24px',
              border: 'none',
              borderRadius: 3,
              background: generating || !localTemplate ? BORDER : BLUE,
              color: generating || !localTemplate ? '#333' : '#000',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: generating || !localTemplate ? 'default' : 'pointer',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!generating && localTemplate) e.currentTarget.style.background = '#5cc0ff';
            }}
            onMouseLeave={(e) => {
              if (!generating && localTemplate) e.currentTarget.style.background = BLUE;
            }}
          >
            {generating ? 'Opening...' : 'Generate Prompt'}
          </button>
        </div>
      </div>

      {/* ── Right column: PREVIEW ── */}
      <div style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BG_DARK,
      }}>
        {/* Preview header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid #141414`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: '#333',
          }}>Preview</span>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: '#222',
            fontFamily: 'monospace',
          }}>
            {localTemplate
              ? localTemplate.templateId === 'scratch'
                ? '\u2014'
                : `${localTemplate.dimensions.width}\u00D7${localTemplate.dimensions.height}`
              : '\u2014'}
          </span>
        </div>

        {/* Preview content */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {previewUrl ? (
            <div style={{
              width: 280,
              height: isLandscape ? 132 : 280,
              background: '#000',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'height 0.3s',
            }}>
              <iframe
                src={previewUrl}
                width={localTemplate!.dimensions.width}
                height={localTemplate!.dimensions.height}
                style={{
                  border: 'none',
                  transform: isLandscape
                    ? 'scale(0.2090)'
                    : `scale(${280 / localTemplate!.dimensions.width})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}
                title="Template preview"
              />
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: 280,
              height: 280,
              border: `1px dashed ${BORDER}`,
              borderRadius: 3,
            }}>
              <div style={{ fontSize: 28, color: BORDER }}>✦</div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#222',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                {localTemplate?.templateId === 'scratch'
                  ? 'From Scratch\nAI will choose the best layout'
                  : 'Select a template to preview'}
              </div>
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

// PreviewFrame removed — preview is now rendered inline in the modal

// ── NEW CAMPAIGN tab ──────────────────────────────────────────────────────────
interface NewCampaignTabProps {
  onClose: () => void;
}

function NewCampaignTab({ onClose }: NewCampaignTabProps) {
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);

  const [campaignName, setCampaignName] = useState('');
  const [brief, setBrief] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLink = () => setLinks((prev) => [...prev, '']);
  const removeLink = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));
  const updateLink = (idx: number, val: string) =>
    setLinks((prev) => prev.map((l, i) => (i === idx ? val : l)));

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

  // Shared resource block styles
  const resourceBlockStyle: CSSProperties = {
    border: '1px solid #161616',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  };
  const resourceBlockHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 16px',
    background: '#0d0d0d',
    borderBottom: '1px solid #161616',
  };
  const resourceBlockLabelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#444',
    flex: 1,
  };
  const resourceBlockBodyStyle: CSSProperties = {
    padding: '14px 16px',
    background: BG_DARK,
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 48px 40px 48px',
      }}>

        {/* CAMPAIGN NAME */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="campaign-name" style={LABEL_STYLE}>Campaign Name</label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g. Q2 Product Launch · Spring 2026"
            style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = BLUE)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>

        {/* BRIEF */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="campaign-brief" style={LABEL_STYLE}>Brief</label>
          <div style={SUBLABEL_STYLE}>Describe the campaign goals, audience, messaging strategy, and key deliverables</div>
          <textarea
            id="campaign-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={7}
            placeholder="e.g. Q2 product launch campaign targeting independent sales reps on LinkedIn and Instagram. Goal: 15% increase in app downloads. Key message: real-time commission visibility. Tone: bold, confident, data-forward. Deliverables: 3 social posts, 1 carousel, 1 landscape banner."
            style={TEXTAREA_STYLE}
            onFocus={(e) => (e.target.style.borderColor = BLUE)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>

        {/* RESOURCES */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>Resources</label>

          {/* Reference Links block */}
          <div style={resourceBlockStyle}>
            <div style={resourceBlockHeaderStyle}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>🔗</span>
              <span style={resourceBlockLabelStyle}>Reference Links</span>
            </div>
            <div style={resourceBlockBodyStyle}>
              {links.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < links.length - 1 ? 8 : 0 }}>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => updateLink(i, e.target.value)}
                    placeholder="https://figma.com/... or https://docs.google.com/..."
                    style={{ ...INPUT_STYLE, flex: 1 }}
                    onFocus={(e) => (e.target.style.borderColor = BLUE)}
                    onBlur={(e) => (e.target.style.borderColor = BORDER)}
                  />
                  <button
                    onClick={() => removeLink(i)}
                    title="Remove"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 4,
                      background: 'transparent',
                      color: '#333',
                      fontSize: 14,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#333';
                      e.currentTarget.style.color = '#888';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.color = '#333';
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addLink}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  border: `1px dashed ${BORDER}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#333',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#333';
                  e.currentTarget.style.color = '#666';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.color = '#333';
                }}
              >
                + Add Link
              </button>
            </div>
          </div>

          {/* Attach Files block */}
          <div style={resourceBlockStyle}>
            <div style={resourceBlockHeaderStyle}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>📎</span>
              <span style={resourceBlockLabelStyle}>Attach Files</span>
            </div>
            <div style={resourceBlockBodyStyle}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                border: `1px dashed ${BORDER_LIGHT}`,
                borderRadius: 4,
                background: 'transparent',
                color: '#3a3a3a',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  style={{ display: 'none' }}
                />
                ↑ &nbsp;Choose Files
              </label>
            </div>
          </div>

          {/* Fluid DAM block */}
          <div style={resourceBlockStyle}>
            <div style={resourceBlockHeaderStyle}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>☁️</span>
              <span style={resourceBlockLabelStyle}>Fluid DAM</span>
            </div>
            <div style={resourceBlockBodyStyle}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  style={{
                    padding: '9px 18px',
                    border: '1px solid #1a3a58',
                    borderRadius: 4,
                    background: 'transparent',
                    color: BLUE,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#08182a';
                    e.currentTarget.style.borderColor = '#2a5878';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#1a3a58';
                  }}
                >
                  Connect DAM
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16,
            padding: '10px 14px',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 4,
            fontSize: 12,
            color: '#f87171',
          }}>
            {error}
          </div>
        )}

        {/* FOOTER — hint + Save button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 32,
          paddingTop: 24,
          borderTop: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontSize: 10,
            color: '#2a2a2a',
            lineHeight: 1.5,
          }}>
            Saves the campaign brief and resources<br />so you can reference them while building assets.
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !campaignName.trim()}
            style={{
              padding: '11px 24px',
              border: 'none',
              borderRadius: 3,
              background: saving || !campaignName.trim() ? BORDER : BLUE,
              color: saving || !campaignName.trim() ? '#333' : '#000',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: saving || !campaignName.trim() ? 'default' : 'pointer',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!saving && campaignName.trim()) e.currentTarget.style.background = '#5cc0ff';
            }}
            onMouseLeave={(e) => {
              if (!saving && campaignName.trim()) e.currentTarget.style.background = BLUE;
            }}
          >
            {saving ? 'Saving...' : 'Save Campaign'}
          </button>
        </div>
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
  onCreationCreated,
}: TemplateCreationModalProps) {
  // 'creation' = "+ NEW CREATION" tab, 'campaign' = "+ NEW CAMPAIGN" tab
  const [activeTab, setActiveTab] = useState<'creation' | 'campaign'>('creation');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      {/* Dialog panel — 960px wide, matching Jonathan's original */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 960,
          maxWidth: '95vw',
          maxHeight: activeTab === 'campaign' ? '82vh' : '88vh',
          backgroundColor: BG_MODAL,
          border: `1px solid ${BORDER_LIGHT}`,
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header: pill toggle tabs + close ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 36px 0 36px',
          marginBottom: 24,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 3, flex: 1 }}>
            {/* New Asset pill tab */}
            <button
              onClick={() => setActiveTab('creation')}
              style={{
                padding: '7px 20px',
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 4,
                background: activeTab === 'creation' ? '#171717' : 'transparent',
                color: activeTab === 'creation' ? '#fff' : '#333',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                userSelect: 'none',
                outline: 'none',
                borderColor: activeTab === 'creation' ? '#2a2a2a' : BORDER_LIGHT,
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'creation') {
                  e.currentTarget.style.color = '#555';
                  e.currentTarget.style.borderColor = '#2a2a2a';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'creation') {
                  e.currentTarget.style.color = '#333';
                  e.currentTarget.style.borderColor = BORDER_LIGHT;
                }
              }}
            >
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: activeTab === 'creation' ? BLUE : '#2a2a2a',
                transition: 'background 0.15s',
                flexShrink: 0,
              }} />
              New Creation
            </button>

            {/* New Campaign pill tab */}
            <button
              onClick={() => setActiveTab('campaign')}
              style={{
                padding: '7px 20px',
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 4,
                background: activeTab === 'campaign' ? '#171717' : 'transparent',
                color: activeTab === 'campaign' ? '#fff' : '#333',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                userSelect: 'none',
                outline: 'none',
                borderColor: activeTab === 'campaign' ? '#2a2a2a' : BORDER_LIGHT,
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'campaign') {
                  e.currentTarget.style.color = '#555';
                  e.currentTarget.style.borderColor = '#2a2a2a';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'campaign') {
                  e.currentTarget.style.color = '#333';
                  e.currentTarget.style.borderColor = BORDER_LIGHT;
                }
              }}
            >
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: activeTab === 'campaign' ? BLUE : '#2a2a2a',
                transition: 'background 0.15s',
                flexShrink: 0,
              }} />
              New Campaign
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: '#444',
              cursor: 'pointer',
              borderRadius: 3,
              transition: 'color 0.15s, background 0.15s',
              fontSize: 18,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#aaa';
              e.currentTarget.style.background = BORDER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#444';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {activeTab === 'creation' && (
            <>
              {/* When flow = 'gallery': show new design */}
              {flow === 'gallery' && (
                <NewCreationTab
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={onSelectTemplate}
                  activeCampaignId={activeCampaignId}
                  onCreationCreated={onCreationCreated}
                />
              )}
              {/* When flow = 'customizer': show the customizer inline */}
              {flow === 'customizer' && selectedTemplate && activeCampaignId && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <TemplateCustomizer
                    template={selectedTemplate}
                    campaignId={activeCampaignId}
                    onBack={onBack}
                    onCreated={onCreationCreated}
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
