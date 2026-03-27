#!/usr/bin/env node
/**
 * compare-runs.cjs — Cross-run comparison tool.
 *
 * Usage:
 *   node tools/compare-runs.cjs <run-A/eval.json> <run-B/eval.json>
 *
 * Outputs:
 *   - Pass rate delta
 *   - New failures / fixed failures
 *   - Variety score delta
 *   - Per-rule violation count delta
 *   - Stage timing delta
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

if (args.length < 2) {
  console.error('Usage: node tools/compare-runs.cjs <run-A/eval.json> <run-B/eval.json>');
  console.error('  run-A is the baseline (before), run-B is the comparison (after).');
  process.exit(1);
}

const [pathA, pathB] = args;

let dataA, dataB;
try { dataA = JSON.parse(fs.readFileSync(pathA, 'utf-8')); } catch (e) { console.error(`Error reading ${pathA}: ${e.message}`); process.exit(1); }
try { dataB = JSON.parse(fs.readFileSync(pathB, 'utf-8')); } catch (e) { console.error(`Error reading ${pathB}: ${e.message}`); process.exit(1); }

const resultsA = Array.isArray(dataA.results || dataA) ? (dataA.results || dataA) : [dataA];
const resultsB = Array.isArray(dataB.results || dataB) ? (dataB.results || dataB) : [dataB];

// ---------------------------------------------------------------------------
// Pass rate delta
// ---------------------------------------------------------------------------
function passRate(results) {
  if (results.length === 0) return 0;
  return results.filter(r => (r.score?.fail ?? 0) === 0).length / results.length;
}

const prA = passRate(resultsA);
const prB = passRate(resultsB);
const prDelta = prB - prA;

// ---------------------------------------------------------------------------
// Per-rule violation counts
// ---------------------------------------------------------------------------
function countViolations(results) {
  const counts = {};
  for (const r of results) {
    for (const check of r.checks || []) {
      if (check.status === 'fail' || check.status === 'warn') {
        counts[check.name] = (counts[check.name] || 0) + 1;
      }
    }
  }
  return counts;
}

const violsA = countViolations(resultsA);
const violsB = countViolations(resultsB);

// All rules across both runs
const allRules = [...new Set([...Object.keys(violsA), ...Object.keys(violsB)])].sort();
const ruleDelta = {};
for (const rule of allRules) {
  const a = violsA[rule] || 0;
  const b = violsB[rule] || 0;
  ruleDelta[rule] = { before: a, after: b, delta: b - a };
}

// New failures = rules in B but not in A
const newFailures = allRules.filter(r => (violsA[r] || 0) === 0 && (violsB[r] || 0) > 0);
// Fixed failures = rules in A but not in B
const fixedFailures = allRules.filter(r => (violsA[r] || 0) > 0 && (violsB[r] || 0) === 0);

// ---------------------------------------------------------------------------
// Variety scores
// ---------------------------------------------------------------------------
function varietyScore(results) {
  const archetypes = new Set();
  const colors = new Set();
  for (const r of results) {
    const fid = (r.checks || []).find(c => c.name === 'archetype-fidelity');
    if (fid?.details?.slug) archetypes.add(fid.details.slug);
    try {
      const copyPath = path.join(r.workingDir, 'copy.md');
      if (fs.existsSync(copyPath)) {
        const copyMd = fs.readFileSync(copyPath, 'utf-8');
        const match = copyMd.match(/#(FF8B58|42B1FF|44B574|C985E5)/i);
        if (match) colors.add('#' + match[1].toUpperCase());
      }
    } catch { /* ok */ }
  }
  return {
    uniqueArchetypes: archetypes.size,
    uniqueColors: colors.size,
    archetypes: [...archetypes],
    colors: [...colors],
  };
}

const varA = varietyScore(resultsA);
const varB = varietyScore(resultsB);

// ---------------------------------------------------------------------------
// Stage timing delta
// ---------------------------------------------------------------------------
function stageTiming(results) {
  const times = {};
  for (const r of results) {
    if (r.handoff?.stages) {
      for (const [stage, data] of Object.entries(r.handoff.stages)) {
        if (data.duration) {
          if (!times[stage]) times[stage] = [];
          times[stage].push(data.duration);
        }
      }
    }
  }
  const avgs = {};
  for (const [stage, durations] of Object.entries(times)) {
    avgs[stage] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }
  return avgs;
}

