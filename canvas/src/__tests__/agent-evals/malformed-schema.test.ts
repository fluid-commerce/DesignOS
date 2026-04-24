/**
 * malformed-schema.test.ts — listArchetypes skips corrupted schema.json
 *
 * A corrupted schema.json must not leak into results with falsy platform/category/meta
 * that would silently bypass every filter. Instead it should be logged and skipped.
 *
 * This test uses its own temp fixture directory via FLUID_ARCHETYPES_DIR.
 * It runs as a separate file because FLUID_ARCHETYPES_DIR is read once at
 * module load and cannot be switched mid-suite.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let TMPDIR: string;

beforeAll(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-archetypes-malformed-'));

  // Good archetype — a minimal valid one
  const goodDir = path.join(TMPDIR, 'good-archetype');
  fs.mkdirSync(goodDir);
  fs.writeFileSync(path.join(goodDir, 'index.html'), '<!DOCTYPE html><html><body></body></html>');
  fs.writeFileSync(path.join(goodDir, 'README.md'), '# good');
  fs.writeFileSync(
    path.join(goodDir, 'schema.json'),
    JSON.stringify({
      archetypeId: 'good-archetype',
      platform: 'instagram-portrait',
      width: 1080,
      height: 1350,
      fields: [],
      brush: null,
      meta: {
        category: 'stat-data',
        imageRole: 'none',
        useCases: ['placeholder'],
        slotCount: 0,
      },
    }),
  );

  // Malformed archetype — schema.json has a trailing comma
  const badDir = path.join(TMPDIR, 'bad-archetype');
  fs.mkdirSync(badDir);
  fs.writeFileSync(path.join(badDir, 'index.html'), '<!DOCTYPE html><html><body></body></html>');
  fs.writeFileSync(path.join(badDir, 'README.md'), '# bad');
  fs.writeFileSync(
    path.join(badDir, 'schema.json'),
    '{ "archetypeId": "bad-archetype", "width": 1080, "height": 1350, }', // trailing comma
  );

  process.env.FLUID_ARCHETYPES_DIR = TMPDIR;
});

afterAll(() => {
  if (TMPDIR && fs.existsSync(TMPDIR)) {
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  }
  delete process.env.FLUID_ARCHETYPES_DIR;
});

describe('listArchetypes skips malformed schema.json', () => {
  it('omits the broken archetype and keeps the good one', async () => {
    // Dynamic import so module-scope env var is read after beforeAll.
    // vi.resetModules ensures agent-tools.ts re-evaluates its top-level consts.
    vi.resetModules();
    const { listArchetypes } = await import('../../server/agent-tools');

    const results = listArchetypes({ pageSize: 50 });
    const slugs = results.map(r => r.slug);

    expect(slugs).toContain('good-archetype');
    expect(slugs).not.toContain('bad-archetype');
  });

  it('logs archetype_schema_parse_failed when a schema is corrupted', async () => {
    vi.resetModules();
    const obs = await import('../../server/observability');
    const spy = vi.spyOn(obs, 'logChatEvent');

    const { listArchetypes } = await import('../../server/agent-tools');
    listArchetypes({ pageSize: 50 });

    const parseFailedEvents = spy.mock.calls.filter(
      call => call[0] === 'archetype_schema_parse_failed',
    );
    expect(parseFailedEvents.length).toBeGreaterThanOrEqual(1);
    expect(parseFailedEvents[0][1]).toMatchObject({ slug: 'bad-archetype' });

    spy.mockRestore();
  });
});
