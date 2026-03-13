import { create } from 'zustand';
import type { Campaign, Creation, Slide, Iteration } from '../lib/campaign-types';

export type NavigationView = 'dashboard' | 'campaign' | 'creation' | 'slide';

/** Top-level navigation tabs controlling the main viewport */
export type NavTab = 'create' | 'my-creations' | 'assets' | 'templates' | 'patterns' | 'voice-guide';

/** Sub-tabs within the Create viewport */
export type CreateViewportTab = 'campaigns' | 'creations';

interface CampaignStore {
  // Navigation state
  currentView: NavigationView;
  activeCampaignId: string | null;
  activeCreationId: string | null;
  activeSlideId: string | null;
  activeIterationId: string | null;

  // Data cache
  campaigns: Campaign[];
  creations: Creation[];
  slides: Slide[];
  iterations: Iteration[];

  /** Latest iteration per creation (keyed by creationId). Populated on navigateToCampaign. */
  latestIterationByCreationId: Record<string, Iteration>;

  // Loading state
  loading: boolean;

  // Top-level navigation tab
  activeNavTab: NavTab;

  // Create viewport sub-tab
  createViewportTab: CreateViewportTab;

  /** When true, CampaignDashboard shows the New Campaign modal (triggered from AppShell header) */
  showNewCampaignModal: boolean;

  // Chat sidebar state (canonical name; leftSidebarOpen kept for backward compat)
  chatSidebarOpen: boolean;

  // Sidebar state
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  /** Internal counter for race condition guard on rapid navigation */
  _requestId: number;

  // Navigation actions
  navigateToDashboard: () => void;
  navigateToCampaign: (id: string) => Promise<void>;
  navigateToCreation: (id: string) => Promise<void>;
  navigateToSlide: (id: string) => Promise<void>;
  selectIteration: (id: string) => void;
  navigateBack: () => void;

  // Data fetching actions
  fetchCampaigns: () => Promise<void>;
  fetchCreations: (campaignId: string) => Promise<void>;
  fetchSlides: (creationId: string) => Promise<void>;
  fetchIterations: (slideId: string) => Promise<void>;
  /**
   * For each creation currently in the store, fetches the first slide and its
   * iterations, then picks the latest iteration by iterationIndex.
   * Result is stored in latestIterationByCreationId.
   */
  fetchLatestIterations: (campaignId: string) => Promise<void>;

  // Nav tab actions
  setActiveNavTab: (tab: NavTab) => void;
  setCreateViewportTab: (tab: CreateViewportTab) => void;
  setShowNewCampaignModal: (show: boolean) => void;
  toggleChatSidebar: () => void;

  // Sidebar actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  // Initial navigation state
  currentView: 'dashboard',
  activeCampaignId: null,
  activeCreationId: null,
  activeSlideId: null,
  activeIterationId: null,

  // Initial data cache
  campaigns: [],
  creations: [],
  slides: [],
  iterations: [],
  latestIterationByCreationId: {},

  loading: false,

  // Top-level nav tab initial state
  activeNavTab: 'create',
  createViewportTab: 'campaigns',
  showNewCampaignModal: false,
  chatSidebarOpen: false,

  // Sidebar initial state
  leftSidebarOpen: true,
  rightSidebarOpen: false,

  _requestId: 0,

  // ---- Navigation actions ----

  navigateToDashboard: () => {
    set({
      currentView: 'dashboard',
      createViewportTab: 'campaigns',
      activeCampaignId: null,
      activeCreationId: null,
      activeSlideId: null,
      activeIterationId: null,
      creations: [],
      slides: [],
      iterations: [],
    });
    get().fetchCampaigns();
  },

  navigateToCampaign: async (id: string) => {
    set({
      currentView: 'campaign',
      activeCampaignId: id,
      activeCreationId: null,
      activeSlideId: null,
      activeIterationId: null,
      slides: [],
      iterations: [],
      latestIterationByCreationId: {},
    });
    await get().fetchCreations(id);
    await get().fetchLatestIterations(id);
  },

