import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContextPanelProps {
  sections: string[];
  tokenEstimate: number;
  gapCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
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
      aria-label={expanded ? 'Collapse context details' : 'Expand context details'}
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContextPanel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collapsible context injection panel for the chat sidebar.
 * Shows which brand sections were injected into a pipeline stage,
 * the estimated token budget used, and optional gap signal count.
 */
export function ContextPanel({ sections, tokenEstimate, gapCount = 0 }: ContextPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 4,
        border: '1px solid #1e1e1e',
        backgroundColor: '#141414',
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
        maxHeight: expanded ? 300 : 24,
      }}
    >
      {/* Collapsed pill / toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '4px 8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: '#888',
          fontSize: '0.72rem',
          minHeight: 24,
        }}
      >
        <ChevronIcon expanded={expanded} />
        <span>
          Context
          {sections.length > 0 && (
            <>
              {' · '}
              <span
                style={{
                  color: '#44B2FF',
                  fontWeight: 600,
                }}
              >
                {sections.length}
              </span>
              {' sections'}
            </>
          )}
          {sections.length === 0 && ' · no sections'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '6px 8px 8px',
            borderTop: '1px solid #1e1e1e',
            overflowY: 'auto',
            maxHeight: 276,
          }}
        >
          {/* Section slug chips */}
          {sections.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {sections.map((slug) => (
                <span
                  key={slug}
                  style={{
                    backgroundColor: '#1e2d40',
                    color: '#7bb8e0',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {slug}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.72rem', color: '#555', margin: '0 0 6px' }}>
              No brand context pre-loaded for this stage
            </p>
          )}

          {/* Token estimate */}
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '0 0 4px' }}>
            ~{tokenEstimate} tokens estimated
          </p>

          {/* Gap signal line */}
          {gapCount > 0 && (
            <p style={{ fontSize: '0.72rem', color: '#FF6614', margin: 0 }}>
              {gapCount} fallback tool {gapCount === 1 ? 'call' : 'calls'} — context gap detected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
