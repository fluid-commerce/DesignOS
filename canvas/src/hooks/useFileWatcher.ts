import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessions';

/**
 * Listens for fluid:file-change HMR custom events from the Vite dev server
 * and triggers a session refresh. Debounced to avoid excessive re-renders.
 */
export function useFileWatcher() {
  const refreshSessions = useSessionStore((s) => s.refreshSessions);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        refreshSessions();
      }, 200);
    };

    import.meta.hot.on('fluid:file-change', handler);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // HMR API doesn't have off(), cleanup happens on module dispose
    };
  }, [refreshSessions]);
}
