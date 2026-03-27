#!/usr/bin/env node
/**
 * report-summary.cjs — Generate SUMMARY.md from eval results.
 *
 * Usage: node tools/report-summary.cjs <eval.json> [--output <SUMMARY.md>]
 *
 * Reads the eval JSON and produces:
 *   - Pass/fail table per creation
 *   - Common failure patterns (grouped by rule, sorted by frequency)
 *   - Variety analysis (archetype distribution, accent color usage)
 *   - Stage timing breakdown
 *   - Deterministic recommendations
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
let evalPath = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) { outputPath = args[++i]; continue; }
  if (!args[i].startsWith('--') && !evalPath) { evalPath = args[i]; }
}

if (!evalPath) {
  console.error('Usage: node tools/report-summary.cjs <eval.json> [--output <SUMMARY.md>]');
  process.exit(1);
}

const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));
const results = evalData.results || evalData;
const creations = Array.isArray(results) ? results : [results];

// ---------------------------------------------------------------------------
// Pass/fail table
// ---------------------------------------------------------------------------
const lines = [
  '# Overnight Run Summary',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Total creations: ${creations.length}`,
  '',
  '## Pass/Fail Table',
  '',
  '| # | Type | Archetype | Pass | Fail | Warn | Overall |',
  '|---|------|-----------|------|------|------|---------|',
];

for (let i = 0; i < creations.length; i++) {
  const c = creations[i];
  const fidelity = (c.checks || []).find(ch => ch.name === 'archetype-fidelity');
  const slug = fidelity?.details?.slug || 'n/a';
  const p = c.score?.pass ?? 0;
  const f = c.score?.fail ?? 0;
  const w = c.score?.warn ?? 0;
  const overall = f > 0 ? 'FAIL' : w > 0 ? 'WARN' : 'PASS';
  lines.push(`| ${i + 1} | ${c.creationType || '?'} | ${slug} | ${p} | ${f} | ${w} | ${overall} |`);
}

const totalPass = creations.filter(c => (c.score?.fail ?? 0) === 0).length;
const totalFail = creations.length - totalPass;
lines.push('', `**Overall: ${totalPass}/${creations.length} pass (${Math.round(totalPass / creations.length * 100)}%)**`);

// ---------------------------------------------------------------------------
// Common failure patterns
// ---------------------------------------------------------------------------
lines.push('', '## Common Failure Patterns', '');

const failureCounts = {};
for (const c of creations) {
  for (const check of c.checks || []) {
    if (check.status === 'fail' || check.status === 'warn') {
      const key = check.name;
      if (!failureCounts[key]) failureCounts[key] = { count: 0, status: check.status, samples: [] };
      failureCounts[key].count++;
      if (failureCounts[key].samples.length < 3) {
        const detail = JSON.stringify(check.details || {}).slice(0, 100);
        failureCounts[key].samples.push(detail);
      }
    }
  }
}

const sortedFailures = Object.entries(failureCounts).sort((a, b) => b[1].count - a[1].count);
if (sortedFailures.length === 0) {
  lines.push('No failures or warnings detected.');
} else {
  lines.push('| Rule | Count | Status | Sample |', '|------|-------|--------|--------|');
  for (const [rule, data] of sortedFailures) {
    lines.push(`| ${rule} | ${data.count}/${creations.length} | ${data.status} | ${data.samples[0] || ''} |`);
  }
}

// ---------------------------------------------------------------------------
// Variety analysis
// ---------------------------------------------------------------------------
lines.push('', '## Variety Analysis', '');

// Archetype distribution
const archetypeCounts = {};
for (const c of creations) {
  const fidelity = (c.checks || []).find(ch => ch.name === 'archetype-fidelity');
  const slug = fidelity?.details?.slug;
  if (slug) archetypeCounts[slug] = (archetypeCounts[slug] || 0) + 1;
}
lines.push('### Archetype Distribution');
if (Object.keys(archetypeCounts).length > 0) {
  lines.push('| Archetype | Count | % |', '|-----------|-------|---|');
  const total = Object.values(archetypeCounts).reduce((a, b) => a + b, 0);
  for (const [slug, count] of Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round(count / total * 100);
    const flag = pct > 40 ? ' ⚠️' : '';
    lines.push(`| ${slug} | ${count} | ${pct}%${flag} |`);
  }
} else {
  lines.push('No archetype data available.');
}

// Accent colors
lines.push('', '### Accent Color Usage');
const accentColors = {};
for (const c of creations) {
  try {
    const copyPath = path.join(c.workingDir, 'copy.md');
    if (fs.existsSync(copyPath)) {
      const copyMd = fs.readFileSync(copyPath, 'utf-8');
      const match = copyMd.match(/#(FF8B58|42B1FF|44B574|C985E5)/i);
      if (match) {
        const color = '#' + match[1].toUpperCase();
        accentColors[color] = (accentColors[color] || 0) + 1;
      }
    }
  } catch { /* ok */ }
}

