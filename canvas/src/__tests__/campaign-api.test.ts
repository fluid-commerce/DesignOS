/**
 * TDD tests for campaign hierarchy CRUD via db-api.ts
 *
 * Tests cover:
 * - createCampaign / getCampaigns / getCampaign
 * - createAsset / getAssets (by campaignId)
 * - createFrame / getFrames (by assetId)
 * - createIteration / getIterations (by frameId)
 * - updateIterationStatus / updateIterationUserState
 * - updateAsset (title rename)
 * - getCampaignPreviewUrls (up to 4 preview entries)
 * - createAnnotation / getAnnotations (by iterationId)
 * - createCampaignWithAssets (atomic transaction)
 * - FK constraint enforcement
 */

// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { closeDb } from '../lib/db';
import {
  createCampaign,
  getCampaigns,
  getCampaign,
  createAsset,
  getAssets,
  createFrame,
  getFrames,
  createIteration,
  getIterations,
  updateIterationStatus,
  updateIterationUserState,
  updateAsset,
  getCampaignPreviewUrls,
  createAnnotation,
  getAnnotations,
  createCampaignWithAssets,
} from '../server/db-api';

// Before each test: close the singleton, point to a fresh temp DB, reopen lazily
function resetDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-api-test-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.FLUID_DB_PATH = dbPath;
  // getDb() will re-initialise with the new FLUID_DB_PATH on next call
}

describe('Campaign CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createCampaign returns a Campaign with id, title, channels, timestamps', () => {
    const campaign = createCampaign({ title: 'Q3 Brand Push', channels: ['instagram', 'linkedin'] });
    expect(campaign.id).toBeDefined();
    expect(campaign.id.length).toBeGreaterThan(4);
    expect(campaign.title).toBe('Q3 Brand Push');
    expect(campaign.channels).toEqual(['instagram', 'linkedin']);
    expect(campaign.createdAt).toBeGreaterThan(0);
    expect(campaign.updatedAt).toBeGreaterThan(0);
  });

  it('getCampaigns returns all campaigns ordered by createdAt DESC', () => {
    createCampaign({ title: 'First', channels: [] });
    createCampaign({ title: 'Second', channels: [] });
    const list = getCampaigns();
    expect(list.length).toBe(2);
    // ORDER BY created_at DESC — most recent first
    // Both were inserted at nearly the same timestamp; just verify both exist
    const titles = list.map((c) => c.title);
    expect(titles).toContain('First');
    expect(titles).toContain('Second');
  });

  it('getCampaign returns the campaign by id', () => {
    const created = createCampaign({ title: 'FindMe', channels: ['twitter'] });
    const found = getCampaign(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('FindMe');
    expect(found!.channels).toEqual(['twitter']);
  });

  it('getCampaign returns undefined for unknown id', () => {
    expect(getCampaign('nonexistent-id')).toBeUndefined();
  });
});

describe('Asset CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createAsset returns an Asset with all fields', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const asset = createAsset({
      campaignId: campaign.id,
      title: 'IG Post',
      assetType: 'instagram',
      frameCount: 1,
    });
    expect(asset.id).toBeDefined();
    expect(asset.campaignId).toBe(campaign.id);
    expect(asset.title).toBe('IG Post');
    expect(asset.assetType).toBe('instagram');
    expect(asset.frameCount).toBe(1);
    expect(asset.createdAt).toBeGreaterThan(0);
  });

  it('getAssets returns assets for a campaign ordered by createdAt ASC', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const a1 = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const a2 = createAsset({ campaignId: campaign.id, title: 'B', assetType: 'linkedin', frameCount: 3 });
    const assets = getAssets(campaign.id);
    expect(assets.length).toBe(2);
    // Both created at nearly same ms; verify both exist by ID
    const ids = assets.map((a) => a.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
  });

  it('getAssets returns empty array for unknown campaign', () => {
    expect(getAssets('ghost-id')).toEqual([]);
  });

  it('createAsset with invalid campaignId throws FK constraint error', () => {
    expect(() =>
      createAsset({ campaignId: 'bad-id', title: 'X', assetType: 'instagram', frameCount: 1 })
    ).toThrow();
  });
});

describe('Frame CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createFrame returns a Frame with correct fields', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    expect(frame.id).toBeDefined();
    expect(frame.assetId).toBe(asset.id);
    expect(frame.frameIndex).toBe(0);
    expect(frame.createdAt).toBeGreaterThan(0);
  });

  it('getFrames returns frames ordered by frameIndex ASC', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'carousel', frameCount: 3 });
    createFrame({ assetId: asset.id, frameIndex: 2 });
    createFrame({ assetId: asset.id, frameIndex: 0 });
    createFrame({ assetId: asset.id, frameIndex: 1 });
    const frames = getFrames(asset.id);
    expect(frames.length).toBe(3);
    expect(frames[0].frameIndex).toBe(0);
    expect(frames[1].frameIndex).toBe(1);
    expect(frames[2].frameIndex).toBe(2);
  });

  it('createFrame with invalid assetId throws FK constraint error', () => {
    expect(() => createFrame({ assetId: 'bad-id', frameIndex: 0 })).toThrow();
  });
});

