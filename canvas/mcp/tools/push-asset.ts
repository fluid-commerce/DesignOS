import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PushAssetInput, Lineage, Round, Variation } from '../types.js';

/**
 * Push a newly generated asset to .fluid/working/{sessionId}/{variationId}/styled.html.
 * Creates or updates lineage.json with the new variation entry.
 */
export async function pushAsset(
  workingDir: string,
  input: PushAssetInput
): Promise<{ filePath: string; message: string }> {
  const { sessionId, variationId, html, platform } = input;

  const sessionDir = path.join(workingDir, sessionId);
  const variationDir = path.join(sessionDir, variationId);
  const htmlPath = path.join(variationDir, 'styled.html');

  // Create directories
  await mkdir(variationDir, { recursive: true });

  // Write HTML
  await writeFile(htmlPath, html, 'utf-8');

  // Create or update lineage.json
  const lineagePath = path.join(sessionDir, 'lineage.json');
  let lineage: Lineage;

  try {
    const existing = await readFile(lineagePath, 'utf-8');
    lineage = JSON.parse(existing) as Lineage;
  } catch {
    // Create new lineage
    lineage = {
      sessionId,
      created: new Date().toISOString(),
      platform: platform ?? 'unknown',
      product: null,
      template: null,
      rounds: [],
    };
  }

  // Ensure rounds array exists (handle legacy format)
  if (!lineage.rounds) {
    lineage.rounds = [];
  }

  // Find or create the current round
  let currentRound = lineage.rounds[lineage.rounds.length - 1];
  if (!currentRound || currentRound.winnerId !== null) {
    // Start a new round if none exists or last round has a winner
    const newRound: Round = {
      roundNumber: lineage.rounds.length + 1,
      prompt: '',
      variations: [],
      winnerId: null,
      timestamp: new Date().toISOString(),
    };
    lineage.rounds.push(newRound);
    currentRound = newRound;
  }

  // Add variation if not already present
  const relativePath = `${variationId}/styled.html`;
  const existingVar = currentRound.variations.find(v => v.id === variationId);
  if (!existingVar) {
    const variation: Variation = {
      id: variationId,
      path: relativePath,
      status: 'unmarked',
      specCheck: 'draft',
    };
    currentRound.variations.push(variation);
  }

  await writeFile(lineagePath, JSON.stringify(lineage, null, 2), 'utf-8');

  return {
    filePath: htmlPath,
    message: `Asset pushed: ${sessionId}/${variationId}/styled.html`,
  };
}
