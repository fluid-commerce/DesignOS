import { useEffect, useState, useCallback } from 'react';
import { PromptSidebar } from './components/PromptSidebar';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateCustomizer } from './components/TemplateCustomizer';
import { VariationGrid } from './components/VariationGrid';
import { Timeline } from './components/Timeline';
import { SidebarNotes } from './components/SidebarNotes';
import { useSessionStore } from './store/sessions';
import { useGenerationStore } from './store/generation';
import { useAnnotationStore } from './store/annotations';
import { useAnnotations } from './hooks/useAnnotations';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { TemplateInfo } from './lib/templates';
import type { VariationStatus } from './lib/types';

type MainView = 'gallery' | 'customizer' | 'session';

export function App() {
  const refreshSessions = useSessionStore((s) => s.refreshSessions);
  const activeSessionData = useSessionStore((s) => s.activeSessionData);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loading = useSessionStore((s) => s.loading);

  const generationStatus = useGenerationStore((s: any) => s.status);
  const generationSessionId = useGenerationStore((s: any) => s.activeSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);

  const {
    annotations,
    statuses,
    activePin,
    setActivePin,
    setStatus,
    sidebarNotes,
    addPin,
    addNote,
    addReply,
  } = useAnnotations();

  const [mainView, setMainView] = useState<MainView>('gallery');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  // Auto-refresh on filesystem changes
  useFileWatcher();

  // Initial session load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Auto-switch to session view when generation starts or completes
  useEffect(() => {
    if (generationStatus === 'generating') {
      setMainView('session');
    }
    if (generationStatus === 'complete') {
      // Refresh sessions list, then auto-select the generated session
      refreshSessions().then(() => {
        if (generationSessionId) {
          selectSession(generationSessionId);
        }
      });
    }
  }, [generationStatus, refreshSessions, generationSessionId, selectSession]);

  // Switch to session view when a session is selected
  useEffect(() => {
    if (activeSessionId && activeSessionData) {
      setMainView('session');
    }
  }, [activeSessionId, activeSessionData]);

  // Template selection handlers
  const handleSelectTemplate = useCallback((template: TemplateInfo) => {
    setSelectedTemplate(template);
    setMainView('customizer');
  }, []);

  const handleFreePrompt = useCallback(() => {
    // Focus is in the sidebar prompt input -- just stay on gallery
    // The user types in the sidebar and clicks Generate
  }, []);

  const handleBackToGallery = useCallback(() => {
    setSelectedTemplate(null);
    setMainView('gallery');
  }, []);

  // Status change: set status directly (no auto-reject of other variations)
  const handleStatusChange = useCallback(
    (variationPath: string, newStatus: VariationStatus) => {
      setStatus(variationPath, newStatus);
    },
    [setStatus]
  );

  const handlePinClick = useCallback(
    (id: string) => {
      setActivePin(activePin === id ? null : id);
    },
    [activePin, setActivePin]
  );

  // Determine current round number
  const currentRound = activeSessionData?.lineage.rounds
    ? Math.max(...activeSessionData.lineage.rounds.map((r) => r.roundNumber), 0)
    : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Top bar spanning full width */}
      <header style={{
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #2a2a3e',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        minHeight: 48,
        flexShrink: 0,
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          color: '#fff',
        }}>
          Fluid Design OS
        </h1>
        {activeSessionData && (
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            {activeSessionData.id}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {mainView === 'session' && activeSessionData && (
          <button
            onClick={() => { setMainView('gallery'); }}
            style={{
              background: 'none',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#888',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Templates
          </button>
        )}
        {activeSessionData && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              background: showNotes ? '#3b82f622' : 'none',
              border: '1px solid #333',
              borderRadius: 4,
              color: showNotes ? '#3b82f6' : '#888',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Notes {sidebarNotes.length > 0 && `(${sidebarNotes.length})`}
          </button>
        )}
      </header>

      {/* Main layout: PromptSidebar | Main Pane | Right sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar: prompt + stream + sessions */}
        <PromptSidebar />

        {/* Main pane with view routing */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Gallery view */}
          {mainView === 'gallery' && (
            <TemplateGallery
              onSelectTemplate={handleSelectTemplate}
              onFreePrompt={handleFreePrompt}
            />
          )}

          {/* Customizer view */}
          {mainView === 'customizer' && selectedTemplate && (
            <TemplateCustomizer
              template={selectedTemplate}
              onBack={handleBackToGallery}
            />
          )}

          {/* Session view */}
          {mainView === 'session' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    Loading session...
                  </div>
                )}

                {!loading && !activeSessionData && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#555',
                    fontSize: '0.95rem',
                    gap: '1rem',
                  }}>
                    {generationStatus === 'generating' ? (
                      <>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          border: '3px solid #333', borderTopColor: '#3b82f6',
                          animation: 'spin 1s linear infinite',
                        }} />
                        <div style={{ color: '#888' }}>Generating your asset...</div>
                        <div style={{ color: '#555', fontSize: '0.8rem' }}>
                          Watch the sidebar for progress
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </>
                    ) : (
                      'Select a session to view variations'
                    )}
                  </div>
                )}

                {!loading && activeSessionData && (
                  <VariationGrid
                    variations={activeSessionData.variations}
                    platform={activeSessionData.lineage.platform}
                    statuses={statuses}
                    annotations={annotations}
                    activePin={activePin}
                    onPinClick={handlePinClick}
                    onAddPin={addPin}
                    onReply={addReply}
                    onStatusChange={handleStatusChange}
                  />
                )}
              </div>

              {/* Iterate panel placeholder -- will be replaced in Plan 04 */}
            </div>
          )}
        </main>

        {/* Right sidebar: Timeline + Notes (only when session active) */}
        {mainView === 'session' && !loading && activeSessionData && (
          <div style={{
            width: showNotes ? 560 : 280,
            display: 'flex',
            borderLeft: '1px solid #2a2a3e',
            flexShrink: 0,
          }}>
            <div style={{ width: 280, overflow: 'hidden' }}>
              <Timeline
                lineage={activeSessionData.lineage}
                statuses={statuses}
              />
            </div>
            {showNotes && (
              <SidebarNotes
                notes={sidebarNotes}
                variations={activeSessionData.variations}
                onAddNote={addNote}
                onClose={() => setShowNotes(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
