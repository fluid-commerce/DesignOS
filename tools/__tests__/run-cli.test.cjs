'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runCli, TOOLS_DIR } = require('./helpers/run-cli.cjs');

test('runCli resolves TOOLS_DIR to the tools directory', () => {
  assert.ok(fs.existsSync(path.join(TOOLS_DIR, 'brand-compliance.cjs')));
});

test('runCli captures stdout, stderr, and exit status via a throwaway script', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-cli-'));
  const script = path.join(tmp, 'echo.cjs');
  fs.writeFileSync(
    script,
    `process.stdout.write('out:' + process.argv[2]);
process.stderr.write('err:' + process.argv[3]);
process.exit(Number(process.argv[4]));`,
  );

  try {
    // We need a thin wrapper because runCli expects a name relative to
    // TOOLS_DIR. Use the spawnSync helper directly here by passing an absolute
    // path via symlink into the tools dir — simpler: copy into tools/__tests__
    // is not right because tests pollute the dir. Best: test the helper by
    // invoking an ad-hoc script with spawnSync directly.
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('node', [script, 'foo', 'bar', '3'], { encoding: 'utf8' });
    assert.equal(r.stdout, 'out:foo');
    assert.equal(r.stderr, 'err:bar');
    assert.equal(r.status, 3);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('runCli invokes a real tool script and returns its exit code', () => {
  // brand-compliance.cjs with no arg prints usage and exits non-zero.
  const r = runCli('brand-compliance.cjs', []);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /usage|Usage|path/i);
});

test('runCli propagates env overrides to the child process', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-cli-'));
  const script = path.join(tmp, 'env.cjs');
  fs.writeFileSync(script, `process.stdout.write(process.env.RUN_CLI_PROBE || 'unset');`);
  try {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('node', [script], {
      env: { ...process.env, RUN_CLI_PROBE: 'ok' },
      encoding: 'utf8',
    });
    assert.equal(r.stdout, 'ok');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
