// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../lib/db';
import { getBrandAssets } from '../server/db-api';
import { scanAndSeedBrandAssets } from '../server/asset-scanner';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const testDir = path.join(os.tmpdir(), `brand-assets-test-${Date.now()}`);

beforeAll(async () => {
  // Set up temp DB
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  await fs.mkdir(testDir, { recursive: true });

  // Create mock assets directory
  const assetsDir = path.join(testDir, 'assets');
  await fs.mkdir(path.join(assetsDir, 'brushstrokes'), { recursive: true });
  await fs.mkdir(path.join(assetsDir, 'fonts'), { recursive: true });
  await fs.writeFile(path.join(assetsDir, 'brushstrokes', 'brush-01.png'), 'fake-png');
  await fs.writeFile(path.join(assetsDir, 'brushstrokes', 'brush-02.png'), 'fake-png-2');
  await fs.writeFile(path.join(assetsDir, 'fonts', 'flfontbold.ttf'), 'fake-font');

  // Init DB and scan
  getDb();
  await scanAndSeedBrandAssets(assetsDir);
});

afterAll(async () => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('brand_assets DB and API', () => {
  it('scanAndSeedBrandAssets populates brand_assets table', () => {
    const all = getBrandAssets();
    expect(all.length).toBe(3);
  });

  it('getBrandAssets filters by category', () => {
    const brushes = getBrandAssets('brushstrokes');
    expect(brushes.length).toBe(2);
    expect(brushes[0].category).toBe('brushstrokes');
  });

  it('getBrandAssets returns /fluid-assets/ URLs', () => {
    const all = getBrandAssets();
    for (const asset of all) {
      expect(asset.url).toMatch(/^\/fluid-assets\//);
    }
  });

  it('rescan is idempotent (INSERT OR IGNORE)', async () => {
    const assetsDir = path.join(testDir, 'assets');
    await scanAndSeedBrandAssets(assetsDir);
    const all = getBrandAssets();
    expect(all.length).toBe(3); // no duplicates
  });

  it('BrandAsset has required fields', () => {
    const [first] = getBrandAssets('fonts');
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('category', 'fonts');
    expect(first).toHaveProperty('url');
    expect(first).toHaveProperty('mimeType');
    expect(first).toHaveProperty('sizeBytes');
    expect(first).toHaveProperty('tags');
    expect(Array.isArray(first.tags)).toBe(true);
  });
});
