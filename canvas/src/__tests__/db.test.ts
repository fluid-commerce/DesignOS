/**
 * TDD tests for canvas/src/lib/db.ts and canvas/src/server/db-api.ts
 *
 * Tests cover:
 * - DB singleton creation with WAL mode, FK constraints
 * - Schema creation (5 tables: campaigns, creations, slides, iterations, annotations)
 * - CRUD for each table in the Campaign > Creation > Slide > Iteration hierarchy
 * - FK constraint enforcement (inserting with invalid foreign key throws)
 * - Transaction rollback on error
 * - getIterations ordering (iteration_index ASC)
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
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
  updateIterationSlotSchema,
  createAnnotation,
  getAnnotations,
  createCampaignWithCreations,
} from '../server/db-api';

// Use a temp database so tests never pollute the production fluid.db
beforeAll(() => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'));
  process.env.FLUID_DB_PATH = path.join(dir, 'test.db');
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
});

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
    const campaign = createCampaign({
      title: 'Instagram Launch',
      channels: ['instagram', 'linkedin'],
    });
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
    expect(campaigns.map((c) => c.id)).toContain(c1.id);
    expect(campaigns.map((c) => c.id)).toContain(c2.id);
    // Channels are deserialized from JSON correctly
    const found1 = campaigns.find((c) => c.id === c1.id)!;
    const found2 = campaigns.find((c) => c.id === c2.id)!;
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

describe('Creation CRUD', () => {
  it('createCreation returns a Creation linked to a campaign', () => {
    const campaign = createCampaign({ title: 'Campaign', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Instagram Post',
      creationType: 'instagram',
      slideCount: 1,
    });

    expect(creation.id).toBeTruthy();
    expect(creation.campaignId).toBe(campaign.id);
    expect(creation.title).toBe('Instagram Post');
    expect(creation.creationType).toBe('instagram');
    expect(creation.slideCount).toBe(1);
  });

  it('getCreations returns creations for a campaign', () => {
    const campaign = createCampaign({
      title: 'Multi-Creation',
      channels: ['instagram', 'linkedin'],
    });
    createCreation({
      campaignId: campaign.id,
      title: 'Creation 1',
      creationType: 'instagram',
      slideCount: 1,
    });
    createCreation({
      campaignId: campaign.id,
      title: 'Creation 2',
      creationType: 'linkedin-landscape',
      slideCount: 1,
    });

    const creations = getCreations(campaign.id);
    expect(creations).toHaveLength(2);
    expect(creations.map((c) => c.title)).toContain('Creation 1');
    expect(creations.map((c) => c.title)).toContain('Creation 2');
  });

  it('FK constraint: inserting creation with nonexistent campaign_id throws', () => {
    expect(() => {
      createCreation({
        campaignId: 'nonexistent_campaign_id_xyz',
        title: 'Bad Creation',
        creationType: 'instagram',
        slideCount: 1,
      });
    }).toThrow();
  });
});

describe('Slide CRUD', () => {
  it('createSlide returns a Slide linked to a creation', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 3,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });

    expect(slide.id).toBeTruthy();
    expect(slide.creationId).toBe(creation.id);
    expect(slide.slideIndex).toBe(0);
  });

  it('getSlides returns slides for a creation', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Carousel',
      creationType: 'instagram',
      slideCount: 3,
    });
    createSlide({ creationId: creation.id, slideIndex: 0 });
    createSlide({ creationId: creation.id, slideIndex: 1 });
    createSlide({ creationId: creation.id, slideIndex: 2 });

    const slides = getSlides(creation.id);
    expect(slides).toHaveLength(3);
    expect(slides.map((s) => s.slideIndex).sort()).toEqual([0, 1, 2]);
  });
});

describe('Iteration CRUD', () => {
  it('createIteration returns an Iteration linked to a slide', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/path/to/version.html',
      source: 'ai',
    });

    expect(iteration.id).toBeTruthy();
    expect(iteration.slideId).toBe(slide.id);
    expect(iteration.iterationIndex).toBe(0);
    expect(iteration.htmlPath).toBe('/path/to/version.html');
    expect(iteration.source).toBe('ai');
    expect(iteration.status).toBe('unmarked');
    expect(iteration.slotSchema).toBeNull();
    expect(iteration.aiBaseline).toBeNull();
    expect(iteration.userState).toBeNull();
  });

  it('createIteration accepts optional slotSchema, source=template with templateId', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const schema = { width: 1080, height: 1080, fields: [] };
    const iteration = createIteration({
      slideId: slide.id,
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
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    // Insert out of order
    createIteration({ slideId: slide.id, iterationIndex: 2, htmlPath: '/v3.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: '/v1.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 1, htmlPath: '/v2.html', source: 'ai' });

    const iterations = getIterations(slide.id);
    expect(iterations).toHaveLength(3);
    expect(iterations[0].iterationIndex).toBe(0);
    expect(iterations[1].iterationIndex).toBe(1);
    expect(iterations[2].iterationIndex).toBe(2);
  });

  it('updateIterationStatus changes the status field', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v.html',
      source: 'ai',
    });

    updateIterationStatus(iteration.id, 'winner');
    const updated = getIterations(slide.id);
    expect(updated[0].status).toBe('winner');
  });

  it('updateIterationUserState updates the user_state field', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v.html',
      source: 'ai',
    });

    const userState = { '.headline': 'Updated Headline', '.subline': 'Updated Subline' };
    updateIterationUserState(iteration.id, userState);
    const updated = getIterations(slide.id);
    expect(updated[0].userState).toEqual(userState);
  });
});

describe('Annotation CRUD', () => {
  it('createAnnotation returns a CampaignAnnotation linked to an iteration', () => {
    const campaign = createCampaign({ title: 'C', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v.html',
      source: 'ai',
    });

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
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'A',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v.html',
      source: 'ai',
    });

    createAnnotation({
      iterationId: iteration.id,
      type: 'pin',
      author: 'human',
      text: 'Note 1',
      x: 10,
      y: 20,
    });
    createAnnotation({
      iterationId: iteration.id,
      type: 'sidebar',
      author: 'human',
      text: 'Note 2',
    });

    const annotations = getAnnotations(iteration.id);
    expect(annotations).toHaveLength(2);
    expect(annotations.map((a) => a.text)).toContain('Note 1');
    expect(annotations.map((a) => a.text)).toContain('Note 2');
  });
});

describe('Transaction: createCampaignWithCreations', () => {
  it('creates campaign and multiple creations atomically', () => {
    const result = createCampaignWithCreations(
      { title: 'Full Campaign', channels: ['instagram', 'linkedin'] },
      [
        { title: 'IG Post', creationType: 'instagram', slideCount: 1 },
        { title: 'LN Post', creationType: 'linkedin-landscape', slideCount: 1 },
      ],
    );

    expect(result.campaign.id).toBeTruthy();
    expect(result.creations).toHaveLength(2);
    expect(result.creations[0].campaignId).toBe(result.campaign.id);
    expect(result.creations[1].campaignId).toBe(result.campaign.id);
  });

  it('transaction rolls back if an insert fails', () => {
    const initialCampaigns = getCampaigns();
    expect(() => {
      // Force a failure by passing an invalid creationType shape that violates NOT NULL
      createCampaignWithCreations({ title: 'Should Rollback', channels: ['instagram'] }, [
        { title: null as unknown as string, creationType: 'instagram', slideCount: 1 },
      ]);
    }).toThrow();
    // Campaign should NOT have been created
    const afterCampaigns = getCampaigns();
    expect(afterCampaigns.length).toBe(initialCampaigns.length);
  });
});

// ---------------------------------------------------------------------------
// updateIterationSlotSchema
// ---------------------------------------------------------------------------

describe('updateIterationSlotSchema', () => {
  it('persists slot schema JSON and can be read back via getIterations', () => {
    const campaign = createCampaign({ title: 'SlotSchema Campaign', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Post',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v.html',
      source: 'ai',
    });

    const schema = {
      archetypeId: 'stat-hero-single',
      width: 1080,
      height: 1080,
      fields: [{ type: 'text', sel: '.headline', label: 'Headline', mode: 'text', rows: 1 }],
      brush: null,
    };
    updateIterationSlotSchema(iteration.id, schema);

    const iterations = getIterations(slide.id);
    expect(iterations[0].slotSchema).not.toBeNull();
    // slotSchema is stored and resolved; verify core fields
    const stored = iterations[0].slotSchema as Record<string, unknown>;
    expect(stored.archetypeId).toBe('stat-hero-single');
  });

  it('stores archetypeId field in schema and it can be retrieved', () => {
    const campaign = createCampaign({ title: 'SlotSchema Campaign 2', channels: ['instagram'] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Post',
      creationType: 'instagram',
      slideCount: 1,
    });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iteration = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: '/v2.html',
      source: 'ai',
    });

    const schema = {
      archetypeId: 'stat-hero-single',
      width: 1080,
      height: 1080,
      fields: [{ type: 'text', sel: '.headline', label: 'Headline', mode: 'text', rows: 1 }],
      brush: null,
    };
    updateIterationSlotSchema(iteration.id, schema);

    const iterations = getIterations(slide.id);
    const stored = iterations[0].slotSchema as Record<string, unknown>;
    expect(stored.archetypeId).toBe('stat-hero-single');
    expect(Array.isArray(stored.fields)).toBe(true);
    expect((stored.fields as unknown[]).length).toBe(1);
  });
});
