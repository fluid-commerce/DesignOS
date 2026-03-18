/**
 * AssetsScreen — user library of saved assets plus brand assets with DAM sync.
 *
 * Two sections:
 *   1. Brand Assets — synced from Fluid DAM Brand Elements folder (with sync status bar)
 *   2. Saved Assets — user library: add/remove via "Add from Fluid DAM" flow
 */

import { useState, useEffect, useCallback } from 'react';
import { FluidDAMModal, type SelectedDAMAsset } from './DAMPicker';
import { useAssets } from '../hooks/useAssets';

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
  description: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'images', label: 'Images' },
  { id: 'brand-elements', label: 'Brand Elements' },
  { id: 'decorations', label: 'Decorations' },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'fonts': 'Font files used by the generation pipeline for brand typography',
  'images': 'Photography and illustrations used in generated assets',
  'brand-elements': 'Core identity pieces — logos and wordmarks always present in output',
  'decorations': 'Hand-drawn elements like circles, underlines, arrows, and brushstrokes',
};

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

// ─── Empty state per category ─────────────────────────────────────────────────

const CATEGORY_EMPTY_STATES: Record<string, { heading: string; body: string }> = {
  'fonts': {
    heading: 'No fonts yet',
    body: 'No fonts yet. Sync from DAM or add font files manually.',
  },
  'images': {
    heading: 'No images yet',
    body: 'Sync from DAM to import photography and illustrations.',
  },
  'brand-elements': {
    heading: 'No brand elements yet',
    body: 'Sync from DAM to import logos and wordmarks.',
  },
  'decorations': {
    heading: 'No decorations yet',
    body: 'Sync from DAM to import hand-drawn circles, brushstrokes, and textures.',
  },
};

function CategoryEmptyState({ category }: { category: string }) {
  const state = CATEGORY_EMPTY_STATES[category] ?? {
    heading: 'No assets in this category',
    body: 'Sync from DAM to import assets.',
  };

  // Category-appropriate SVG icons (40x40, stroke only, #555)
  const icon = category === 'fonts' ? (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <text x="8" y="30" fontFamily="serif" fontSize="26" fill="none" stroke="#555" strokeWidth="1.5">A</text>
    </svg>
  ) : category === 'images' ? (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="32" height="24" rx="2" />
      <path d="M4 26L13 16L20 22L27 14L36 26" />
    </svg>
  ) : category === 'brand-elements' ? (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4L36 12V22C36 30 29 36 20 38C11 36 4 30 4 22V12L20 4Z" />
    </svg>
  ) : category === 'decorations' ? (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 32C12 32 16 24 20 16C24 8 28 6 30 8C32 10 30 14 26 18" />
      <path d="M10 34L14 30" />
      <circle cx="11" cy="33" r="2" />
    </svg>
  ) : (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="32" height="32" rx="3" />
      <line x1="4" y1="14" x2="36" y2="14" />
      <line x1="20" y1="14" x2="20" y2="36" />
    </svg>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      marginBottom: '1.5rem',
    }}>
      {icon}
      <h4 style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', margin: '12px 0 4px' }}>
        {state.heading}
      </h4>
      <p style={{ fontSize: 12, fontWeight: 400, color: '#888', margin: 0, maxWidth: 300 }}>
        {state.body}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssetsScreen() {
  // Saved assets via shared hook (deduped with BuildHero)
  const { assets, loading, error: assetsError, invalidate: fetchAssets } = useAssets();
  const [error, setError] = useState<string | null>(null);
  const [damOpen, setDamOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Surface hook-level errors into local error state
  useEffect(() => {
    if (assetsError) setError(assetsError);
  }, [assetsError]);

  // Brand assets + DAM sync state (new)
  const [brandAssets, setBrandAssets] = useState<BrandAssetUI[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'no-token'>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Category filter state
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Inline description editing state
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editDescContent, setEditDescContent] = useState('');
  const [savedDescId, setSavedDescId] = useState<string | null>(null);

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

  // On mount: fetch brand assets and detect DAM token presence
  // (saved assets are handled by the useAssets hook)
  useEffect(() => {
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
  }, [fetchBrandAssets]);

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

  const saveDescription = async (id: string, description: string) => {
    const prev = brandAssets;
    setBrandAssets(a => a.map(asset => asset.id === id ? { ...asset, description } : asset));
    setEditingDescId(null);
    try {
      const res = await fetch(`/api/brand-assets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedDescId(id);
      setTimeout(() => setSavedDescId(null), 2000);
    } catch {
      setBrandAssets(prev);
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

  // Filtered brand assets (exclude dam-deleted from count calculation)
  const filteredBrandAssets = activeCategory === 'all'
    ? brandAssets
    : brandAssets.filter(a => a.category === activeCategory);

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return brandAssets.filter(a => !a.damDeleted).length;
    return brandAssets.filter(a => a.category === categoryId && !a.damDeleted).length;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
    }}>
      {/* ── Fixed header bar ── */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid #1e1e1e',
        backgroundColor: '#0d0d0d',
        padding: '14px 1rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              color: '#e0e0e0',
              letterSpacing: '-0.02em',
            }}>
              Assets
            </h1>
            <p style={{ fontSize: 14, fontWeight: 400, color: '#888', marginTop: 4, marginBottom: 0 }}>
              Fonts, images, logos, and decorative elements available to the generation pipeline
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddFromDAM}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#fff',
              backgroundColor: '#44B2FF',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a9fe0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#44B2FF')}
          >
            <PlusIcon />
            Add from Fluid DAM
          </button>
        </div>

        {/* Category tabs in header bar */}
        {brandAssets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {ASSET_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              const count = getCategoryCount(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.72rem',
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    color: isActive ? '#e0e0e0' : '#666',
                    backgroundColor: isActive ? '#1a1a1e' : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem 1.5rem 2rem',
      }}>

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

      {/* Category description (tabs moved to header) */}
      {activeCategory !== 'all' && CATEGORY_DESCRIPTIONS[activeCategory] && (
        <p style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#888',
          padding: '0 0 16px 0',
          margin: 0,
        }}>
          {CATEGORY_DESCRIPTIONS[activeCategory]}
        </p>
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
      ) : filteredBrandAssets.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {filteredBrandAssets.map((a) => (
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
                {/* Inline description editing */}
                {editingDescId === a.id ? (
                  <textarea
                    autoFocus
                    value={editDescContent}
                    onChange={e => setEditDescContent(e.target.value)}
                    onBlur={() => saveDescription(a.id, editDescContent)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveDescription(a.id, editDescContent);
                      }
                      if (e.key === 'Escape') {
                        setEditingDescId(null);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      fontSize: 11,
                      color: '#aaa',
                      backgroundColor: '#111',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '4px 6px',
                      resize: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                      minHeight: 48,
                      outline: 'none',
                    }}
                  />
                ) : savedDescId === a.id ? (
                  <span style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 11,
                    color: '#44B2FF',
                    fontWeight: 500,
                  }}>
                    Saved
                  </span>
                ) : (
                  <span
                    onClick={() => {
                      setEditingDescId(a.id);
                      setEditDescContent(a.description ?? '');
                    }}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      fontSize: 11,
                      color: a.description ? '#888' : '#555',
                      fontStyle: a.description ? 'normal' : 'italic',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.description ?? 'Add description...'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : brandAssets.length > 0 ? (
        <CategoryEmptyState category={activeCategory} />
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
