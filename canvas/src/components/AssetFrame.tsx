import { ASSET_DIMENSIONS } from '../lib/types';
import type { VariationStatus } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface AssetFrameProps {
  html: string;
  name: string;
  platform: string;
  status: VariationStatus;
  displayWidth?: number;
}

export function AssetFrame({ html, name, platform, status, displayWidth = 400 }: AssetFrameProps) {
  const dims = ASSET_DIMENSIONS[platform] ?? { width: 1080, height: 1080 };
  const scale = displayWidth / dims.width;
  const displayHeight = dims.height * scale;

  return (
    <div data-testid="asset-frame" style={{ position: 'relative' }}>
      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{name}</span>
        <StatusBadge status={status} />
      </div>
      <div style={{
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        borderRadius: '6px',
        border: '1px solid #333',
        position: 'relative',
      }}>
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{
            width: dims.width,
            height: dims.height,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          title={name}
        />
        {/* Transparent overlay for future annotation pin clicks */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}
