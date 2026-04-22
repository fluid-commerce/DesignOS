// @vitest-environment node

/**
 * Tests for context_map and context_log DB tables and API functions.
 * Uses a temp DB for complete isolation.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb, getDb } from '../lib/db';
import {
  getContextMap,
  upsertContextMapEntry,
  deleteContextMapEntry,
  insertContextLog,
  getContextLogs,
} from '../server/db-api';
import { seedContextMapIfEmpty } from '../server/brand-seeder';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let testDir: string;

beforeEach(() => {
  closeDb();
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-map-test-'));
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  // Initialize the schema
  getDb();
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('getContextMap', () => {
  it('returns empty array on fresh DB', () => {
    const entries = getContextMap();
    expect(entries).toEqual([]);
  });
});

describe('seedContextMapIfEmpty', () => {
  it('seeds 9 default entries', () => {
    const count = seedContextMapIfEmpty();
    expect(count).toBe(9);
    const entries = getContextMap();
    expect(entries).toHaveLength(9);
  });

  it('is idempotent — second call returns count without double-inserting', () => {
    seedContextMapIfEmpty();
    const countAfterFirst = getContextMap().length;
    const returned = seedContextMapIfEmpty();
    const countAfterSecond = getContextMap().length;
    expect(countAfterSecond).toBe(countAfterFirst);
    expect(returned).toBe(9);
  });

  it('seeds entries with correct creation types and stages', () => {
    seedContextMapIfEmpty();
    const entries = getContextMap();
    const instagram = entries.filter((e) => e.creationType === 'instagram');
    const linkedin = entries.filter((e) => e.creationType === 'linkedin');
    const onePager = entries.filter((e) => e.creationType === 'one-pager');
    expect(instagram).toHaveLength(3);
    expect(linkedin).toHaveLength(3);
    expect(onePager).toHaveLength(3);
    const stages = [...new Set(entries.map((e) => e.stage))].sort();
    expect(stages).toEqual(['copy', 'layout', 'styling']);
  });

  it('copy stage entries include voice-guide sections', () => {
    seedContextMapIfEmpty();
    const copyEntries = getContextMap().filter((e) => e.stage === 'copy');
    for (const entry of copyEntries) {
      expect(entry.sections).toContain('voice-guide:*');
    }
  });
});

describe('upsertContextMapEntry', () => {
  it('inserts a new row when no id is provided', () => {
    const entry = upsertContextMapEntry({
      creationType: 'twitter',
      stage: 'copy',
      sections: ['voice-guide:*'],
      priority: 75,
      maxTokens: 5000,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.creationType).toBe('twitter');
    expect(entry.stage).toBe('copy');
    expect(entry.sections).toEqual(['voice-guide:*']);
    expect(entry.priority).toBe(75);
    expect(entry.maxTokens).toBe(5000);
  });

  it('returns the inserted row with sections correctly parsed as array', () => {
    const entry = upsertContextMapEntry({
      creationType: 'facebook',
      stage: 'layout',
      sections: ['design-tokens:*', 'layout-archetype:*'],
    });
    expect(Array.isArray(entry.sections)).toBe(true);
    expect(entry.sections).toHaveLength(2);
  });

  it('updates an existing row when id is provided', () => {
    const created = upsertContextMapEntry({
      creationType: 'instagram',
      stage: 'copy',
      sections: ['voice-guide:*'],
      priority: 80,
    });

    const updated = upsertContextMapEntry({
      id: created.id,
      creationType: 'instagram',
      stage: 'copy',
      sections: ['voice-guide:*', 'design-tokens:color-palette'],
      priority: 90,
      maxTokens: 12000,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.sections).toEqual(['voice-guide:*', 'design-tokens:color-palette']);
    expect(updated.priority).toBe(90);
    expect(updated.maxTokens).toBe(12000);
  });
});

describe('UNIQUE(creation_type, stage) constraint', () => {
  it('throws when inserting duplicate creation_type + stage', () => {
    upsertContextMapEntry({
      creationType: 'instagram',
      stage: 'copy',
      sections: ['voice-guide:*'],
    });
    expect(() => {
      upsertContextMapEntry({
        creationType: 'instagram',
        stage: 'copy',
        sections: ['design-tokens:*'],
      });
    }).toThrow();
  });
});

describe('deleteContextMapEntry', () => {
  it('removes a row and returns true', () => {
    const entry = upsertContextMapEntry({
      creationType: 'tiktok',
      stage: 'copy',
      sections: ['voice-guide:*'],
    });
    const result = deleteContextMapEntry(entry.id);
    expect(result).toBe(true);
    const all = getContextMap();
    expect(all.find((e) => e.id === entry.id)).toBeUndefined();
  });

  it('returns false for a nonexistent id', () => {
    const result = deleteContextMapEntry('nonexistent-id-xyz');
    expect(result).toBe(false);
  });
});

describe('insertContextLog', () => {
  it('writes a row with correct fields', () => {
    const log = insertContextLog({
      generationId: 'gen-123',
      creationType: 'instagram',
      stage: 'copy',
      injectedSections: ['voice-guide:what-is-fluid'],
      tokenEstimate: 2500,
      gapToolCalls: [
        { tool: 'read_brand_section', input: { slug: 'voice-and-style' }, timestamp: Date.now() },
      ],
    });

    expect(log.id).toBeTruthy();
    expect(log.generationId).toBe('gen-123');
    expect(log.creationType).toBe('instagram');
    expect(log.stage).toBe('copy');
    expect(log.injectedSections).toEqual(['voice-guide:what-is-fluid']);
    expect(log.tokenEstimate).toBe(2500);
    expect(log.gapToolCalls).toHaveLength(1);
    expect(log.gapToolCalls[0].tool).toBe('read_brand_section');
    expect(log.createdAt).toBeGreaterThan(0);
  });

  it('defaults gapToolCalls to empty array when not provided', () => {
    const log = insertContextLog({
      generationId: 'gen-456',
      creationType: 'linkedin',
      stage: 'layout',
      injectedSections: ['design-tokens:color-palette'],
      tokenEstimate: 1200,
    });

    expect(log.gapToolCalls).toEqual([]);
  });
});

describe('getContextLogs', () => {
  it('returns entries filtered by creationType', () => {
    insertContextLog({
      generationId: 'g1',
      creationType: 'instagram',
      stage: 'copy',
      injectedSections: [],
      tokenEstimate: 100,
    });
    insertContextLog({
      generationId: 'g2',
      creationType: 'linkedin',
      stage: 'copy',
      injectedSections: [],
      tokenEstimate: 200,
    });
    insertContextLog({
      generationId: 'g3',
      creationType: 'instagram',
      stage: 'layout',
      injectedSections: [],
      tokenEstimate: 300,
    });

    const instagramLogs = getContextLogs({ creationType: 'instagram' });
    expect(instagramLogs.length).toBeGreaterThanOrEqual(2);
    for (const log of instagramLogs) {
      expect(log.creationType).toBe('instagram');
    }
  });

  it('returns entries filtered by stage', () => {
    insertContextLog({
      generationId: 'g4',
      creationType: 'instagram',
      stage: 'styling',
      injectedSections: [],
      tokenEstimate: 400,
    });

    const stylingLogs = getContextLogs({ stage: 'styling' });
    expect(stylingLogs.length).toBeGreaterThanOrEqual(1);
    for (const log of stylingLogs) {
      expect(log.stage).toBe('styling');
    }
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      insertContextLog({
        generationId: `limit-g${i}`,
        creationType: 'one-pager',
        stage: 'copy',
        injectedSections: [],
        tokenEstimate: i * 100,
      });
    }
    const limited = getContextLogs({ creationType: 'one-pager', limit: 3 });
    expect(limited.length).toBeLessThanOrEqual(3);
  });
});
