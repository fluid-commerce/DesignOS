/**
 * MCP Tools Unit Tests — SQLite/db-api behavior
 *
 * These tests call canvas/src/server/db-api.ts functions directly,
 * avoiding any dependency on a running Vite dev server.
 *
 * Each test suite sets FLUID_DB_PATH to an isolated temp file so DB state
 * is fully independent across test runs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ─── DB API helpers ─────────────────────────────────────────────────────────

// We import db-api lazily after setting FLUID_DB_PATH so the singleton
// initialises against the correct test database.

type DbApi = typeof import('../../src/server/db-api.js');

let dbApi: DbApi;
let tmpDir: string;
let dbPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'fluid-mcp-test-'));
  dbPath = path.join(tmpDir, 'test.db');
  process.env.FLUID_DB_PATH = dbPath;

  // Force fresh db singleton per test by clearing module cache via dynamic import
  // (Vitest re-imports when env var changes thanks to test isolation)
  const { closeDb } = await import('../../src/lib/db.js');
  closeDb();

  dbApi = await import('../../src/server/db-api.js');
});

afterEach(async () => {
  const { closeDb } = await import('../../src/lib/db.js');
  closeDb();
  delete process.env.FLUID_DB_PATH;
  await rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scaffoldCampaignHierarchy() {
  const campaign = dbApi.createCampaign({ title: 'Test Campaign', channels: ['instagram'] });
  const asset = dbApi.createAsset({
    campaignId: campaign.id,
    title: 'Test Asset',
    assetType: 'instagram-square',
    frameCount: 1,
  });
  const frame = dbApi.createFrame({ assetId: asset.id, frameIndex: 0 });
  return { campaign, asset, frame };
}

// ─── push_asset — creates Iteration in SQLite ─────────────────────────────

describe('push_asset (db-api layer)', () => {
  it('creates an Iteration record in SQLite via createIteration', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    const iteration = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: `campaigns/cmp/ast/${frame.id}/itr.html`,
      source: 'ai',
    });

    expect(iteration.id).toBeTruthy();
    expect(iteration.frameId).toBe(frame.id);
    expect(iteration.iterationIndex).toBe(0);
    expect(iteration.status).toBe('unmarked');
    expect(iteration.source).toBe('ai');
  });

  it('stores slotSchema as JSON and returns it parsed', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    const schema = { templateId: 't1-quote', width: 1080, height: 1080, fields: [] };
    const iteration = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'campaigns/c/a/f/i.html',
      slotSchema: schema,
      source: 'template',
      templateId: 't1-quote',
    });

    expect(iteration.slotSchema).toEqual(schema);
    expect(iteration.templateId).toBe('t1-quote');
  });

  it('multiple push_asset calls create separate iteration records', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'path/to/0.html',
      source: 'ai',
    });
    dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 1,
      htmlPath: 'path/to/1.html',
      source: 'ai',
    });

    const iterations = dbApi.getIterations(frame.id);
    expect(iterations).toHaveLength(2);
    expect(iterations[0].iterationIndex).toBe(0);
    expect(iterations[1].iterationIndex).toBe(1);
  });
});

// ─── read_annotations — returns annotations by iterationId ───────────────

describe('read_annotations (db-api layer)', () => {
  it('returns empty array when no annotations exist for an iteration', async () => {
    const { frame } = scaffoldCampaignHierarchy();
    const iteration = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'p.html',
      source: 'ai',
    });

    const annotations = dbApi.getAnnotations(iteration.id);
    expect(annotations).toEqual([]);
  });

  it('returns annotations linked to the correct iterationId', async () => {
    const { frame } = scaffoldCampaignHierarchy();
    const iter1 = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'p1.html',
      source: 'ai',
    });
    const iter2 = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 1,
      htmlPath: 'p2.html',
      source: 'ai',
    });

    dbApi.createAnnotation({
      iterationId: iter1.id,
      type: 'pin',
      author: 'human',
      text: 'Make headline bigger',
      x: 50,
      y: 20,
    });
    dbApi.createAnnotation({
      iterationId: iter2.id,
      type: 'sidebar',
      author: 'agent',
      text: 'Strong typography',
    });

    const ann1 = dbApi.getAnnotations(iter1.id);
    expect(ann1).toHaveLength(1);
    expect(ann1[0].text).toBe('Make headline bigger');
    expect(ann1[0].type).toBe('pin');
    expect(ann1[0].x).toBe(50);
    expect(ann1[0].y).toBe(20);

    const ann2 = dbApi.getAnnotations(iter2.id);
    expect(ann2).toHaveLength(1);
    expect(ann2[0].text).toBe('Strong typography');
  });
});

// ─── read_statuses — returns status map for frame's iterations ────────────

describe('read_statuses (db-api layer)', () => {
  it('returns status map keyed by iterationId', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    const iter1 = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'p1.html',
      source: 'ai',
    });
    const iter2 = dbApi.createIteration({
      frameId: frame.id,
      iterationIndex: 1,
      htmlPath: 'p2.html',
      source: 'ai',
    });

    dbApi.updateIterationStatus(iter1.id, 'winner');
    dbApi.updateIterationStatus(iter2.id, 'rejected');

    const iterations = dbApi.getIterations(frame.id);
    const statusMap: Record<string, string> = {};
    for (const iter of iterations) {
      statusMap[iter.id] = iter.status;
    }

    expect(statusMap[iter1.id]).toBe('winner');
    expect(statusMap[iter2.id]).toBe('rejected');
  });

  it('returns empty for a frame with no iterations', async () => {
    const { frame } = scaffoldCampaignHierarchy();
    const iterations = dbApi.getIterations(frame.id);
    expect(iterations).toHaveLength(0);
  });
});

// ─── read_history — returns full iteration chain ──────────────────────────

describe('read_history (db-api layer)', () => {
  it('returns all iterations for a frame in order', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    dbApi.createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'r0.html', source: 'ai' });
    dbApi.createIteration({ frameId: frame.id, iterationIndex: 1, htmlPath: 'r1.html', source: 'ai' });
    dbApi.createIteration({ frameId: frame.id, iterationIndex: 2, htmlPath: 'r2.html', source: 'ai' });

    const iterations = dbApi.getIterations(frame.id);
    expect(iterations).toHaveLength(3);
    expect(iterations.map(i => i.iterationIndex)).toEqual([0, 1, 2]);
  });

  it('can retrieve annotations for each iteration in the chain', async () => {
    const { frame } = scaffoldCampaignHierarchy();

    const iter0 = dbApi.createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'r0.html', source: 'ai' });
    const iter1 = dbApi.createIteration({ frameId: frame.id, iterationIndex: 1, htmlPath: 'r1.html', source: 'ai' });

    dbApi.createAnnotation({ iterationId: iter0.id, type: 'pin', author: 'human', text: 'Too dark', x: 10, y: 10 });
    dbApi.createAnnotation({ iterationId: iter1.id, type: 'sidebar', author: 'human', text: 'Perfect' });

    const ann0 = dbApi.getAnnotations(iter0.id);
    const ann1 = dbApi.getAnnotations(iter1.id);

    expect(ann0[0].text).toBe('Too dark');
    expect(ann1[0].text).toBe('Perfect');
  });
});

// ─── Backward compatibility — legacy sessionId params ────────────────────

describe('push_asset backward compatibility', () => {
  it('handleLegacyPushAsset throws a descriptive deprecation error', async () => {
    const { handleLegacyPushAsset } = await import('../tools/push-asset.js');

    expect(() =>
      handleLegacyPushAsset({
        sessionId: '20260310-143022',
        variationId: 'v1',
        html: '<html></html>',
      })
    ).toThrow(/DEPRECATED/);

    expect(() =>
      handleLegacyPushAsset({
        sessionId: '20260310-143022',
        variationId: 'v1',
        html: '<html></html>',
      })
    ).toThrow(/sessionId/);
  });
});
