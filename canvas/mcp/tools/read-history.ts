import type { Iteration, CampaignAnnotation } from '../../src/lib/campaign-types.js';

/** Full iteration history for a frame, returned by read_history */
export interface FrameHistory {
  frameId: string;
  iterations: Iteration[];
  /** Flat list of all annotations across all iterations in this frame */
  annotations: CampaignAnnotation[];
  /** Map of iterationId -> status */
  statuses: Record<string, Iteration['status']>;
}

/**
 * Read the full iteration chain for a frame from the SQLite API.
 * Also collects all annotations across all iterations.
 *
 * Production: GET /api/frames/:id/iterations + GET /api/iterations/:id/annotations
 *
 * @param frameId   Frame ID (frm_xxx)
 * @param apiBase   HTTP API base URL (default: http://localhost:5174)
 */
export async function readHistory(
  frameId: string,
  apiBase = 'http://localhost:5174'
): Promise<FrameHistory> {
  // 1. Get all iterations for the frame
  const iterRes = await fetch(`${apiBase}/api/frames/${frameId}/iterations`);
  if (!iterRes.ok) {
    const text = await iterRes.text().catch(() => '');
    throw new Error(
      `read_history: API returned ${iterRes.status} ${iterRes.statusText}${text ? ': ' + text : ''}`
    );
  }
  const iterations = (await iterRes.json()) as Iteration[];

  // 2. Collect annotations for each iteration (parallel fetch)
  const annotationArrays = await Promise.all(
    iterations.map(async (iter) => {
      const aRes = await fetch(`${apiBase}/api/iterations/${iter.id}/annotations`);
      if (!aRes.ok) return [] as CampaignAnnotation[];
      return (await aRes.json()) as CampaignAnnotation[];
    })
  );

  const annotations = annotationArrays.flat();

  // 3. Build status map
  const statuses: Record<string, Iteration['status']> = {};
  for (const iter of iterations) {
    statuses[iter.id] = iter.status;
  }

  return { frameId, iterations, annotations, statuses };
}
