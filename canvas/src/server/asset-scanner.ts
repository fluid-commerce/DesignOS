/**
 * Asset scanner: populates brand_assets table from the project assets/ directory on startup.
 * Uses INSERT OR IGNORE (relies on file_path UNIQUE constraint) for idempotent rescans.
 * Server-only module — never import from React components.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';

/** Map file extension to MIME type. */
function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':  return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg':  return 'image/svg+xml';
    case '.webp': return 'image/webp';
    case '.gif':  return 'image/gif';
    case '.ttf':  return 'font/ttf';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.otf':  return 'font/otf';
    default:      return 'application/octet-stream';
  }
}

/**
 * Scan the given assets directory and seed brand_assets with any new files.
 * Each top-level subdirectory is treated as a category (brushstrokes, fonts, etc.).
 * Skips hidden files and non-file entries. Uses INSERT OR IGNORE for idempotency.
 */
export async function scanAndSeedBrandAssets(assetsDir: string): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO brand_assets (id, name, category, file_path, mime_type, size_bytes, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let categories: string[];
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    categories = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);
  } catch {
    // Assets directory doesn't exist yet — nothing to scan
    return;
  }

  for (const category of categories) {
    const categoryDir = path.join(assetsDir, category);
    let files: import('node:fs').Dirent[];
    try {
      files = await fs.readdir(categoryDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const file of files) {
      // Skip hidden files and non-file entries (subdirectories within category dirs)
      if (file.name.startsWith('.') || !file.isFile()) continue;

      const filePath = `${category}/${file.name}`;
      const fullPath = path.join(categoryDir, file.name);
      const ext = path.extname(file.name);
      const name = path.basename(file.name, ext);

      let sizeBytes = 0;
      try {
        const stat = await fs.stat(fullPath);
        sizeBytes = stat.size;
      } catch {
        // Skip files we can't stat
        continue;
      }

      const mimeType = getMimeType(ext);

      stmt.run(
        nanoid(),
        name,
        category,
        filePath,
        mimeType,
        sizeBytes,
        '[]',
        Date.now()
      );
    }
  }
}
