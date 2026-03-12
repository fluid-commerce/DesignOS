import type { Iteration } from '../../src/lib/campaign-types.js';
import type { VariationStatus } from '../types.js';

/**
 * Read statuses for all iterations in a frame from the SQLite API.
 * Returns a map of iterationId -> status.
 *
 * Production: GET /api/frames/:id/iterations via Vite dev server.
 *
 * @param frameId   Frame ID (frm_xxx)
 * @param apiBase   HTTP API base URL (default: http://localhost:5174)
 */
export async function readStatuses(
  frameId: string,
  apiBase = 'http://localhost:5174'
): Promise<Record<string, VariationStatus>> {
  const res = await fetch(`${apiBase}/api/frames/${frameId}/iterations`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `read_statuses: API returned ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    );
  }

  const iterations = (await res.json()) as Iteration[];
  const statuses: Record<string, VariationStatus> = {};
  for (const iteration of iterations) {
    statuses[iteration.id] = iteration.status;
  }
  return statuses;
}
