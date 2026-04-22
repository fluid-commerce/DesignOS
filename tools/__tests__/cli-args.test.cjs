'use strict';

/**
 * cli-args.test.cjs — Characterize and verify CLI argument parsing across
 * five tools after yargs migration.
 *
 * Written to match POST-MIGRATION (yargs) behavior:
 *   - --help exits 0 with a yargs-style help screen
 *   - Missing required positional: exit 1, "Missing required" in output
 *   - Unknown flag: exit 1, "Unknown argument" in output (.strict() enabled)
 *   - Valid invocations: exit 0 (or domain-appropriate code)
 *   - Boolean flags (db-import, feedback-ingest): verified via --help text only
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

const FIXTURES = path.join(TOOLS_DIR, '__fixtures__', 'html');
const CLEAN_WEBSITE = path.join(FIXTURES, 'clean-website.html');
const CLEAN_SOCIAL = path.join(FIXTURES, 'clean-social-post.html');

// ─── brand-compliance.cjs ────────────────────────────────────────────────────

test('brand-compliance: --help exits 0 and shows usage', () => {
  const r = runCli('brand-compliance.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /brand-compliance/i, 'Help text should mention the tool name');
  assert.match(combined, /--context/i, 'Help text should mention --context flag');
});

test('brand-compliance: missing positional exits non-zero with "Missing required"', () => {
  const r = runCli('brand-compliance.cjs', []);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /not enough non-option arguments|missing required/i, 'Output should mention missing positional argument');
});

test('brand-compliance: valid file + --context website exits 0', () => {
  const r = runCli('brand-compliance.cjs', [CLEAN_WEBSITE, '--context', 'website']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
});

test('brand-compliance: --context flag is read (clean-website exits 0, not a context detection error)', () => {
  const r = runCli('brand-compliance.cjs', [CLEAN_WEBSITE, '--context', 'website']);
  // Any non-2 exit (2 = tool error) confirms context was parsed, not a hard failure
  assert.notEqual(r.status, 2, `Expected non-tool-error exit, got ${r.status}\nstderr: ${r.stderr}`);
});

test('brand-compliance: unknown flag exits non-zero with "Unknown argument"', () => {
  const r = runCli('brand-compliance.cjs', [CLEAN_WEBSITE, '--bogus-flag-xyz']);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /unknown argument/i, 'Output should mention unknown argument');
});

// ─── dimension-check.cjs ─────────────────────────────────────────────────────

test('dimension-check: --help exits 0 and shows usage', () => {
  const r = runCli('dimension-check.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /dimension-check/i, 'Help text should mention the tool name');
  assert.match(combined, /--target/i, 'Help text should mention --target flag');
});

test('dimension-check: missing positional exits non-zero with "Missing required"', () => {
  const r = runCli('dimension-check.cjs', []);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /not enough non-option arguments|missing required/i, 'Output should mention missing positional argument');
});

test('dimension-check: valid file + --target 1080x1080 exits 0', () => {
  const r = runCli('dimension-check.cjs', [CLEAN_SOCIAL, '--target', '1080x1080']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
});

test('dimension-check: --target flag is read (exits 0 for matching target)', () => {
  const r = runCli('dimension-check.cjs', [CLEAN_SOCIAL, '--target', '1080x1080']);
  assert.equal(r.status, 0, `Expected exit 0 for matching target, got ${r.status}\nstderr: ${r.stderr}`);
});

test('dimension-check: unknown flag exits non-zero with "Unknown argument"', () => {
  const r = runCli('dimension-check.cjs', [CLEAN_SOCIAL, '--bogus-flag-xyz']);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /unknown argument/i, 'Output should mention unknown argument');
});

// ─── scaffold.cjs ────────────────────────────────────────────────────────────

test('scaffold: --help exits 0 and shows usage', () => {
  const r = runCli('scaffold.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /scaffold/i, 'Help text should mention the tool name');
  assert.match(combined, /--output/i, 'Help text should mention --output flag');
});

test('scaffold: missing positional exits non-zero with "Missing required"', () => {
  const r = runCli('scaffold.cjs', []);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /not enough non-option arguments|missing required/i, 'Output should mention missing positional argument');
});

test('scaffold: valid section-name + --output path exits 0', () => {
  const tmpOut = path.join(os.tmpdir(), `scaffold-test-${Date.now()}.liquid`);
  const r = runCli('scaffold.cjs', ['test-hero', '--output', tmpOut]);
  try {
    assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.ok(fs.existsSync(tmpOut), 'Expected output file to be created');
  } finally {
    try { fs.unlinkSync(tmpOut); } catch (_) {}
  }
});

test('scaffold: --output flag is parsed (file is created at specified path)', () => {
  const tmpOut = path.join(os.tmpdir(), `scaffold-out-${Date.now()}.liquid`);
  const r = runCli('scaffold.cjs', ['my-section', '--output', tmpOut]);
  try {
    assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}`);
    assert.ok(fs.existsSync(tmpOut), 'Expected output file at --output path');
  } finally {
    try { fs.unlinkSync(tmpOut); } catch (_) {}
  }
});

test('scaffold: unknown flag exits non-zero with "Unknown argument"', () => {
  const r = runCli('scaffold.cjs', ['test-hero', '--bogus-flag-xyz']);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /unknown argument/i, 'Output should mention unknown argument');
});

// ─── feedback-ingest.cjs ─────────────────────────────────────────────────────
// Do NOT run in live mode (touches real DB/files).
// Verify via --help and that --dry-run / --test appear in help text.

test('feedback-ingest: --help exits 0 and shows usage', () => {
  const r = runCli('feedback-ingest.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /feedback-ingest/i, 'Help text should mention the tool name');
});

test('feedback-ingest: --help mentions --dry-run flag', () => {
  const r = runCli('feedback-ingest.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /--dry-run/i, 'Help text should mention --dry-run flag');
});

test('feedback-ingest: --help mentions --test flag', () => {
  const r = runCli('feedback-ingest.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /--test/i, 'Help text should mention --test flag');
});

test('feedback-ingest: unknown flag exits non-zero with "Unknown argument"', () => {
  const r = runCli('feedback-ingest.cjs', ['--bogus-flag-xyz']);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /unknown argument/i, 'Output should mention unknown argument');
});

// ─── db-import.cjs ───────────────────────────────────────────────────────────
// Do NOT run in live mode (modifies real SQLite DB).
// Verify via --help that --force and --merge appear in help text.

test('db-import: --help exits 0 and shows usage', () => {
  const r = runCli('db-import.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /db-import/i, 'Help text should mention the tool name');
});

test('db-import: --help mentions --force flag', () => {
  const r = runCli('db-import.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /--force/i, 'Help text should mention --force flag');
});

test('db-import: --help mentions --merge flag', () => {
  const r = runCli('db-import.cjs', ['--help']);
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /--merge/i, 'Help text should mention --merge flag');
});

test('db-import: unknown flag exits non-zero with "Unknown argument"', () => {
  const r = runCli('db-import.cjs', ['--bogus-flag-xyz']);
  assert.notEqual(r.status, 0, `Expected non-zero exit, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /unknown argument/i, 'Output should mention unknown argument');
});
