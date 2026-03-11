import { readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { IterateRequest } from '../types.js';

/**
 * Read a pending iteration request from the canvas UI.
 * The canvas writes iterate-request.json when a user clicks "Iterate".
 * After reading, renames the file to iterate-request-read.json to prevent re-reads.
 * Returns null if no pending request exists.
 */
export async function readIterationRequest(
  workingDir: string,
  sessionId: string
): Promise<IterateRequest | null> {
  const requestPath = path.join(workingDir, sessionId, 'iterate-request.json');
  const readPath = path.join(workingDir, sessionId, 'iterate-request-read.json');

  try {
    const raw = await readFile(requestPath, 'utf-8');
    const request = JSON.parse(raw) as IterateRequest;

    // Rename to mark as read
    await rename(requestPath, readPath);

    return request;
  } catch {
    // No pending request
    return null;
  }
}