const colorNames = { '#FF8B58': 'Orange', '#42B1FF': 'Blue', '#44B574': 'Green', '#C985E5': 'Purple' };
if (Object.keys(accentColors).length > 0) {
  for (const [color, count] of Object.entries(accentColors)) {
    lines.push(`- ${colorNames[color] || color}: ${count} use(s)`);
  }
  if (Object.keys(accentColors).length < 3 && creations.length >= 6) {
    lines.push('', '⚠️ Low color variety — only ' + Object.keys(accentColors).length + ' of 4 accent colors used.');
  }
} else {
  lines.push('No accent color data available.');
}

// ---------------------------------------------------------------------------
// Stage timing (if available)
// ---------------------------------------------------------------------------
lines.push('', '## Stage Timing', '');
let hasTimingData = false;
const stageTimes = {};
for (const c of creations) {
  if (c.handoff?.stages) {
    hasTimingData = true;
    for (const [stage, data] of Object.entries(c.handoff.stages)) {
      if (data.duration) {
        if (!stageTimes[stage]) stageTimes[stage] = [];
        stageTimes[stage].push(data.duration);
      }
    }
  }
}
if (hasTimingData) {
  lines.push('| Stage | Avg (ms) | Min | Max |', '|-------|----------|-----|-----|');
  for (const [stage, times] of Object.entries(stageTimes)) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);
    lines.push(`| ${stage} | ${avg} | ${min} | ${max} |`);
  }
} else {
  lines.push('No timing data available in this run.');
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------
lines.push('', '## Recommendations', '');

const recommendations = [];

// Archetype over-selection
for (const [slug, count] of Object.entries(archetypeCounts)) {
  const total = Object.values(archetypeCounts).reduce((a, b) => a + b, 0);
  if (count / total > 0.4 && total >= 5) {
    recommendations.push(`- **Archetype over-selected**: "${slug}" used ${Math.round(count / total * 100)}% of the time. Add variety bias to copy prompt.`);
  }
}

// Compliance rule failing >20%
for (const [rule, data] of sortedFailures) {
  if (data.count / creations.length > 0.2 && data.status === 'fail') {
    recommendations.push(`- **Compliance rule failing**: "${rule}" failing in ${Math.round(data.count / creations.length * 100)}% of creations. Tighten relevant pattern-seed.`);
  }
}

// Low color variety
if (Object.keys(accentColors).length < 3 && creations.length >= 6) {
  recommendations.push(`- **Low accent color variety**: Only ${Object.keys(accentColors).length}/4 colors used. Add color rotation guidance to copy prompt.`);
}

if (recommendations.length === 0) {
  lines.push('No actionable recommendations — results look healthy.');
} else {
  lines.push(...recommendations);
}

lines.push('');

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const summary = lines.join('\n');

if (outputPath) {
  fs.writeFileSync(outputPath, summary);
  console.error(`Summary written to ${outputPath}`);
} else {
  // Default: write next to eval.json
  const defaultOutput = path.join(path.dirname(evalPath), 'SUMMARY.md');
  fs.writeFileSync(defaultOutput, summary);
  console.error(`Summary written to ${defaultOutput}`);
}

process.stdout.write(summary);
