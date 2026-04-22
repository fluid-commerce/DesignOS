'use strict';
/**
 * validate-archetypes.test.cjs — Characterization tests for validate-archetypes.cjs
 *
 * Uses FLUID_ARCHETYPES_DIR env var to point the tool at isolated fixture directories,
 * so tests don't depend on or pollute the real archetypes/ directory.
 *
 * Covers:
 *   1. Valid archetype — exit 0
 *   2. Missing schema.json — exit 1, code MISSING_FILE
 *   3. Invalid JSON in schema.json — exit 1, code INVALID_JSON
 *   4. Has templateId field — exit 1, code HAS_TEMPLATE_ID
 *   5. Wrong platform dimensions — exit 1, code WRONG_DIMS
 *   6. No-arg / "all" mode on empty fixture dir — exit 0
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

const FIXTURES_DIR = path.join(TOOLS_DIR, '__fixtures__', 'archetypes');

/** Run validate-archetypes.cjs with the fixture dir as FLUID_ARCHETYPES_DIR */
function runValidator(slug, extraEnv = {}) {
  return runCli('validate-archetypes.cjs', slug ? [slug] : [], {
    env: {
      FLUID_ARCHETYPES_DIR: FIXTURES_DIR,
      ...extraEnv,
    },
  });
}

/** Parse violations JSON from stdout (returns [] on parse failure) */
function parseViolations(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

// ─── Test 1: Valid archetype — exit 0 ────────────────────────────────────────

test('validate-archetypes: valid-ig archetype exits 0 with no violations', () => {
  const r = runValidator('valid-ig');
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const errors = violations.filter(v => v.severity === 'error');
  assert.equal(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors, null, 2)}`);
});

// ─── Test 2: Missing schema.json — MISSING_FILE ───────────────────────────────

test('validate-archetypes: missing schema.json exits 1 with MISSING_FILE', () => {
  const r = runValidator('no-schema-ig');
  assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const missingFile = violations.find(v => v.code === 'MISSING_FILE');
  assert.ok(
    missingFile,
    `Expected MISSING_FILE violation\nviolations: ${JSON.stringify(violations, null, 2)}`
  );
  assert.ok(
    missingFile.message.includes('schema.json'),
    `Expected message to mention schema.json, got: ${missingFile.message}`
  );
});

// ─── Test 3: Invalid JSON in schema.json — INVALID_JSON ───────────────────────

test('validate-archetypes: invalid JSON in schema.json exits 1 with INVALID_JSON', () => {
  const r = runValidator('bad-schema-ig');
  assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const invalidJson = violations.find(v => v.code === 'INVALID_JSON');
  assert.ok(
    invalidJson,
    `Expected INVALID_JSON violation\nviolations: ${JSON.stringify(violations, null, 2)}`
  );
});

// ─── Test 4: Has templateId — HAS_TEMPLATE_ID ────────────────────────────────

test('validate-archetypes: templateId field exits 1 with HAS_TEMPLATE_ID', () => {
  const r = runValidator('has-template-id-ig');
  assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const hasTemplateId = violations.find(v => v.code === 'HAS_TEMPLATE_ID');
  assert.ok(
    hasTemplateId,
    `Expected HAS_TEMPLATE_ID violation\nviolations: ${JSON.stringify(violations, null, 2)}`
  );
});

// ─── Test 5: Wrong platform dimensions — WRONG_DIMS ──────────────────────────

test('validate-archetypes: wrong dimensions exits 1 with WRONG_DIMS', () => {
  const r = runValidator('wrong-dims-ig');
  assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const wrongDims = violations.find(v => v.code === 'WRONG_DIMS');
  assert.ok(
    wrongDims,
    `Expected WRONG_DIMS violation\nviolations: ${JSON.stringify(violations, null, 2)}`
  );
  // Should mention the expected vs actual dimensions
  assert.ok(
    wrongDims.message.includes('1080'),
    `Expected message to mention 1080, got: ${wrongDims.message}`
  );
});

// ─── Test 6: Non-existent slug — MISSING_DIR ─────────────────────────────────

test('validate-archetypes: non-existent slug exits 1 with MISSING_DIR', () => {
  const r = runValidator('slug-that-does-not-exist');
  assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const violations = parseViolations(r.stdout);
  const missingDir = violations.find(v => v.code === 'MISSING_DIR');
  assert.ok(
    missingDir,
    `Expected MISSING_DIR violation\nviolations: ${JSON.stringify(violations, null, 2)}`
  );
});

// ─── Test 7: "all" mode on fixture dir — exit 0 if all pass ──────────────────

test('validate-archetypes: "all" mode collects violations from all fixture archetypes', () => {
  // We have some bad fixtures so we expect failures; just check that it runs and
  // returns valid JSON covering multiple slugs
  const r = runValidator('all');
  // Should NOT crash (signal null, status defined)
  assert.notEqual(r.signal, 'SIGKILL', 'Process was killed (timeout?)');
  const violations = parseViolations(r.stdout);
  assert.ok(Array.isArray(violations), `Expected violations array, got: ${typeof violations}`);
  // Should cover multiple fixtures (at least one violation from the bad ones)
  assert.ok(violations.length > 0, 'Expected at least some violations from bad fixture archetypes');
});
