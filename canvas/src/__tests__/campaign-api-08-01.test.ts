/**
 * TDD tests for Phase 08-01: generationStatus field + new db-api helpers.
 *
 * Tests cover:
 * - createIteration returns generationStatus defaulting to 'complete'
 * - updateIterationGenerationStatus changes the field
 * - updateAsset changes the asset title
 * - getLatestIterationByFrame returns highest iterationIndex
 * - getLatestIterationByFrame returns undefined for frame with no iterations
 * - getCampaignPreviewUrls returns up to 4 objects per campaign's first 4 assets
 * - getCampaignPreviewUrls returns empty array for campaign with no iterations
 */

// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { closeDb } from '../lib/db';
import {
  createCampaign,
  createAsset,
  getAssets,
  createFrame,
  createIteration,
  getIterations,
  updateAsset,
  getLatestIterationByFrame,
  updateIterationGenerationStatus,
  getCampaignPreviewUrls,
} from '../server/db-api';

function resetDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-api-08-01-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.FLUID_DB_PATH = dbPath;
}

function makeFrame() {
  const campaign = createCampaign({ title: 'C', channels: [] });
  const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
  const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
  return { campaign, asset, frame };
}

describe('generationStatus field on iterations', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createIteration returns an iteration with generationStatus defaulting to "complete"', () => {
    const { frame } = makeFrame();
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
    });
    expect(iter.generationStatus).toBe('complete');
  });

  it('createIteration accepts explicit generationStatus "pending"', () => {
    const { frame } = makeFrame();
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    expect(iter.generationStatus).toBe('pending');
  });

  it('updateIterationGenerationStatus changes the field to "generating"', () => {
    const { frame } = makeFrame();
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'x.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    updateIterationGenerationStatus(iter.id, 'generating');
    const [updated] = getIterations(frame.id);
    expect(updated.generationStatus).toBe('generating');
  });

  it('updateIterationGenerationStatus changes the field to "complete"', () => {
    const { frame } = makeFrame();
    const iter = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: 'x.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    updateIterationGenerationStatus(iter.id, 'complete');
    const [updated] = getIterations(frame.id);
    expect(updated.generationStatus).toBe('complete');
  });
});

describe('updateAsset', () => {
  beforeEach(() => {
    resetDb();
  });

  it('updateAsset changes the asset title', () => {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const asset = createAsset({ campaignId: campaign.id, title: 'Old Title', assetType: 'instagram', frameCount: 1 });
    updateAsset(asset.id, { title: 'New Title' });
    const assets = getAssets(campaign.id);
    expect(assets[0].title).toBe('New Title');
  });
});

describe('getLatestIterationByFrame', () => {
  beforeEach(() => {
    resetDb();
  });

  it('returns the iteration with highest iterationIndex for a frame', () => {
    const { frame } = makeFrame();
    createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: 'v0.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 1, htmlPath: 'v1.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 2, htmlPath: 'v2.html', source: 'ai' });
    const latest = getLatestIterationByFrame(frame.id);
    expect(latest).toBeDefined();
    expect(latest!.iterationIndex).toBe(2);
    expect(latest!.htmlPath).toBe('v2.html');
  });

  it('returns undefined for a frame with no iterations', () => {
    const { frame } = makeFrame();
    const latest = getLatestIterationByFrame(frame.id);
    expect(latest).toBeUndefined();
  });
});

describe('getCampaignPreviewUrls', () => {
  beforeEach(() => {
    resetDb();
  });

  it('returns up to 4 objects with { iterationId, htmlPath, assetType } from the campaign first 4 assets', () => {
    const campaign = createCampaign({ title: 'Preview Campaign', channels: ['instagram'] });

    // Create 4 assets each with a frame and an iteration
    for (let i = 0; i < 4; i++) {
      const asset = createAsset({
        campaignId: campaign.id,
        title: `Asset ${i}`,
        assetType: i % 2 === 0 ? 'instagram' : 'linkedin',
        frameCount: 1,
      });
      const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
      createIteration({
        frameId: frame.id,
        iterationIndex: 0,
        htmlPath: `sessions/abc/asset-${i}/v0.html`,
        source: 'ai',
      });
    }

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews.length).toBe(4);
    for (const preview of previews) {
      expect(preview).toHaveProperty('iterationId');
      expect(preview).toHaveProperty('htmlPath');
      expect(preview).toHaveProperty('assetType');
      expect(typeof preview.iterationId).toBe('string');
      expect(typeof preview.htmlPath).toBe('string');
      expect(typeof preview.assetType).toBe('string');
    }
  });

  it('limits to 4 even when campaign has more than 4 assets', () => {
    const campaign = createCampaign({ title: 'Big Campaign', channels: [] });

    for (let i = 0; i < 6; i++) {
      const asset = createAsset({
        campaignId: campaign.id,
        title: `Asset ${i}`,
        assetType: 'instagram',
        frameCount: 1,
      });
      const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
      createIteration({
        frameId: frame.id,
        iterationIndex: 0,
        htmlPath: `sessions/abc/asset-${i}/v0.html`,
        source: 'ai',
      });
    }

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews.length).toBe(4);
  });

  it('returns empty array for campaign with no iterations', () => {
    const campaign = createCampaign({ title: 'Empty', channels: [] });
    const asset = createAsset({
      campaignId: campaign.id,
      title: 'Asset',
      assetType: 'instagram',
      frameCount: 1,
    });
    createFrame({ assetId: asset.id, frameIndex: 0 });
    // No iterations created

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews).toEqual([]);
  });

  it('returns empty array for campaign with no assets', () => {
    const campaign = createCampaign({ title: 'No Assets', channels: [] });
    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews).toEqual([]);
  });
});
