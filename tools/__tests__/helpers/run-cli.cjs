'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const TOOLS_DIR = path.resolve(__dirname, '../..');

/**
 * Spawn a CLI at tools/<name>.cjs with args, capture stdout/stderr/status.
 *
 * @param {string} name - Tool filename relative to tools/, e.g. 'brand-compliance.cjs'
 * @param {string[]} args - Argv to pass after the script
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] - Environment (merged onto process.env)
 * @param {string} [options.cwd] - Working directory (default: tools/)
 * @param {string|Buffer} [options.input] - stdin payload
 * @param {number} [options.timeoutMs] - Kill after N ms (default 15000)
 * @returns {{ stdout: string, stderr: string, status: number | null, signal: NodeJS.Signals | null }}
 */
function runCli(name, args = [], options = {}) {
  const script = path.join(TOOLS_DIR, name);
  const result = spawnSync('node', [script, ...args], {
    cwd: options.cwd ?? TOOLS_DIR,
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 15000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
    signal: result.signal,
  };
}

module.exports = { runCli, TOOLS_DIR };
