// @vitest-environment node

/**
 * Tests for brand context loading and injection into pipeline stage prompts.
 * Verifies that:
 * - loadBrandContextFromDb() returns non-empty strings from DB
 * - build*Prompt functions inject brand context inline (no read_file instructions for brand docs)
 * - Each stage prompt contains the correct brand context heading
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
  // Initialize schema + seed data
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
// Helpers
// ---------------------------------------------------------------------------

import {
  loadBrandContextFromDb,
  BrandContext,
} from '../server/api-pipeline';
import type { PipelineContext } from '../server/api-pipeline';

// Access internal build*Prompt functions via module re-export or test-exported functions.
// Since they are private, we test them indirectly via the exported pipeline context.
// However, the plan instructs us to export them or test them via the module.
// We'll dynamically import the module to access the build*Prompt functions.

// We need to test build*Prompt functions — they are currently private in api-pipeline.ts.
// Per the plan, we need to export them for testing OR verify via integration.
// The plan's test list checks them directly, so we'll export them.
// For now, use a workaround: import the module and access through a test helper.

// Import build*Prompt functions — they will be exported after the implementation
import {
  buildCopyPrompt as _buildCopyPrompt,
  buildLayoutPrompt as _buildLayoutPrompt,
  buildStylingPrompt as _buildStylingPrompt,
} from '../server/api-pipeline';

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
// loadBrandContextFromDb
// ---------------------------------------------------------------------------

describe('loadBrandContextFromDb', () => {
  it('returns an object with voiceRules, designTokens, layoutArchetypes, patternSnippets', () => {
    const brandCtx = loadBrandContextFromDb();
    expect(brandCtx).toHaveProperty('voiceRules');
    expect(brandCtx).toHaveProperty('designTokens');
    expect(brandCtx).toHaveProperty('layoutArchetypes');
    expect(brandCtx).toHaveProperty('patternSnippets');
  });

  it('voiceRules is a non-empty string from voice_guide_docs', () => {
    const brandCtx = loadBrandContextFromDb();
    expect(typeof brandCtx.voiceRules).toBe('string');
    expect(brandCtx.voiceRules.length).toBeGreaterThan(0);
  });

  it('designTokens is a non-empty string from brand_patterns category=design-tokens', () => {
    const brandCtx = loadBrandContextFromDb();
    expect(typeof brandCtx.designTokens).toBe('string');
    expect(brandCtx.designTokens.length).toBeGreaterThan(0);
  });

  it('layoutArchetypes is a non-empty string from brand_patterns category=layout-archetype', () => {
    const brandCtx = loadBrandContextFromDb();
    expect(typeof brandCtx.layoutArchetypes).toBe('string');
    expect(brandCtx.layoutArchetypes.length).toBeGreaterThan(0);
  });

  it('patternSnippets is a non-empty string from brand_patterns category=pattern', () => {
    const brandCtx = loadBrandContextFromDb();
    expect(typeof brandCtx.patternSnippets).toBe('string');
    expect(brandCtx.patternSnippets.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildCopyPrompt — brand context injection
// ---------------------------------------------------------------------------

describe('buildCopyPrompt with brandCtx', () => {
  it('includes Brand Voice Rules heading', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildCopyPrompt(ctx, brandCtx);
    expect(prompt).toContain('Brand Voice Rules');
  });

  it('does NOT contain "read_file" instruction for brand docs', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildCopyPrompt(ctx, brandCtx);
    expect(prompt).not.toContain('read_file to load brand/');
    expect(prompt).not.toContain('Use read_file to load brand/voice-rules.md');
  });

  it('does NOT contain "load brand/" in the prompt', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildCopyPrompt(ctx, brandCtx);
    expect(prompt).not.toContain('load brand/');
  });
});

// ---------------------------------------------------------------------------
// buildLayoutPrompt — brand context injection
// ---------------------------------------------------------------------------

describe('buildLayoutPrompt with brandCtx', () => {
  it('includes Layout Archetypes heading', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildLayoutPrompt(ctx, brandCtx);
    expect(prompt).toContain('Layout Archetypes');
  });

  it('does NOT contain "read_file to load brand/" instruction', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildLayoutPrompt(ctx, brandCtx);
    expect(prompt).not.toContain('read_file to load brand/');
  });

  it('still instructs agent to read copy.md from working dir (intermediate work files OK)', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildLayoutPrompt(ctx, brandCtx);
    expect(prompt).toContain('copy.md');
  });
});

// ---------------------------------------------------------------------------
// buildStylingPrompt — brand context injection
// ---------------------------------------------------------------------------

describe('buildStylingPrompt with brandCtx', () => {
  it('includes Design Tokens heading', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildStylingPrompt(ctx, brandCtx);
    expect(prompt).toContain('Design Tokens');
  });

  it('does NOT contain "read_file to load brand/design-tokens.md"', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildStylingPrompt(ctx, brandCtx);
    expect(prompt).not.toContain('read_file to load brand/design-tokens.md');
  });

  it('still contains /api/brand-assets instruction for asset discovery', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildStylingPrompt(ctx, brandCtx);
    expect(prompt).toContain('/api/brand-assets');
  });

  it('still instructs agent to read layout.html from working dir (intermediate work files OK)', () => {
    const brandCtx = loadBrandContextFromDb();
    const ctx = makeCtx();
    const prompt = _buildStylingPrompt(ctx, brandCtx);
    expect(prompt).toContain('layout.html');
  });
});
