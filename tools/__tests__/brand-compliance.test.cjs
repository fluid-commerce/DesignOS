'use strict';

/**
 * brand-compliance.test.cjs — Characterization + post-migration tests.
 *
 * Tests fall into two categories:
 *
 *   PRE+POST: Pinned behaviors that should pass both before AND after the
 *   parse5 migration. These are regression guards.
 *
 *   POST-MIGRATION ONLY: Tests that assert the CORRECT (post-parse5) behavior.
 *   These will FAIL on the regex-based implementation because the regex has bugs
 *   on the edge-case fixtures. Once brand-compliance.cjs is migrated, all tests
 *   should pass.
 *
 * Edge-case fixtures with a "POST-MIGRATION" note: pre-migration, the test
 * will fail due to known regex bugs (false positives / false negatives).
 * Post-migration, parse5 AST walking fixes these bugs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

const FIXTURES = path.join(TOOLS_DIR, '__fixtures__', 'html');
const CLEAN_SOCIAL = path.join(FIXTURES, 'clean-social-post.html');
const CLEAN_WEBSITE = path.join(FIXTURES, 'clean-website.html');
const EDGE_IMG_ALT_GT = path.join(FIXTURES, 'edge-img-alt-contains-gt.html');
const EDGE_HEX_META = path.join(FIXTURES, 'edge-hex-in-meta-not-style.html');
const EDGE_MULTI_STYLE = path.join(FIXTURES, 'edge-multiple-style-blocks.html');

// ─── PRE+POST: Clean social post ─────────────────────────────────────────────

test('brand-compliance: clean-social-post exits 1 with exactly one violation (style-no-inline)', () => {
  // The fixture has one <div class="brush" style="..."> — that is a inline-style
  // violation. All other attributes (colors, fonts) are brand-compliant.
  // This pinned behavior should pass both pre- and post-migration.
  const r = runCli('brand-compliance.cjs', [CLEAN_SOCIAL, '--context', 'social'], {
    env: { FLUID_DB_PATH: '/dev/null' },
  });

  assert.equal(r.status, 1, `Expected exit 1 (has errors)\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  assert.equal(parsed.violations.length, 1,
    `Expected exactly 1 violation, got ${parsed.violations.length}:\n${JSON.stringify(parsed.violations, null, 2)}`);
  assert.equal(parsed.violations[0].rule, 'style-no-inline',
    `Expected rule 'style-no-inline', got '${parsed.violations[0].rule}'`);
});

// ─── PRE+POST: Clean website ─────────────────────────────────────────────────

test('brand-compliance: clean-website exits 0 with zero violations (--context website)', () => {
  // All colors, fonts, and structure are brand-compliant for a website context.
  // This pinned behavior should pass both pre- and post-migration.
  const r = runCli('brand-compliance.cjs', [CLEAN_WEBSITE, '--context', 'website'], {
    env: { FLUID_DB_PATH: '/dev/null' },
  });

  assert.equal(r.status, 0, `Expected exit 0\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  assert.equal(parsed.violations.length, 0,
    `Expected 0 violations, got ${parsed.violations.length}:\n${JSON.stringify(parsed.violations, null, 2)}`);
});

// ─── POST-MIGRATION: img with alt containing '>' ──────────────────────────────
//
// Pre-migration: regex `<img\b[^>]*>` stops at the first '>' inside the alt
// value, so the tag text is truncated. The validator may not flag this img
// because the truncated tag doesn't include `class="decorative"`.
//
// Post-migration: parse5 reads the full tag, sees class="decorative", and
// correctly raises 'img-no-decorative'.

test('brand-compliance: edge-img-alt-contains-gt flags decorative img (POST-MIGRATION: parse5 fixes alt-gt bug)', () => {
  const r = runCli('brand-compliance.cjs', [EDGE_IMG_ALT_GT, '--context', 'social'], {
    env: { FLUID_DB_PATH: '/dev/null' },
  });

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  const decorativeViolation = parsed.violations.find(v => v.rule === 'img-no-decorative');
  assert.ok(decorativeViolation,
    `Expected a 'img-no-decorative' violation but found none.\nAll violations: ${JSON.stringify(parsed.violations, null, 2)}`);
});

// ─── POST-MIGRATION: hex in <meta theme-color> should NOT be flagged ──────────
//
// Pre-migration: the global hex regex scans the entire file and flags #FF00FF
// in the <meta name="theme-color"> content attribute, even though theme-color
// is not CSS and is not brand-controlled.
//
// Post-migration: parse5 scans only <style> text nodes (and style= attributes
// if in scope). The meta content attribute is NOT a CSS surface, so #FF00FF
// is not flagged.

test('brand-compliance: edge-hex-in-meta-not-style has zero hex violations (POST-MIGRATION: parse5 scopes to <style>)', () => {
  const r = runCli('brand-compliance.cjs', [EDGE_HEX_META, '--context', 'social'], {
    env: { FLUID_DB_PATH: '/dev/null' },
  });

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  const hexViolations = parsed.violations.filter(v => v.rule === 'color-non-brand-hex');
  assert.equal(hexViolations.length, 0,
    `Expected 0 color-non-brand-hex violations (meta theme-color is not CSS), got ${hexViolations.length}:\n${JSON.stringify(hexViolations, null, 2)}`);
});

// ─── POST-MIGRATION: hex in <pre> should NOT be flagged ───────────────────────
//
// Pre-migration: the global hex regex scans the entire file and flags #DEADBE
// inside a <pre> block containing a literal CSS snippet.
//
// Post-migration: parse5 scans only <style> element text nodes. The <pre>
// text node is not a <style>, so #DEADBE is not flagged. Colors inside the
// real <style> blocks (#000000, #FFFFFF, #FF8B58) should still be evaluated
// correctly.

test('brand-compliance: edge-multiple-style-blocks does not flag hex in <pre> (POST-MIGRATION: parse5 scopes to <style>)', () => {
  const r = runCli('brand-compliance.cjs', [EDGE_MULTI_STYLE, '--context', 'social'], {
    env: { FLUID_DB_PATH: '/dev/null' },
  });

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not valid JSON:\n${r.stdout}`);
  }

  const hexViolations = parsed.violations.filter(v => v.rule === 'color-non-brand-hex');
  // #DEADBE (in <pre>) should NOT be flagged. Violations for #DEADBE only.
  const deadbeViolations = hexViolations.filter(v => v.found && v.found.toUpperCase().includes('DEADBE'));
  assert.equal(deadbeViolations.length, 0,
    `#DEADBE is inside a <pre> (not a <style>), should not be flagged as a CSS color.\nViolations: ${JSON.stringify(hexViolations, null, 2)}`);
});