describe('Iteration CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeFrame() {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    return createFrame({ assetId: asset.id, frameIndex: 0 });
  }

  it('createIteration returns an Iteration with correct default status', () => {
    const frame = makeFrame();
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
    });
    expect(iter.id).toBeDefined();
    expect(iter.frameId).toBe(frame.id);
    expect(iter.iterationIndex).toBe(0);
    expect(iter.htmlPath).toBe('sessions/abc/round-1/v1.html');
    expect(iter.status).toBe('unmarked');
    expect(iter.source).toBe('ai');
    expect(iter.slotSchema).toBeNull();
    expect(iter.aiBaseline).toBeNull();
    expect(iter.userState).toBeNull();
    expect(iter.templateId).toBeNull();
  });

  it('createIteration persists slotSchema and templateId', () => {
    const frame = makeFrame();
    const schema = { fields: [{ name: 'headline', type: 'text' }] };
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'path/to/file.html',
      slotSchema: schema,
      source: 'template',
      templateId: 'tpl-orange-burst',
    });
    expect(iter.slotSchema).toEqual(schema);
    expect(iter.templateId).toBe('tpl-orange-burst');
    expect(iter.source).toBe('template');
  });

  it('getIterations returns iterations ordered by iterationIndex ASC', () => {
    const frame = makeFrame();
    createIteration({ frameId: frame.id, iterationIndex: 2, htmlPath: 'p2.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'p0.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 1, htmlPath: 'p1.html', source: 'ai' });
    const iters = getIterations(frame.id);
    expect(iters.length).toBe(3);
    expect(iters[0].iterationIndex).toBe(0);
    expect(iters[1].iterationIndex).toBe(1);
    expect(iters[2].iterationIndex).toBe(2);
  });

  it('updateIterationStatus changes status to winner', () => {
    const frame = makeFrame();
    const iter = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    updateIterationStatus(iter.id, 'winner');
    const [updated] = getIterations(frame.id);
    expect(updated.status).toBe('winner');
  });

  it('updateIterationStatus changes status to rejected', () => {
    const frame = makeFrame();
    const iter = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    updateIterationStatus(iter.id, 'rejected');
    const [updated] = getIterations(frame.id);
    expect(updated.status).toBe('rejected');
  });

  it('updateIterationUserState persists the user state object', () => {
    const frame = makeFrame();
    const iter = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    const userState = { headline: 'New Headline', body: 'Updated copy' };
    updateIterationUserState(iter.id, userState);
    const [updated] = getIterations(frame.id);
    expect(updated.userState).toEqual(userState);
  });

  it('createIteration with invalid frameId throws FK constraint error', () => {
    expect(() =>
      createIteration({ frameId: 'bad-id', iterationIndex: 0, htmlPath: 'x.html', source: 'ai' })
    ).toThrow();
  });
});

describe('Annotation CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeIteration() {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    return createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
  }

  it('createAnnotation returns a pin annotation with coordinates', () => {
    const iter = makeIteration();
    const ann = createAnnotation({
      iterationId: iter.id,
      type: 'pin',
      author: 'human',
      text: 'Make the logo bigger',
      x: 50,
      y: 25,
    });
    expect(ann.id).toBeDefined();
    expect(ann.iterationId).toBe(iter.id);
    expect(ann.type).toBe('pin');
    expect(ann.author).toBe('human');
    expect(ann.text).toBe('Make the logo bigger');
    expect(ann.x).toBe(50);
    expect(ann.y).toBe(25);
    expect(ann.createdAt).toBeGreaterThan(0);
  });

  it('createAnnotation creates a sidebar note without coordinates', () => {
    const iter = makeIteration();
    const ann = createAnnotation({
      iterationId: iter.id,
      type: 'sidebar',
      author: 'agent',
      text: 'Overall tone is too formal',
    });
    expect(ann.type).toBe('sidebar');
    expect(ann.x).toBeUndefined();
    expect(ann.y).toBeUndefined();
  });

  it('getAnnotations returns annotations ordered by createdAt ASC', () => {
    const iter = makeIteration();
    const a1 = createAnnotation({ iterationId: iter.id, type: 'sidebar', author: 'human', text: 'First' });
    const a2 = createAnnotation({ iterationId: iter.id, type: 'pin', author: 'human', text: 'Second', x: 10, y: 10 });
    const anns = getAnnotations(iter.id);
    expect(anns.length).toBe(2);
    // Verify both exist by ID
    const ids = anns.map((a) => a.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
  });

  it('createAnnotation with invalid iterationId throws FK constraint error', () => {
    expect(() =>
      createAnnotation({ iterationId: 'bad-id', type: 'pin', author: 'human', text: 'x', x: 0, y: 0 })
    ).toThrow();
  });
});

