// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { getDb, closeDb } from '../lib/db';
import { getBrandAssets, upsertDamAsset, softDeleteRemovedDamAssets, type DamAssetRow } from '../server/db-api';
import { flattenDamTree, getCompanyIdFromToken, type RawDamAsset } from '../server/dam-client';
import { runDamSync } from '../server/dam-sync';

// ─── Test setup ───────────────────────────────────────────────────────────────

const testDir = path.join(os.tmpdir(), `dam-sync-test-${Date.now()}`);

beforeAll(async () => {
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  await fs.mkdir(testDir, { recursive: true });
  // Initialize DB (creates schema + migrations)
  getDb();
});

afterAll(async () => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  await fs.rm(testDir, { recursive: true, force: true });
});

// ─── Helper: create a minimal RawDamAsset ────────────────────────────────────

function makeDamAsset(overrides: Partial<RawDamAsset> = {}): RawDamAsset {
  return {
    id: 1,
    code: 'test-code-001',
    name: 'Test Asset',
    category: 'brand_elements',
    canonical_path: '123.brand_elements.test-code-001',
    default_variant_url: 'https://cdn.example.com/test.png',
    updated_at: '2024-01-01T00:00:00.000Z',
    variants: [{ id: 'v1', mime_type: 'image/png', processing_status: 'completed' }],
    ...overrides,
  };
}

// ─── flattenDamTree ───────────────────────────────────────────────────────────

describe('flattenDamTree', () => {
  it('extracts assets from nested tree', () => {
    const asset1 = makeDamAsset({ code: 'asset-001', name: 'Asset 1' });
    const asset2 = makeDamAsset({ code: 'asset-002', name: 'Asset 2' });
    const asset3 = makeDamAsset({ code: 'asset-003', name: 'Asset 3' });

    const tree = {
      folder1: {
        nested: asset1,
        deep: {
          veryDeep: asset2,
        },
      },
      topLevel: asset3,
    };

    const result = flattenDamTree(tree);
    expect(result).toHaveLength(3);
    expect(result.map(a => a.code)).toContain('asset-001');
    expect(result.map(a => a.code)).toContain('asset-002');
    expect(result.map(a => a.code)).toContain('asset-003');
  });

  it('handles empty tree', () => {
    const result = flattenDamTree({});
    expect(result).toEqual([]);
  });

  it('handles max depth — stops at depth 10', () => {
    // Build a 12-level deep nested object
    let current: Record<string, unknown> = { asset: makeDamAsset({ code: 'deep-asset' }) };
    for (let i = 0; i < 12; i++) {
      current = { level: current };
    }
    // Asset is at depth 12, beyond the cutoff of 10
    const result = flattenDamTree(current);
    // Should not find the asset since it's too deep
    expect(result.some(a => a.code === 'deep-asset')).toBe(false);
  });

  it('does not include non-asset objects (missing variants array)', () => {
    const notAnAsset = { code: 'foo', name: 'Foo', variants: 'not-an-array' };
    const asset = makeDamAsset({ code: 'real-asset' });
    const tree = { folder: { notAnAsset, asset } };
    const result = flattenDamTree(tree);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('real-asset');
  });
});

// ─── getCompanyIdFromToken ────────────────────────────────────────────────────

describe('getCompanyIdFromToken', () => {
  it('extracts company_id from JWT payload', () => {
    // Build a fake JWT: header.payload.signature
    const payload = { company_id: 12345, exp: 9999999999 };
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const fakeToken = `header.${b64Payload}.signature`;

    const result = getCompanyIdFromToken(fakeToken);
    expect(result).toBe(12345);
  });
});

// ─── upsertDamAsset ───────────────────────────────────────────────────────────

