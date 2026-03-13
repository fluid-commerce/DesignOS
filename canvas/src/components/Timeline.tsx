import type { Lineage, VersionStatus } from '../lib/types';
import { TimelineNode } from './TimelineNode';

interface TimelineProps {
  lineage: Lineage;
  statuses: Record<string, VersionStatus>;
  onVersionClick?: (versionPath: string) => void;
}

/**
 * Vertical iteration timeline showing the branching journey:
 * prompt -> fan out -> pick winner -> refine -> fan out -> ...
 *
 * Supports both Phase 4 (rounds) and Phase 2 (entries) lineage formats.
 */
export function Timeline({ lineage, statuses, onVersionClick }: TimelineProps) {
  const rounds = lineage.rounds ?? [];

  // Legacy format: show entries as a single pseudo-round
  if (rounds.length === 0 && lineage.entries && lineage.entries.length > 0) {
    return (
      <div data-testid="timeline" style={containerStyle}>
        <h3 style={headerStyle}>Timeline</h3>
        <div style={{ padding: '0.5rem' }}>
          <TimelineNode
            round={{
              roundNumber: 1,
              prompt: lineage.entries[0]?.prompt ?? 'Initial generation',
              variations: lineage.entries.map((e, i) => ({
                id: `v${i + 1}`,
                path: e.output,
                status: (statuses[e.output] ?? 'unmarked') as VersionStatus,
                specCheck: 'draft' as const,
              })),
              winnerId: null,
              timestamp: lineage.created,
            }}
            isActive={true}
            onVersionClick={onVersionClick}
          />
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div data-testid="timeline" style={containerStyle}>
        <h3 style={headerStyle}>Timeline</h3>
        <p style={{ color: '#555', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
          No iteration rounds yet.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="timeline" style={containerStyle}>
      <h3 style={headerStyle}>Timeline</h3>
      <div style={{ padding: '0.5rem', overflowY: 'auto', flex: 1 }}>
        {rounds.map((round, i) => (
          <TimelineNode
            key={round.roundNumber}
            round={round}
            isActive={i === rounds.length - 1}
            onVersionClick={onVersionClick}
          />
        ))}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
  color: '#fff',
  borderBottom: '1px solid #2a2a2e',
};
