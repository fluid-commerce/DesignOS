import type { CampaignAnnotation } from '../../src/lib/campaign-types.js';

/**
 * Read annotations for a specific iteration from the SQLite API.
 *
 * Production: GET /api/iterations/:id/annotations via Vite dev server.
 *
 * @param iterationId  Iteration ID (itr_xxx)
 * @param apiBase      HTTP API base URL (default: http://localhost:5174)
 */
export async function readAnnotations(
  iterationId: string,
  apiBase = 'http://localhost:5174'
): Promise<CampaignAnnotation[]> {
  const res = await fetch(`${apiBase}/api/iterations/${iterationId}/annotations`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `read_annotations: API returned ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    );
  }

  const data = (await res.json()) as CampaignAnnotation[];
  return data;
}
