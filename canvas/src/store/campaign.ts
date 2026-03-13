import { create } from 'zustand';
import type { Campaign, Asset, Frame, Iteration } from '../lib/campaign-types';

export type NavigationView = 'dashboard' | 'campaign' | 'asset' | 'frame';

interface CampaignStore {
  // Navigation state
  currentView: NavigationView;
  activeCampaignId: string | null;
  activeAssetId: string | null;
  activeFrameId: string | null;
  activeIterationId: string | null;

  // Data cache
  campaigns: Campaign[];
  assets: Asset[];
  frames: Frame[];
  iterations: Iteration[];

  /** Latest iteration per asset (keyed by assetId). Populated on navigateToCampaign. */
  latestIterationByAssetId: Record<string, Iteration>;

  // Loading state
  loading: boolean;

  // Sidebar state
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  /** Internal counter for race condition guard on rapid navigation */
  _requestId: number;

  // Navigation actions
  navigateToDashboard: () => void;
  navigateToCampaign: (id: string) => Promise<void>;
  navigateToAsset: (id: string) => Promise<void>;
  navigateToFrame: (id: string) => Promise<void>;
  selectIteration: (id: string) => void;
  navigateBack: () => void;

  // Data fetching actions
  fetchCampaigns: () => Promise<void>;
  fetchAssets: (campaignId: string) => Promise<void>;
  fetchFrames: (assetId: string) => Promise<void>;
  fetchIterations: (frameId: string) => Promise<void>;
  /**
   * For each asset currently in the store, fetches the first frame and its
   * iterations, then picks the latest iteration by iterationIndex.
   * Result is stored in latestIterationByAssetId.
   */
  fetchLatestIterations: (campaignId: string) => Promise<void>;

  // Sidebar actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  // Initial navigation state
  currentView: 'dashboard',
  activeCampaignId: null,
  activeAssetId: null,
  activeFrameId: null,
  activeIterationId: null,

  // Initial data cache
  campaigns: [],
  assets: [],
  frames: [],
  iterations: [],
  latestIterationByAssetId: {},

  loading: false,

  // Sidebar initial state
  leftSidebarOpen: true,
  rightSidebarOpen: false,

  _requestId: 0,

  // ---- Navigation actions ----

  navigateToDashboard: () => {
    set({
      currentView: 'dashboard',
      activeCampaignId: null,
      activeAssetId: null,
      activeFrameId: null,
      activeIterationId: null,
      assets: [],
      frames: [],
      iterations: [],
    });
    get().fetchCampaigns();
  },

  navigateToCampaign: async (id: string) => {
    set({
      currentView: 'campaign',
      activeCampaignId: id,
      activeAssetId: null,
      activeFrameId: null,
      activeIterationId: null,
      frames: [],
      iterations: [],
      latestIterationByAssetId: {},
    });
    await get().fetchAssets(id);
    await get().fetchLatestIterations(id);
  },

  navigateToAsset: async (id: string) => {
    set({
      currentView: 'asset',
      activeAssetId: id,
      activeFrameId: null,
      activeIterationId: null,
      iterations: [],
    });
    await get().fetchFrames(id);
    // Fetch iterations for all frames so frame preview cards can show content
    const { frames } = get();
    if (frames.length > 0) {
      const allIterations: Iteration[] = [];
      await Promise.all(
        frames.map(async (frame) => {
          try {
            const res = await fetch(`/api/frames/${frame.id}/iterations`);
            if (!res.ok) return;
            const iters: Iteration[] = await res.json();
            allIterations.push(...iters);
          } catch { /* noop */ }
        })
      );
      set({ iterations: allIterations });
    }
  },

  navigateToFrame: async (id: string) => {
    set({
      currentView: 'frame',
      activeFrameId: id,
      activeIterationId: null,
    });
    await get().fetchIterations(id);
  },

  selectIteration: (id: string) => {
    set({ activeIterationId: id });
  },

  navigateBack: () => {
    const { currentView, activeCampaignId, activeAssetId } = get();
    switch (currentView) {
      case 'frame':
        if (activeAssetId) {
          get().navigateToAsset(activeAssetId);
        } else {
          get().navigateToDashboard();
        }
        break;
      case 'asset':
        if (activeCampaignId) {
          get().navigateToCampaign(activeCampaignId);
        } else {
          get().navigateToDashboard();
        }
        break;
      case 'campaign':
        get().navigateToDashboard();
        break;
      case 'dashboard':
      default:
        // Already at top level; no-op
        break;
    }
  },

  // ---- Data fetching actions ----

  fetchCampaigns: async () => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch('/api/campaigns');
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const campaigns: Campaign[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ campaigns, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch campaigns:', err);
      set({ loading: false });
    }
  },

  fetchAssets: async (campaignId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assets`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const assets: Asset[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ assets, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch assets:', campaignId, err);
      set({ loading: false });
    }
  },

  fetchFrames: async (assetId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/assets/${assetId}/frames`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const frames: Frame[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ frames, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch frames:', assetId, err);
      set({ loading: false });
    }
  },

  fetchIterations: async (frameId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/frames/${frameId}/iterations`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const iterations: Iteration[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ iterations, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch iterations:', frameId, err);
      set({ loading: false });
    }
  },

  fetchLatestIterations: async (_campaignId: string) => {
    const { assets } = get();
    if (assets.length === 0) return;

    const result: Record<string, Iteration> = {};

    await Promise.all(
      assets.map(async (asset) => {
        try {
          // Fetch frames for this asset
          const framesRes = await fetch(`/api/assets/${asset.id}/frames`);
          if (!framesRes.ok) return;
          const frames: Frame[] = await framesRes.json();
          if (frames.length === 0) return;

          // Use the first frame
          const firstFrame = frames[0];
          const itersRes = await fetch(`/api/frames/${firstFrame.id}/iterations`);
          if (!itersRes.ok) return;
          const iterations: Iteration[] = await itersRes.json();
          if (iterations.length === 0) return;

          // Pick the latest by iterationIndex
          const latest = iterations.reduce((best, iter) =>
            iter.iterationIndex > best.iterationIndex ? iter : best
          );
          result[asset.id] = latest;
        } catch (err) {
          console.error('[campaign store] fetchLatestIterations failed for asset:', asset.id, err);
        }
      })
    );

    set({ latestIterationByAssetId: result });
  },

  // ---- Sidebar actions ----

  toggleLeftSidebar: () => {
    set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen }));
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  setRightSidebarOpen: (open: boolean) => {
    set({ rightSidebarOpen: open });
  },
}));
