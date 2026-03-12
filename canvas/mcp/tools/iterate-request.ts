/**
 * iterate-request.ts — SQLite-backed iteration request tool.
 *
 * Signals that the agent wants another iteration round on a frame,
 * using a specific winner iteration as the base.
 *
 * In the old flat-file system this wrote an iterate-request.json file.
 * Now it records the intent via the HTTP API.
 */

export interface IterateRequestResult {
  frameId: string;
  winnerId: string;
  feedback: string;
  message: string;
}

/**
 * Create an iterate request via the SQLite API.
 *
 * Production: POST /api/frames/:frameId/iterate-request
 *
 * @param frameId   Frame to iterate on
 * @param feedback  Human feedback for the next generation
 * @param winnerId  ID of the winning iteration to base the next round on
 * @param apiBase   HTTP API base URL (default: http://localhost:5174)
 */
export async function iterateRequest(
  frameId: string,
  feedback: string,
  winnerId: string,
  apiBase = 'http://localhost:5174'
): Promise<IterateRequestResult> {
  const res = await fetch(`${apiBase}/api/frames/${frameId}/iterate-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback, winnerId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `iterate_request: API returned ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    );
  }

  return {
    frameId,
    winnerId,
    feedback,
    message: `Iterate request created for frame ${frameId}, winner ${winnerId}`,
  };
}
