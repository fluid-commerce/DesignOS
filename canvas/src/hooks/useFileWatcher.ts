import { useEffect, useRef } from 'react';
import { useCampaignStore } from '../store/campaign';

/**
 * Listens for fluid:file-change HMR custom events from the Vite dev server
 * and triggers a refresh of the current campaign view.
 * Debounced to avoid excessive re-renders.
 *
 * Campaign refresh: refetches the current view's data so new iterations
 * pushed by MCP tools appear without a manual reload.
 */
export function useFileWatcher() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Refresh campaign data for the current view
        const campaignStore = useCampaignStore.getState();
        const { currentView, activeCampaignId, activeCreationId } = campaignStore;

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
  }, []);
}
