import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Requires canvas server running at localhost:5174 (npm run dev)
// These are integration tests — they create real DB records
// Test campaigns are named with E2E prefix + timestamp for easy cleanup

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARCHETYPES_DIR = path.resolve(__dirname, '../../archetypes');

// All 10 archetype slugs (6 original + 4 added during user review)
const ARCHETYPE_SLUGS = [
  'hero-stat',
  'hero-stat-split',
  'photo-bg-overlay',
  'split-photo-text',
  'split-photo-quote',
  'quote-testimonial',
  'minimal-statement',
  'minimal-photo-top',
  'data-dashboard',
  'stat-hero-single',
] as const;

type ArchetypeSlug = typeof ARCHETYPE_SLUGS[number];

// Expected interactive field counts (non-divider fields) per archetype
const _EXPECTED_FIELD_COUNTS: Record<ArchetypeSlug, number> = {
  'hero-stat':           9,  // eyebrow, headline, body-copy, 3x stat num+label
  'hero-stat-split':     8,  // photo, eyebrow, headline, body-copy, 2x stat num+label
  'photo-bg-overlay':    3,  // photo, headline, subtext
  'split-photo-text':    3,  // photo, headline, body-copy
  'split-photo-quote':   5,  // photo, quote-text, portrait, attribution, title
  'quote-testimonial':   4,  // quote-text, portrait, attribution, title
  'minimal-statement':   2,  // headline, subtext
  'minimal-photo-top':   3,  // photo, headline, subtext
  'data-dashboard':      9,  // headline + 4x stat num+label
  'stat-hero-single':    4,  // context-label, stat-number, headline, body-copy
};

