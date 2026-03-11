import type { VariationStatus } from '../lib/types';

const STATUS_STYLES: Record<VariationStatus, { bg: string; color: string; label: string }> = {
  winner: { bg: '#22c55e22', color: '#22c55e', label: 'Winner' },
  rejected: { bg: '#ef444422', color: '#ef4444', label: 'Rejected' },
  final: { bg: '#eab30822', color: '#eab308', label: 'Final' },
  unmarked: { bg: '#6b728022', color: '#6b7280', label: 'Unmarked' },
};

interface StatusBadgeProps {
  status: VariationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.color,
      textDecoration: status === 'rejected' ? 'line-through' : 'none',
    }}>
      {style.label}
    </span>
  );
}
