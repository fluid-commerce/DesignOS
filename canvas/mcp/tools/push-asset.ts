import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PushAssetInput, PushAssetInputLegacy, PushAssetResult } from '../types.js';

/**
 * Push a newly generated HTML asset into the campaign hierarchy.
 *
 * Production path: POST /api/frames/:frameId/iterations via HTTP to Vite dev server.
 * Test path: set MCP_DB_API_PATH env var to the db-api module path for direct calls.
 *
 * HTML is written to:
 *   .fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html
 *
 * @param fluidDir  Root .fluid/ directory (parent of campaigns/)
 * @param input     Campaign-aware push input
 * @param apiBase   HTTP API base URL (default: http://localhost:5174)
 */
export async function pushAsset(
  fluidDir: string,
  input: PushAssetInput,
  apiBase = 'http://localhost:5174',
): Promise<PushAssetResult> {
  const {
    campaignId,
    assetId,
    frameId,
    html,
    iterationIndex,
    slotSchema,
    source = 'ai',
    templateId,
  } = input;

  // 1. POST to API to create iteration record in SQLite
  const url = `${apiBase}/api/frames/${frameId}/iterations`;
  const body: Record<string, unknown> = {
    iterationIndex: iterationIndex ?? 0,
    htmlPath: '', // Will be set after we know the iteration ID
    source,
  };
  if (slotSchema) body.slotSchema = slotSchema;
  if (templateId) body.templateId = templateId;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `push_asset: API returned ${res.status} ${res.statusText}${text ? ': ' + text : ''}`,
    );
  }

  const iteration = (await res.json()) as { id: string; iterationIndex: number };
  const iterationId = iteration.id;

  // 2. Write HTML to disk at canonical path
  const htmlRelPath = `campaigns/${campaignId}/${assetId}/${frameId}/${iterationId}.html`;
  const htmlAbsPath = path.join(fluidDir, htmlRelPath);
  await mkdir(path.dirname(htmlAbsPath), { recursive: true });
  await writeFile(htmlAbsPath, html, 'utf-8');

  // 3. PATCH iteration to set the htmlPath now that we know the iteration ID
  //    (The API may accept htmlPath on POST; if not, a PATCH ensures it's set)
  //    We do a best-effort PATCH — if it fails we still return success.
  try {
    await fetch(`${apiBase}/api/iterations/${iterationId}/html-path`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlPath: htmlRelPath }),
    });
  } catch {
    // Non-fatal: the HTML is on disk even if the DB path isn't updated
    console.error(`[push_asset] Warning: failed to update htmlPath for iteration ${iterationId}`);
  }

  return {
    iterationId,
    htmlPath: htmlRelPath,
    message: `Asset pushed: iteration ${iterationId} for frame ${frameId}`,
  };
}

/**
 * Handle legacy V1 push_asset calls (sessionId + variationId style).
 * Logs a deprecation warning and returns an error response.
 * The MCP server should prefer the V2 campaign-aware API.
 */
export function handleLegacyPushAsset(input: PushAssetInputLegacy): never {
  throw new Error(
    `[push_asset] DEPRECATED: sessionId/variationId params are no longer supported. ` +
      `Please use campaignId/assetId/frameId instead. ` +
      `Legacy input: sessionId=${input.sessionId}, variationId=${input.variationId}`,
  );
}
