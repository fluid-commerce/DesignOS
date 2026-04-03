import { describe, it, expect } from 'vitest';
import {
  listVoiceGuide, readVoiceGuide,
  listPatterns, readPattern,
  listAssets, listTemplates,
  listArchetypes, readArchetype,
} from '../src/server/agent-tools';

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
