import { useEffect, useState } from 'react';
import { useCampaignStore } from '../store/campaign';
import { DrillDownGrid, type DrillDownItem, type PreviewDescriptor } from './DrillDownGrid';
import type { Campaign } from '../lib/campaign-types';

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
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

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

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
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
          width: 420,
          backgroundColor: '#13131f',
          border: '1px solid #2a2a3e',
          borderRadius: 10,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
            New Campaign
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ×
          </button>
        </div>

        {/* Title input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500 }}>
            Campaign title
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Spring 2026 Launch"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
            style={{
              backgroundColor: '#0d0d1a',
              border: '1px solid #2a2a3e',
              borderRadius: 6,
              color: '#e0e0e0',
              padding: '8px 12px',
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2a3e')}
          />
        </div>

        {/* Channel selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500 }}>
            Channels
          </label>
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
                    border: `1px solid ${active ? '#3b82f6' : '#2a2a3e'}`,
                    backgroundColor: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: active ? '#7db5ff' : '#666',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: 'none',
              border: '1px solid #2a2a3e',
              borderRadius: 6,
              color: '#888',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            style={{
              padding: '7px 16px',
              backgroundColor: title.trim() ? '#3b82f6' : '#1e2a40',
              border: 'none',
              borderRadius: 6,
              color: title.trim() ? '#fff' : '#444',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.15s',
            }}
          >
            Create Campaign
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      {/* Channel filter chips */}
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
        {allChannels.map((ch) => {
          const active = filterChannel === ch;
          return (
            <button
              key={ch}
              onClick={() => onFilterChannel(ch)}
              style={{
                padding: '3px 10px',
                borderRadius: 5,
                border: `1px solid ${active ? '#3b82f6' : '#2a2a3e'}`,
                backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? '#7db5ff' : '#555',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.12s',
              }}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* Sort controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#444' }}>Sort:</span>
        {[
          { key: 'updatedAt' as SortKey, label: 'Updated' },
          { key: 'createdAt' as SortKey, label: 'Created' },
          { key: 'title' as SortKey, label: 'Name' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onSort(key)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${sortKey === key ? '#3b82f6' : '#2a2a3e'}`,
              backgroundColor: sortKey === key ? 'rgba(59,130,246,0.1)' : 'transparent',
              color: sortKey === key ? '#7db5ff' : '#555',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
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
   * At campaign level we don't have asset HTML loaded yet.
   * Return null — the grid will show a "No preview" placeholder.
   * A future plan can wire in representative asset thumbnails.
   */
  const renderPreview = (_item: DrillDownItem<Campaign>): PreviewDescriptor | null => null;

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
          padding: '5px 12px',
          backgroundColor: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
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
      color: '#444',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
           stroke="#2a2a3e" strokeWidth="1.25" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <div style={{ fontSize: '0.9rem' }}>No campaigns yet</div>
      <div style={{ fontSize: '0.8rem', color: '#333' }}>
        Create one to get started
      </div>
      <button
        onClick={() => setShowNewModal(true)}
        style={{
          marginTop: '0.5rem',
          padding: '7px 16px',
          backgroundColor: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
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
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid #2a2a3e', borderTopColor: '#3b82f6',
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
