/**
 * AssetsScreen — user library of saved assets.
 * Add assets from Fluid DAM; list and remove saved assets (persisted via /api/assets).
 */

import { useState, useEffect, useCallback } from 'react';
import { FluidDAMModal, type SelectedDAMAsset } from './DAMPicker';

interface SavedAsset {
  id: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  source: 'dam' | 'upload';
  createdAt: number;
}

export function AssetsScreen() {
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [damOpen, setDamOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assets');
      if (!res.ok) throw new Error('Failed to load assets');
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAddFromDAM = () => setDamOpen(true);

  const handleDAMSelect = async (asset: SelectedDAMAsset) => {
    setDamOpen(false);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: asset.url, name: asset.name ?? null, source: 'dam' }),
      });
      if (!res.ok) throw new Error('Failed to save asset');
      await fetchAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save asset');
    }
  };

  const handleRemove = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      await fetchAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setDeletingId(null);
    }
  };

  const isImage = (mime: string | null, url: string) => {
    if (mime?.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      padding: '1.5rem 1.5rem 2rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: 600,
          color: '#e0e0e0',
          letterSpacing: '-0.02em',
        }}>
          Assets
        </h1>
        <button
          type="button"
          onClick={handleAddFromDAM}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '8px 14px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#0d0d0d',
            backgroundColor: '#44B2FF',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <PlusIcon />
          Add from Fluid DAM
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px',
          marginBottom: '1rem',
          backgroundColor: 'rgba(200, 80, 80, 0.15)',
          color: '#e88',
          borderRadius: 6,
          fontSize: '0.8125rem',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#888', fontSize: '0.875rem' }}>Loading assets…</div>
      ) : assets.length === 0 ? (
        <div style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.875rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px dashed #333',
        }}>
          <p style={{ margin: '0 0 0.5rem' }}>No saved assets yet.</p>
          <p style={{ margin: 0 }}>Use “Add from Fluid DAM” to browse and save assets to your library.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem',
        }}>
          {assets.map((a) => (
            <div
              key={a.id}
              style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: '#1a1a1e',
                border: '1px solid #2a2a2e',
              }}
            >
              <div style={{
                aspectRatio: '1',
                backgroundColor: '#111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isImage(a.mimeType, a.url) ? (
                  <img
                    src={a.url}
                    alt={a.name ?? 'Asset'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <span style={{ color: '#555', fontSize: '0.75rem' }}>File</span>
                )}
              </div>
              <div style={{
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
              }}>
                <span
                  title={a.name ?? a.url}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.75rem',
                    color: '#aaa',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name ?? 'Asset'}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={deletingId === a.id}
                  title="Remove"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: deletingId === a.id ? 'wait' : 'pointer',
                    borderRadius: 4,
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FluidDAMModal
        isOpen={damOpen}
        onSelect={handleDAMSelect}
        onCancel={() => setDamOpen(false)}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
