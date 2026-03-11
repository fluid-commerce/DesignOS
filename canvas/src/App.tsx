import { useEffect, useState, useCallback } from 'react';
import { SessionSidebar } from './components/SessionSidebar';
import { VariationGrid } from './components/VariationGrid';
import { Timeline } from './components/Timeline';
import { IteratePanel } from './components/IteratePanel';
import { SidebarNotes } from './components/SidebarNotes';
import { useSessionStore } from './store/sessions';
import { useAnnotationStore } from './store/annotations';
import { useAnnotations } from './hooks/useAnnotations';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { VariationStatus } from './lib/types';

export function App() {
  const refreshSessions = useSessionStore((s) => s.refreshSessions);
  const activeSessionData = useSessionStore((s) => s.activeSessionData);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loading = useSessionStore((s) => s.loading);

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

  const [showNotes, setShowNotes] = useState(false);

  // Auto-refresh on filesystem changes
  useFileWatcher();

  // Initial session load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

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
      height: '100vh',
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <SessionSidebar />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <header style={{
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #2a2a3e',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          minHeight: 48,
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

        {/* Main content area */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {/* Center: variations + iterate */}
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
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#555',
                  fontSize: '0.95rem',
                }}>
                  Select a session to view variations
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

            {/* Iterate panel (below grid) */}
            {!loading && activeSessionData && activeSessionId && (
              <IteratePanel
                sessionId={activeSessionId}
                annotations={annotations}
                statuses={statuses}
                currentRound={currentRound}
              />
            )}
          </div>

          {/* Right sidebar: Timeline + Notes */}
          {!loading && activeSessionData && (
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
      </main>
    </div>
  );
}
