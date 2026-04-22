import { describe, it, expect } from 'vitest';
import {
  listVoiceGuide, readVoiceGuide,
  listPatterns, readPattern,
  listAssets, listTemplates,
  listArchetypes, readArchetype,
  createPattern, deletePattern,
  saveCreation, getCreation,
} from '../src/server/agent-tools';
import * as fs from 'fs';
import * as path from 'path';

describe('Brand Discovery Tools', () => {
  it('listVoiceGuide returns array with slug and title', () => {
    const result = listVoiceGuide();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('slug');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('description');
    }
  });

  it('readVoiceGuide returns content for valid slug', () => {
    const list = listVoiceGuide();
    if (list.length === 0) return; // skip if no data
    const doc = readVoiceGuide(list[0].slug);
    expect(doc).not.toBeNull();
    expect(doc!.content.length).toBeGreaterThan(0);
  });

  it('readVoiceGuide returns null for invalid slug', () => {
    expect(readVoiceGuide('nonexistent-slug-xyz')).toBeNull();
  });

  it('listPatterns returns array', () => {
    const result = listPatterns();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('slug');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('weight');
    }
  });

  it('listPatterns filters by category', () => {
    const all = listPatterns();
    if (all.length === 0) return;
    const category = all[0].category;
    const filtered = listPatterns(category);
    expect(filtered.every(p => p.category === category)).toBe(true);
  });

  it('listAssets returns array', () => {
    const result = listAssets();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('category');
    }
  });

  it('listTemplates returns array', () => {
    const result = listTemplates();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    }
  });

  it('listArchetypes returns entries from filesystem', () => {
    const result = listArchetypes();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('slug');
    expect(result[0]).toHaveProperty('slots');
  });

  it('readArchetype returns HTML and schema for valid slug', () => {
    const list = listArchetypes();
    if (list.length === 0) return;
    const arch = readArchetype(list[0].slug);
    expect(arch).not.toBeNull();
    expect(arch!.html.length).toBeGreaterThan(0);
    expect(arch!.schema).not.toBeNull();
  });

  it('readArchetype returns null for invalid slug', () => {
    expect(readArchetype('nonexistent-archetype-xyz')).toBeNull();
  });
});

describe('Brand Editing Tools', () => {
  it('createPattern creates and deletePattern removes a pattern', () => {
    const created = createPattern('colors', 'Test Agent Pattern', '# Test\nSome test content');
    // createPattern returns { slug, name, category, weight } on success or { error } on failure
    expect('error' in created).toBe(false);
    if ('error' in created) throw new Error(created.error);
    expect(created.slug).toMatch(/^test-agent-pattern(-\d+)?$/);
    expect(created.category).toBe('colors');
    expect(created.weight).toBe(50);

    // Verify it can be read back
    const found = readPattern(created.slug);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('# Test\nSome test content');

    // Delete and verify removal. Shape is { success, error? }.
    const deleted = deletePattern(created.slug);
    expect(deleted.success).toBe(true);
    expect(readPattern(created.slug)).toBeNull();

    // Deleting again returns { success: false, error: 'Pattern ... not found' }
    const deletedAgain = deletePattern(created.slug);
    expect(deletedAgain.success).toBe(false);
    expect(deletedAgain.error).toBeDefined();
  });
});

describe('Visual Tools', () => {
  it('saveCreation creates DB records and writes HTML file', () => {
    const html = '<html><body>Test creation</body></html>';
    const slotSchema = { headline: { selector: '.headline', type: 'text' } };
    const result = saveCreation(html, slotSchema, 'instagram');

    expect(result.campaignId).toBeTruthy();
    expect(result.creationId).toBeTruthy();
    expect(result.slideId).toBeTruthy();
    expect(result.iterationId).toBeTruthy();
    expect(result.htmlPath).toContain('.fluid/campaigns/');

    // Verify HTML file was written. The harness merges brand CSS layers on
    // save, so the file content is a superset of the input — check for the
    // distinctive body string instead of exact match.
    const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
    const absPath = path.resolve(PROJECT_ROOT, result.htmlPath);
    expect(fs.existsSync(absPath)).toBe(true);
    expect(fs.readFileSync(absPath, 'utf-8')).toContain('Test creation');

    // Cleanup: remove the generated file
    try {
      fs.rmSync(path.dirname(absPath), { recursive: true });
    } catch {
      // best-effort cleanup
    }
  });
});

describe('Context Tools', () => {
  it('getCreation returns merged slot state', () => {
    const html = '<html><body>Context test</body></html>';
    const slotSchema = { title: { selector: '.title', type: 'text' } };
    const result = saveCreation(html, slotSchema, 'linkedin');

    const creation = getCreation(result.iterationId);
    expect(creation).not.toBeNull();
    expect(creation!.creationType).toBe('linkedin');
    expect(creation!.slotSchema).toEqual(slotSchema);
    expect(creation!.status).toBe('unmarked');
    expect(creation!.generationStatus).toBe('complete');
    // ai_baseline was set with null values for each slot key
    expect(creation!.mergedSlotState).toEqual({ title: null });

    // Cleanup
    const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
    try {
      fs.rmSync(path.resolve(PROJECT_ROOT, path.dirname(result.htmlPath)), { recursive: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('getCreation returns null for invalid iteration', () => {
    expect(getCreation('nonexistent-iteration-xyz')).toBeNull();
  });
});
