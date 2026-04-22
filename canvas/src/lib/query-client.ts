import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Match current useAssets behavior: fetch on mount, cache across
      // consumers, re-fetch only when invalidate() is called.
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
