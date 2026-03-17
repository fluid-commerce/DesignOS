// @vitest-environment node

/**
 * Tests for brand context tool-based access in the pipeline.
 * Verifies that:
 * - list_brand_sections and read_brand_section tools work via executeTool
 * - build*Prompt functions instruct agents to use brand tools (not inline injection)
 * - Each stage prompt references the correct brand section categories
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeDb, getDb } from '../lib/db';
import { seedVoiceGuideIfEmpty, seedBrandPatternsIfEmpty } from '../server/brand-seeder';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Project root (Fluid-DesignOS/) is 3 levels up from canvas/src/__tests__/
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const VOICE_GUIDE_DIR = path.join(PROJECT_ROOT, 'voice-guide');
const PATTERNS_HTML = path.join(PROJECT_ROOT, 'patterns/index.html');

let testDir: string;

beforeAll(async () => {
  closeDb();
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-context-test-'));
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  getDb();
  await seedVoiceGuideIfEmpty(VOICE_GUIDE_DIR);
  await seedBrandPatternsIfEmpty(PATTERNS_HTML);
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  executeTool,
  buildCopyPrompt,
  buildLayoutPrompt,
  buildStylingPrompt,
} from '../server/api-pipeline';
import type { PipelineContext } from '../server/api-pipeline';

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    prompt: 'Test product launch campaign',
    creationType: 'instagram',
    workingDir: '/tmp/test-working-dir',
    htmlOutputPath: '/tmp/test-working-dir/output.html',
    creationId: 'creation-test',
    campaignId: 'campaign-test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// list_brand_sections tool
// ---------------------------------------------------------------------------

describe('list_brand_sections tool', () => {
  it('returns all sections when no category filter', async () => {
    const result = await executeTool('list_brand_sections', {}, '/tmp');
    const sections = JSON.parse(result);
    expect(sections.length).toBeGreaterThan(0);
    const categories = [...new Set(sections.map((s: { category: string }) => s.category))];
    expect(categories).toContain('voice-guide');
    expect(categories).toContain('pattern');
  });

  it('filters by voice-guide category', async () => {
    const result = await executeTool('list_brand_sections', { category: 'voice-guide' }, '/tmp');
    const sections = JSON.parse(result);
    expect(sections.length).toBe(13);
    expect(sections.every((s: { category: string }) => s.category === 'voice-guide')).toBe(true);
  });

  it('filters by design-tokens category', async () => {
    const result = await executeTool('list_brand_sections', { category: 'design-tokens' }, '/tmp');
    const sections = JSON.parse(result);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s: { category: string }) => s.category === 'design-tokens')).toBe(true);
  });

  it('filters by pattern category', async () => {
    const result = await executeTool('list_brand_sections', { category: 'pattern' }, '/tmp');
    const sections = JSON.parse(result);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s: { category: string }) => s.category === 'pattern')).toBe(true);
  });

  it('returns slug, label, category for each section (no content)', async () => {
    const result = await executeTool('list_brand_sections', {}, '/tmp');
    const sections = JSON.parse(result);
    const first = sections[0];
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('label');
    expect(first).toHaveProperty('category');
    expect(first).not.toHaveProperty('content');
  });
});

// ---------------------------------------------------------------------------
// read_brand_section tool
// ---------------------------------------------------------------------------

describe('read_brand_section tool', () => {
  it('reads a voice guide doc by slug', async () => {
    const result = await executeTool('read_brand_section', { slug: 'voice-and-style' }, '/tmp');
    expect(result).toContain('Voice and Style Guide');
    expect(result.length).toBeGreaterThan(100);
  });

  it('reads a brand pattern by slug', async () => {
    const result = await executeTool('read_brand_section', { slug: 'brushstroke-textures' }, '/tmp');
    expect(result).toContain('Brushstroke Textures');
  });

  it('returns error for unknown slug', async () => {
    const result = await executeTool('read_brand_section', { slug: 'nonexistent' }, '/tmp');
    expect(result).toContain('No brand section found');
  });
});

// ---------------------------------------------------------------------------
// buildCopyPrompt — uses tool instructions, not inline content
// ---------------------------------------------------------------------------

describe('buildCopyPrompt', () => {
  it('instructs agent to use list_brand_sections', () => {
    const prompt = buildCopyPrompt(makeCtx());
    expect(prompt).toContain('list_brand_sections');
  });

  it('instructs agent to use read_brand_section', () => {
    const prompt = buildCopyPrompt(makeCtx());
    expect(prompt).toContain('read_brand_section');
  });

  it('references voice-guide category', () => {
    const prompt = buildCopyPrompt(makeCtx());
    expect(prompt).toContain('voice-guide');
  });

  it('does NOT inline brand content', () => {
    const prompt = buildCopyPrompt(makeCtx());
    // Prompt should be short — no 90k of voice rules dumped in
    expect(prompt.length).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// buildLayoutPrompt — tool-based brand access
// ---------------------------------------------------------------------------

describe('buildLayoutPrompt', () => {
  it('instructs agent to use list_brand_sections for layout-archetype', () => {
    const prompt = buildLayoutPrompt(makeCtx());
    expect(prompt).toContain('layout-archetype');
  });

  it('still instructs agent to read copy.md', () => {
    const prompt = buildLayoutPrompt(makeCtx());
    expect(prompt).toContain('copy.md');
  });

  it('does NOT inline brand content', () => {
    const prompt = buildLayoutPrompt(makeCtx());
    expect(prompt.length).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// buildStylingPrompt — tool-based brand access
// ---------------------------------------------------------------------------

describe('buildStylingPrompt', () => {
  it('instructs agent to use list_brand_sections', () => {
    const prompt = buildStylingPrompt(makeCtx());
    expect(prompt).toContain('list_brand_sections');
  });

  it('references design-tokens and pattern categories', () => {
    const prompt = buildStylingPrompt(makeCtx());
    expect(prompt).toContain('design-tokens');
    expect(prompt).toContain('pattern');
  });

  it('instructs agent to use list_brand_assets tool', () => {
    const prompt = buildStylingPrompt(makeCtx());
    expect(prompt).toContain('list_brand_assets');
  });

  it('does NOT inline brand content', () => {
    const prompt = buildStylingPrompt(makeCtx());
    expect(prompt.length).toBeLessThan(1500);
  });
});
