import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useCampaignStore, type CreateViewportTab } from '../store/campaign';
import { Breadcrumb } from './Breadcrumb';
import { LeftNav } from './LeftNav';
import { ChatSidebar } from './ChatSidebar';
import { VoiceGuide } from './VoiceGuide';
import { BuildHero } from './BuildHero';
import { AssetsScreen } from './AssetsScreen';
import { NewCampaignModal } from './CampaignDashboard';
import { TemplatesScreen } from './TemplatesScreen';
import { PatternsScreen } from './PatternsScreen';
import { StylesScreen } from './StylesScreen';
import { SettingsScreen } from './SettingsScreen';

interface AppShellProps {
  /**
   * Content for the right sidebar (ContentEditor).
   * Closed by default; opens when an iteration is selected.
   */
  rightSidebar?: ReactNode;

  /**
   * Main content for the Campaigns viewport (CampaignDashboard or DrillDownGrid).
   */
  children: ReactNode;

  /**
   * Called when the user triggers a "New Asset" flow.
   * Only shown in Campaigns viewport header when provided.
   */
  onNewCreation?: () => void;

  /**
   * When true, hides the My Creations chrome (title, Campaigns/Creations tabs, Create New)
   * so the editor or template-creation flow can use the full viewport height.
   */
  hideMyCreationsHeader?: boolean;
}

const RIGHT_SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 48;

/** Layers icon for collapsed right sidebar */
function LayersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