const timingA = stageTiming(resultsA);
const timingB = stageTiming(resultsB);
const allStages = [...new Set([...Object.keys(timingA), ...Object.keys(timingB)])].sort();
const timingDelta = {};
for (const stage of allStages) {
  const a = timingA[stage] || 0;
  const b = timingB[stage] || 0;
  timingDelta[stage] = { before: a, after: b, delta: a && b ? b - a : null };
}

// ---------------------------------------------------------------------------
// Output report
// ---------------------------------------------------------------------------
const lines = [
  '# Run Comparison',
  '',
  `Baseline: ${pathA} (${resultsA.length} creations)`,
  `Comparison: ${pathB} (${resultsB.length} creations)`,
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Pass Rate',
  '',
  `| Run | Pass Rate | Count |`,
  `|-----|-----------|-------|`,
  `| Baseline | ${Math.round(prA * 100)}% | ${Math.round(prA * resultsA.length)}/${resultsA.length} |`,
  `| Comparison | ${Math.round(prB * 100)}% | ${Math.round(prB * resultsB.length)}/${resultsB.length} |`,
  `| **Delta** | **${prDelta >= 0 ? '+' : ''}${Math.round(prDelta * 100)}%** | |`,
  '',
];

// New / fixed failures
if (newFailures.length > 0 || fixedFailures.length > 0) {
  lines.push('## New / Fixed Failures', '');
  if (fixedFailures.length > 0) {
    lines.push('**Fixed (no longer failing):**');
    fixedFailures.forEach(r => lines.push(`- ${r} (was ${violsA[r]}x)`));
  }
  if (newFailures.length > 0) {
    lines.push('', '**New failures:**');
    newFailures.forEach(r => lines.push(`- ${r} (now ${violsB[r]}x)`));
  }
  lines.push('');
}

// Per-rule delta
lines.push('## Per-Rule Violation Delta', '');
lines.push('| Rule | Before | After | Delta |', '|------|--------|-------|-------|');
for (const [rule, data] of Object.entries(ruleDelta)) {
  const sign = data.delta > 0 ? '+' : data.delta < 0 ? '' : '';
  const indicator = data.delta < 0 ? ' ✅' : data.delta > 0 ? ' ❌' : '';
  lines.push(`| ${rule} | ${data.before} | ${data.after} | ${sign}${data.delta}${indicator} |`);
}

// Variety
lines.push('', '## Variety Score Delta', '');
lines.push('| Metric | Before | After | Delta |', '|--------|--------|-------|-------|');
lines.push(`| Unique archetypes | ${varA.uniqueArchetypes} | ${varB.uniqueArchetypes} | ${varB.uniqueArchetypes - varA.uniqueArchetypes >= 0 ? '+' : ''}${varB.uniqueArchetypes - varA.uniqueArchetypes} |`);
lines.push(`| Unique accent colors | ${varA.uniqueColors} | ${varB.uniqueColors} | ${varB.uniqueColors - varA.uniqueColors >= 0 ? '+' : ''}${varB.uniqueColors - varA.uniqueColors} |`);

// Timing
if (allStages.length > 0 && (Object.keys(timingA).length > 0 || Object.keys(timingB).length > 0)) {
  lines.push('', '## Stage Timing Delta', '');
  lines.push('| Stage | Before (ms) | After (ms) | Delta |', '|-------|-------------|------------|-------|');
  for (const [stage, data] of Object.entries(timingDelta)) {
    const delta = data.delta !== null ? `${data.delta >= 0 ? '+' : ''}${data.delta}ms` : 'n/a';
    lines.push(`| ${stage} | ${data.before || 'n/a'} | ${data.after || 'n/a'} | ${delta} |`);
  }
}

lines.push('');

const report = lines.join('\n');
process.stdout.write(report);

// Also write JSON for programmatic consumption
const jsonOutput = {
  baseline: pathA,
  comparison: pathB,
  passRate: { before: prA, after: prB, delta: prDelta },
  newFailures,
  fixedFailures,
  ruleDelta,
  variety: { before: varA, after: varB },
  timing: timingDelta,
};
process.stderr.write(JSON.stringify(jsonOutput, null, 2) + '\n');
