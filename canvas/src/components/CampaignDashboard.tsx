import { useEffect, useState, useCallback } from 'react';
import { useCampaignStore } from '../store/campaign';
import { DrillDownGrid, type DrillDownItem, type PreviewDescriptor } from './DrillDownGrid';
import type { Campaign, Asset } from '../lib/campaign-types';

// ---- New Campaign Modal ----

interface NewCampaignModalProps {
  onClose: () => void;
  onCreated: (title: string, channels: string[]) => void;
}

const CHANNEL_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'one-pager', label: 'One-pager' },
  { value: 'email', label: 'Email' },
];

function NewCampaignModal({ onClose, onCreated }: NewCampaignModalProps) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [refLinks, setRefLinks] = useState<string[]>(['']);

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleCreate = () => {
    const t = title.trim();
    if (!t) return;
    onCreated(t, selectedChannels);
    onClose();
  };

  const addLink = () => setRefLinks((prev) => [...prev, '']);
  const removeLink = (i: number) => setRefLinks((prev) => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) =>
    setRefLinks((prev) => prev.map((l, idx) => (idx === i ? val : l)));

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: '#888',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '0.5rem',
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#141414',
    border: '1px solid #2a2a2e',
    borderRadius: 6,
    color: '#e0e0e0',
    padding: '8px 12px',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Inter', sans-serif",
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 580,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#1a1a1e',
          border: '1px solid #2a2a2e',
          borderRadius: 10,
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
            New Campaign
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '2px 6px' }}
          >
            ×
          </button>
        </div>

        {/* Campaign Name */}
        <div>
          <label style={labelStyle}>Campaign Name</label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Spring 2026 Launch"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#44B2FF')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
          />
        </div>

        {/* Brief */}
        <div>
          <label style={labelStyle}>Brief</label>
          <textarea
            placeholder="e.g. Q2 product launch campaign targeting independent sales reps on LinkedIn and Instagram..."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: 100,
              resize: 'vertical',
              lineHeight: '1.5',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#44B2FF')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
          />
        </div>

        {/* Resources */}
        <div>
          <label style={labelStyle}>Resources</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{
              fontSize: '0.7rem',
              color: '#555',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Reference Links
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {refLinks.map((link, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => updateLink(i, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={(e) => (e.target.style.borderColor = '#44B2FF')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
                />
                <button
                  onClick={() => removeLink(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0 4px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addLink}
            style={{
              background: 'none',
              border: 'none',
              color: '#44B2FF',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '0.375rem 0',
              marginTop: '0.25rem',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            + Add Link
          </button>
        </div>

        {/* Attach Files */}
        <div>
          <label style={labelStyle}>Attach Files</label>
          <button
            style={{
              padding: '7px 16px',
              background: 'none',
              border: '1px solid #2a2a2e',
              borderRadius: 6,
              color: '#888',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '0.04em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#44B2FF')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2e')}
          >
            Choose Files
          </button>
        </div>

        {/* Fluid DAM */}
        <div>
          <label style={labelStyle}>Fluid DAM</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
            <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>✦</span>
            <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 500 }}>Fluid DAM connected</span>
          </div>
          <button
            style={{
              width: '100%',
              padding: '9px 16px',
              backgroundColor: '#44B2FF',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Browse Assets
          </button>
        </div>

        {/* Channel selection (styled to match) */}
        <div>
          <label style={labelStyle}>Channels</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {CHANNEL_OPTIONS.map((ch) => {
              const active = selectedChannels.includes(ch.value);
              return (
                <button
                  key={ch.value}
                  onClick={() => toggleChannel(ch.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: `1px solid ${active ? '#44B2FF' : '#2a2a2e'}`,
                    backgroundColor: active ? 'rgba(68,178,255,0.12)' : 'transparent',
                    color: active ? '#44B2FF' : '#666',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: 'none',
              border: '1px solid #2a2a2e',
              borderRadius: 6,
              color: '#888',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            style={{
              padding: '7px 20px',
              backgroundColor: title.trim() ? '#44B2FF' : '#1a2530',
              border: 'none',
              borderRadius: 6,
              color: title.trim() ? '#fff' : '#444',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'background-color 0.15s',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Save Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Filter / Sort bar ----

type SortKey = 'updatedAt' | 'createdAt' | 'title';

interface FilterSortBarProps {
  filterChannel: string;
  onFilterChannel: (ch: string) => void;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  channels: string[];
}

function FilterSortBar({ filterChannel, onFilterChannel, sortKey, onSort, channels }: FilterSortBarProps) {
  const allChannels = ['all', ...Array.from(new Set(channels))];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'nowrap', minWidth: 0 }}>
      {/* Channel filter tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', overflowX: 'auto', flexShrink: 1, minWidth: 0 }}>
        {allChannels.map((ch) => {
          const active = filterChannel === ch;
          return (
            <button
              key={ch}
              onClick={() => onFilterChannel(ch)}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                border: `1px solid ${active ? '#44B2FF' : 'transparent'}`,
                backgroundColor: active ? 'rgba(68,178,255,0.1)' : 'transparent',
                color: active ? '#44B2FF' : '#555',
                fontSize: '0.7rem',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                transition: 'all 0.12s',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#888'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#555'; }}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* Sort controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
        <span style={{ fontSize: '0.7rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Sort:</span>
        {[
          { key: 'updatedAt' as SortKey, label: 'Updated' },
          { key: 'createdAt' as SortKey, label: 'Created' },
          { key: 'title' as SortKey, label: 'Name' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onSort(key)}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              border: `1px solid ${sortKey === key ? '#44B2FF' : 'transparent'}`,
              backgroundColor: sortKey === key ? 'rgba(68,178,255,0.1)' : 'transparent',
              color: sortKey === key ? '#44B2FF' : '#555',
              fontSize: '0.7rem',
              fontWeight: sortKey === key ? 600 : 500,
              cursor: 'pointer',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              transition: 'all 0.12s',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => { if (sortKey !== key) e.currentTarget.style.color = '#888'; }}
            onMouseLeave={(e) => { if (sortKey !== key) e.currentTarget.style.color = '#555'; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- CampaignDashboard ----

/**
 * Top-level campaign list view.
 * Uses DrillDownGrid with filter/sort controls and a "New Campaign" action.
 */
export function CampaignDashboard() {
  const campaigns = useCampaignStore((s) => s.campaigns);
  const loading = useCampaignStore((s) => s.loading);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);

  const [showNewModal, setShowNewModal] = useState(false);
  const [filterChannel, setFilterChannel] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Collect all channels across campaigns for the filter bar
  const allChannels = campaigns.flatMap((c) => c.channels);

  // Filter
  const filtered = filterChannel === 'all'
    ? campaigns
    : campaigns.filter((c) => c.channels.includes(filterChannel));

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'title') return a.title.localeCompare(b.title);
    return b[sortKey] - a[sortKey]; // numeric desc (most recent first)
  });

  // Map to DrillDownGrid items
  const items: DrillDownItem<Campaign>[] = sorted.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.channels.join(', ') || 'No channels',
    data: c,
  }));

  /**
   * renderPreview for campaigns:
   * Shows channel badges and creation date as metadata card.
   */
  const renderPreview = (item: DrillDownItem<Campaign>): PreviewDescriptor | null => {
    const channels = item.data.channels;
    const date = new Date(item.data.createdAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      width: 320,
      height: 180,
      meta: {
        icon: 'campaign',
        badges: channels.length > 0 ? channels : undefined,
        detail: `Created ${dateStr}`,
      },
    };
  };

  const handleSelect = (item: DrillDownItem<Campaign>) => {
    navigateToCampaign(item.id);
  };

  const handleCreated = (title: string, channels: string[]) => {
    // POST to API — fire-and-forget, then refresh
    fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, channels }),
    })
      .then(() => fetchCampaigns())
      .catch((err) => console.error('[CampaignDashboard] Failed to create campaign:', err));
  };

  const headerActions = (
    <>
      <FilterSortBar
        filterChannel={filterChannel}
        onFilterChannel={setFilterChannel}
        sortKey={sortKey}
        onSort={setSortKey}
        channels={allChannels}
      />
      <button
        onClick={() => setShowNewModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '5px 14px',
          backgroundColor: '#44B2FF',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.7rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Campaign
      </button>
    </>
  );

  const emptyState = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 300,
      gap: '1rem',
      color: '#555',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
           stroke="#2a2a2e" strokeWidth="1.25" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <div style={{ fontSize: '0.9rem', color: '#555' }}>No campaigns yet</div>
      <div style={{ fontSize: '0.8rem', color: '#3a3a3a' }}>
        Create one to get started
      </div>
      <button
        onClick={() => setShowNewModal(true)}
        style={{
          marginTop: '0.5rem',
          padding: '7px 18px',
          backgroundColor: '#44B2FF',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.7rem',
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        + New Campaign
      </button>
    </div>
  );

  if (loading && campaigns.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#555',
        fontSize: '0.9rem',
        gap: '0.75rem',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid #2a2a2e', borderTopColor: '#44B2FF',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Loading campaigns...
      </div>
    );
  }

  return (
    <>
      <DrillDownGrid
        items={items}
        renderPreview={renderPreview}
        onSelect={handleSelect}
        emptyState={emptyState}
        title="Campaigns"
        headerActions={headerActions}
      />

      {showNewModal && (
        <NewCampaignModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

// ─── CampaignChannelSlots ─────────────────────────────────────────────────────
//
// Shows a per-channel tab view with 5 fixed option slots per channel.
// Each slot displays a filled asset preview (iframe) or a dashed empty placeholder.
// Matches Jonathan's UI design for the campaign output view.
//
// Props:
//   campaignId — the active campaign ID
//   assets     — the assets already loaded for this campaign (from campaign store)
//   onSelectAsset — handler to drill into a specific asset
//   onGenerateCampaign — callback to trigger /fluid-campaign invocation

const SLOT_CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'blog', label: 'Blog' },
  { key: 'one-pager', label: 'One Pager' },
];

const SLOTS_PER_CHANNEL = 5;

interface CampaignChannelSlotsProps {
  campaignId: string;
  assets: Asset[];
  onSelectAsset: (assetId: string) => void;
  onGenerateCampaign?: () => void;
  generatingCampaign?: boolean;
}

export function CampaignChannelSlots({
  campaignId: _campaignId,
  assets,
  onSelectAsset,
  onGenerateCampaign,
  generatingCampaign = false,
}: CampaignChannelSlotsProps) {
  const [activeChannel, setActiveChannel] = useState(SLOT_CHANNELS[0].key);

  // Group assets by channel (assetType)
  const assetsByChannel = useCallback(
    (channelKey: string): Asset[] =>
      assets.filter(
        (a) =>
          a.assetType === channelKey ||
          a.assetType === channelKey.replace('-', '_') ||
          a.assetType.toLowerCase().includes(channelKey.toLowerCase())
      ),
    [assets]
  );

  const channelAssets = assetsByChannel(activeChannel);

  return (
    <div style={slotStyles.container}>
      {/* Header: channel tabs + Generate Campaign action */}
      <div style={slotStyles.header}>
        {/* Channel tabs */}
        <div style={slotStyles.tabs}>
          {SLOT_CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.key;
            const count = assetsByChannel(ch.key).length;
            return (
              <button
                key={ch.key}
                onClick={() => setActiveChannel(ch.key)}
                style={{
                  ...slotStyles.tab,
                  borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                  color: isActive ? '#44B2FF' : '#555',
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#888'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#555'; }}
              >
                {ch.label}
                {count > 0 && (
                  <span style={slotStyles.tabBadge}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Generate Campaign button */}
        <button
          onClick={onGenerateCampaign}
          disabled={generatingCampaign || !onGenerateCampaign}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '5px 14px',
            backgroundColor: generatingCampaign ? '#1a2530' : '#44B2FF',
            color: generatingCampaign ? '#444' : '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: generatingCampaign ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            fontFamily: "'Inter', sans-serif",
            transition: 'background-color 0.15s',
            flexShrink: 0,
          }}
          title="Generate all channels with /fluid-campaign"
        >
          {generatingCampaign ? (
            <>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                border: '1.5px solid #2a2a2e', borderTopColor: '#44B2FF',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              Generating...
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Generate Campaign
            </>
          )}
        </button>
      </div>

      {/* 5-slot grid */}
      <div style={slotStyles.slotGrid}>
        {Array.from({ length: SLOTS_PER_CHANNEL }).map((_, slotIndex) => {
          const asset = channelAssets[slotIndex] ?? null;
          return (
            <SlotCard
              key={slotIndex}
              slotIndex={slotIndex}
              asset={asset}
              onSelect={asset ? () => onSelectAsset(asset.id) : undefined}
            />
          );
        })}
      </div>

      {/* Empty channel hint */}
      {channelAssets.length === 0 && (
        <div style={slotStyles.emptyHint}>
          No {SLOT_CHANNELS.find((c) => c.key === activeChannel)?.label ?? activeChannel} assets yet.
          Click &ldquo;Generate Campaign&rdquo; to create them with /fluid-campaign.
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Slot card ────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slotIndex: number;
  asset: Asset | null;
  onSelect?: () => void;
}

function SlotCard({ slotIndex, asset, onSelect }: SlotCardProps) {
  const isEmpty = asset === null;

  return (
    <div
      onClick={onSelect}
      style={{
        ...slotStyles.slotCard,
        border: isEmpty ? '1px dashed #2a2a2e' : '1px solid #333',
        cursor: isEmpty ? 'default' : 'pointer',
        backgroundColor: isEmpty ? 'transparent' : '#161616',
      }}
      title={asset ? `${asset.title} — click to open` : `Slot ${slotIndex + 1} — empty`}
      onMouseEnter={(e) => {
        if (!isEmpty) (e.currentTarget as HTMLDivElement).style.borderColor = '#44B2FF';
      }}
      onMouseLeave={(e) => {
        if (!isEmpty) (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
      }}
    >
      {isEmpty ? (
        // Empty slot placeholder
        <div style={slotStyles.emptySlot}>
          <div style={slotStyles.slotNumber}>{slotIndex + 1}</div>
          <div style={slotStyles.emptyLabel}>Empty</div>
        </div>
      ) : (
        // Filled slot: asset type badge + title
        <div style={slotStyles.filledSlot}>
          <div style={slotStyles.assetTypeBadge}>{asset.assetType}</div>
          <div style={slotStyles.assetTitle}>{asset.title}</div>
          <div style={slotStyles.slotArrow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="#444" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const slotStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#0d0d0d',
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    borderBottom: '1px solid #1e1e1e',
    flexShrink: 0,
    gap: '1rem',
  },
  tabs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0',
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '0.75rem 0.875rem',
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    transition: 'color 0.12s, border-color 0.12s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  tabBadge: {
    backgroundColor: 'rgba(68,178,255,0.18)',
    color: '#44B2FF',
    borderRadius: 8,
    padding: '0 5px',
    fontSize: '0.62rem',
    fontWeight: 700,
    lineHeight: '16px',
  },
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '0.75rem',
    padding: '1.25rem',
    flex: 1,
    alignContent: 'start',
  },
  slotCard: {
    borderRadius: 6,
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    transition: 'border-color 0.15s',
    position: 'relative' as const,
  },
  emptySlot: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 140,
    gap: '0.3rem',
  },
  slotNumber: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#222',
    lineHeight: 1,
  },
  emptyLabel: {
    fontSize: '0.65rem',
    color: '#333',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  filledSlot: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0.75rem',
    height: '100%',
    minHeight: 140,
    gap: '0.35rem',
    position: 'relative' as const,
  },
  assetTypeBadge: {
    fontSize: '0.6rem',
    fontWeight: 600,
    color: '#44B2FF',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  assetTitle: {
    fontSize: '0.75rem',
    color: '#ccc',
    flex: 1,
    lineHeight: 1.4,
  },
  slotArrow: {
    alignSelf: 'flex-end',
  },
  emptyHint: {
    padding: '0 1.25rem 1.25rem',
    fontSize: '0.78rem',
    color: '#3a3a3a',
    textAlign: 'center' as const,
  },
};