describe('upsertDamAsset', () => {
  it('inserts new DAM asset with source=dam', () => {
    const row: DamAssetRow = {
      damId: 'new-dam-asset-01',
      name: 'Logo PNG',
      category: 'brand_elements',
      filePath: 'dam/new-dam-asset-01-logo_png.png',
      mimeType: 'image/png',
      sizeBytes: 5000,
      damUrl: 'https://cdn.example.com/logo.png',
      damModifiedAt: '2024-01-01T00:00:00.000Z',
    };

    upsertDamAsset(row);

    const db = getDb();
    const saved = db.prepare(
      'SELECT source, dam_asset_id FROM brand_assets WHERE dam_asset_id = ?'
    ).get(row.damId) as { source: string; dam_asset_id: string } | undefined;

    expect(saved).toBeDefined();
    expect(saved!.source).toBe('dam');
    expect(saved!.dam_asset_id).toBe('new-dam-asset-01');
  });

  it('skips if dam_modified_at is unchanged', () => {
    const row: DamAssetRow = {
      damId: 'stable-asset-01',
      name: 'Stable Asset',
      category: 'brand_elements',
      filePath: 'dam/stable-asset-01-stable_asset.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      damUrl: 'https://cdn.example.com/stable.png',
      damModifiedAt: '2024-02-01T00:00:00.000Z',
    };

    // Insert initial row
    upsertDamAsset(row);
    const db = getDb();
    const before = db.prepare(
      'SELECT last_synced_at FROM brand_assets WHERE dam_asset_id = ?'
    ).get(row.damId) as { last_synced_at: number };

    // Wait briefly to ensure timestamps would differ if updated
    // Then call upsert again with same damModifiedAt — should skip
    upsertDamAsset({ ...row, name: 'Changed Name' });

    const after = db.prepare(
      'SELECT last_synced_at, name FROM brand_assets WHERE dam_asset_id = ?'
    ).get(row.damId) as { last_synced_at: number; name: string };

    // last_synced_at should not have changed (skipped)
    expect(after.last_synced_at).toBe(before.last_synced_at);
    // Name should NOT have been updated
    expect(after.name).toBe('Stable Asset');
  });

  it('updates if dam_modified_at is newer', () => {
    const row: DamAssetRow = {
      damId: 'updated-asset-01',
      name: 'Old Name',
      category: 'brand_elements',
      filePath: 'dam/updated-asset-01-old_name.png',
      mimeType: 'image/png',
      sizeBytes: 2000,
      damUrl: 'https://cdn.example.com/updated.png',
      damModifiedAt: '2024-01-01T00:00:00.000Z',
    };

    // Insert with old date
    upsertDamAsset(row);

    // Update with newer date
    upsertDamAsset({
      ...row,
      name: 'New Name',
      damModifiedAt: '2024-06-01T00:00:00.000Z',
    });

    const db = getDb();
    const saved = db.prepare(
      'SELECT name FROM brand_assets WHERE dam_asset_id = ?'
    ).get(row.damId) as { name: string };

    expect(saved.name).toBe('New Name');
  });

  it('clears dam_deleted=1 on re-sync (resurrects soft-deleted asset)', () => {
    const row: DamAssetRow = {
      damId: 'resurrection-asset-01',
      name: 'Resurrection Asset',
      category: 'brand_elements',
      filePath: 'dam/resurrection-asset-01-resurrection_asset.png',
      mimeType: 'image/png',
      sizeBytes: 3000,
      damUrl: 'https://cdn.example.com/resurrection.png',
      damModifiedAt: '2024-01-01T00:00:00.000Z',
    };

    // Insert asset
    upsertDamAsset(row);

    // Soft-delete it
    const db = getDb();
    db.prepare(
      'UPDATE brand_assets SET dam_deleted = 1 WHERE dam_asset_id = ?'
    ).run(row.damId);

    // Now upsert with a newer modified date — should clear dam_deleted
    upsertDamAsset({
      ...row,
      damModifiedAt: '2024-12-01T00:00:00.000Z',
    });

    const saved = db.prepare(
      'SELECT dam_deleted FROM brand_assets WHERE dam_asset_id = ?'
    ).get(row.damId) as { dam_deleted: number };

    expect(saved.dam_deleted).toBe(0);
  });
});

// ─── softDeleteRemovedDamAssets ───────────────────────────────────────────────

