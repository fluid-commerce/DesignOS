import type { VariationFile, VariationStatus } from '../lib/types';
import { AssetFrame } from './AssetFrame';

interface VariationGridProps {
  variations: VariationFile[];
  platform: string;
  statuses: Record<string, VariationStatus>;
}

export function VariationGrid({ variations, platform, statuses }: VariationGridProps) {
  if (variations.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
        No variations to display
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
      {variations.map((v) => (
        <AssetFrame
          key={v.path}
          html={v.html}
          name={v.name}
          platform={platform}
          status={statuses[v.path] ?? 'unmarked'}
        />
      ))}
    </div>
  );
}
