import { useState, useRef, useEffect, useMemo } from 'react';
import { useGenerationStream } from '../hooks/useGenerationStream';
import { StreamMessage } from './StreamMessage';
import { useSessionStore } from '../store/sessions';
import { useGenerationStore } from '../store/generation';
import { useAnnotationStore } from '../store/annotations';
import { useCampaignStore } from '../store/campaign';
import { useAnnotations } from '../hooks/useAnnotations';
import { buildIterationContext } from '../lib/context-bundler';
import type { StreamUIMessage } from '../lib/stream-parser';

/** Format a YYYYMMDD-HHMMSS session ID into a readable date string. */
function formatSessionId(id: string): string {
  const match = id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) return id;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(+y, +mo - 1, +d, +h, +mi);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Left sidebar with prompt input and streaming agent output display.
 * Always visible regardless of main pane view.
 * Session-aware: switches between "Create with AI" (new) and "Iterate on [Title]" mode.
 * Includes a collapsible "Recent Sessions" list at the bottom.
 */
export function PromptSidebar() {
  const { generate, cancelGeneration, status, events, errorMessage } = useGenerationStream();
  const [prompt, setPrompt] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const activeSessionData = useSessionStore((s) => s.activeSessionData);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const clearSelection = useSessionStore((s) => s.clearSelection);
  const resetGeneration = useGenerationStore((s) => s.reset);
  const activeCampaignId = useGenerationStore((s) => s.activeCampaignId);
  const generationStatus = useGenerationStore((s) => s.status);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);
  const { annotations } = useAnnotations();

  // Mode detection
  const isIterateMode = !!activeSessionId && !!activeSessionData;
  const projectTitle = activeSessionData?.lineage?.title ?? (activeSessionId ? formatSessionId(activeSessionId) : '');
  const annotationCount = annotations.filter((a) => a.type === 'pin').length;

  const isGenerating = status === 'generating';

  // Accumulate consecutive text events into single messages
  const displayMessages = useMemo(() => {
    const result: StreamUIMessage[] = [];
    for (const ev of events) {
      if (ev.type === 'text' && result.length > 0 && result[result.length - 1].type === 'text') {
        // Merge into previous text message
        const prev = result[result.length - 1];
        result[result.length - 1] = {
          ...prev,
          content: prev.content + ev.content,
        };
      } else {
        result.push(ev);
      }
    }
    return result;
  }, [events]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages]);

  const [submittedPrompt, setSubmittedPrompt] = useState('');

  // Navigate to the newly created campaign when generation completes
  const prevStatusRef = useRef(generationStatus);
  useEffect(() => {
    if (prevStatusRef.current === 'generating' && generationStatus === 'complete' && activeCampaignId) {
      // Small delay to let the server finish writing iteration records
      const timer = setTimeout(() => {
        navigateToCampaign(activeCampaignId);
      }, 500);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = generationStatus;
  }, [generationStatus, activeCampaignId, navigateToCampaign]);

  const [submittedPrompt, setSubmittedPrompt] = useState('');

  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text || isGenerating) return;

    setSubmittedPrompt(text);

    if (isIterateMode && activeSessionData) {
      // Iteration mode: bundle context and pass to generate
      try {
        const storeStatuses = useAnnotationStore.getState().statuses;
        const iterCtx = buildIterationContext({
          variations: activeSessionData.variations,
          annotations,
          statuses: storeStatuses,
          currentRound: activeSessionData.lineage.rounds
            ? Math.max(...activeSessionData.lineage.rounds.map((r) => r.roundNumber), 0)
            : 0,
          originalPrompt: activeSessionData.lineage.rounds?.[0]?.prompt || '',
        });
        generate(text, {
          skillType: 'social',
          sessionId: activeSessionId!,
          iterationContext: iterCtx,
        });
      } catch (err) {
        // If no winner selected, fall through to normal generation
        generate(text, { skillType: 'social' });
      }
    } else {
      generate(text, { skillType: 'social' });
    }
    setPrompt('');
  };

  const handleNewSession = () => {
    clearSelection();
    resetGeneration();
    setPrompt('');
    setSubmittedPrompt('');
  };

  // Clear stale generation log when switching sessions
  const prevSessionRef = useRef(activeSessionId);
  useEffect(() => {
    if (activeSessionId !== prevSessionRef.current) {
      prevSessionRef.current = activeSessionId;
      if (status !== 'generating') {
        resetGeneration();
        setSubmittedPrompt('');
      }
    }
  }, [activeSessionId, status, resetGeneration]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Contextual text based on mode
  const headerText = isIterateMode ? `Iterate on ${projectTitle}` : 'Create with AI';
  const placeholderText = isIterateMode ? 'Describe changes...' : 'Describe what you want to create...';
  const buttonText = isIterateMode
    ? (isGenerating ? 'Iterating...' : 'Iterate')
    : (isGenerating ? 'Generating...' : 'Generate');

  return (
    <div
      style={{
        width: '100%',
        borderRight: '1px solid #2a2a2e',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111111',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Prompt input area */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid #2a2a2e' }}>
        {/* Header with optional + New button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.75rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {headerText}
            </span>
            {isIterateMode && annotationCount > 0 && (
              <span
                style={{
                  fontSize: '0.6rem',
                  color: '#a78bfa',
                  backgroundColor: '#1e1e1e',
                  padding: '0.1rem 0.35rem',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                {annotationCount} annotation{annotationCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {isIterateMode && (
            <button
              onClick={handleNewSession}
              style={{
                background: 'none',
                border: '1px solid #2a2a2e',
                color: '#888',
                fontSize: '0.68rem',
                padding: '0.15rem 0.4rem',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              + New
            </button>
          )}
        </div>
        <textarea
          value={isGenerating ? submittedPrompt : prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          readOnly={isGenerating}
          placeholder={placeholderText}
          style={{
            width: '100%',
            backgroundColor: '#1a1a1e',
            border: '1px solid #2a2a2e',
            borderRadius: 6,
            color: '#e0e0e0',
            padding: '0.5rem 0.6rem',
            fontSize: '0.82rem',
            resize: 'none',
            minHeight: 60,
            outline: 'none',
            boxSizing: 'border-box',
            opacity: isGenerating ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          style={{
            width: '100%',
            marginTop: '0.35rem',
            backgroundColor: isGenerating ? '#333' : '#44B2FF',
            color: isGenerating ? '#666' : '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '0.45rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {buttonText}
        </button>
        {isGenerating && (
          <button
            onClick={cancelGeneration}
            style={{
              width: '100%',
              marginTop: '0.25rem',
              backgroundColor: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef444444',
              borderRadius: 6,
              padding: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Stream display */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {status === 'idle' && displayMessages.length === 0 && (
          <div style={{ color: '#444', fontSize: '0.75rem', textAlign: 'center', padding: '2rem 0.5rem' }}>
            Enter a prompt above or choose a template to get started.
          </div>
        )}

        {displayMessages.map((msg) => (
          <StreamMessage key={msg.id} message={msg} />
        ))}

        {status === 'complete' && (
          <div style={{ textAlign: 'center', color: '#22c55e', fontSize: '0.75rem', padding: '0.5rem 0' }}>
            Done
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.75rem', padding: '0.5rem 0' }}>
            Generation failed{errorMessage ? `: ${errorMessage}` : ''}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div style={{ borderTop: '1px solid #2a2a2e', maxHeight: 200, overflowY: 'auto' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#555', fontWeight: 600 }}>
          Recent Sessions
        </div>
        {sessions.map((s: any) => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: s.id === activeSessionId ? '#1a1a1e' : 'none',
              border: 'none',
              borderBottom: '1px solid #1e1e1e',
              color: s.id === activeSessionId ? '#e0e0e0' : '#888',
              padding: '0.4rem 0.75rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title || formatSessionId(s.id)}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '0.1rem' }}>
              {formatSessionId(s.id)}
            </div>
          </button>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#444' }}>
            No sessions yet
          </div>
        )}
      </div>
    </div>
  );
}