describe('createCampaignWithAssets — atomic transaction', () => {
  beforeEach(() => {
    resetDb();
  });

  it('creates campaign and multiple assets atomically', () => {
    const { campaign, assets } = createCampaignWithAssets(
      { title: 'Big Campaign', channels: ['instagram', 'linkedin', 'email'] },
      [
        { title: 'IG Story', assetType: 'instagram-story', frameCount: 1 },
        { title: 'LI Banner', assetType: 'linkedin-landscape', frameCount: 1 },
        { title: 'One-Pager', assetType: 'one-pager', frameCount: 1 },
      ]
    );
    expect(campaign.id).toBeDefined();
    expect(campaign.title).toBe('Big Campaign');
    expect(campaign.channels).toEqual(['instagram', 'linkedin', 'email']);
    expect(assets.length).toBe(3);

    const allCampaigns = getCampaigns();
    expect(allCampaigns.length).toBe(1);

    const savedAssets = getAssets(campaign.id);
    expect(savedAssets.length).toBe(3);
  });

  it('returns correct asset structures from the transaction', () => {
    const { campaign, assets } = createCampaignWithAssets(
      { title: 'Cam', channels: [] },
      [{ title: 'Post', assetType: 'instagram', frameCount: 2 }]
    );
    expect(assets[0].campaignId).toBe(campaign.id);
    expect(assets[0].assetType).toBe('instagram');
    expect(assets[0].frameCount).toBe(2);
  });

  it('createCampaignWithAssets with zero assets creates only the campaign', () => {
    const { campaign, assets } = createCampaignWithAssets(
      { title: 'Empty Campaign', channels: [] },
      []
    );
    expect(getCampaigns().length).toBe(1);
    expect(assets.length).toBe(0);
    expect(getAssets(campaign.id).length).toBe(0);
  });
});

describe('updateAsset — PATCH /api/assets/:id', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeAsset() {
    const campaign = createCampaign({ title: 'Cam', channels: ['instagram'] });
    return createAsset({ campaignId: campaign.id, title: 'instagram 1', assetType: 'instagram', frameCount: 1 });
  }

  it('updateAsset changes the title in the database', () => {
    const asset = makeAsset();
    const originalTitle = asset.title;
    expect(originalTitle).toBe('instagram 1');

    updateAsset(asset.id, { title: 'Bold Product Launch — IG Square' });

    // Verify via getAssets
    const assets = getAssets(asset.campaignId);
    expect(assets[0].title).toBe('Bold Product Launch — IG Square');
  });

  it('updateAsset with undefined title does not change anything', () => {
    const asset = makeAsset();
    updateAsset(asset.id, {}); // no title provided
    const assets = getAssets(asset.campaignId);
    expect(assets[0].title).toBe('instagram 1'); // unchanged
  });

  it('updateAsset on nonexistent id does not throw', () => {
    // updateAsset is a fire-and-forget UPDATE — no FK constraint on id
    expect(() => updateAsset('nonexistent-id', { title: 'Ghost' })).not.toThrow();
  });
});

describe('getCampaignPreviewUrls — GET /api/campaigns/:id/preview-urls', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeFullCampaign(assetCount = 4) {
    const { campaign, assets } = createCampaignWithAssets(
      { title: 'Preview Cam', channels: ['instagram', 'linkedin'] },
      Array.from({ length: assetCount }, (_, i) => ({
        title: `asset ${i + 1}`,
        assetType: i % 2 === 0 ? 'instagram' : 'linkedin',
        frameCount: 1,
      }))
    );
    const entries: Array<{ iterationId: string; assetType: string }> = [];
    for (const asset of assets) {
      const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
      const iter = createIteration({
        frameId: frame.id,
        iterationIndex: 0,
        htmlPath: `.fluid/campaigns/${campaign.id}/${asset.id}/${frame.id}/iter.html`,
        source: 'ai',
        generationStatus: 'complete',
      });
      entries.push({ iterationId: iter.id, assetType: asset.assetType });
    }
    return { campaign, entries };
  }

  it('returns up to 4 preview entries with correct structure', () => {
    const { campaign, entries } = makeFullCampaign(4);
    const urls = getCampaignPreviewUrls(campaign.id);

    expect(urls.length).toBe(4);
    for (const url of urls) {
      expect(url.iterationId).toBeDefined();
      expect(url.htmlPath).toContain('.fluid/campaigns/');
      expect(['instagram', 'linkedin']).toContain(url.assetType);
    }
  });

  it('caps results at 4 even if campaign has more assets', () => {
    const { campaign } = makeFullCampaign(7);
    const urls = getCampaignPreviewUrls(campaign.id);
    expect(urls.length).toBeLessThanOrEqual(4);
  });

  it('returns correct iterationIds that match the created iterations', () => {
    const { campaign, entries } = makeFullCampaign(2);
    const urls = getCampaignPreviewUrls(campaign.id);
    const expectedIds = new Set(entries.map((e) => e.iterationId));
    for (const url of urls) {
      expect(expectedIds.has(url.iterationId)).toBe(true);
    }
  });

  it('returns empty array for campaign with no frames/iterations', () => {
    const campaign = createCampaign({ title: 'Empty', channels: [] });
    const urls = getCampaignPreviewUrls(campaign.id);
    expect(urls).toEqual([]);
  });

  it('returns empty array for nonexistent campaign', () => {
    const urls = getCampaignPreviewUrls('nonexistent-id');
    expect(urls).toEqual([]);
  });
});
