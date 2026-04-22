/**
 * TDD tests for Phase 08-01: generationStatus field + new db-api helpers.
 *
 * Tests cover:
 * - createIteration returns generationStatus defaulting to 'complete'
 * - updateIterationGenerationStatus changes the field
 * - updateCreation changes the creation title
 * - getLatestIterationBySlide returns highest iterationIndex
 * - getLatestIterationBySlide returns undefined for slide with no iterations
 * - getCampaignPreviewUrls returns up to 4 objects per campaign's first 4 creations
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
  createCreation,
  getCreations,
  createSlide,
  createIteration,
  getIterations,
  updateCreation,
  getLatestIterationBySlide,
  updateIterationGenerationStatus,
  getCampaignPreviewUrls,
} from '../server/db-api';

function resetDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-api-08-01-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.FLUID_DB_PATH = dbPath;
}

function makeSlide() {
  const campaign = createCampaign({ title: 'C', channels: [] });
  const creation = createCreation({
    campaignId: campaign.id,
    title: 'A',
    creationType: 'instagram',
    slideCount: 1,
  });
  const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
  return { campaign, creation, slide };
}

describe('generationStatus field on iterations', () => {
  beforeEach(() => {
    resetDb();
  });

  it('createIteration returns an iteration with generationStatus defaulting to "complete"', () => {
    const { slide } = makeSlide();
    const iter = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
    });
    expect(iter.generationStatus).toBe('complete');
  });

  it('createIteration accepts explicit generationStatus "pending"', () => {
    const { slide } = makeSlide();
    const iter = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: 'sessions/abc/round-1/v1.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    expect(iter.generationStatus).toBe('pending');
  });

  it('updateIterationGenerationStatus changes the field to "generating"', () => {
    const { slide } = makeSlide();
    const iter = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: 'x.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    updateIterationGenerationStatus(iter.id, 'generating');
    const [updated] = getIterations(slide.id);
    expect(updated.generationStatus).toBe('generating');
  });

  it('updateIterationGenerationStatus changes the field to "complete"', () => {
    const { slide } = makeSlide();
    const iter = createIteration({
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: 'x.html',
      source: 'ai',
      generationStatus: 'pending',
    });
    updateIterationGenerationStatus(iter.id, 'complete');
    const [updated] = getIterations(slide.id);
    expect(updated.generationStatus).toBe('complete');
  });
});

describe('updateCreation', () => {
  beforeEach(() => {
    resetDb();
  });

  it('updateCreation changes the creation title', () => {
    const campaign = createCampaign({ title: 'C', channels: [] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Old Title',
      creationType: 'instagram',
      slideCount: 1,
    });
    updateCreation(creation.id, { title: 'New Title' });
    const creations = getCreations(campaign.id);
    expect(creations[0].title).toBe('New Title');
  });
});

describe('getLatestIterationBySlide', () => {
  beforeEach(() => {
    resetDb();
  });

  it('returns the iteration with highest iterationIndex for a slide', () => {
    const { slide } = makeSlide();
    createIteration({ slideId: slide.id, iterationIndex: 0, htmlPath: 'v0.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 1, htmlPath: 'v1.html', source: 'ai' });
    createIteration({ slideId: slide.id, iterationIndex: 2, htmlPath: 'v2.html', source: 'ai' });
    const latest = getLatestIterationBySlide(slide.id);
    expect(latest).toBeDefined();
    expect(latest!.iterationIndex).toBe(2);
    expect(latest!.htmlPath).toBe('v2.html');
  });

  it('returns undefined for a slide with no iterations', () => {
    const { slide } = makeSlide();
    const latest = getLatestIterationBySlide(slide.id);
    expect(latest).toBeUndefined();
  });
});

describe('getCampaignPreviewUrls', () => {
  beforeEach(() => {
    resetDb();
  });

  it('returns up to 4 objects with { iterationId, htmlPath, creationType } from the campaign first 4 creations', () => {
    const campaign = createCampaign({ title: 'Preview Campaign', channels: ['instagram'] });

    // Create 4 creations each with a slide and an iteration
    for (let i = 0; i < 4; i++) {
      const creation = createCreation({
        campaignId: campaign.id,
        title: `Creation ${i}`,
        creationType: i % 2 === 0 ? 'instagram' : 'linkedin',
        slideCount: 1,
      });
      const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
      createIteration({
        slideId: slide.id,
        iterationIndex: 0,
        htmlPath: `sessions/abc/creation-${i}/v0.html`,
        source: 'ai',
      });
    }

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews.length).toBe(4);
    for (const preview of previews) {
      expect(preview).toHaveProperty('iterationId');
      expect(preview).toHaveProperty('htmlPath');
      expect(preview).toHaveProperty('creationType');
      expect(typeof preview.iterationId).toBe('string');
      expect(typeof preview.htmlPath).toBe('string');
      expect(typeof preview.creationType).toBe('string');
    }
  });

  it('limits to 4 even when campaign has more than 4 creations', () => {
    const campaign = createCampaign({ title: 'Big Campaign', channels: [] });

    for (let i = 0; i < 6; i++) {
      const creation = createCreation({
        campaignId: campaign.id,
        title: `Creation ${i}`,
        creationType: 'instagram',
        slideCount: 1,
      });
      const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
      createIteration({
        slideId: slide.id,
        iterationIndex: 0,
        htmlPath: `sessions/abc/creation-${i}/v0.html`,
        source: 'ai',
      });
    }

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews.length).toBe(4);
  });

  it('returns empty array for campaign with no iterations', () => {
    const campaign = createCampaign({ title: 'Empty', channels: [] });
    const creation = createCreation({
      campaignId: campaign.id,
      title: 'Creation',
      creationType: 'instagram',
      slideCount: 1,
    });
    createSlide({ creationId: creation.id, slideIndex: 0 });
    // No iterations created

    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews).toEqual([]);
  });

  it('returns empty array for campaign with no creations', () => {
    const campaign = createCampaign({ title: 'No Creations', channels: [] });
    const previews = getCampaignPreviewUrls(campaign.id);
    expect(previews).toEqual([]);
  });
});
