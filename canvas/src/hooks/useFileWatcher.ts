import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessions';
import { useCampaignStore } from '../store/campaign';
import { useGenerationStore } from '../store/generation';

/**
 * Listens for fluid:file-change HMR custom events from the Vite dev server
 * and triggers a refresh of both sessions and the current campaign view.
 * Debounced to avoid excessive re-renders.
 *
 * PAUSES during active generation to prevent partial/in-progress files
 * from flickering in the UI. Resumes on generation complete/error.
 *
 * Campaign refresh: refetches the current view's data so new iterations
 * pushed by MCP tools appear without a manual reload.
 */
export function useFileWatcher() {
  const refreshSessions = useSessionStore((s) => s.refreshSessions);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handler = () => {
      // Don't refresh while generating — the completion effect handles it
      if (useGenerationStore.getState().status === 'generating') return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Refresh legacy session store (flat-file sessions)
        refreshSessions();

        // Refresh campaign data for the current view
        const campaignStore = useCampaignStore.getState();
        const { currentView, activeCampaignId, activeCreationId, activeSlideId } = campaignStore;

        switch (currentView) {
          case 'dashboard':
            campaignStore.fetchCampaigns();
            break;
          case 'campaign':
            if (activeCampaignId) {
              campaignStore.fetchCreations(activeCampaignId);
            }
            break;
          case 'creation':
            if (activeCreationId) {
              // Re-navigate to refresh slides + iterations for the unified creation view
              campaignStore.navigateToCreation(activeCreationId);
            }
            break;
        }
      }, 200);
    };

    import.meta.hot.on('fluid:file-change', handler);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshSessions]);
}
