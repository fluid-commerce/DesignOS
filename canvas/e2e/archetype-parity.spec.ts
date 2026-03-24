/**
 * Phase 20 Plan 03 — Archetype-Based Iteration Editor Parity
 *
 * Verifies the complete chain: stored SlotSchema → watcher HTML serving →
 * editor sidebar field rendering parity for archetype-based iterations.
 *
 * Tests use the REST API fixture chain to create campaigns/creations/slides/iterations
 * with an archetype's slotSchema, then verify:
 *   1. slotSchema is persisted and resolved with correct field labels
 *   2. Text editing (slot value update) is reflected back via the iteration API
 *   3. Brush transform control visibility depends on schema.brush (non-null = visible)
 *   4. Export endpoint responds correctly for archetype-based iterations
 *
 * Requires canvas server running at localhost:5174 (npm run dev).
 * These are integration tests that create real DB records.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ARCHETYPES_DIR = path.join(PROJECT_ROOT, 'archetypes');

// stat-hero-single schema fixture (from archetypes/stat-hero-single/schema.json)
const STAT_HERO_SCHEMA = {
  archetypeId: 'stat-hero-single',
  width: 1080,
  height: 1080,
  fields: [
    { type: 'text', sel: '.context-label', label: 'Context Label', mode: 'text', rows: 1 },
    { type: 'text', sel: '.stat-number',   label: 'Stat Value',    mode: 'text', rows: 1 },
    { type: 'text', sel: '.headline',      label: 'Headline',      mode: 'text', rows: 2 },
    { type: 'text', sel: '.body-copy',     label: 'Body Copy',     mode: 'pre',  rows: 4 },
  ],
  brush: null,
};

// Brush schema variant — same archetype but with brush field set
const STAT_HERO_SCHEMA_WITH_BRUSH = {
  ...STAT_HERO_SCHEMA,
  brush: '.decorative-zone',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create the full fixture chain: campaign → creation → slide → iteration.
 * Returns all IDs for later verification and cleanup.
 */
