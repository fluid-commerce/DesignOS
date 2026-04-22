import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface SavedAsset {
  id: string;
  url: string;
  name: string | null;
  mimeType?: string | null;
  source?: 'dam' | 'upload';
  createdAt?: number;
}

async function fetchAssets(): Promise<SavedAsset[]> {
  const res = await fetch('/api/assets');
  if (!res.ok) throw new Error('Failed to load assets');
  const data = await res.json();
  return Array.isArray(data) ? (data as SavedAsset[]) : [];
}

/**
 * Shared hook for /api/assets. Uses @tanstack/react-query for dedup, caching,
 * and invalidation. Call `invalidate()` to re-fetch (e.g. after adding/removing).
 *
 * Return shape is unchanged: { assets, loading, error, invalidate }
 */
export function useAssets() {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['assets'], queryFn: fetchAssets });
  return {
    assets: q.data ?? [],
    loading: q.isPending,
    error: q.error ? (q.error instanceof Error ? q.error.message : String(q.error)) : null,
    invalidate: () => client.invalidateQueries({ queryKey: ['assets'] }),
  };
}
