/**
 * Tests for parseChannelHints singularity detection and campaign vs single routing.
 * RED phase: these tests will fail until parseChannelHints is updated and exported.
 */

import { describe, it, expect } from 'vitest';
import { parseChannelHints } from '../server/watcher.js';

describe('parseChannelHints — singularity detection', () => {
  it('single post prompt returns isSingleCreation: true', () => {
    const result = parseChannelHints('create a post about payments');
    expect(result.isSingleCreation).toBe(true);
  });

  it('single instagram prompt returns isSingleCreation: true', () => {
    const result = parseChannelHints('create a linkedin post');
    expect(result.isSingleCreation).toBe(true);
  });

  it('single image prompt returns isSingleCreation: true', () => {
    const result = parseChannelHints('make an instagram image');
    expect(result.isSingleCreation).toBe(true);
  });

  it('one-pager prompt returns isSingleCreation: true with inferredType one-pager', () => {
    const result = parseChannelHints('create a one-pager');
    expect(result.isSingleCreation).toBe(true);
    expect(result.inferredType).toBe('one-pager');
  });

  it('campaign keyword overrides singularity — returns isSingleCreation: false', () => {
    const result = parseChannelHints('campaign for payments');
    expect(result.isSingleCreation).toBe(false);
  });

  it('multiple posts keyword returns isSingleCreation: false', () => {
    const result = parseChannelHints('create multiple posts');
    expect(result.isSingleCreation).toBe(false);
  });

  it('campaign with instagram returns isSingleCreation: false', () => {
    const result = parseChannelHints('a campaign with instagram posts');
    expect(result.isSingleCreation).toBe(false);
  });

  it('existing channel-only hints remain campaign (3 linkedin, not single)', () => {
    const result = parseChannelHints('just linkedin');
    expect(result.isSingleCreation).toBe(false);
    expect(result.creationCounts['linkedin']).toBe(3);
  });
});

describe('parseChannelHints — type inference for single creations', () => {
  it('linkedin single prompt infers linkedin type', () => {
    const result = parseChannelHints('create a linkedin post');
    expect(result.isSingleCreation).toBe(true);
    expect(result.inferredType).toBe('linkedin');
    expect(result.channels).toEqual(['linkedin']);
    expect(result.creationCounts).toEqual({ linkedin: 1 });
  });

  it('instagram single prompt infers instagram type', () => {
    const result = parseChannelHints('make an instagram image');
    expect(result.isSingleCreation).toBe(true);
    expect(result.inferredType).toBe('instagram');
    expect(result.channels).toEqual(['instagram']);
    expect(result.creationCounts).toEqual({ instagram: 1 });
  });

  it('generic post prompt defaults to instagram type', () => {
    const result = parseChannelHints('create a post about payments');
    expect(result.isSingleCreation).toBe(true);
    expect(result.inferredType).toBe('instagram');
  });

  it('one-pager prompt infers one-pager type with 1 count', () => {
    const result = parseChannelHints('create a one-pager');
    expect(result.isSingleCreation).toBe(true);
    expect(result.inferredType).toBe('one-pager');
    expect(result.channels).toEqual(['one-pager']);
    expect(result.creationCounts).toEqual({ 'one-pager': 1 });
  });
});

describe('parseChannelHints — backward compatibility', () => {
  it('non-single prompt still returns all default channels', () => {
    const result = parseChannelHints('campaign for payments');
    expect(result.isSingleCreation).toBe(false);
    expect(result.channels).toContain('instagram');
    expect(result.channels).toContain('linkedin');
    expect(result.channels).toContain('one-pager');
  });

  it('just instagram returns channel hint (3 creations), not single', () => {
    const result = parseChannelHints('just instagram');
    expect(result.isSingleCreation).toBe(false);
    expect(result.creationCounts['instagram']).toBe(3);
  });

  it('result always contains isSingleCreation boolean field', () => {
    const single = parseChannelHints('create a post');
    const campaign = parseChannelHints('build a campaign');
    expect(typeof single.isSingleCreation).toBe('boolean');
    expect(typeof campaign.isSingleCreation).toBe('boolean');
  });
});
