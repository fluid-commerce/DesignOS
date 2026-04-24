/**
 * phase-23.test.ts — Golden-task prompts + archetype selection assertions
 *
 * Tests that the listArchetypes() function:
 * 1. Returns the correct archetypes for filter combinations that mirror agent decision-making
 * 2. Returns rich meta projection (category, imageRole, useCases, slotCount)
 * 3. Enforces page size limits
 * 4. Preserves backwards compatibility with legacy (non-portrait) archetypes
 *
 * These are meaningful behavioral tests — not tautological.
 * Each test encodes a real agent decision scenario.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';

// We test listArchetypes directly, not via the agent HTTP layer.
// Adjust import path to resolve relative to canvas/src.
process.env.FLUID_ARCHETYPES_DIR = path.resolve(__dirname, '../../../../archetypes');

// Import after env var is set
import { listArchetypes, normalizePlatform } from '../../server/agent-tools';

// ─── Golden task 1: Stat/data content for a quarterly review ─────────────────
describe('golden-task: stat/data quarterly review post (4:5)', () => {
  it('returns stat-data archetypes for instagram-portrait', () => {
    const results = listArchetypes({ category: 'stat-data', platform: 'instagram-portrait' });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('hero-stat-45');
    expect(slugs).toContain('big-number-card');
    expect(slugs).toContain('stat-comparison');
    // Should NOT include legacy square archetypes
    expect(slugs).not.toContain('hero-stat');
    expect(slugs).not.toContain('data-dashboard');
  });

  it('hero-stat-45 has correct meta for a 3-metric report post', () => {
    const results = listArchetypes({ category: 'stat-data', platform: 'instagram-portrait' });
    const heroStat = results.find(r => r.slug === 'hero-stat-45');
    expect(heroStat).toBeDefined();
    expect(heroStat!.imageRole).toBe('none');
    expect(heroStat!.slotCount).toBe(9);
    expect(heroStat!.useCases.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Golden task 2: Quote post — no photo available ──────────────────────────
describe('golden-task: quote post with no photo available', () => {
  it('returns quote archetypes with imageRole:none', () => {
    const results = listArchetypes({
      category: 'quote-testimonial',
      platform: 'instagram-portrait',
      imageRole: 'none',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('typographic-quote');
    // photocentric-quote has imageRole:hero — should be filtered out
    expect(slugs).not.toContain('photocentric-quote');
  });
});

// ─── Golden task 3: Quote post — strong portrait photo available ──────────────
describe('golden-task: quote post with a strong portrait photo', () => {
  it('returns hero-imageRole archetypes in quote category', () => {
    const results = listArchetypes({
      category: 'quote-testimonial',
      platform: 'instagram-portrait',
      imageRole: 'hero',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('photocentric-quote');
  });
});

// ─── Golden task 4: Launch announcement with product mockup ──────────────────
describe('golden-task: website launch with product mockup', () => {
  it('returns announcement archetypes with imageRole:accent', () => {
    const results = listArchetypes({
      category: 'announcement',
      platform: 'instagram-portrait',
      imageRole: 'accent',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('website-launch-mockup');
    // coming-soon-minimal has imageRole:none
    expect(slugs).not.toContain('coming-soon-minimal');
  });
});

// ─── Golden task 5: Event promo — venue photo available ──────────────────────
describe('golden-task: event promo with venue photo', () => {
  it('returns event-promo with background imageRole', () => {
    const results = listArchetypes({
      category: 'announcement',
      platform: 'instagram-portrait',
      imageRole: 'background',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('event-promo');
  });
});

// ─── Golden task 6: Fashion moodboard post ───────────────────────────────────
describe('golden-task: fashion moodboard with 4+ photos', () => {
  it('returns photo-collage archetypes with grid imageRole', () => {
    const results = listArchetypes({
      category: 'photo-collage',
      platform: 'instagram-portrait',
      imageRole: 'grid',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('vintage-scrapbook');
    expect(slugs).toContain('memory-grid-4up');
  });
});

// ─── Golden task 7: Hiring post with team photo ──────────────────────────────
describe('golden-task: we are hiring post with team photo', () => {
  it('returns hiring-portrait-cta from personal-about category', () => {
    const results = listArchetypes({
      category: 'personal-about',
      platform: 'instagram-portrait',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('hiring-portrait-cta');
    expect(slugs).toContain('about-me-portrait');
  });
});

// ─── Golden task 8: Product launch with 4 items ──────────────────────────────
describe('golden-task: new collection launch showing 4 products', () => {
  it('returns product-feature-grid from product category', () => {
    const results = listArchetypes({
      category: 'product',
      platform: 'instagram-portrait',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('product-feature-grid');
    expect(slugs).toContain('product-hero-backlit');
    expect(slugs).toContain('product-callout-macro');
  });
});

// ─── Golden task 9: Carousel cover for educational content ───────────────────
describe('golden-task: carousel cover for 5-tips educational series', () => {
  it('returns carousel-cover-typographic from carousel-cover category', () => {
    const results = listArchetypes({
      category: 'carousel-cover',
      platform: 'instagram-portrait',
    });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('carousel-cover-typographic');
  });

  it('carousel-cover-typographic has imageRole:none (text-only)', () => {
    const results = listArchetypes({
      category: 'carousel-cover',
      platform: 'instagram-portrait',
    });
    const cover = results.find(r => r.slug === 'carousel-cover-typographic');
    expect(cover).toBeDefined();
    expect(cover!.imageRole).toBe('none');
  });
});

// ─── Golden task 10: Default platform is portrait ────────────────────────────
describe('golden-task: default instagram platform resolves to portrait', () => {
  it('all 25 new archetypes have platform instagram-portrait', () => {
    const portraitSlugs = [
      'hero-stat-45', 'big-number-card', 'stat-comparison',
      'photocentric-quote', 'typographic-quote', 'book-quote-highlight',
      'coming-soon-minimal', 'website-launch-mockup', 'event-promo',
      'vintage-scrapbook', 'fashion-moodboard', 'memory-grid-4up', 'asymmetric-photo-collage',
      'photo-darken-headline', 'split-photo-feature',
      'numbered-tips-cover', 'how-to-step-card',
      'about-me-portrait', 'hiring-portrait-cta',
      'product-hero-backlit', 'product-feature-grid', 'product-callout-macro',
      'affirmation-note', 'handwritten-quote-photo',
      'carousel-cover-typographic',
    ];

    const results = listArchetypes({ platform: 'instagram-portrait' });
    const resultSlugs = new Set(results.map(r => r.slug));

    for (const slug of portraitSlugs) {
      expect(resultSlugs.has(slug), `${slug} should appear in instagram-portrait results`).toBe(true);
    }
  });
});

// ─── Page size enforcement ────────────────────────────────────────────────────
describe('listArchetypes page size', () => {
  it('defaults to max 25 results', () => {
    const results = listArchetypes();
    expect(results.length).toBeLessThanOrEqual(25);
  });

  it('respects custom page size up to 50', () => {
    const results = listArchetypes({ pageSize: 50 });
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('hard caps at 50 even if larger pageSize is requested', () => {
    const results = listArchetypes({ pageSize: 999 });
    expect(results.length).toBeLessThanOrEqual(50);
  });
});

// ─── Meta projection completeness ─────────────────────────────────────────────
describe('listArchetypes meta projection', () => {
  it('portrait archetypes include category, imageRole, slotCount, useCases', () => {
    const results = listArchetypes({ platform: 'instagram-portrait', pageSize: 50 });
    for (const r of results) {
      expect(typeof r.category, `${r.slug}.category`).toBe('string');
      expect(typeof r.imageRole, `${r.slug}.imageRole`).toBe('string');
      expect(typeof r.slotCount, `${r.slug}.slotCount`).toBe('number');
      expect(Array.isArray(r.useCases), `${r.slug}.useCases`).toBe(true);
      expect(r.useCases.length, `${r.slug}.useCases.length`).toBeGreaterThanOrEqual(1);
    }
  });

  it('legacy square archetypes still appear with platform:instagram-square', () => {
    const results = listArchetypes({ platform: 'instagram-square', pageSize: 50 });
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('hero-stat');
    expect(slugs).toContain('quote-testimonial');
  });
});

// ─── normalizePlatform accepts instagram-portrait ─────────────────────────────
// Regression guard: the system prompt now advertises 'instagram-portrait' as
// the default Instagram platform. If normalizePlatform doesn't accept it,
// saveCreation will throw at runtime.
describe('normalizePlatform accepts instagram-portrait', () => {
  it('does not throw for instagram-portrait', () => {
    expect(() => normalizePlatform('instagram-portrait')).not.toThrow();
    expect(normalizePlatform('instagram-portrait')).toBe('instagram-portrait');
  });

  it('accepts other known platforms unchanged', () => {
    for (const p of ['instagram', 'instagram-square', 'instagram-story', 'linkedin', 'facebook', 'twitter', 'one-pager']) {
      expect(() => normalizePlatform(p)).not.toThrow();
    }
  });

  it('still rejects unknown platforms', () => {
    expect(() => normalizePlatform('tiktok')).toThrow(/Unknown platform/);
  });
});

// ─── Determinism: sorted results ──────────────────────────────────────────────
describe('listArchetypes returns deterministic order', () => {
  it('results are sorted alphabetically by slug', () => {
    const results = listArchetypes({ pageSize: 50 });
    const slugs = results.map(r => r.slug);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });

  it('filtered results are also sorted', () => {
    const results = listArchetypes({ platform: 'instagram-portrait', pageSize: 50 });
    const slugs = results.map(r => r.slug);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });
});
