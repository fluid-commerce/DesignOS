/**
 * Unit tests for `rewriteAssetUrls` — the pure URL-rewriting helper
 * extracted from `renderPreview`. These tests DO NOT launch Chromium;
 * they exercise just the string transformation + DB lookup logic.
 *
 * Covers the fix for the silent-mask-image-failure bug:
 *   - Resolvable assets produce a file:// URL.
 *   - Unresolvable asset names fall back to a transparent 1x1 PNG data URL
 *     (instead of a bogus file:// path that Chromium would fail to load
 *     with no useful signal).
 *   - Leftover /api/brand-assets/ URLs the rewriter doesn't recognize are
 *     surfaced in `leftoverApiUrls` for diagnostic logging.
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';

import { closeDb, getDb } from '../lib/db';
import {
  rewriteAssetUrls,
  TRANSPARENT_PNG_DATA_URL,
} from '../server/render-engine';

let tempRoot: string;
const ASSETS_DIR = '/tmp/fake-assets-dir-for-test';

function insertAsset(name: string, filePath: string, category = 'decorations'): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO brand_assets (id, name, category, file_path, mime_type, size_bytes, tags, source, dam_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(nanoid(10), name, category, filePath, 'image/png', 1024, JSON.stringify([]), 'scan', now);
}

beforeAll(() => {
  closeDb();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'render-engine-mask-test-'));
  process.env.FLUID_DB_PATH = path.join(tempRoot, 'test.db');
  // Touch the DB so schema is created, then seed fixtures.
  getDb();
  insertAsset('brush-01', 'brushstrokes/brush-01.png');
  insertAsset('logo-primary', 'logos/logo-primary.png', 'logos');
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {}
});

describe('TRANSPARENT_PNG_DATA_URL', () => {
  it('is a well-formed PNG data URL', () => {
    expect(TRANSPARENT_PNG_DATA_URL.startsWith('data:image/png;base64,iVBOR')).toBe(true);
    // A 1x1 transparent PNG is ~110 chars including the data: prefix.
    expect(TRANSPARENT_PNG_DATA_URL.length).toBeGreaterThan(100);
    expect(TRANSPARENT_PNG_DATA_URL.length).toBeLessThan(140);
  });
});

describe('rewriteAssetUrls — resolvable asset', () => {
  it('rewrites /api/brand-assets/serve/{name} to file:// URL when DB has the asset', () => {
    const html = `<style>.x { mask-image: url('/api/brand-assets/serve/brush-01'); }</style>`;
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.html).toContain(`file://${ASSETS_DIR}/brushstrokes/brush-01.png`);
    expect(result.html).not.toContain('/api/brand-assets/serve/');
    expect(result.unresolved).toEqual([]);
    expect(result.leftoverApiUrls).toEqual([]);
  });
});

describe('rewriteAssetUrls — unresolvable asset', () => {
  it('falls back to transparent PNG data URL and records the name as unresolved', () => {
    const html = `<style>.x { mask-image: url('/api/brand-assets/serve/does-not-exist'); }</style>`;
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.html).toContain(TRANSPARENT_PNG_DATA_URL);
    expect(result.html).not.toContain('/api/brand-assets/serve/');
    expect(result.unresolved).toEqual(['does-not-exist']);
    // Transparent PNG is a data: URL, not a /api/ URL, so no leftovers.
    expect(result.leftoverApiUrls).toEqual([]);
  });
});

describe('rewriteAssetUrls — mixed resolvable + unresolvable', () => {
  it('rewrites resolvable to file:// and unresolvable to transparent PNG', () => {
    const html = [
      `<style>`,
      `.a { mask-image: url('/api/brand-assets/serve/brush-01'); }`,
      `.b { mask-image: url('/api/brand-assets/serve/missing-asset'); }`,
      `.c { background-image: url('/api/brand-assets/serve/logo-primary'); }`,
      `</style>`,
    ].join('\n');
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.html).toContain(`file://${ASSETS_DIR}/brushstrokes/brush-01.png`);
    expect(result.html).toContain(`file://${ASSETS_DIR}/logos/logo-primary.png`);
    expect(result.html).toContain(TRANSPARENT_PNG_DATA_URL);
    expect(result.html).not.toContain('/api/brand-assets/serve/');

    expect(result.unresolved).toEqual(['missing-asset']);
    expect(result.leftoverApiUrls).toEqual([]);
  });
});

describe('rewriteAssetUrls — no brand-asset references', () => {
  it('returns HTML with only /fluid-assets/ rewritten and empty diagnostic arrays', () => {
    const html = `<style>.x { background-image: url('/fluid-assets/fonts/inter.woff2'); color: red; }</style>`;
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.html).toContain(`file://${ASSETS_DIR}/fonts/inter.woff2`);
    expect(result.unresolved).toEqual([]);
    expect(result.leftoverApiUrls).toEqual([]);
  });

  it('passes HTML with no asset references through unchanged', () => {
    const html = `<!doctype html><html><body><h1 style="color:red">hi</h1></body></html>`;
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.html).toBe(html);
    expect(result.unresolved).toEqual([]);
    expect(result.leftoverApiUrls).toEqual([]);
  });
});

describe('rewriteAssetUrls — leftover /api/ URLs', () => {
  it('surfaces unrewritten /api/brand-assets/ URLs (different path shape) as leftovers', () => {
    // /api/brand-assets/metadata/foo is a different endpoint the rewriter
    // doesn't handle — it should be reported as a leftover for diagnostics.
    const html = `<img src="/api/brand-assets/metadata/foo" />`;
    const result = rewriteAssetUrls(html, ASSETS_DIR);

    expect(result.leftoverApiUrls.length).toBeGreaterThan(0);
    expect(result.leftoverApiUrls[0]).toContain('/api/brand-assets/metadata/foo');
  });
});
