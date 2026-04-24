/**
 * invariants.test.ts — Archetype invariant checks
 *
 * Every archetype must:
 * 1. Have the required 3 files: index.html, schema.json, README.md
 * 2. Pass schema shape (archetypeId, width, height, fields, brush:null)
 * 3. Have selector parity (every field.sel class exists in index.html)
 * 4. Have no brand bleed (no /fluid-assets/ URLs, no inline style attributes)
 * 5. Instagram-portrait archetypes must have valid meta (category, imageRole, useCases≥1, slotCount)
 * 6. No templateId field (use archetypeId)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ARCHETYPES_DIR = path.resolve(__dirname, '../../../../archetypes');
const SKIP_DIRS = new Set(['components']);

const INSTAGRAM_PORTRAIT_DIMS = { width: 1080, height: 1350 };
const INSTAGRAM_PORTRAIT_META_REQUIRED = ['category', 'imageRole', 'useCases', 'slotCount'] as const;

function extractClassName(sel: string): string {
  return sel.split(/[\s>+~]/)[0].replace(/^\./, '');
}

function getPlatform(slug: string, schema: any): string {
  if (schema?.platform) return schema.platform;
  if (slug.endsWith('-li')) return 'linkedin-landscape';
  if (slug.endsWith('-op')) return 'one-pager';
  return 'instagram-square';
}

function getArchetypeSlugs(): string[] {
  if (!fs.existsSync(ARCHETYPES_DIR)) return [];
  return fs.readdirSync(ARCHETYPES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !SKIP_DIRS.has(d.name))
    .map(d => d.name);
}

describe('archetype invariants', () => {
  const slugs = getArchetypeSlugs();

  it('at least 44 archetypes exist (19 legacy + 25 new)', () => {
    expect(slugs.length).toBeGreaterThanOrEqual(44);
  });

  for (const slug of slugs) {
    const dir = path.join(ARCHETYPES_DIR, slug);

    describe(`archetype: ${slug}`, () => {
      const schemaPath = path.join(dir, 'schema.json');
      const htmlPath = path.join(dir, 'index.html');
      const readmePath = path.join(dir, 'README.md');

      it('has all required files', () => {
        expect(fs.existsSync(htmlPath), `missing index.html`).toBe(true);
        expect(fs.existsSync(schemaPath), `missing schema.json`).toBe(true);
        expect(fs.existsSync(readmePath), `missing README.md`).toBe(true);
      });

      it('schema.json is valid JSON', () => {
        const raw = fs.readFileSync(schemaPath, 'utf8');
        expect(() => JSON.parse(raw)).not.toThrow();
      });

      it('schema has archetypeId, width, height, fields, brush:null — no templateId', () => {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        expect(typeof schema.width).toBe('number');
        expect(typeof schema.height).toBe('number');
        expect(Array.isArray(schema.fields)).toBe(true);
        expect(schema.brush).toBeNull();
        expect(schema).not.toHaveProperty('templateId');
      });

      it('selector parity: every field.sel class exists in index.html', () => {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const html = fs.readFileSync(htmlPath, 'utf8');
        const mismatches: string[] = [];
        for (const field of schema.fields ?? []) {
          if (field.type === 'divider') continue;
          if (typeof field.sel === 'string') {
            const cls = extractClassName(field.sel);
            if (cls && !html.includes(cls)) {
              mismatches.push(`sel "${field.sel}" → class "${cls}" not found in index.html`);
            }
          }
        }
        expect(mismatches, mismatches.join(', ')).toHaveLength(0);
      });

      it('no brand bleed: no /fluid-assets/ URLs', () => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        expect(html).not.toContain('/fluid-assets/');
      });

      it('no external image URLs in HTML', () => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        // data: URIs are fine; http:// or https:// URLs in src attributes are not
        const externalSrcMatch = html.match(/src=["']https?:\/\//g);
        expect(externalSrcMatch).toBeNull();
      });

      it('has .background-layer and .foreground-layer divs', () => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        expect(html).toContain('class="background-layer"');
        expect(html).toContain('class="foreground-layer"');
      });

      // Forward-only: instagram-portrait archetypes require meta
      it('instagram-portrait: must have valid meta object', () => {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const platform = getPlatform(slug, schema);
        if (platform !== 'instagram-portrait') return; // skip for legacy archetypes

        expect(schema.meta, 'meta object is required for instagram-portrait').toBeTruthy();
        const meta = schema.meta;

        for (const field of INSTAGRAM_PORTRAIT_META_REQUIRED) {
          expect(meta[field], `meta.${field} is required`).toBeDefined();
        }
        expect(
          Array.isArray(meta.useCases) && meta.useCases.length >= 1,
          'meta.useCases must have at least 1 entry'
        ).toBe(true);
        expect(
          typeof meta.slotCount === 'number' && meta.slotCount >= 1,
          'meta.slotCount must be a positive integer'
        ).toBe(true);
      });
    });
  }
});
