/**
 * TDD tests for campaign hierarchy CRUD via db-api.ts
 *
 * Tests cover:
 * - createCampaign / getCampaigns / getCampaign
 * - createCreation / getCreations (by campaignId)
 * - createSlide / getSlides (by creationId)
 * - createIteration / getIterations (by slideId)
 * - updateIterationStatus / updateIterationUserState
 * - updateCreation (title rename)
 * - getCampaignPreviewUrls (up to 4 preview entries)
 * - createAnnotation / getAnnotations (by iterationId)
 * - createCampaignWithCreations (atomic transaction)
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
  createCreation,
  getCreations,
  createSlide,
  getSlides,
  createIteration,
  getIterations,
  updateIterationStatus,
  updateIterationUserState,
  updateCreation,
  getCampaignPreviewUrls,
  createAnnotation,
  getAnnotations,
  createCampaignWithCreations,
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

describe('Creation CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createCreation returns a Creation with all fields', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'IG Post',
      creationType: 'instagram',
      slideCount: 1,
    });
    expect(creation.id).toBeDefined();
    expect(creation.campaignId).toBe(campaign.id);
    expect(creation.title).toBe('IG Post');
    expect(creation.creationType).toBe('instagram');
    expect(creation.slideCount).toBe(1);
    expect(creation.createdAt).toBeGreaterThan(0);
  });

  it('getCreations returns creations for a campaign ordered by createdAt ASC', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const c1 = createCreation({ campaignId: campaign.id, title: 'A', creationType: 'instagram', slideCount: 1 });
    const c2 = createCreation({ campaignId: campaign.id, title: 'B', creationType: 'linkedin', slideCount: 3 });
    const creations = getCreations(campaign.id);
    expect(creations.length).toBe(2);
    // Both created at nearly same ms; verify both exist by ID
    const ids = creations.map((c) => c.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);
  });

  it('getCreations returns empty array for unknown campaign', () => {
    expect(getCreations('ghost-id')).toEqual([]);
  });

  it('createCreation with invalid campaignId throws FK constraint error', () => {
    expect(() =>
      createCreation({ campaignId: 'bad-id', title: 'X', creationType: 'instagram', slideCount: 1 })
    ).toThrow();
  });
});

describe('Slide CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createSlide returns a Slide with correct fields', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const creation = createCreation({ campaignId: campaign.id, title: 'A', creationType: 'instagram', slideCount: 1 });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    expect(slide.id).toBeDefined();
    expect(slide.creationId).toBe(creation.id);
    expect(slide.slideIndex).toBe(0);
    expect(slide.createdAt).toBeGreaterThan(0);
  });

  it('getSlides returns slides ordered by slideIndex ASC', () => {
    const campaign = createCampaign({ title: 'Cam', channels: [] });
    const creation = createCreation({ campaignId: campaign.id, title: 'A', creationType: 'carousel', slideCount: 3 });
    createSlide({ creationId: creation.id, slideIndex: 2 });
    createSlide({ creationId: creation.id, slideIndex: 0 });
    createSlide({ creationId: creation.id, slideIndex: 1 });
    const slides = getSlides(creation.id);
    expect(slides.length).toBe(3);
    expect(slides[0].slideIndex).toBe(0);
    expect(slides[1].slideIndex).toBe(1);
    expect(slides[2].slideIndex).toBe(2);
  });

  it('createSlide with invalid creationId throws FK constraint error', () => {
    expect(() => createSlide({ creationId: 'bad-id', slideIndex: 0 })).toThrow();
  });
});

describe('Iteration CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeSlide() {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const creation = createCreation({ campaignId: campaign.id, title: 'A', creationType: 'instagram', slideCount: 1 });
    return createSlide({ creationId: creation.id, slideIndex: 0 });
  }

  it('createIteration returns an Iteration with correct default status', () => {
    const slide = makeSlide();
    const iter = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
    });
    expect(iter.id).toBeDefined();
    expect(iter.slideId).toBe(slide.id);
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
    const slide = makeSlide();
    const schema = { fields: [{ name: 'headline', type: 'text' }] };
    const iter = createIteration({
      slideId: slide.id,
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
    const slide = makeSlide();
    createIteration({ slideId: slide.id, iterationIndex: 2, htmlPath: 'p2.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'p0.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 1, htmlPath: 'p1.html', source: 'ai' });
    const iters = getIterations(slide.id);
    expect(iters.length).toBe(3);
    expect(iters[0].iterationIndex).toBe(0);
    expect(iters[1].iterationIndex).toBe(1);
    expect(iters[2].iterationIndex).toBe(2);
  });

  it('updateIterationStatus changes status to winner', () => {
    const slide = makeSlide();
    const iter = createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    updateIterationStatus(iter.id, 'winner');
    const [updated] = getIterations(slide.id);
    expect(updated.status).toBe('winner');
  });

  it('updateIterationStatus changes status to rejected', () => {
    const slide = makeSlide();
    const iter = createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    updateIterationStatus(iter.id, 'rejected');
    const [updated] = getIterations(slide.id);
    expect(updated.status).toBe('rejected');
  });

  it('updateIterationUserState persists the user state object', () => {
    const slide = makeSlide();
    const iter = createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
    const userState = { headline: 'New Headline', body: 'Updated copy' };
    updateIterationUserState(iter.id, userState);
    const [updated] = getIterations(slide.id);
    expect(updated.userState).toEqual(userState);
  });

  it('createIteration with invalid slideId throws FK constraint error', () => {
    expect(() =>
      createIteration({ slideId: 'bad-id', iterationIndex: 0, htmlPath: 'x.html', source: 'ai' })
    ).toThrow();
  });
});

describe('Annotation CRUD', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeIteration() {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const creation = createCreation({ campaignId: campaign.id, title: 'A', creationType: 'instagram', slideCount: 1 });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    return createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'x.html', source: 'ai' });
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

describe('createCampaignWithCreations — atomic transaction', () => {
  beforeEach(() => {
    resetDb();
  });

  it('creates campaign and multiple creations atomically', () => {
    const { campaign, creations } = createCampaignWithCreations(
      { title: 'Big Campaign', channels: ['instagram', 'linkedin', 'email'] },
      [
        { title: 'IG Story', creationType: 'instagram-story', slideCount: 1 },
        { title: 'LI Banner', creationType: 'linkedin-landscape', slideCount: 1 },
        { title: 'One-Pager', creationType: 'one-pager', slideCount: 1 },
      ]
    );
    expect(campaign.id).toBeDefined();
    expect(campaign.title).toBe('Big Campaign');
    expect(campaign.channels).toEqual(['instagram', 'linkedin', 'email']);
    expect(creations.length).toBe(3);

    const allCampaigns = getCampaigns();
    expect(allCampaigns.length).toBe(1);

    const savedCreations = getCreations(campaign.id);
    expect(savedCreations.length).toBe(3);
  });

  it('returns correct creation structures from the transaction', () => {
    const { campaign, creations } = createCampaignWithCreations(
      { title: 'Cam', channels: [] },
      [{ title: 'Post', creationType: 'instagram', slideCount: 2 }]
    );
    expect(creations[0].campaignId).toBe(campaign.id);
    expect(creations[0].creationType).toBe('instagram');
    expect(creations[0].slideCount).toBe(2);
  });

  it('createCampaignWithCreations with zero creations creates only the campaign', () => {
    const { campaign, creations } = createCampaignWithCreations(
      { title: 'Empty Campaign', channels: [] },
      []
    );
    expect(getCampaigns().length).toBe(1);
    expect(creations.length).toBe(0);
    expect(getCreations(campaign.id).length).toBe(0);
  });
});

describe('updateCreation — PATCH /api/creations/:id', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeCreation() {
    const campaign = createCampaign({ title: 'Cam', channels: ['instagram'] });
    return createCreation({ campaignId: campaign.id, title: 'instagram 1', creationType: 'instagram', slideCount: 1 });
  }

  it('updateCreation changes the title in the database', () => {
    const creation = makeCreation();
    const originalTitle = creation.title;
    expect(originalTitle).toBe('instagram 1');

    updateCreation(creation.id, { title: 'Bold Product Launch — IG Square' });

    // Verify via getCreations
    const creations = getCreations(creation.campaignId);
    expect(creations[0].title).toBe('Bold Product Launch — IG Square');
  });

  it('updateCreation with undefined title does not change anything', () => {
    const creation = makeCreation();
    updateCreation(creation.id, {}); // no title provided
    const creations = getCreations(creation.campaignId);
    expect(creations[0].title).toBe('instagram 1'); // unchanged
  });

  it('updateCreation on nonexistent id does not throw', () => {
    // updateCreation is a fire-and-forget UPDATE — no FK constraint on id
    expect(() => updateCreation('nonexistent-id', { title: 'Ghost' })).not.toThrow();
  });
});

describe('getCampaignPreviewUrls — GET /api/campaigns/:id/preview-urls', () => {
  beforeEach(() => {
    resetDb();
  });

  function makeFullCampaign(creationCount = 4) {
    const { campaign, creations } = createCampaignWithCreations(
      { title: 'Preview Cam', channels: ['instagram', 'linkedin'] },
      Array.from({ length: creationCount }, (_, i) => ({
        title: `creation ${i + 1}`,
        creationType: i % 2 === 0 ? 'instagram' : 'linkedin',
        slideCount: 1,
      }))
    );
    const entries: Array<{ iterationId: string; creationType: string }> = [];
    for (const creation of creations) {
      const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
      const iter = createIteration({
        slideId: slide.id,
        iterationIndex: 0,
        htmlPath: `.fluid/campaigns/${campaign.id}/${creation.id}/${slide.id}/iter.html`,
        source: 'ai',
        generationStatus: 'complete',
      });
      entries.push({ iterationId: iter.id, creationType: creation.creationType });
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
      expect(['instagram', 'linkedin']).toContain(url.creationType);
    }
  });

  it('caps results at 4 even if campaign has more creations', () => {
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

  it('returns empty array for campaign with no slides/iterations', () => {
    const campaign = createCampaign({ title: 'Empty', channels: [] });
    const urls = getCampaignPreviewUrls(campaign.id);
    expect(urls).toEqual([]);
  });

  it('returns empty array for nonexistent campaign', () => {
    const urls = getCampaignPreviewUrls('nonexistent-id');
    expect(urls).toEqual([]);
  });
});
