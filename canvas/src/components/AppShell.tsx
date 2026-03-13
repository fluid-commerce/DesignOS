import type { ReactNode } from 'react';
import { useCampaignStore } from '../store/campaign';
import { Breadcrumb } from './Breadcrumb';
import { LeftNav } from './LeftNav';
import { ChatSidebar } from './ChatSidebar';
import { VoiceGuide } from './VoiceGuide';

interface AppShellProps {
  /**
   * Content for the left chat sidebar (PromptSidebar).
   * Wrapped in ChatSidebar for collapsible behavior.
   */
  leftSidebar?: ReactNode;

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
  onNewAsset?: () => void;

}

const RIGHT_SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 48;

/** Layers icon for collapsed right sidebar */
function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ transform: `rotate(${rotate}deg)` }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function AppShell({ leftSidebar, rightSidebar, children, onNewAsset }: AppShellProps) {
  const activeNavTab = useCampaignStore((s) => s.activeNavTab);
  const rightSidebarOpen = useCampaignStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useCampaignStore((s) => s.toggleRightSidebar);

  const renderViewport = () => {
    switch (activeNavTab) {
      case 'campaigns':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Campaigns viewport header */}
            <div style={{
              flexShrink: 0,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 1rem',
              borderBottom: '1px solid #1e1e1e',
              backgroundColor: '#0d0d0d',
            }}>
              {/* Breadcrumb */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Breadcrumb />
              </div>
              {/* New Asset button */}
              {onNewAsset && (
                <button
                  onClick={onNewAsset}
                  title="New asset"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '5px 12px',
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
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a9fe0')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#44B2FF')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Asset
                </button>
              )}
            </div>
            {/* Campaign drill-down content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
          </div>
        );

      case 'templates':
        return (
          <iframe
            src="/templates/"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Template Library"
          />
        );

      case 'patterns':
        return (
          <iframe
            src="/patterns/"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Pattern Library"
          />
        );

      case 'voice-guide':
        return <VoiceGuide />;

      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0d0d0d',
      color: '#e0e0e0',
      fontFamily: "'Inter', 'Neue Haas Grotesk Display Pro', -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Zone 1: Slim icon-based left nav */}
      <LeftNav />

      {/* Zone 2: Collapsible AI chat sidebar */}
      <ChatSidebar>
        {leftSidebar}
      </ChatSidebar>

      {/* Zone 3: Main viewport (controlled by activeNavTab) */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {renderViewport()}
      </main>

      {/* Zone 4: Right sidebar (ContentEditor) — unchanged collapse/expand behavior */}
      {rightSidebar && (
        <aside style={{
          width: rightSidebarOpen ? RIGHT_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #1e1e1e',
          backgroundColor: '#111111',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
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
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {rightSidebar}
              </div>
            </>
          ) : (
            /* Icon strip when collapsed */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '0.75rem',
              gap: '0.5rem',
            }}>
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
    </div>
  );
}