/** Chevron arrow for sidebar toggle buttons */
function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotate = direction === 'right' ? 0 : 180;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Create New choice modal — New Asset vs New Campaign (matches templates Create New modal) */
function CreateNewChoiceModal({
  open,
  onClose,
  onOpenAsset,
  onOpenCampaign,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAsset: () => void;
  onOpenCampaign: () => void;
}) {
  const [mode, setMode] = useState<'asset' | 'campaign'>('asset');
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9001,
            width: 560,
            maxHeight: '88vh',
            overflow: 'hidden',
            background: '#111',
            border: '1px solid #1e1e1e',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Create New</Dialog.Title>
          </VisuallyHidden.Root>
          <VisuallyHidden.Root asChild>
            <Dialog.Description>Choose to create a new asset or campaign.</Dialog.Description>
          </VisuallyHidden.Root>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '28px 36px 0 36px',
              marginBottom: 24,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '2px',
                flexShrink: 0,
                borderRadius: 0,
                overflow: 'hidden',
              }}
            >
              {(['asset', 'campaign'] as const).map((m) => {
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    style={{
                      padding: '8px 14px',
                      minHeight: 36,
                      boxSizing: 'border-box',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: isActive ? '#e0e0e0' : '#666',
                      backgroundColor: isActive ? '#1a1a1e' : 'transparent',
                      border: 'none',
                      borderRadius: 0,
                      borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'color 0.15s, background-color 0.15s',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#aaa';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#666';
                    }}
                  >
                    {m === 'asset' ? 'New Asset' : 'New Campaign'}
                  </button>
                );
              })}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
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
                  fontSize: 18,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#aaa';
                  e.currentTarget.style.background = '#1a1a1a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#444';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ×
              </button>
            </Dialog.Close>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 36px 36px 36px' }}>
            {mode === 'asset' ? (
              <>
                <p style={{ margin: '0 0 12px', fontSize: 11, color: '#2a2a2a', lineHeight: 1.5 }}>
                  Create a new social post, one-pager, or other asset from a template or from
                  scratch.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAsset();
                    onClose();
                  }}
                  style={{
                    padding: '11px 24px',
                    border: 'none',
                    borderRadius: 3,
                    background: '#44B2FF',
                    color: '#000',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#5cc0ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#44B2FF')}
                >
                  Open template gallery
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 12px', fontSize: 11, color: '#2a2a2a', lineHeight: 1.5 }}>
                  Create a new campaign to organize your creations and assets.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenCampaign();
                    onClose();
                  }}
                  style={{
                    padding: '11px 24px',
                    border: 'none',
                    borderRadius: 3,
                    background: '#44B2FF',
                    color: '#000',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#5cc0ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#44B2FF')}
                >
                  Create campaign
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({
  rightSidebar,
  children,
  onNewCreation,
  hideMyCreationsHeader,
}: AppShellProps) {
  const [showCreateNewModal, setShowCreateNewModal] = useState(false);
  const activeNavTab = useCampaignStore((s) => s.activeNavTab);
  const createViewportTab = useCampaignStore((s) => s.createViewportTab);
  const currentView = useCampaignStore((s) => s.currentView);
  const navigateToDashboard = useCampaignStore((s) => s.navigateToDashboard);
  const navigateToDashboardCreations = useCampaignStore((s) => s.navigateToDashboardCreations);
  const rightSidebarOpen = useCampaignStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useCampaignStore((s) => s.toggleRightSidebar);
  const showNewCampaignModal = useCampaignStore((s) => s.showNewCampaignModal);
  const setShowNewCampaignModal = useCampaignStore((s) => s.setShowNewCampaignModal);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);

  const handleSetCreateViewportTab = useCallback(
    (tab: 'campaigns' | 'creations') => {
      if (tab === 'creations') {
        if (currentView !== 'dashboard' || createViewportTab !== 'creations') {
          navigateToDashboardCreations();
        }
      } else {
        if (currentView !== 'dashboard' || createViewportTab !== 'campaigns') {
          navigateToDashboard();
        }
      }
    },
    [currentView, createViewportTab, navigateToDashboardCreations, navigateToDashboard],
  );

  const handleNewCampaignCreated = useCallback(
    (title: string, channels: string[]) => {
      fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, channels }),
      })
        .then(() => fetchCampaigns())
        .catch((err) => console.error('[AppShell] Failed to create campaign:', err));
      setShowNewCampaignModal(false);
    },
    [fetchCampaigns, setShowNewCampaignModal],
  );

  const renderViewport = () => {
    switch (activeNavTab) {
      case 'create':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <BuildHero />
          </div>
        );

      case 'assets':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <AssetsScreen />
          </div>
        );

      case 'my-creations':
        return (
          <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
          >
            {!hideMyCreationsHeader && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderBottom: '1px solid #1e1e1e',
                  backgroundColor: '#0d0d0d',
                }}
              >
                {/* Row 1: Title + Campaigns/Creations tabs (left) + Create New button (right) */}
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 1.5rem',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5rem',
                      flexShrink: 0,
                      minWidth: 0,
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: '26px',
                        fontWeight: 700,
                        color: '#e0e0e0',
                        letterSpacing: '-0.02em',
                        flexShrink: 0,
                      }}
                    >
                      My Creations
                    </h1>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {(['campaigns', 'creations'] as CreateViewportTab[]).map((tab) => {
                        const isActive = createViewportTab === tab;
                        return (
                          <button
                            key={tab}
                            onClick={() => handleSetCreateViewportTab(tab)}
                            style={{
                              padding: '8px 14px',
                              minHeight: 36,
                              boxSizing: 'border-box',
                              fontSize: '0.75rem',
                              fontWeight: isActive ? 600 : 400,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: isActive ? '#e0e0e0' : '#666',
                              backgroundColor: isActive ? '#1a1a1e' : 'transparent',
                              border: 'none',
                              borderRadius: 0,
                              borderBottom: isActive
                                ? '2px solid #44B2FF'
                                : '2px solid transparent',
                              cursor: 'pointer',
                              transition: 'color 0.15s, background-color 0.15s',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.color = '#aaa';
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.color = '#666';
                            }}
                          >
                            {tab === 'campaigns' ? 'Campaigns' : 'Creations'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateNewModal(true)}
                    title="Create new campaign or asset"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.375rem',
                      padding: '8px 14px',
                      minHeight: 36,
                      boxSizing: 'border-box',
                      backgroundColor: '#44B2FF',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'background-color 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a9fe0')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#44B2FF')}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create New
                  </button>
                </div>
                {/* Row 2: Breadcrumb below tabs (hidden) */}
                <div
                  style={{
                    display: 'none',
                    padding: '0 1.5rem 0.5rem',
                    overflow: 'hidden',
                    minHeight: 0,
                  }}
                >
                  <Breadcrumb />
                </div>
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
          </div>
        );

      case 'templates':
        return <TemplatesScreen onCreateNew={() => setShowCreateNewModal(true)} />;

      case 'patterns':
        return <PatternsScreen />;

      case 'styles':
        return <StylesScreen />;

      case 'voice-guide':
        return <VoiceGuide />;

      case 'settings':
        return <SettingsScreen />;

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#0d0d0d',
        color: '#e0e0e0',
        fontFamily:
          "'Inter', 'Neue Haas Grotesk Display Pro', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Zone 1: Slim icon-based left nav */}
      <LeftNav />

      {/* Zone 2: Collapsible AI chat sidebar */}
      <ChatSidebar />

      {/* Zone 3: Main viewport (controlled by activeNavTab) */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {renderViewport()}
      </main>

      {/* Zone 4: Right sidebar (ContentEditor) — unchanged collapse/expand behavior */}
      {rightSidebar && (
        <aside
          style={{
            width: rightSidebarOpen ? RIGHT_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #1e1e1e',
            backgroundColor: '#111111',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}
        >
          {rightSidebarOpen ? (
            <>
              {/* Right sidebar collapse toggle at top */}
              <button
                onClick={toggleRightSidebar}
                title="Collapse content editor"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid #1e1e1e',
                  color: '#555',
                  cursor: 'pointer',
                  gap: '0.375rem',
                  fontSize: '0.75rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
              >
                <ChevronIcon direction="right" />
                <span>Close</span>
              </button>
              {/* Right sidebar content */}
              <div style={{ flex: 1, overflow: 'hidden' }}>{rightSidebar}</div>
            </>
          ) : (
            /* Icon strip when collapsed */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '0.75rem',
                gap: '0.5rem',
              }}
            >
              <button
                onClick={toggleRightSidebar}
                title="Expand content editor"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  background: 'none',
                  border: '1px solid #2a2a2e',
                  borderRadius: 5,
                  color: '#666',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
              >
                <LayersIcon />
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Create New choice modal — New Asset | New Campaign (also from Templates tab) */}
      {(activeNavTab === 'my-creations' || activeNavTab === 'templates') && (
        <CreateNewChoiceModal
          open={showCreateNewModal}
          onClose={() => setShowCreateNewModal(false)}
          onOpenAsset={() => onNewCreation?.()}
          onOpenCampaign={() => setShowNewCampaignModal(true)}
        />
      )}

      {/* New Campaign modal — opened from choice modal (my-creations or templates) */}
      {(activeNavTab === 'my-creations' || activeNavTab === 'templates') &&
        showNewCampaignModal && (
          <NewCampaignModal
            onClose={() => setShowNewCampaignModal(false)}
            onCreated={handleNewCampaignCreated}
          />
        )}
    </div>
  );
}