  navigateToCreation: async (id: string) => {
    set({
      currentView: 'creation',
      activeCreationId: id,
      activeSlideId: null,
      activeIterationId: null,
      iterations: [],
    });
    await get().fetchSlides(id);
    // Fetch iterations for all slides so slide preview cards can show content
    const { slides } = get();
    if (slides.length > 0) {
      const allIterations: Iteration[] = [];
      await Promise.all(
        slides.map(async (slide) => {
          try {
            const res = await fetch(`/api/slides/${slide.id}/iterations`);
            if (!res.ok) return;
            const iters: Iteration[] = await res.json();
            allIterations.push(...iters);
          } catch { /* noop */ }
        })
      );
      set({ iterations: allIterations });
    }
  },

  navigateToSlide: async (id: string) => {
    set({
      currentView: 'slide',
      activeSlideId: id,
      activeIterationId: null,
    });
    await get().fetchIterations(id);
  },

  selectIteration: (id: string) => {
    set({ activeIterationId: id });
  },

  navigateBack: () => {
    const { currentView, activeCampaignId, activeCreationId } = get();
    switch (currentView) {
      case 'slide':
        if (activeCreationId) {
          get().navigateToCreation(activeCreationId);
        } else {
          get().navigateToDashboard();
        }
        break;
      case 'creation':
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

  fetchCreations: async (campaignId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creations`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const creations: Creation[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ creations, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch creations:', campaignId, err);
      set({ loading: false });
    }
  },

  fetchSlides: async (creationId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/creations/${creationId}/slides`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const slides: Slide[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ slides, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch slides:', creationId, err);
      set({ loading: false });
    }
  },

  fetchIterations: async (slideId: string) => {
    const requestId = get()._requestId + 1;
    set({ loading: true, _requestId: requestId });
    try {
      const res = await fetch(`/api/slides/${slideId}/iterations`);
      if (get()._requestId !== requestId) return;
      if (!res.ok) { set({ loading: false }); return; }
      const iterations: Iteration[] = await res.json();
      if (get()._requestId !== requestId) return;
      set({ iterations, loading: false });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      console.error('[campaign store] Failed to fetch iterations:', slideId, err);
      set({ loading: false });
    }
  },

  fetchLatestIterations: async (_campaignId: string) => {
    const { creations } = get();
    if (creations.length === 0) return;

    const result: Record<string, Iteration> = {};

    await Promise.all(
      creations.map(async (creation) => {
        try {
          // Fetch slides for this creation
          const slidesRes = await fetch(`/api/creations/${creation.id}/slides`);
          if (!slidesRes.ok) return;
          const slides: Slide[] = await slidesRes.json();
          if (slides.length === 0) return;

          // Use the first slide
          const firstSlide = slides[0];
          const itersRes = await fetch(`/api/slides/${firstSlide.id}/iterations`);
          if (!itersRes.ok) return;
          const iterations: Iteration[] = await itersRes.json();
          if (iterations.length === 0) return;

          // Pick the latest by iterationIndex
          const latest = iterations.reduce((best, iter) =>
            iter.iterationIndex > best.iterationIndex ? iter : best
          );
          result[creation.id] = latest;
        } catch (err) {
          console.error('[campaign store] fetchLatestIterations failed for creation:', creation.id, err);
        }
      })
    );

    set({ latestIterationByCreationId: result });
  },

  // ---- Nav tab actions ----

  setActiveNavTab: (tab: NavTab) => {
    set((state) => ({
      activeNavTab: tab,
      ...(tab === 'create' ? { chatSidebarOpen: false } : {}),
    }));
  },

  setCreateViewportTab: (tab: CreateViewportTab) => {
    set({ createViewportTab: tab });
  },
  setShowNewCampaignModal: (show: boolean) => {
    set({ showNewCampaignModal: show });
  },

  toggleChatSidebar: () => {
    set((state) => ({
      chatSidebarOpen: !state.chatSidebarOpen,
      leftSidebarOpen: !state.chatSidebarOpen,
    }));
  },

  // ---- Sidebar actions ----

  toggleLeftSidebar: () => {
    set((state) => ({
      leftSidebarOpen: !state.leftSidebarOpen,
      chatSidebarOpen: !state.leftSidebarOpen,
    }));
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  setRightSidebarOpen: (open: boolean) => {
    set({ rightSidebarOpen: open });
  },
}));