describe('softDeleteRemovedDamAssets', () => {
  it('marks missing assets as dam_deleted=1', () => {
    const base: DamAssetRow = {
      damId: '',
      name: 'Asset',
      category: 'brand_elements',
      filePath: 'dam/placeholder.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      damUrl: 'https://cdn.example.com/placeholder.png',
      damModifiedAt: '2024-01-01T00:00:00.000Z',
    };

    // Insert 3 assets
    upsertDamAsset({ ...base, damId: 'delete-test-A', filePath: 'dam/delete-test-a.png' });
    upsertDamAsset({ ...base, damId: 'delete-test-B', filePath: 'dam/delete-test-b.png' });
    upsertDamAsset({ ...base, damId: 'delete-test-C', filePath: 'dam/delete-test-c.png' });

    // Soft-delete with only A and B still present (C is gone)
    const count = softDeleteRemovedDamAssets(new Set(['delete-test-A', 'delete-test-B']));

    // Should have soft-deleted exactly 1 row (C)
    expect(count).toBeGreaterThanOrEqual(1);

    const db = getDb();
    const rowC = db.prepare(
      'SELECT dam_deleted FROM brand_assets WHERE dam_asset_id = ?'
    ).get('delete-test-C') as { dam_deleted: number };
    expect(rowC.dam_deleted).toBe(1);

    // A and B should still be active
    const rowA = db.prepare(
      'SELECT dam_deleted FROM brand_assets WHERE dam_asset_id = ?'
    ).get('delete-test-A') as { dam_deleted: number };
    expect(rowA.dam_deleted).toBe(0);
  });

  it('does not touch local assets (source=local)', async () => {
    // Insert a local asset directly (no dam_asset_id)
    const db = getDb();
    const { nanoid } = await import('nanoid');
    const localId = nanoid();
    db.prepare(`
      INSERT INTO brand_assets (id, name, category, file_path, mime_type, size_bytes, tags, created_at)
      VALUES (?, 'Local Asset', 'brushstrokes', 'brushstrokes/local-test.png', 'image/png', 500, '[]', ?)
    `).run(localId, Date.now());

    // Soft-delete with empty set (all DAM assets gone)
    softDeleteRemovedDamAssets(new Set());

    // Local asset should be untouched (no dam_deleted column value change)
    const row = db.prepare(
      'SELECT dam_deleted FROM brand_assets WHERE id = ?'
    ).get(localId) as { dam_deleted: number | null };

    // dam_deleted defaults to 0 for local assets; should remain unchanged
    expect(row.dam_deleted == null || row.dam_deleted === 0).toBe(true);
  });
});

// ─── getBrandAssets excludes soft-deleted ────────────────────────────────────

describe('getBrandAssets excludes dam_deleted rows', () => {
  it('does not return assets with dam_deleted=1', () => {
    const row: DamAssetRow = {
      damId: 'hidden-asset-01',
      name: 'Hidden Asset',
      category: 'brand_elements',
      filePath: 'dam/hidden-asset-01-hidden_asset.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      damUrl: 'https://cdn.example.com/hidden.png',
      damModifiedAt: '2024-01-01T00:00:00.000Z',
    };
    upsertDamAsset(row);

    // Soft-delete it
    const db = getDb();
    db.prepare(
      'UPDATE brand_assets SET dam_deleted = 1 WHERE dam_asset_id = ?'
    ).run(row.damId);

    const assets = getBrandAssets();
    expect(assets.some(a => a.name === 'Hidden Asset')).toBe(false);
  });
});

// ─── runDamSync ───────────────────────────────────────────────────────────────

describe('runDamSync', () => {
  it('handles offline DAM gracefully — returns result with errors, does not throw', async () => {
    // Mock global fetch to throw a network error
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch;

    const assetsDir = path.join(testDir, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    // Build a fake token that decodes correctly
    const payload = { company_id: 12345, exp: 9999999999 };
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const fakeToken = `header.${b64Payload}.signature`;

    // runDamSync must not throw — it captures errors internally
    const result = await runDamSync(fakeToken, assetsDir);

    // Should have captured the error instead of throwing
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('ECONNREFUSED');

    // Restore fetch
    global.fetch = originalFetch;
  });
});
