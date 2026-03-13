import type { Round, VersionStatus } from '../lib/types';
import { StatusBadge } from './StatusBadge';
import { PromptReveal } from './PromptReveal';

interface TimelineNodeProps {
  round: Round;
  isActive: boolean;
  onVersionClick?: (versionPath: string) => void;
}

/**
 * Single node in the iteration timeline representing one round.
 * Shows round number, variation statuses, winner highlight, and collapsible prompt.
 */
export function TimelineNode({ round, isActive, onVersionClick }: TimelineNodeProps) {
  return (
    <div
      data-testid={`timeline-node-${round.roundNumber}`}
      style={{
        position: 'relative',
        paddingLeft: '1.5rem',
        paddingBottom: '1rem',
        borderLeft: '2px solid #333',
        marginLeft: '0.5rem',
      }}
    >
      {/* Circle marker */}
      <div style={{
        position: 'absolute',
        left: -6,
        top: 2,
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: isActive ? '#44B2FF' : '#555',
        border: '2px solid #1e1e1e',
      }} />

      {/* Round header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.4rem' }}>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: isActive ? '#fff' : '#aaa',
        }}>
          Round {round.roundNumber}
        </span>
        <span style={{ fontSize: '0.6rem', color: '#555' }}>
          {new Date(round.timestamp).toLocaleString()}
        </span>
      </div>

      {/* Variations list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {round.variations.map((v) => {
          const isWinner = v.id === round.winnerId;
          return (
            <button
              key={v.id}
              data-testid={`timeline-variation-${v.id}`}
              onClick={() => onVersionClick?.(v.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: isWinner ? '1px solid #22c55e' : '1px solid transparent',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                opacity: v.status === 'rejected' ? 0.5 : 1,
              }}
            >
              <span style={{
                fontSize: '0.75rem',
                color: isWinner ? '#22c55e' : '#bbb',
                textDecoration: v.status === 'rejected' ? 'line-through' : 'none',
              }}>
                {v.id}
              </span>
              {isWinner && (
                <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>&#10003;</span>
              )}
              <StatusBadge status={v.status} />
            </button>
          );
        })}
      </div>

      {/* Prompt */}
      <PromptReveal prompt={round.prompt} label={`Round ${round.roundNumber} prompt`} />
    </div>
  );
}
