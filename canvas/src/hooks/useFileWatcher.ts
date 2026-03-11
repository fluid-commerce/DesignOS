import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessions';
import { useGenerationStore } from '../store/generation';

/**
 * Listens for fluid:file-change HMR custom events from the Vite dev server
 * and triggers a session refresh. Debounced to avoid excessive re-renders.
 *
 * PAUSES during active generation to prevent partial/in-progress files
 * from flickering in the UI. Resumes on generation complete/error.
 */
export function useFileWatcher() {
  const refreshSessions = useSessionStore((s) => s.refreshSessions);
  const generationStatus = useGenerationStore((s) => s.status);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handler = () => {
      // Don't refresh while generating — the completion effect handles it
      if (useGenerationStore.getState().status === 'generating') return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        refreshSessions();
      }, 200);
    };

    import.meta.hot.on('fluid:file-change', handler);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshSessions]);
}