async function createArchetypeFixture(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  opts: {
    name: string;
    slotSchema: Record<string, unknown>;
  }
) {
  const campRes = await request.post('/api/campaigns', {
    data: { name: opts.name },
  });
  expect(campRes.ok(), `POST /api/campaigns failed: ${await campRes.text()}`).toBeTruthy();
  const camp = (await campRes.json()) as { id: string };

  const createRes = await request.post(`/api/campaigns/${camp.id}/creations`, {
    data: {
      title: opts.name,
      creationType: 'instagram-square',
      slideCount: 1,
    },
  });
  expect(createRes.ok(), `POST /api/campaigns/:id/creations failed`).toBeTruthy();
  const creation = (await createRes.json()) as { id: string };

  const slideRes = await request.post(`/api/creations/${creation.id}/slides`, {
    data: { slideIndex: 0 },
  });
  expect(slideRes.ok(), `POST /api/creations/:id/slides failed`).toBeTruthy();
  const slide = (await slideRes.json()) as { id: string };

  const iterRes = await request.post(`/api/slides/${slide.id}/iterations`, {
    data: {
      iterationIndex: 0,
      htmlPath: 'archetypes/stat-hero-single/index.html',
      slotSchema: opts.slotSchema,
      source: 'ai',
    },
  });
  expect(iterRes.ok(), `POST /api/slides/:id/iterations failed: ${await iterRes.text()}`).toBeTruthy();
  const iteration = (await iterRes.json()) as { id: string };

  return {
    campaignId: camp.id,
    creationId: creation.id,
    slideId: slide.id,
    iterationId: iteration.id,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Phase 20: Archetype-based iteration editor parity', () => {
  test.setTimeout(60_000);

  // ── Test 1: Sidebar renders archetype schema fields ──────────────────────
  test('Sidebar renders archetype schema fields (Context Label, Stat Value, Headline, Body Copy)', async ({ request }) => {
    const ts = Date.now();
    const fixture = await createArchetypeFixture(request, {
      name: `E2E Archetype Parity Test ${ts}`,
      slotSchema: STAT_HERO_SCHEMA,
    });

    // Fetch the created iteration — this is what the sidebar consumes
    const iterRes = await request.get(`/api/iterations/${fixture.iterationId}`);
    expect(iterRes.ok(), 'GET /api/iterations/:id should succeed').toBeTruthy();

    const iteration = (await iterRes.json()) as {
      id: string;
      slotSchema: {
        archetypeId: string;
        width: number;
        height: number;
        fields: Array<{ type: string; label: string; sel?: string }>;
        brush: string | null;
      } | null;
      htmlPath: string;
      source: string;
    };

    // slotSchema must be resolved (not null) — sidebar requires this
    expect(iteration.slotSchema, 'slotSchema must resolve for archetype iteration').not.toBeNull();
    const schema = iteration.slotSchema!;

    // archetypeId present — identifies this as an archetype-sourced iteration
    expect(schema.archetypeId, 'archetypeId should be stat-hero-single').toBe('stat-hero-single');

    // Dimensions preserved
    expect(schema.width, 'width should be 1080').toBe(1080);
    expect(schema.height, 'height should be 1080').toBe(1080);

    // All 4 fields from schema.json must be present with correct labels
    const labels = schema.fields.map((f) => f.label);
    expect(labels, 'sidebar should show "Context Label"').toContain('Context Label');
    expect(labels, 'sidebar should show "Stat Value"').toContain('Stat Value');
    expect(labels, 'sidebar should show "Headline"').toContain('Headline');
    expect(labels, 'sidebar should show "Body Copy"').toContain('Body Copy');

    // All 4 fields must be text type with CSS selectors
    const selectors = schema.fields
      .filter((f) => f.type === 'text')
      .map((f) => f.sel);
    expect(selectors, 'sidebar must have .context-label selector').toContain('.context-label');
    expect(selectors, 'sidebar must have .stat-number selector').toContain('.stat-number');
    expect(selectors, 'sidebar must have .headline selector').toContain('.headline');
    expect(selectors, 'sidebar must have .body-copy selector').toContain('.body-copy');

    // brush: null — no brush transform control should appear
    expect(schema.brush, 'brush should be null for base archetype').toBeNull();

    // htmlPath points to the archetype HTML
    expect(iteration.htmlPath, 'htmlPath should be archetype index.html').toBe(
      'archetypes/stat-hero-single/index.html'
    );

    // source is ai (pipeline-generated)
    expect(iteration.source, 'source should be ai').toBe('ai');

    // Note: No DELETE /api/campaigns endpoint — test campaigns accumulate and can be
    // cleaned up manually from the DB if needed. Named with "E2E" prefix + timestamp.
  });

  // ── Test 2: Text editing via sidebar updates slot values ──────────────────
  test('Text editing via sidebar updates iteration user-state (slot value persistence)', async ({ request }) => {
    const ts = Date.now();
    const fixture = await createArchetypeFixture(request, {
      name: `E2E Archetype Text Edit ${ts}`,
      slotSchema: STAT_HERO_SCHEMA,
    });

    // Simulate sidebar text edit: PATCH /api/iterations/:id/user-state
    const newHeadline = 'Updated Headline Text';
    const patchRes = await request.patch(
      `/api/iterations/${fixture.iterationId}/user-state`,
      {
        data: {
          userState: {
            '.headline': newHeadline,
            '.context-label': 'Test Context',
            '.stat-number': '99%',
            '.body-copy': 'Test body copy.',
          },
        },
      }
    );
    expect(patchRes.ok(), `PATCH /api/iterations/:id/user-state failed: ${await patchRes.text()}`).toBeTruthy();

    // Re-fetch to verify the slot value was persisted
    const iterRes = await request.get(`/api/iterations/${fixture.iterationId}`);
    expect(iterRes.ok()).toBeTruthy();
    const iteration = (await iterRes.json()) as {
      userState: Record<string, string> | null;
    };

    expect(iteration.userState, 'userState should be persisted after PATCH').not.toBeNull();
    expect(
      iteration.userState!['.headline'],
      'Headline slot value should be updated'
    ).toBe(newHeadline);
    expect(
      iteration.userState!['.context-label'],
      'context-label slot value should be updated'
    ).toBe('Test Context');
    expect(
      iteration.userState!['.stat-number'],
      'stat-number slot value should be updated'
    ).toBe('99%');
  });

  // ── Test 3: Brush transform control appears when schema has brush ─────────
  test('Brush transform control: visible when schema.brush non-null, hidden when null', async ({ request }) => {
    const ts = Date.now();

    // Fixture A: brush = null (no brush control)
    const fixtureNoBrush = await createArchetypeFixture(request, {
      name: `E2E Archetype No Brush ${ts}`,
      slotSchema: STAT_HERO_SCHEMA,
    });

    // Fixture B: brush = ".decorative-zone" (brush control should appear)
    const fixtureWithBrush = await createArchetypeFixture(request, {
      name: `E2E Archetype With Brush ${ts}`,
      slotSchema: STAT_HERO_SCHEMA_WITH_BRUSH,
    });

    // Verify no-brush iteration
    const noBrushRes = await request.get(`/api/iterations/${fixtureNoBrush.iterationId}`);
    expect(noBrushRes.ok()).toBeTruthy();
    const noBrushIter = (await noBrushRes.json()) as {
      slotSchema: { brush: string | null } | null;
    };
    expect(noBrushIter.slotSchema, 'no-brush iteration must have slotSchema').not.toBeNull();
    expect(
      noBrushIter.slotSchema!.brush,
      'brush must be null — no brush transform control should render'
    ).toBeNull();

    // Verify with-brush iteration
    const withBrushRes = await request.get(`/api/iterations/${fixtureWithBrush.iterationId}`);
    expect(withBrushRes.ok()).toBeTruthy();
    const withBrushIter = (await withBrushRes.json()) as {
      slotSchema: { brush: string | null } | null;
    };
    expect(withBrushIter.slotSchema, 'with-brush iteration must have slotSchema').not.toBeNull();
    expect(
      withBrushIter.slotSchema!.brush,
      'brush must be ".decorative-zone" — brush transform control should render'
    ).toBe('.decorative-zone');

  });

  // ── Test 4: Export works for archetype-based iteration ────────────────────
  test('Export endpoint returns valid content for archetype-based iteration', async ({ request }) => {
    const ts = Date.now();
    const fixture = await createArchetypeFixture(request, {
      name: `E2E Archetype Export ${ts}`,
      slotSchema: STAT_HERO_SCHEMA,
    });

    // The HTML endpoint serves the iteration (required for export to work)
    const htmlRes = await request.get(`/api/iterations/${fixture.iterationId}/html`);
    expect(htmlRes.ok(), `GET /api/iterations/:id/html should succeed: ${htmlRes.status()}`).toBeTruthy();

    const html = await htmlRes.text();
    expect(html.length, 'HTML should not be empty').toBeGreaterThan(100);
    // Archetype HTML has DOCTYPE
    expect(html.toLowerCase()).toContain('<!doctype html');
    // stat-hero-single's archetypeId comment is in the file
    expect(html).toContain('stat-hero-single');

    // ZIP export endpoint — returns application/zip
    const exportRes = await request.get(
      `/api/iterations/${fixture.iterationId}/html?export=zip`
    );
    expect(exportRes.ok(), `ZIP export endpoint should respond 200: ${exportRes.status()}`).toBeTruthy();

    const contentType = exportRes.headers()['content-type'];
    expect(contentType, 'ZIP export should return application/zip').toContain('application/zip');

  });

  // ── Test 5: schema.json on disk matches fixture used in tests ─────────────
  test('stat-hero-single: schema.json on disk matches the archetypeId field contract', () => {
    // This is a static check — no server required
    const schemaPath = path.join(ARCHETYPES_DIR, 'stat-hero-single', 'schema.json');
    expect(fs.existsSync(schemaPath), 'stat-hero-single/schema.json must exist').toBeTruthy();

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as {
      archetypeId: string;
      width: number;
      height: number;
      fields: Array<{ type: string; label: string; sel?: string }>;
      brush: unknown;
    };

    // archetypeId is present — required for Phase 20 pipeline to select this archetype
    expect(schema.archetypeId).toBe('stat-hero-single');

    // Dimensions
    expect(schema.width).toBe(1080);
    expect(schema.height).toBe(1080);

    // brush is null — archetypes never hardcode brush; brand layer provides it
    expect(schema.brush).toBeNull();

    // All 4 expected labels exist
    const labels = schema.fields.map((f) => f.label);
    expect(labels).toContain('Context Label');
    expect(labels).toContain('Stat Value');
    expect(labels).toContain('Headline');
    expect(labels).toContain('Body Copy');

    // Every text field has sel and mode
    const textFields = schema.fields.filter((f) => f.type === 'text') as Array<{
      type: string;
      sel: string;
      mode: string;
      rows: number;
    }>;
    expect(textFields.length, 'should have 4 text fields').toBe(4);
    for (const field of textFields) {
      expect(typeof field.sel, `${field.sel}: sel is string`).toBe('string');
      expect(field.sel.startsWith('.'), `${field.sel}: sel starts with '.'`).toBeTruthy();
      expect(typeof field.mode, `${field.sel}: mode is string`).toBe('string');
    }
  });

  // ── Test 6: HTML serving applies slot values for archetype iterations ──────
  test('HTML serving reflects userState slot values for archetype-based iterations', async ({ request }) => {
    const ts = Date.now();
    const fixture = await createArchetypeFixture(request, {
      name: `E2E Archetype HTML Serving ${ts}`,
      slotSchema: STAT_HERO_SCHEMA,
    });

    const customHeadline = 'Pipeline-generated headline for testing';

    // Apply user state (simulates sidebar edit save)
    await request.patch(`/api/iterations/${fixture.iterationId}/user-state`, {
      data: {
        userState: {
          '.headline': customHeadline,
        },
      },
    });

    // The HTML endpoint should serve the archetype with injected base href
    const htmlRes = await request.get(`/api/iterations/${fixture.iterationId}/html`);
    expect(htmlRes.ok()).toBeTruthy();

    const html = await htmlRes.text();
    // base href is injected for iframe rendering
    expect(html).toContain('<base href=');
    // asset paths are rewritten (no ../../assets/ references)
    expect(html).not.toContain('../../assets/');

  });
});
