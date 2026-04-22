'use strict';

/**
 * dimension-check.test.cjs — Characterization + post-migration tests.
 *
 * Tests fall into two categories:
 *
 *   PRE+POST: Pinned behaviors that should pass both before AND after the
 *   parse5 migration.
 *
 *   POST-MIGRATION ONLY: Tests that assert the CORRECT (post-parse5) behavior.
 *   These will FAIL on the regex-based implementation because the regex matches
 *   `target: NxM` patterns wherever they appear in the raw HTML string, including
 *   inside data-* attributes.
 *
 * Edge-case fixtures with a "POST-MIGRATION" note: pre-migration, the test
 * will fail due to the regex scanning the full HTML string. Post-migration,
 * parse5 walks only comment nodes, fixing the false-positive.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

const FIXTURES = path.join(TOOLS_DIR, '__fixtures__', 'html');
const CLEAN_SOCIAL = path.join(FIXTURES, 'clean-social-post.html');
const CLEAN_WEBSITE = path.join(FIXTURES, 'clean-website.html');
const EDGE_TARGET_IN_ATTR = path.join(FIXTURES, 'edge-target-comment-in-attribute.html');

// ─── PRE+POST: Clean social post has a real HTML comment ─────────────────────

test('dimension-check: clean-social-post exits 0, source is html-comment, dimensions 1080x1080', () => {
  // The fixture starts with `<!-- target: 1080x1080 -->`.
  // dimension-check should find it and report source: 'html-comment'.
  // This should pass both pre- and post-migration.
  const r = runCli('dimension-check.cjs', [CLEAN_SOCIAL]);

  assert.equal(r.status, 0, `Expected exit 0\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  assert.ok(parsed.found, `Expected 'found' to be non-null\nResult: ${JSON.stringify(parsed, null, 2)}`);
  assert.equal(parsed.found.source, 'html-comment',
    `Expected source 'html-comment', got '${parsed.found.source}'`);
  assert.equal(parsed.found.width, 1080,
    `Expected width 1080, got ${parsed.found.width}`);
  assert.equal(parsed.found.height, 1080,
    `Expected height 1080, got ${parsed.found.height}`);
});

// ─── POST-MIGRATION: target in data-* attribute should NOT be extracted ───────
//
// Pre-migration: the regex `<!--\s*(?:target|dimensions?|size)\s*:\s*(\d+)\s*x\s*(\d+)\s*-->/i`
// operates on the raw HTML string. But the fixture has `data-note="target: 1080x1080 ..."`,
// which does NOT match the comment regex pattern literally. However, the broader
// concern is that any string-based regex searching for the text "target: 1080x1080"
// anywhere in the file would be tricked. The current code uses a specific
// comment regex pattern — but check: will it match inside a data-attribute?
//
// The test asserts the POST-MIGRATION correct behavior: `found` should be null
// because the directive is inside a data-* attribute, not an HTML comment node.
// parse5 ensures we only look at #comment nodes.
//
// Pre-migration status: the existing comment regex likely will NOT match the
// data-attr case (it requires `<!--...-->`), but this test is written against
// the parse5-guaranteed semantics to prevent future regressions.

test('dimension-check: edge-target-comment-in-attribute returns found=null (POST-MIGRATION: parse5 comment-only scan)', () => {
  const r = runCli('dimension-check.cjs', [EDGE_TARGET_IN_ATTR]);

  // May exit 0 (unknown status) — the fixture has no target, no body style, no
  // style block with dimensions, and no meta viewport. Status should be 'unknown'.
  // Exit code 0 or 1 both acceptable (the spec exits 1 only on "fail" = mismatch
  // with known target; "unknown" exits 0).

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  assert.equal(parsed.found, null,
    `Expected found=null (data-attr target is not a real HTML comment), got: ${JSON.stringify(parsed.found)}`);
  assert.equal(parsed.status, 'unknown',
    `Expected status 'unknown', got '${parsed.status}'`);
});

// ─── PRE+POST: Clean website has no dimension directive ──────────────────────

test('dimension-check: clean-website falls through to unknown (no comment, no inline style)', () => {
  // The website fixture has no <!-- target: --> comment, no body inline style,
  // and no CSS width/height for body. The tool should report found=null.
  const r = runCli('dimension-check.cjs', [CLEAN_WEBSITE]);

  // Exit 0 (unknown is not a failure)
  assert.equal(r.status, 0, `Expected exit 0 (unknown is not a mismatch)\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  assert.equal(parsed.found, null,
    `Expected found=null for a website without dimension directives, got: ${JSON.stringify(parsed.found)}`);
  assert.equal(parsed.status, 'unknown',
    `Expected status 'unknown', got '${parsed.status}'`);
});
