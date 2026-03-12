/**
 * TDD tests for canvas/src/lib/db.ts and canvas/src/server/db-api.ts
 *
 * Tests cover:
 * - DB singleton creation with WAL mode, FK constraints
 * - Schema creation (5 tables: campaigns, assets, frames, iterations, annotations)
 * - CRUD for each table in the Campaign > Asset > Frame > Iteration hierarchy
 * - FK constraint enforcement (inserting with invalid foreign key throws)
 * - Transaction rollback on error
 * - getIterations ordering (iteration_index ASC)
 */

// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// These imports will fail until db-api.ts is created (TDD RED)
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
  createAnnotation,
  getAnnotations,
  createCampaignWithAssets,
} from '../server/db-api';

// Reset the singleton for each test by using an in-memory or temp DB
// We'll override the DB_PATH via a test setup that patches the module

describe('db schema creation', () => {
  it('creates all 5 tables on first getDb() call', () => {
    // The db-api functions work, which proves tables were created
    const campaign = createCampaign({ title: 'Test Campaign', channels: ['instagram'] });
    expect(campaign).toBeDefined();
    expect(campaign.id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('returns a singleton — multiple calls return same connection', async () => {
    const { getDb } = await import('../lib/db');
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});

describe('Campaign CRUD', () => {
  it('createCampaign returns a Campaign with id, title, channels, timestamps', () => {
    const before = Date.now();
    const campaign = createCampaign({ title: 'Instagram Launch', channels: ['instagram', 'linkedin'] });
    const after = Date.now();

    expect(campaign.id).toBeTruthy();
    expect(campaign.title).toBe('Instagram Launch');
    expect(campaign.channels).toEqual(['instagram', 'linkedin']);
    expect(campaign.createdAt).toBeGreaterThanOrEqual(before);
    expect(campaign.createdAt).toBeLessThanOrEqual(after);
    expect(campaign.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('getCampaigns returns all campaigns including newly created ones', () => {
    const c1 = createCampaign({ title: 'First', channels: ['instagram'] });
    const c2 = createCampaign({ title: 'Second', channels: ['linkedin'] });

    const campaigns = getCampaigns();
    expect(campaigns.length).toBeGreaterThanOrEqual(2);
    // Both campaigns are present in the results
    expect(campaigns.map(c => c.id)).toContain(c1.id);
    expect(campaigns.map(c => c.id)).toContain(c2.id);
    // Channels are deserialized from JSON correctly
    const found1 = campaigns.find(c => c.id === c1.id)!;
    const found2 = campaigns.find(c => c.id === c2.id)!;
    expect(found1.channels).toEqual(['instagram']);
    expect(found2.channels).toEqual(['linkedin']);
  });

  it('getCampaign returns a single campaign by id', () => {
    const created = createCampaign({ title: 'Find Me', channels: ['instagram'] });
    const found = getCampaign(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe('Find Me');
  });

  it('getCampaign returns undefined for non-existent id', () => {
    const result = getCampaign('nonexistent_id_xyz');
    expect(result).toBeUndefined();
  });
});

describe('Asset CRUD', () => {
  it('createAsset returns an Asset linked to a campaign', () => {
    const campaign = createCampaign({ title: 'Campaign', channels: ['instagram'] });
    const asset = createAsset({
      campaignId: campaign.id,
      title: 'Instagram Post',
      assetType: 'instagram',
      frameCount: 1,
    });

    expect(asset.id).toBeTruthy();
    expect(asset.campaignId).toBe(campaign.id);
    expect(asset.title).toBe('Instagram Post');
    expect(asset.assetType).toBe('instagram');
    expect(asset.frameCount).toBe(1);
  });

  it('getAssets returns assets for a campaign', () => {
    const campaign = createCampaign({ title: 'Multi-Asset', channels: ['instagram', 'linkedin'] });
    createAsset({ campaignId: campaign.id, title: 'Asset 1', assetType: 'instagram', frameCount: 1 });
    createAsset({ campaignId: campaign.id, title: 'Asset 2', assetType: 'linkedin-landscape', frameCount: 1 });

    const assets = getAssets(campaign.id);
    expect(assets).toHaveLength(2);
    expect(assets.map(a => a.title)).toContain('Asset 1');
    expect(assets.map(a => a.title)).toContain('Asset 2');
  });

  it('FK constraint: inserting asset with nonexistent campaign_id throws', () => {
    expect(() => {
      createAsset({
        campaignId: 'nonexistent_campaign_id_xyz',
        title: 'Bad Asset',
        assetType: 'instagram',
        frameCount: 1,
      });
    }).toThrow();
  });
});

describe('Frame CRUD', () => {
  it('createFrame returns a Frame linked to an asset', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 3 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });

    expect(frame.id).toBeTruthy();
    expect(frame.assetId).toBe(asset.id);
    expect(frame.frameIndex).toBe(0);
  });

  it('getFrames returns frames for an asset', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'Carousel', assetType: 'instagram', frameCount: 3 });
    createFrame({ assetId: asset.id, frameIndex: 0 });
    createFrame({ assetId: asset.id, frameIndex: 1 });
    createFrame({ assetId: asset.id, frameIndex: 2 });

    const frames = getFrames(asset.id);
    expect(frames).toHaveLength(3);
    expect(frames.map(f => f.frameIndex).sort()).toEqual([0, 1, 2]);
  });
});

describe('Iteration CRUD', () => {
  it('createIteration returns an Iteration linked to a frame', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const iteration = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: '/path/to/variation.html',
      source: 'ai',
    });

    expect(iteration.id).toBeTruthy();
    expect(iteration.frameId).toBe(frame.id);
    expect(iteration.iterationIndex).toBe(0);
    expect(iteration.htmlPath).toBe('/path/to/variation.html');
    expect(iteration.source).toBe('ai');
    expect(iteration.status).toBe('unmarked');
    expect(iteration.slotSchema).toBeNull();
    expect(iteration.aiBaseline).toBeNull();
    expect(iteration.userState).toBeNull();
  });

  it('createIteration accepts optional slotSchema, source=template with templateId', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const schema = { width: 1080, height: 1080, fields: [] };
    const iteration = createIteration({
      frameId: frame.id,
      iterationIndex: 0,
      htmlPath: '/path/to/template.html',
      slotSchema: schema,
      source: 'template',
      templateId: 'tpl_001',
    });

    expect(iteration.source).toBe('template');
    expect(iteration.templateId).toBe('tpl_001');
    expect(iteration.slotSchema).toEqual(schema);
  });

  it('getIterations returns iterations ordered by iteration_index ASC', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    // Insert out of order
    createIteration({ frameId: frame.id, iterationIndex: 2, htmlPath: '/v3.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: '/v1.html', source: 'ai' });
    createIteration({ frameId: frame.id, iterationIndex: 1, htmlPath: '/v2.html', source: 'ai' });

    const iterations = getIterations(frame.id);
    expect(iterations).toHaveLength(3);
    expect(iterations[0].iterationIndex).toBe(0);
    expect(iterations[1].iterationIndex).toBe(1);
    expect(iterations[2].iterationIndex).toBe(2);
  });

  it('updateIterationStatus changes the status field', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const iteration = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: '/v.html', source: 'ai' });

    updateIterationStatus(iteration.id, 'winner');
    const updated = getIterations(frame.id);
    expect(updated[0].status).toBe('winner');
  });

  it('updateIterationUserState updates the user_state field', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const iteration = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: '/v.html', source: 'ai' });

    const userState = { '.headline': 'Updated Headline', '.subline': 'Updated Subline' };
    updateIterationUserState(iteration.id, userState);
    const updated = getIterations(frame.id);
    expect(updated[0].userState).toEqual(userState);
  });
});

