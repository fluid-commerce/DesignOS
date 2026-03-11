import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnnotationFile } from '../types.js';

/**
 * Read all annotations for a session.
 * Returns the full annotations array and statuses, or defaults if file doesn't exist.
 */
export async function readAnnotations(
  workingDir: string,
  sessionId: string
): Promise<AnnotationFile> {
  const annotationsPath = path.join(workingDir, sessionId, 'annotations.json');

  try {
    const raw = await readFile(annotationsPath, 'utf-8');
    const data = JSON.parse(raw) as AnnotationFile;
    return {
      sessionId: data.sessionId ?? sessionId,
      annotations: data.annotations ?? [],
      statuses: data.statuses ?? {},
    };
  } catch {
    // File doesn't exist or is malformed -- return empty defaults
    return {
      sessionId,
      annotations: [],
      statuses: {},
    };
  }
}
