/**
 * DAM sync runner: downloads brand assets from Fluid DAM and upserts into brand_assets table.
 *
 * Server-only module — NEVER import from React components or client code.
 *
 * Usage:
 *   runDamSync(token, assetsDir)  — called on startup and via POST /api/dam-sync
 *
 * Strategy:
 *   1. Decode company ID from token JWT payload
 *   2. Fetch all assets from Brand Elements folder via /dam/query (paginated)
 *   3. For each asset with a CDN URL: download to disk + upsert into brand_assets
 *   4. Soft-delete assets no longer present in the DAM folder
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { listBrandElements, getCompanyIdFromToken, type RawDamAsset } from './dam-client';
import { upsertDamAsset, softDeleteRemovedDamAssets, type DamAssetRow } from './db-api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DamSyncResult {
  synced: number;
  skipped: number;
  softDeleted: number;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize a filename: lowercase, replace non-alphanumeric chars (except dots/hyphens) with underscores.
 */
export function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-]/g, '_');
}

/**
 * Extract MIME type from a URL by inspecting the file extension in the path.
 */
export function getMimeTypeFromUrl(url: string): string {
  // Extract the path portion (before any query string) and get the extension
  const urlPath = url.split('?')[0];
  const ext = path.extname(urlPath).toLowerCase();
  switch (ext) {
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
 * Download a file from a CDN URL (no auth needed) to the given destination path.
 * Creates parent directories as needed.
 * Returns the byte count of the downloaded file.
 */
export async function downloadAsset(url: string, destPath: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed for ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, Buffer.from(arrayBuffer));
  return arrayBuffer.byteLength;
}

// ─── Main Sync Function ───────────────────────────────────────────────────────

/**
 * Run a full DAM sync cycle:
 *   1. List all Brand Elements assets from Fluid DAM
 *   2. Download each asset to {assetsDir}/dam/{code}-{sanitizedName}{ext}
 *   3. Upsert each asset into brand_assets table (incremental: skip unchanged)
 *   4. Soft-delete assets no longer in the DAM folder
 *
 * Never throws — all errors are captured in the result.errors array.
 * Designed to be called fire-and-forget on Vite startup.
 *
 * @param token    - VITE_FLUID_DAM_TOKEN JWT Bearer token
 * @param assetsDir - Absolute path to the project assets/ directory
 */
export async function runDamSync(token: string, assetsDir: string): Promise<DamSyncResult> {
  const result: DamSyncResult = {
    synced: 0,
    skipped: 0,
    softDeleted: 0,
    errors: [],
  };

  try {
    // Step 1: Decode company ID from token
    const companyId = getCompanyIdFromToken(token);

    // Step 2: Fetch all assets from Brand Elements folder
    const assets = await listBrandElements(token, companyId);

    // Step 3: Download and upsert each asset
    const damDir = path.join(assetsDir, 'dam');
    await fs.mkdir(damDir, { recursive: true });

    const seenCodes = new Set<string>();

    for (const asset of assets as RawDamAsset[]) {
      try {
        // Only process assets with a CDN download URL
        if (!asset.default_variant_url) {
          result.skipped++;
          continue;
        }

        seenCodes.add(asset.code);

        // Build filename: {code}-{sanitizedName}{ext}
        // Using code prefix ensures uniqueness even when display names collide
        const urlPath = asset.default_variant_url.split('?')[0];
        const ext = path.extname(urlPath);
        const filename = `${asset.code}-${sanitizeFilename(asset.name)}${ext}`;
        const filePath = `dam/${filename}`;
        const destPath = path.join(assetsDir, 'dam', filename);

        // Download asset to disk
        let sizeBytes: number;
        try {
          sizeBytes = await downloadAsset(asset.default_variant_url, destPath);
        } catch (downloadErr) {
          result.errors.push(`Download error for ${asset.code}: ${String(downloadErr)}`);
          result.skipped++;
          continue;
        }

        // Build the DB row
        const row: DamAssetRow = {
          damId: asset.code,
          name: asset.name,
          category: asset.category || 'dam',
          filePath,
          mimeType: getMimeTypeFromUrl(asset.default_variant_url),
          sizeBytes,
          damUrl: asset.default_variant_url,
          damModifiedAt: asset.updated_at,
        };

        upsertDamAsset(row);
        result.synced++;
      } catch (assetErr) {
        result.errors.push(`Asset error for ${asset.code ?? 'unknown'}: ${String(assetErr)}`);
        result.skipped++;
      }
    }

    // Step 4: Soft-delete assets no longer in DAM folder
    result.softDeleted = softDeleteRemovedDamAssets(seenCodes);
  } catch (err) {
    result.errors.push(`DAM sync failed: ${String(err)}`);
  }

  return result;
}
