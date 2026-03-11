import type { Annotation, VariationFile, VariationStatus } from '../lib/types';
import { AssetFrame } from './AssetFrame';

interface VariationGridProps {
  variations: VariationFile[];
  platform: string;
  statuses: Record<string, VariationStatus>;
  annotations: Annotation[];
  activePin: string | null;
  onPinClick: (id: string) => void;
  onAddPin: (variationPath: string, x: number, y: number, text: string) => void;
  onReply: (annotationId: string, text: string) => void;
  onStatusChange: (variationPath: string, status: VariationStatus) => void;
}

export function VariationGrid({
  variations,
  platform,
  statuses,
  annotations,
  activePin,
  onPinClick,
  onAddPin,
  onReply,
  onStatusChange,
}: VariationGridProps) {
  if (variations.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>No variations yet</div>
        <div style={{ fontSize: '0.75rem', color: '#555' }}>
          Generation may still be in progress — check the sidebar for status.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: '1.5rem',
      padding: '1.5rem',
    }}>
      {variations.map((v) => {
        const pins = annotations.filter(
          (a) => a.variationPath === v.path && a.type === 'pin'
        );
        return (
          <AssetFrame
            key={v.path}
            html={v.html}
            name={v.name}
            path={v.path}
            platform={platform}
            status={statuses[v.path] ?? 'unmarked'}
            pins={pins}
            activePin={activePin}
            onPinClick={onPinClick}
            onAddPin={onAddPin}
            onReply={onReply}
            onStatusChange={onStatusChange}
          />
        );
      })}
    </div>
  );
}