// Helper: read schema.json for an archetype
function loadSchema(slug: string): Record<string, unknown> {
  const schemaPath = path.join(ARCHETYPES_DIR, slug, 'schema.json');
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

// Helper: create a test iteration with an archetype's schema via the REST API chain
async function createTestIteration(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  slug: string,
  schema: Record<string, unknown>
) {
  // 1. Create campaign
  const campRes = await request.post('/api/campaigns', {
    data: { name: `E2E-archetype-${slug}-${Date.now()}` },
  });
  expect(campRes.ok(), `POST /api/campaigns failed for ${slug}`).toBeTruthy();
  const camp = await campRes.json() as { id: string };

  // 2. Create creation under the campaign
  const createRes = await request.post(`/api/campaigns/${camp.id}/creations`, {
    data: {
      title: `${slug}-test`,
      creationType: 'instagram-square',
      slideCount: 1,
    },
  });
  expect(createRes.ok(), `POST /api/campaigns/:id/creations failed for ${slug}`).toBeTruthy();
  const creation = await createRes.json() as { id: string };

  // 3. Create slide (slide 0 for the creation)
  const slideRes = await request.post(`/api/creations/${creation.id}/slides`, {
    data: { slideIndex: 0 },
  });
  expect(slideRes.ok(), `POST /api/creations/:id/slides failed for ${slug}`).toBeTruthy();
  const slide = await slideRes.json() as { id: string };

  // 4. Create iteration with the archetype's schema as slot_schema
  //    htmlPath points to the archetype's index.html (relative to project root)
  const iterRes = await request.post(`/api/slides/${slide.id}/iterations`, {
    data: {
      iterationIndex: 0,
      htmlPath: `archetypes/${slug}/index.html`,
      slotSchema: schema,
      source: 'template',
    },
  });
  expect(iterRes.ok(), `POST /api/slides/:id/iterations failed for ${slug}`).toBeTruthy();
  const iteration = await iterRes.json() as { id: string };

  return {
    campaignId: camp.id,
    creationId: creation.id,
    slideId: slide.id,
    iterationId: iteration.id,
  };
}

// ─── Test Suite ────────────────────────────────────────────────────────────

test.describe('Phase 19: Archetype schema validation (no browser)', () => {
  // Read each schema.json and assert structural correctness — no server needed
  for (const slug of ARCHETYPE_SLUGS) {
    test(`${slug}: schema.json is structurally valid`, () => {
      const schema = loadSchema(slug);

      // Dimensions
      expect(schema.width, `${slug}: width`).toBe(1080);
      expect(schema.height, `${slug}: height`).toBe(1080);

      // Fields array present and non-empty
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(Array.isArray(fields), `${slug}: fields is array`).toBeTruthy();
      expect(fields.length, `${slug}: fields non-empty`).toBeGreaterThan(0);

      // brush is null (archetypes never set a brush — brand layer provides it)
      expect(schema.brush, `${slug}: brush is null`).toBeNull();

      // No templateId — archetypes resolve via slot_schema, not TEMPLATE_SCHEMAS
      expect(schema.templateId, `${slug}: no templateId`).toBeUndefined();

      // Every field has a type and a label
      for (const field of fields) {
        expect(['text', 'image', 'divider'], `${slug}: field type is valid`).toContain(field.type);
        expect(typeof field.label, `${slug}: field.label is string`).toBe('string');
        expect((field.label as string).length, `${slug}: field.label non-empty`).toBeGreaterThan(0);
      }

      // Non-divider fields have sel
      const contentFields = fields.filter((f) => f.type !== 'divider');
      for (const field of contentFields) {
        expect(typeof field.sel, `${slug}: content field has sel`).toBe('string');
        expect((field.sel as string).length, `${slug}: content field sel non-empty`).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('Phase 19: Archetype iteration creation via REST API', () => {
  test.setTimeout(60_000);

  // One test per archetype — creates DB records and verifies the iteration
  // resolves correctly via GET /api/iterations/:id
  for (const slug of ARCHETYPE_SLUGS) {
    test(`${slug}: creates iteration with slot_schema and resolves sidebar fields`, async ({ request }) => {
      const schema = loadSchema(slug);
      const { iterationId } = await createTestIteration(request, slug, schema);

      // Fetch the created iteration via GET /api/iterations/:id
      const iterRes = await request.get(`/api/iterations/${iterationId}`);
      expect(iterRes.ok(), `GET /api/iterations/${iterationId} should succeed`).toBeTruthy();

      const iteration = await iterRes.json() as {
        id: string;
        slotSchema: {
          width: number;
          height: number;
          fields: Array<{ type: string; label: string; sel?: string }>;
        } | null;
        htmlPath: string;
      };

      // The returned iteration must carry a resolved slotSchema (sidebar will render it)
      expect(iteration.slotSchema, `${slug}: slotSchema should resolve`).not.toBeNull();
      const resolved = iteration.slotSchema!;

      // Dimensions preserved
      expect(resolved.width).toBe(1080);
      expect(resolved.height).toBe(1080);

      // Fields preserved — at least as many as the source schema
      const sourceFields = schema.fields as Array<{ type: string }>;
      expect(resolved.fields.length, `${slug}: resolved fields count`).toBeGreaterThanOrEqual(
        sourceFields.length
      );

      // Non-divider fields (what the sidebar actually renders as inputs)
      const interactiveFields = resolved.fields.filter((f) => f.type !== 'divider');
      expect(
        interactiveFields.length,
        `${slug}: interactive (non-divider) field count`
      ).toBeGreaterThan(0);

      // Every interactive field has a label (what the sidebar <label> element shows)
      for (const field of interactiveFields) {
        expect(typeof field.label, `${slug}: field label is string`).toBe('string');
        expect(field.label.length, `${slug}: field label non-empty`).toBeGreaterThan(0);
      }

      // htmlPath is set correctly
      expect(iteration.htmlPath, `${slug}: htmlPath`).toBe(`archetypes/${slug}/index.html`);
    });
  }
});

test.describe('Phase 19: data-dashboard archetype — named stat selectors', () => {
  test.setTimeout(30_000);

  test('data-dashboard: 4 stat pairs + headline verify individually', async ({ request }) => {
    const slug = 'data-dashboard';
    const schema = loadSchema(slug);
    const { iterationId } = await createTestIteration(request, slug, schema);

    const iterRes = await request.get(`/api/iterations/${iterationId}`);
    expect(iterRes.ok()).toBeTruthy();
    const iteration = await iterRes.json() as {
      slotSchema: {
        fields: Array<{ type: string; label: string; sel?: string }>;
      } | null;
    };

    const resolved = iteration.slotSchema!;
    expect(resolved, 'data-dashboard: slotSchema must resolve').not.toBeNull();

    const fields = resolved.fields;

    // Verify all 4 stat pairs are present by selector
    const statSelectors = [
      '.stat-1-num',
      '.stat-1-label',
      '.stat-2-num',
      '.stat-2-label',
      '.stat-3-num',
      '.stat-3-label',
      '.stat-4-num',
      '.stat-4-label',
    ];
    for (const sel of statSelectors) {
      const found = fields.find((f) => f.sel === sel);
      expect(found, `data-dashboard: field with sel="${sel}" should exist`).toBeDefined();
      expect(found!.type, `data-dashboard: ${sel} should be text field`).toBe('text');
    }

    // Verify headline field exists
    const headline = fields.find((f) => f.sel === '.headline');
    expect(headline, 'data-dashboard: headline field should exist').toBeDefined();

    // Total: 9 interactive fields (headline + 4x num + 4x label), no dividers
    const interactiveCount = fields.filter((f) => f.type !== 'divider').length;
    expect(interactiveCount, 'data-dashboard: 9 interactive fields').toBe(9);
  });
});

test.describe('Phase 19: archetype HTML files exist and are non-empty', () => {
  // File system check — no server needed
  for (const slug of ARCHETYPE_SLUGS) {
    test(`${slug}: index.html, schema.json, README.md all exist`, () => {
      const archetypeDir = path.join(ARCHETYPES_DIR, slug);

      const indexHtml = path.join(archetypeDir, 'index.html');
      expect(fs.existsSync(indexHtml), `${slug}/index.html missing`).toBeTruthy();
      expect(fs.statSync(indexHtml).size, `${slug}/index.html is empty`).toBeGreaterThan(0);

      const schemaJson = path.join(archetypeDir, 'schema.json');
      expect(fs.existsSync(schemaJson), `${slug}/schema.json missing`).toBeTruthy();
      expect(fs.statSync(schemaJson).size, `${slug}/schema.json is empty`).toBeGreaterThan(0);

      const readmeMd = path.join(archetypeDir, 'README.md');
      expect(fs.existsSync(readmeMd), `${slug}/README.md missing`).toBeTruthy();
      expect(fs.statSync(readmeMd).size, `${slug}/README.md is empty`).toBeGreaterThan(0);
    });
  }

  test('archetypes/components/README.md exists', () => {
    const componentsReadme = path.join(ARCHETYPES_DIR, 'components', 'README.md');
    expect(fs.existsSync(componentsReadme), 'components/README.md missing').toBeTruthy();
    expect(fs.statSync(componentsReadme).size, 'components/README.md is empty').toBeGreaterThan(0);
  });
});

test.describe('Phase 19: archetype index.html content checks', () => {
  // Verify each wireframe has visible text content and basic structure
  for (const slug of ARCHETYPE_SLUGS) {
    test(`${slug}: index.html contains DOCTYPE and CSS class selectors from schema`, () => {
      const schema = loadSchema(slug);
      const fields = schema.fields as Array<{ type: string; sel?: string }>;
      const htmlPath = path.join(ARCHETYPES_DIR, slug, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // Must be valid HTML with doctype
      expect(html.toLowerCase(), `${slug}: DOCTYPE declaration`).toContain('<!doctype html');

      // Every selector in the schema must exist in the HTML
      const contentFields = fields.filter((f) => f.type !== 'divider' && f.sel);
      for (const field of contentFields) {
        // Convert CSS selector ".class-name" -> "class-name" for a simple substring check
        // Handles simple class selectors like ".stat-number", ".headline", etc.
        const sel = field.sel as string;
        if (sel.startsWith('.')) {
          const className = sel.slice(1).split(' ')[0]; // first class segment
          expect(
            html,
            `${slug}: HTML must contain class "${className}" referenced in schema sel "${sel}"`
          ).toContain(className);
        }
      }

      // Must have background/foreground layers per archetype spec
      expect(html, `${slug}: background-layer div required`).toContain('background-layer');
      expect(html, `${slug}: foreground-layer div required`).toContain('foreground-layer');
    });
  }
});
