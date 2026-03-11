import { readAnnotations } from './read-annotations.js';
import type { VariationStatus } from '../types.js';

/**
 * Read just the variation statuses for a session.
 * Returns a map of variation path -> status.
 * Useful for agents to quickly check which variation won.
 */
export async function readStatuses(
  workingDir: string,
  sessionId: string
): Promise<Record<string, VariationStatus>> {
  const annotationFile = await readAnnotations(workingDir, sessionId);
  return annotationFile.statuses;
}