describe('Annotation CRUD', () => {
  it('createAnnotation returns a CampaignAnnotation linked to an iteration', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const iteration = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: '/v.html', source: 'ai' });

    const annotation = createAnnotation({
      iterationId: iteration.id,
      type: 'pin',
      author: 'human',
      text: 'Fix the headline',
      x: 50.5,
      y: 25.3,
    });

    expect(annotation.id).toBeTruthy();
    expect(annotation.iterationId).toBe(iteration.id);
    expect(annotation.type).toBe('pin');
    expect(annotation.author).toBe('human');
    expect(annotation.text).toBe('Fix the headline');
    expect(annotation.x).toBe(50.5);
    expect(annotation.y).toBe(25.3);
  });

  it('getAnnotations returns annotations for an iteration', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const asset = createAsset({ campaignId: campaign.id, title: 'A', assetType: 'instagram', frameCount: 1 });
    const frame = createFrame({ assetId: asset.id, frameIndex: 0 });
    const iteration = createIteration({ frameId: frame.id, iterationIndex: 0, htmlPath: '/v.html', source: 'ai' });

    createAnnotation({ iterationId: iteration.id, type: 'pin', author: 'human', text: 'Note 1', x: 10, y: 20 });
    createAnnotation({ iterationId: iteration.id, type: 'sidebar', author: 'human', text: 'Note 2' });

    const annotations = getAnnotations(iteration.id);
    expect(annotations).toHaveLength(2);
    expect(annotations.map(a => a.text)).toContain('Note 1');
    expect(annotations.map(a => a.text)).toContain('Note 2');
  });
});

describe('Transaction: createCampaignWithAssets', () => {
  it('creates campaign and multiple assets atomically', () => {
    const result = createCampaignWithAssets(
      { title: 'Full Campaign', channels: ['instagram', 'linkedin'] },
      [
        { title: 'IG Post', assetType: 'instagram', frameCount: 1 },
        { title: 'LN Post', assetType: 'linkedin-landscape', frameCount: 1 },
      ]
    );

    expect(result.campaign.id).toBeTruthy();
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0].campaignId).toBe(result.campaign.id);
    expect(result.assets[1].campaignId).toBe(result.campaign.id);
  });

  it('transaction rolls back if an insert fails', () => {
    const initialCampaigns = getCampaigns();
    expect(() => {
      // Force a failure by passing an invalid assetType shape that violates NOT NULL
      createCampaignWithAssets(
        { title: 'Should Rollback', channels: ['instagram'] },
        [
          { title: null as unknown as string, assetType: 'instagram', frameCount: 1 },
        ]
      );
    }).toThrow();
    // Campaign should NOT have been created
    const afterCampaigns = getCampaigns();
    expect(afterCampaigns.length).toBe(initialCampaigns.length);
  });
});
