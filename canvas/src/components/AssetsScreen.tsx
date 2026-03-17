/**
 * AssetsScreen — user library of saved assets plus brand assets with DAM sync.
 *
 * Two sections:
 *   1. Brand Assets — synced from Fluid DAM Brand Elements folder (with sync status bar)
 *   2. Saved Assets — user library: add/remove via "Add from Fluid DAM" flow
 */

import { useState, useEffect, useCallback } from 'react';
import { FluidDAMModal, type SelectedDAMAsset } from './DAMPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedAsset {
  id: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  source: 'dam' | 'upload';
  createdAt: number;
}

interface BrandAssetUI {
  id: string;
  name: string;
  category: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  source?: 'local' | 'dam';
  damDeleted?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff} seconds ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssetsScreen() {
  // Saved assets state (existing)
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [damOpen, setDamOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Brand assets + DAM sync state (new)
  const [brandAssets, setBrandAssets] = useState<BrandAssetUI[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'no-token'>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  const fetchBrandAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/brand-assets?include_deleted=true');
      if (!res.ok) return;
      const data = await res.json();
      setBrandAssets(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data as BrandAssetUI[] : [];
    } catch {
      return [];
    }
  }, []);

  // On mount: fetch everything and detect DAM token presence
  useEffect(() => {
    fetchAssets();
    fetchBrandAssets().then(async (loaded) => {
      if (!loaded) return;
      // If any brand assets have source=dam, DAM was synced before — show bar
      const hasDam = loaded.some((a) => a.source === 'dam');
      if (hasDam) {
        setSyncStatus('idle');
        return;
      }
      // Probe to detect if token is configured (no dam assets yet, may be new setup)
      try {
        const probe = await fetch('/api/dam-sync', { method: 'POST' });
        if (probe.status === 400) {
          setSyncStatus('no-token');
        } else if (probe.ok) {
          const result = await probe.json();
          setLastSynced(Date.now());
          setSyncStatus('idle');
          if (result.errors?.length) {
            setSyncError(`DAM unreachable — showing cached assets`);
            setSyncStatus('error');
          }
          // Refresh brand assets after initial probe sync
          await fetchBrandAssets();
        } else {
          // 500 etc — DAM configured but errored
          setSyncStatus('error');
          setSyncError('DAM unreachable — showing cached assets');
        }
      } catch {
        setSyncStatus('error');
        setSyncError('DAM unreachable — showing cached assets');
      }
    });
  }, [fetchAssets, fetchBrandAssets]);

  const handleSync = async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const res = await fetch('/api/dam-sync', { method: 'POST' });
      if (res.status === 400) {
        setSyncStatus('no-token');
        return;
      }
      if (res.ok) {
        const result = await res.json();
        setLastSynced(Date.now());
        if (result.errors?.length) {
          setSyncError(`DAM unreachable — showing cached assets`);
          setSyncStatus('error');
        } else {
          setSyncStatus('idle');
        }
      } else {
        setSyncStatus('error');
        setSyncError('DAM unreachable — showing cached assets');
      }
    } catch {
      setSyncStatus('error');
      setSyncError('DAM unreachable — showing cached assets');
    } finally {
      await fetchBrandAssets();
    }
  };

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

  const isImage = (mime: string | null | undefined, url: string) => {
    if (mime?.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
  };

  const syncStatusText = (): string => {
    if (syncStatus === 'syncing') return 'Syncing brand assets...';
    if (syncStatus === 'error') return syncError ?? 'DAM unreachable — showing cached assets';
    if (lastSynced) return `Last synced ${getRelativeTime(lastSynced)}`;
    return 'Synced on startup';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      padding: '24px 1.5rem',
    }}>
      {/* ── Page heading row ── */}
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
          fontSize: '26px',
          fontWeight: 700,
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
            justifyContent: 'center',
            gap: '0.375rem',
            padding: '8px 14px',
            minHeight: 36,
            boxSizing: 'border-box',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#fff',
            backgroundColor: '#44B2FF',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a9fe0')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#44B2FF')}
        >
          <PlusIcon />
          Add from Fluid DAM
        </button>
      </div>

      {/* ── Error banner ── */}
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

      {/* ── Brand Assets section ── */}
      <h2 style={{
        margin: '0 0 12px',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#e0e0e0',
      }}>
        Brand Assets
      </h2>

      {/* Sync status bar (hidden when no-token) */}
      {syncStatus !== 'no-token' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: syncStatus === 'error'
            ? 'rgba(200, 80, 80, 0.15)'
            : 'rgba(255, 255, 255, 0.03)',
          fontSize: '0.8125rem',
          marginBottom: '1rem',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {syncStatus === 'syncing' ? <SyncSpinner /> : <CloudSyncIcon />}
            <span style={{ color: syncStatus === 'error' ? '#e88' : '#555' }}>
              {syncStatusText()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncStatus === 'syncing'}
            style={{
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#0d0d0d',
              backgroundColor: '#44B2FF',
              border: 'none',
              borderRadius: 6,
              cursor: syncStatus === 'syncing' ? 'not-allowed' : 'pointer',
              opacity: syncStatus === 'syncing' ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            Sync now
          </button>
        </div>
      )}

      {/* Brand assets grid */}
      {brandAssets.length === 0 && syncStatus !== 'no-token' ? (
        <div style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.875rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px dashed #333',
          marginBottom: '1.5rem',
        }}>
          <p style={{ margin: '0 0 0.5rem' }}>No brand assets yet.</p>
          <p style={{ margin: 0 }}>Brand assets sync automatically from the Fluid DAM Brand Elements folder on startup. Configure VITE_FLUID_DAM_TOKEN to enable sync.</p>
        </div>
      ) : brandAssets.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {brandAssets.map((a) => (
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
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isImage(a.mimeType, a.url) ? (
                  <img
                    src={a.url}
                    alt={a.name}
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
                {/* Removed from DAM badge */}
                {a.source === 'dam' && a.damDeleted && (
                  <span
                    title="This asset was removed from the Fluid DAM Brand Elements folder. You can delete it manually."
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      padding: '4px 8px',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      background: 'rgba(255,180,50,0.15)',
                      color: '#cc9',
                      borderRadius: 999,
                    }}
                  >
                    Removed from DAM
                  </span>
                )}
                {/* DAM source badge */}
                {a.source === 'dam' && !a.damDeleted && (
                  <span style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'rgba(68,178,255,0.7)',
                    pointerEvents: 'none',
                  }}>
                    DAM
                  </span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <span
                  title={a.name}
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: '#aaa',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Divider ── */}
      <div style={{ borderTop: '1px solid #2a2a2e', marginTop: 24, marginBottom: 24 }} />

      {/* ── Saved Assets section ── */}
      <h2 style={{
        margin: '0 0 12px',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#e0e0e0',
      }}>
        Saved Assets
      </h2>

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
          <p style={{ margin: 0 }}>Use "Add from Fluid DAM" to browse and save assets to your library.</p>
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

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function SyncSpinner() {
  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#44B2FF"
        strokeWidth="1.75"
        strokeLinecap="round"
        style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </>
  );
}

function CloudSyncIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#555"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}
