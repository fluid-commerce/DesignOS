import { BG_SECONDARY, BORDER, BORDER_HOVER, TEXT_PRIMARY, TEXT_SECONDARY } from '../tokens';

export interface SelectedDamAsset {
  id: string;
  url: string;
  name?: string;
}

interface SelectedAssetsListProps {
  assets: SelectedDamAsset[];
  onRemove: (id: string) => void;
}

export function SelectedAssetsList({ assets, onRemove }: SelectedAssetsListProps) {
  if (assets.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      {assets.map((asset) => (
        <div
          key={asset.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.5rem 0.375rem 0.5rem',
            background: BG_SECONDARY,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: TEXT_PRIMARY,
            maxWidth: 220,
          }}
        >
          {asset.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
            <img
              src={asset.url}
              alt=""
              style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
            />
          ) : (
            <span
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: TEXT_SECONDARY,
              }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.name || asset.url.replace(/^.*\//, '').slice(0, 20) || 'Asset'}
          </span>
          <button
            type="button"
            title="Remove"
            onClick={() => onRemove(asset.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              marginLeft: 2,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: TEXT_SECONDARY,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TEXT_PRIMARY;
              e.currentTarget.style.background = BORDER_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TEXT_SECONDARY;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>&times;</span>
          </button>
        </div>
      ))}
    </div>
  );
}
