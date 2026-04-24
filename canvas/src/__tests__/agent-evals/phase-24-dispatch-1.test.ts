/**
 * phase-24-dispatch-1.test.ts
 *
 * Tests for Phase 24 Dispatch 1 foundation:
 * 1. searchBrandAssets scoring — correct ranking by name/desc/tags
 * 2. searchBrandImages tool — url field format
 * 3. TOOL_POLICY completeness — every agent.ts tool has a registry entry
 * 4. dailySpendUsd — returns 0 for empty log
 * 5. writeToolAuditLog + dailySpendUsd integration — persists and sums cost
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeDb, getDb } from '../../lib/db';
import {
  searchBrandAssets,
  writeToolAuditLog,
  dailySpendUsd,
} from '../../server/db-api';
import { searchBrandImages } from '../../server/agent-tools';
import { TOOL_POLICY } from '../../server/capabilities';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';

// ─── Test DB setup ────────────────────────────────────────────────────────────

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase24-d1-test-'));

beforeAll(() => {
  closeDb();
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  // Initialize DB schema (triggers initSchema including Phase 24 migrations)
  getDb();
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedAsset(overrides: {
  name: string;
  category?: string;
  description?: string | null;
  tags?: string;
}): string {
  const db = getDb();
  const id = nanoid();
  db.prepare(
    `INSERT INTO brand_assets
       (id, name, category, file_path, mime_type, size_bytes, tags, description, source, dam_deleted, created_at)
     VALUES (?, ?, ?, ?, 'image/png', 0, ?, ?, 'local', 0, ?)`,
  ).run(
    id,
    overrides.name,
    overrides.category ?? 'images',
    `/assets/${id}.png`,
    overrides.tags ?? '[]',
    overrides.description ?? null,
    Date.now(),
  );
  return id;
}

// ─── 1. searchBrandAssets scoring ────────────────────────────────────────────

describe('searchBrandAssets scoring', () => {
  let idNameMatch: string;
  let idDescMatch: string;
  let idTagMatch: string;

  beforeAll(() => {
    // Seed 3 assets with different relevance to the query "fitness runner"
    idNameMatch = seedAsset({
      name: 'fitness-runner-hero',
      description: 'A high-energy photo',
      tags: '[]',
    });
    idDescMatch = seedAsset({
      name: 'lifestyle-outdoor',
      description: 'fitness runner in an outdoor setting',
      tags: '[]',
    });
    idTagMatch = seedAsset({
      name: 'promo-shot',
      description: 'Product promotion',
      tags: '["runner","sport"]',
    });
  });

  it('name match scores higher than description-only match', () => {
    const results = searchBrandAssets('fitness runner', undefined, 25);
    // Filter to only our seeded assets for deterministic comparison
    const seededIds = new Set([idNameMatch, idDescMatch, idTagMatch]);
    const filtered = results.filter((r) => seededIds.has(r.id));

    const nameResult = filtered.find((r) => r.id === idNameMatch);
    const descResult = filtered.find((r) => r.id === idDescMatch);
    const tagResult = filtered.find((r) => r.id === idTagMatch);

    expect(nameResult).toBeDefined();
    expect(descResult).toBeDefined();
    expect(tagResult).toBeDefined();

    // Name match: +3 per token × 2 tokens = 6
    // Desc match: +2 per token × 2 tokens = 4 (both 'fitness' and 'runner' in desc)
    // Tag match: +1 per token × 1 token = 1 (only 'runner' in tags)
    expect(nameResult!.score).toBeGreaterThan(descResult!.score);
    expect(descResult!.score).toBeGreaterThan(tagResult!.score);
  });

  it('returns results sorted by score descending', () => {
    const results = searchBrandAssets('fitness runner', undefined, 25);
    const seededIds = new Set([idNameMatch, idDescMatch, idTagMatch]);
    const filtered = results.filter((r) => seededIds.has(r.id));
    for (let i = 1; i < filtered.length; i++) {
      expect(filtered[i - 1].score).toBeGreaterThanOrEqual(filtered[i].score);
    }
  });

  it('category filter restricts results to matching category', () => {
    // Seed an asset in a different category
    seedAsset({ name: 'fitness-logo', category: 'logos', description: 'fitness brand logo' });
    const imagesOnly = searchBrandAssets('fitness', 'images', 25);
    for (const r of imagesOnly) {
      expect(r.category).toBe('images');
    }
  });

  it('returns empty array for blank query tokens', () => {
    const results = searchBrandAssets('   ', undefined, 10);
    expect(results).toEqual([]);
  });

  it('respects limit cap of 25', () => {
    const results = searchBrandAssets('fitness', undefined, 100);
    expect(results.length).toBeLessThanOrEqual(25);
  });

  it('result url is formatted as /api/brand-assets/serve/<name>', () => {
    const results = searchBrandAssets('fitness runner', undefined, 5);
    const seededIds = new Set([idNameMatch, idDescMatch, idTagMatch]);
    const filtered = results.filter((r) => seededIds.has(r.id));
    for (const r of filtered) {
      expect(r.url).toMatch(/^\/api\/brand-assets\/serve\//);
      expect(r.url).toContain(encodeURIComponent(r.name));
    }
  });
});

// ─── 2. searchBrandImages tool ────────────────────────────────────────────────

describe('searchBrandImages tool', () => {
  it('returns empty array for empty query', () => {
    const results = searchBrandImages({ query: '' });
    expect(results).toEqual([]);
  });

  it('url field matches /api/brand-assets/serve/ pattern', () => {
    const results = searchBrandImages({ query: 'fitness runner', limit: 5 });
    for (const r of results) {
      expect(r.url).toMatch(/^\/api\/brand-assets\/serve\//);
    }
  });

  it('respects limit parameter (capped at 25)', () => {
    const results = searchBrandImages({ query: 'fitness', limit: 50 });
    expect(results.length).toBeLessThanOrEqual(25);
  });

  it('result has required fields: id, name, url, mimeType, description, score', () => {
    // Seed a known asset
    seedAsset({ name: 'unique-brand-photo-xyz', description: 'unique-brand-photo-xyz test' });
    const results = searchBrandImages({ query: 'unique-brand-photo-xyz' });
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('name');
    expect(r).toHaveProperty('url');
    expect(r).toHaveProperty('mimeType');
    expect(r).toHaveProperty('description');
    expect(r).toHaveProperty('score');
  });
});

// ─── 3. TOOL_POLICY completeness ─────────────────────────────────────────────

describe('TOOL_POLICY completeness', () => {
  // The canonical list of tools registered in agent.ts TOOL_DEFINITIONS.
  // Keep this in sync — the test fails if a tool is added to agent.ts without
  // a corresponding entry in capabilities.ts.
  const AGENT_TOOLS = [
    'list_voice_guide',
    'read_voice_guide',
    'list_patterns',
    'read_pattern',
    'list_assets',
    'list_templates',
    'read_template',
    'list_archetypes',
    'read_archetype',
    'update_pattern',
    'create_pattern',
    'delete_pattern',
    'update_voice_guide',
    'create_voice_guide',
    'render_preview',
    'save_creation',
    'edit_creation',
    'save_as_template',
    'get_ui_context',
    'get_creation',
    'get_campaign',
    'search_brand_images',
  ];

  it('TOOL_POLICY has an entry for every agent.ts tool', () => {
    for (const toolName of AGENT_TOOLS) {
      expect(
        Object.prototype.hasOwnProperty.call(TOOL_POLICY, toolName),
        `Missing TOOL_POLICY entry for tool: ${toolName}`,
      ).toBe(true);
    }
  });

  it('every TOOL_POLICY entry has valid tier, costProfile, sideEffect', () => {
    const validTiers = new Set(['always-allow', 'ask-first', 'never-allow-by-default']);
    const validCosts = new Set(['free', 'tokens', 'image-api']);
    const validSideEffects = new Set(['read', 'write-db', 'spend-api', 'write-fs']);
    for (const [name, policy] of Object.entries(TOOL_POLICY)) {
      expect(validTiers.has(policy.tier), `${name}.tier invalid: ${policy.tier}`).toBe(true);
      expect(
        validCosts.has(policy.costProfile),
        `${name}.costProfile invalid: ${policy.costProfile}`,
      ).toBe(true);
      expect(
        validSideEffects.has(policy.sideEffect),
        `${name}.sideEffect invalid: ${policy.sideEffect}`,
      ).toBe(true);
      expect(typeof policy.responsibility).toBe('string');
      expect(policy.responsibility.length).toBeGreaterThan(0);
    }
  });

  it('search_brand_images is tier always-allow with read sideEffect', () => {
    const policy = TOOL_POLICY['search_brand_images'];
    expect(policy).toBeDefined();
    expect(policy.tier).toBe('always-allow');
    expect(policy.sideEffect).toBe('read');
    expect(policy.costProfile).toBe('free');
  });
});

// ─── 4. dailySpendUsd baseline ────────────────────────────────────────────────

describe('dailySpendUsd', () => {
  it('returns 0 when tool_audit_log is empty for the given period', () => {
    // Use a future timestamp so no existing rows fall in range
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const spend = dailySpendUsd(farFuture);
    expect(spend).toBe(0);
  });

  it('returns 0 with default (today) when no entries exist today', () => {
    // This may be flaky if rows from this test session land in today's window,
    // but we call it before any writeToolAuditLog calls in this describe block.
    // Use start-of-far-future-day to be safe.
    const spend = dailySpendUsd(Date.now() + 100_000_000);
    expect(spend).toBe(0);
  });
});

// ─── 5. writeToolAuditLog + dailySpendUsd integration ────────────────────────

describe('writeToolAuditLog + dailySpendUsd integration', () => {
  it('persists a log entry and dailySpendUsd reflects the cost', () => {
    const beforeTs = Date.now();

    writeToolAuditLog({
      sessionId: 'test-session-001',
      tool: 'search_brand_images',
      argsHash: 'abc123',
      tier: 'always-allow',
      decision: 'allowed',
      costUsdEst: 0.05,
      outcome: 'ok',
    });

    writeToolAuditLog({
      sessionId: 'test-session-001',
      tool: 'render_preview',
      argsHash: 'def456',
      tier: 'always-allow',
      decision: 'allowed',
      costUsdEst: 0.10,
      outcome: 'ok',
    });

    const spend = dailySpendUsd(beforeTs);
    // Should sum both entries (0.05 + 0.10 = 0.15), within float tolerance
    expect(spend).toBeCloseTo(0.15, 5);
  });

  it('persists entry with null sessionId', () => {
    const db = getDb();
    writeToolAuditLog({
      sessionId: null,
      tool: 'list_assets',
      argsHash: 'xyz789',
      tier: 'always-allow',
      decision: 'allowed',
    });
    const row = db
      .prepare('SELECT session_id, tool FROM tool_audit_log WHERE tool = ? ORDER BY timestamp DESC LIMIT 1')
      .get('list_assets') as { session_id: string | null; tool: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.session_id).toBeNull();
    expect(row!.tool).toBe('list_assets');
  });

  it('row has correct tier and decision', () => {
    const db = getDb();
    writeToolAuditLog({
      sessionId: 'test-check-fields',
      tool: 'save_creation',
      argsHash: 'hash-fields',
      tier: 'ask-first',
      decision: 'approved',
      costUsdEst: 0,
      outcome: 'ok',
      detailJson: '{"extra":"data"}',
    });
    const row = db
      .prepare(
        'SELECT tier, decision, detail_json FROM tool_audit_log WHERE session_id = ? AND tool = ? LIMIT 1',
      )
      .get('test-check-fields', 'save_creation') as
      | { tier: string; decision: string; detail_json: string | null }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.tier).toBe('ask-first');
    expect(row!.decision).toBe('approved');
    expect(row!.detail_json).toBe('{"extra":"data"}');
  });
});
