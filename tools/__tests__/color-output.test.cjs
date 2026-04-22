'use strict';

/**
 * color-output.test.cjs — Characterizes/verifies ANSI color output for the
 * three CLIs that print human summaries to stderr.
 *
 * Tests run in three env configurations per CLI:
 *   1. FORCE_COLOR=1   → ANSI escapes MUST be present
 *   2. NO_COLOR=1      → ANSI escapes MUST be absent
 *   3. no override     → spawnSync has no TTY so escapes MUST be absent (baseline)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURES = path.join(TOOLS_DIR, '__fixtures__', 'html');
const SOCIAL_POST = path.join(FIXTURES, 'clean-social-post.html');

// Minimal .liquid file with an incomplete schema block — reaches the color
// code path (exits 1 with issues). Created once and cleaned up on process exit.
let tmpDir;
let liquidFile;

// node:test doesn't have beforeAll; use a module-level setup flag + lazy init
function getTmpLiquid() {
  if (liquidFile) return liquidFile;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'color-test-'));
  liquidFile = path.join(tmpDir, 'test.liquid');
  // Minimal liquid with a valid schema block that fails validation → color path
  fs.writeFileSync(liquidFile, [
    '<div>hello</div>',
    '{% schema %}',
    '{ "name": "Test Section" }',
    '{% endschema %}',
    '',
  ].join('\n'));
  return liquidFile;
}

// Cleanup helper — call after all tests. node:test doesn't expose a global
// afterAll; we register a process exit handler to clean up the tmpdir.
process.on('exit', () => {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ─── ANSI detection helpers ───────────────────────────────────────────────────

/** True if the string contains at least one ANSI CSI escape sequence. */
function hasAnsi(str) {
  // ESC [ is \x1b[  (0x1B + 0x5B)
  return /\x1b\[/.test(str);
}

// ─── brand-compliance.cjs ────────────────────────────────────────────────────
// Uses clean-social-post.html with --context social → emits ERROR (exit 1)

test('brand-compliance: FORCE_COLOR=1 produces ANSI escapes in stderr', () => {
  const r = runCli('brand-compliance.cjs', [SOCIAL_POST, '--context', 'social'], {
    env: { FORCE_COLOR: '1', NO_COLOR: '' },
  });
  assert.ok(
    hasAnsi(r.stderr),
    `Expected ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('brand-compliance: NO_COLOR=1 suppresses ANSI escapes in stderr', () => {
  const r = runCli('brand-compliance.cjs', [SOCIAL_POST, '--context', 'social'], {
    env: { NO_COLOR: '1', FORCE_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('brand-compliance: no TTY env → no ANSI escapes in stderr (baseline)', () => {
  const r = runCli('brand-compliance.cjs', [SOCIAL_POST, '--context', 'social'], {
    env: { FORCE_COLOR: '', NO_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in non-TTY baseline, got:\n${r.stderr}`,
  );
});

// ─── dimension-check.cjs ─────────────────────────────────────────────────────
// clean-social-post.html has <!-- target: 1080x1080 --> → emits green PASS (exit 0)

test('dimension-check: FORCE_COLOR=1 produces ANSI escapes in stderr', () => {
  const r = runCli('dimension-check.cjs', [SOCIAL_POST], {
    env: { FORCE_COLOR: '1', NO_COLOR: '' },
  });
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}`);
  assert.ok(
    hasAnsi(r.stderr),
    `Expected ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('dimension-check: NO_COLOR=1 suppresses ANSI escapes in stderr', () => {
  const r = runCli('dimension-check.cjs', [SOCIAL_POST], {
    env: { NO_COLOR: '1', FORCE_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('dimension-check: no TTY env → no ANSI escapes in stderr (baseline)', () => {
  const r = runCli('dimension-check.cjs', [SOCIAL_POST], {
    env: { FORCE_COLOR: '', NO_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in non-TTY baseline, got:\n${r.stderr}`,
  );
});

// ─── schema-validation.cjs ───────────────────────────────────────────────────
// Throwaway .liquid with no schema block → exits 2 but still emits stderr output

test('schema-validation: FORCE_COLOR=1 produces ANSI escapes in stderr', () => {
  const liq = getTmpLiquid();
  const r = runCli('schema-validation.cjs', [liq], {
    env: { FORCE_COLOR: '1', NO_COLOR: '' },
  });
  // exit 1 (schema fails) — incomplete schema block hits the color error path
  assert.ok(
    hasAnsi(r.stderr),
    `Expected ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('schema-validation: NO_COLOR=1 suppresses ANSI escapes in stderr', () => {
  const liq = getTmpLiquid();
  const r = runCli('schema-validation.cjs', [liq], {
    env: { NO_COLOR: '1', FORCE_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in stderr, got:\n${r.stderr}`,
  );
});

test('schema-validation: no TTY env → no ANSI escapes in stderr (baseline)', () => {
  const liq = getTmpLiquid();
  const r = runCli('schema-validation.cjs', [liq], {
    env: { FORCE_COLOR: '', NO_COLOR: '' },
  });
  assert.ok(
    !hasAnsi(r.stderr),
    `Expected NO ANSI escapes in non-TTY baseline, got:\n${r.stderr}`,
  );
});
