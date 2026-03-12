import type { VariationStatus } from '../lib/types';

export type GenerationStatus = 'pending' | 'generating' | 'complete';

const STATUS_STYLES: Record<VariationStatus, { bg: string; color: string; label: string }> = {
  winner: { bg: '#22c55e22', color: '#22c55e', label: 'Winner' },
  rejected: { bg: '#ef444422', color: '#ef4444', label: 'Rejected' },
  final: { bg: '#eab30822', color: '#eab308', label: 'Final' },
  unmarked: { bg: '#6b728022', color: '#6b7280', label: 'Unmarked' },
};

const GENERATION_STYLES: Record<GenerationStatus, { bg: string; color: string; label: string; pulse?: boolean }> = {
  pending: { bg: '#6b728022', color: '#6b7280', label: 'Pending' },
  generating: { bg: '#f59e0b22', color: '#f59e0b', label: 'Generating', pulse: true },
  complete: { bg: '#22c55e22', color: '#22c55e', label: 'Complete' },
};

const GENERATION_KEYS = new Set<string>(['pending', 'generating', 'complete']);

interface StatusBadgeProps {
  status: VariationStatus | GenerationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isGenerationStatus = GENERATION_KEYS.has(status);
  const style = isGenerationStatus
    ? (GENERATION_STYLES[status as GenerationStatus] ?? GENERATION_STYLES.pending)
    : (STATUS_STYLES[status as VariationStatus] ?? STATUS_STYLES.unmarked);

  const pulse = isGenerationStatus && (GENERATION_STYLES[status as GenerationStatus]?.pulse ?? false);

  return (
    <>
      {pulse && (
        <style>{`
          @keyframes statusPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      )}
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        textDecoration: (status as VariationStatus) === 'rejected' ? 'line-through' : 'none',
        animation: pulse ? 'statusPulse 1.5s ease-in-out infinite' : 'none',
      }}>
        {style.label}
      </span>
    </>
  );
}
