import fs from 'node:fs/promises';
import path from 'node:path';
import type { Lineage, SessionSummary, SessionData, VariationFile, AnnotationFile } from './types';

// Session directory pattern: YYYYMMDD-HHMMSS
const SESSION_DIR_PATTERN = /^\d{8}-\d{6}$/;

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

/**
 * Discover all sessions in the working directory.
 * Returns SessionSummary[] sorted newest-first.
 */
export async function discoverSessions(workingDir: string): Promise<SessionSummary[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(workingDir);
  } catch {
    return [];
  }

  const sessionDirs = entries.filter((e) => SESSION_DIR_PATTERN.test(e));
  const sessions: SessionSummary[] = [];

  for (const dir of sessionDirs) {
    const lineagePath = path.join(workingDir, dir, 'lineage.json');
    try {
      const raw = await fs.readFile(lineagePath, 'utf-8');
      const lineage = parseLineage(raw);
      if (!lineage) continue;

      // Check for annotations
      const annotationsPath = path.join(workingDir, dir, 'annotations.json');
      let hasAnnotations = false;
      try {
        await fs.access(annotationsPath);
        hasAnnotations = true;
      } catch {
        // No annotations file
      }

      const latestRound = lineage.rounds
        ? Math.max(...lineage.rounds.map((r) => r.roundNumber), 0)
        : 0;

      sessions.push({
        id: dir,
        created: lineage.created,
        platform: lineage.platform,
        variationCount: countVariations(lineage),
        hasAnnotations,
        latestRound,
      });
    } catch {
      // Skip directories without valid lineage.json
    }
  }

  // Sort newest first
  sessions.sort((a, b) => b.created.localeCompare(a.created));
  return sessions;
}

/**
 * Load a session's full data including HTML file contents.
 */
export async function loadSession(workingDir: string, sessionId: string): Promise<SessionData | null> {
  const sessionDir = path.join(workingDir, sessionId);

  // Read lineage
  let lineage: Lineage;
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'lineage.json'), 'utf-8');
    const parsed = parseLineage(raw);
    if (!parsed) return null;
    lineage = parsed;
  } catch {
    return null;
  }

  // Read annotations if present
  let annotations: AnnotationFile | null = null;
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'annotations.json'), 'utf-8');
    annotations = JSON.parse(raw) as AnnotationFile;
  } catch {
    // No annotations
  }

  // Find HTML variation files
  const variations = await findVariationFiles(sessionDir);

  return {
    id: sessionId,
    lineage,
    variations,
    annotations,
  };
}

/**
 * Find all HTML variation files in a session directory.
 * Looks for styled.html in subdirectories (v1/, v2/, etc.) and root.
 */
async function findVariationFiles(sessionDir: string): Promise<VariationFile[]> {
  const variations: VariationFile[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(sessionDir);
  } catch {
    return variations;
  }

  for (const entry of entries) {
    const entryPath = path.join(sessionDir, entry);
    const stat = await fs.stat(entryPath).catch(() => null);

    if (stat?.isDirectory()) {
      // Check for styled.html in subdirectory
      const htmlPath = path.join(entryPath, 'styled.html');
      try {
        const html = await fs.readFile(htmlPath, 'utf-8');
        variations.push({ path: `${entry}/styled.html`, html, name: entry });
      } catch {
        // No styled.html in this subdirectory
      }
    } else if (entry.endsWith('.html') && entry !== 'index.html') {
      // Root-level HTML files
      try {
        const html = await fs.readFile(entryPath, 'utf-8');
        variations.push({ path: entry, html, name: entry.replace('.html', '') });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return variations;
}
