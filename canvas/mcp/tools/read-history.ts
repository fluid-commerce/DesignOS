import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readAnnotations } from './read-annotations.js';
import type { Lineage, LegacyLineage, Round, RevisionHistory } from '../types.js';

/**
 * Read the full revision history for a session, combining lineage and annotation data.
 * Handles both Phase 4 (rounds[]) and Phase 2 (entries[]) lineage formats.
 * This is the tool agents use to avoid repeating rejected patterns.
 */
export async function readHistory(
  workingDir: string,
  sessionId: string
): Promise<RevisionHistory> {
  const lineagePath = path.join(workingDir, sessionId, 'lineage.json');
  const annotationData = await readAnnotations(workingDir, sessionId);

  let rounds: Round[] = [];
  let created = '';
  let platform = 'unknown';

  try {
    const raw = await readFile(lineagePath, 'utf-8');
    const lineage = JSON.parse(raw);

    created = lineage.created ?? '';
    platform = lineage.platform ?? 'unknown';

    if (lineage.rounds && Array.isArray(lineage.rounds)) {
      // Phase 4 format
      rounds = lineage.rounds as Round[];
    } else if (lineage.entries && Array.isArray(lineage.entries)) {
      // Phase 2 legacy format -- convert entries[] to a single round
      const legacy = lineage as LegacyLineage;
      rounds = [
        {
          roundNumber: 1,
          prompt: '',
          variations: legacy.entries.map((entry, i) => ({
            id: `v${i + 1}`,
            path: entry.file ?? '',
            status: 'unmarked' as const,
            specCheck: 'draft' as const,
          })),
          winnerId: null,
          timestamp: legacy.created ?? '',
        },
      ];
    }
  } catch {
    // No lineage file -- return empty history
  }

  return {
    sessionId,
    created,
    platform,
    rounds,
    annotations: annotationData.annotations,
    statuses: annotationData.statuses,
  };
}
