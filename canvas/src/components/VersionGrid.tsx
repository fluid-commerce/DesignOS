import type { Annotation, VersionFile, VersionStatus } from '../lib/types';
import { CreationFrame } from './CreationFrame';

interface VersionGridProps {
  versions: VersionFile[];
  platform: string;
  statuses: Record<string, VersionStatus>;
  annotations: Annotation[];
  activePin: string | null;
  onPinClick: (id: string) => void;
  onAddPin: (versionPath: string, x: number, y: number, text: string) => void;
  onReply: (annotationId: string, text: string) => void;
  onStatusChange: (versionPath: string, status: VersionStatus) => void;
}

export function VersionGrid({
  versions,
  platform,
  statuses,
  annotations,
  activePin,
  onPinClick,
  onAddPin,
  onReply,
  onStatusChange,
}: VersionGridProps) {
  if (versions.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>No versions yet</div>
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
      {versions.map((v) => {
        const pins = annotations.filter(
          (a) => a.versionPath === v.path && a.type === 'pin'
        );
        return (
          <CreationFrame
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
