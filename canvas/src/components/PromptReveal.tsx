import { useState } from 'react';

interface PromptRevealProps {
  prompt: string;
  label?: string;
}

/**
 * Collapsible section showing the prompt/refinement instruction for a timeline round.
 */
export function PromptReveal({ prompt, label = 'Prompt' }: PromptRevealProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid="prompt-reveal" style={{ marginTop: '0.25rem' }}>
      <button
        data-testid="prompt-toggle"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: '0.7rem',
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            fontSize: '0.6rem',
          }}
        >
          &#9654;
        </span>
        {label}
      </button>
      {expanded && (
        <div
          data-testid="prompt-content"
          style={{
            backgroundColor: '#1a1a2a',
            borderRadius: 4,
            padding: '0.5rem 0.75rem',
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            color: '#bbb',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {prompt}
        </div>
      )}
    </div>
  );
}
