import { useEffect, useRef } from 'react';
import { useCampaignStore, type NavTab } from '../store/campaign';

const BASE = '/app';

/** Tab segments that map 1:1 to NavTab values */
const TAB_SEGMENTS: Record<string, NavTab> = {
  create: 'create',
  'my-creations': 'my-creations',
  assets: 'assets',
  templates: 'templates',
  patterns: 'patterns',
  styles: 'styles',
  'voice-guide': 'voice-guide',
  settings: 'settings',
};

/** Reverse: NavTab → URL segment */
const TAB_TO_SEGMENT: Record<NavTab, string> = {
  create: 'create',
  'my-creations': 'my-creations',
  assets: 'assets',
  templates: 'templates',
  patterns: 'patterns',
  styles: 'styles',
  'voice-guide': 'voice-guide',
  settings: 'settings',
};

interface ParsedRoute {
  tab: NavTab;
  /** 'campaigns' | 'creations' sub-tab for my-creations */
  subTab?: 'campaigns' | 'creations';
  /** Campaign or creation ID for drill-down */
  entityId?: string;
  /** Whether we're viewing a creation (vs a campaign) */
  isCreation?: boolean;
}

function parsePathname(pathname: string): ParsedRoute {
  // Strip base and trailing slash
  let path = pathname;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  if (path.startsWith('/')) path = path.slice(1);
  if (path.endsWith('/')) path = path.slice(0, -1);

  const segments = path.split('/').filter(Boolean);

  // No segments → default to create
  if (segments.length === 0) {
    return { tab: 'create' };
  }

  const tabSegment = segments[0];
  const tab = TAB_SEGMENTS[tabSegment];

  // Unknown tab → default to create
  if (!tab) {
    return { tab: 'create' };
  }

  // Non-my-creations tabs have no sub-routing
  if (tab !== 'my-creations') {
    return { tab };
  }

  // my-creations sub-routes:
  // /app/my-creations → campaigns sub-tab (dashboard)
  // /app/my-creations/creations → creations sub-tab (standalone)
  // /app/my-creations/campaigns/:id → campaign drill-down
  // /app/my-creations/creations/:id → creation drill-down
  if (segments.length === 1) {
    return { tab, subTab: 'campaigns' };
  }

  const sub = segments[1];
  if (sub === 'creations') {
    if (segments.length >= 3) {
      return { tab, subTab: 'creations', entityId: segments[2], isCreation: true };
    }
    return { tab, subTab: 'creations' };
  }

  if (sub === 'campaigns' && segments.length >= 3) {
    return { tab, subTab: 'campaigns', entityId: segments[2], isCreation: false };
  }

  return { tab, subTab: 'campaigns' };
}

function buildPathname(state: {
  activeNavTab: NavTab;
  currentView: string;
  createViewportTab: string;
  activeCampaignId: string | null;
  activeCreationId: string | null;
}): string {
  const segment = TAB_TO_SEGMENT[state.activeNavTab];

  if (state.activeNavTab !== 'my-creations') {
    return `${BASE}/${segment}`;
  }

  // my-creations sub-routes
  if (state.currentView === 'creation' && state.activeCreationId) {
    return `${BASE}/my-creations/creations/${state.activeCreationId}`;
  }

  if (state.currentView === 'campaign' && state.activeCampaignId) {
    return `${BASE}/my-creations/campaigns/${state.activeCampaignId}`;
  }

  // Dashboard level
  if (state.createViewportTab === 'creations') {
    return `${BASE}/my-creations/creations`;
  }

  return `${BASE}/my-creations`;
}

/**
 * Syncs browser URL ↔ Zustand campaign store.
 * - On mount: reads URL and hydrates store state
 * - On state change: pushes new URL via History API
 * - On popstate (back/forward): updates store from URL
 */
export function useRouteSync() {
  // Guard against URL pushes triggered by our own state hydration
  const suppressPush = useRef(false);
  const lastPushedPath = useRef('');

  // ── 1. On mount: hydrate state from URL ──
  useEffect(() => {
    const route = parsePathname(window.location.pathname);
    const store = useCampaignStore.getState();

    suppressPush.current = true;

    // Set the nav tab
    store.setActiveNavTab(route.tab);

    if (route.tab === 'my-creations') {
      if (route.subTab) {
        store.setCreateViewportTab(route.subTab);
      }

      if (route.entityId) {
        if (route.isCreation) {
          // Navigate to creation (this is async — fetches data)
          store.navigateToCreation(route.entityId).finally(() => {
            suppressPush.current = false;
          });
          // Also switch to creations sub-tab
          store.setCreateViewportTab('creations');
          return; // Don't unsuppress yet — wait for async nav
        } else {
          // Navigate to campaign
          store.navigateToCampaign(route.entityId).finally(() => {
            suppressPush.current = false;
          });
          return;
        }
      }
    }

    // For non-async routes, unsuppress after a tick
    requestAnimationFrame(() => {
      suppressPush.current = false;
    });
  }, []);

  // ── 2. Subscribe to state changes → push URL ──
  useEffect(() => {
    const unsub = useCampaignStore.subscribe((state) => {
      if (suppressPush.current) return;

      const newPath = buildPathname(state);

      // Don't push if URL is already correct
      if (newPath === lastPushedPath.current) return;
      if (newPath === window.location.pathname) {
        lastPushedPath.current = newPath;
        return;
      }

      lastPushedPath.current = newPath;
      window.history.pushState(null, '', newPath);
    });

    return unsub;
  }, []);

  // ── 3. Listen to popstate (back/forward buttons) → hydrate state ──
  useEffect(() => {
    const handlePopState = () => {
      const route = parsePathname(window.location.pathname);
      const store = useCampaignStore.getState();

      suppressPush.current = true;

      store.setActiveNavTab(route.tab);

      if (route.tab === 'my-creations') {
        if (route.subTab) {
          store.setCreateViewportTab(route.subTab);
        }

        if (route.entityId) {
          if (route.isCreation) {
            store.navigateToCreation(route.entityId).finally(() => {
              suppressPush.current = false;
            });
            store.setCreateViewportTab('creations');
            return;
          } else {
            store.navigateToCampaign(route.entityId).finally(() => {
              suppressPush.current = false;
            });
            return;
          }
        } else {
          // Dashboard level — reset drill-down state
          store.navigateToDashboard();
        }
      }

      requestAnimationFrame(() => {
        suppressPush.current = false;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
