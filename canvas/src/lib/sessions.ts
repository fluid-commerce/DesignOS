import type { Lineage } from './types';

/**
 * Count variations in a lineage, supporting both Phase 2 and Phase 4 formats.
 */
export function countVariations(lineage: Lineage): number {
  if (lineage.rounds && lineage.rounds.length > 0) {
    // Phase 4: count all variations across all rounds
    return lineage.rounds.reduce((sum, round) => sum + round.variations.length, 0);
  }
  if (lineage.entries && lineage.entries.length > 0) {
    // Phase 2: each entry is one variation
    return lineage.entries.length;
  }
  return 0;
}

/**
 * Parse a lineage JSON string, returning null if invalid.
 */
export function parseLineage(json: string): Lineage | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.sessionId || !parsed.created || !parsed.platform) {
      return null;
    }
    return parsed as Lineage;
  } catch {
    return null;
  }
}
