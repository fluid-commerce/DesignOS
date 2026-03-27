#!/usr/bin/env node
/**
 * eval-harness.cjs — Deterministic evaluation harness for pipeline outputs.
 *
 * Per-creation mode:
 *   node tools/eval-harness.cjs <htmlPath> --working-dir <dir> --creation-type <type>
 *
 * Batch mode:
 *   node tools/eval-harness.cjs --batch <report.json>
 *
 * Per-creation checks:
 *   - Archetype fidelity (schema fields present, populated vs total)
 *   - Copy structure (required sections, word counts)
 *   - Asset URL integrity (well-formed /api/brand-assets/serve/ URLs, @font-face, no base64)
 *   - CSS hygiene (no inline style="", font fallback is sans-serif)
 *   - DECORATIONS comment present
 *   - Brand compliance (via brand-compliance.cjs)
 *   - Dimensions (via dimension-check.cjs)
 *
 * Batch-level variety eval:
 *   - Archetype distribution (no single archetype >40%)
 *   - Accent color variety (at least 3 of 4 used across 6+ creations)
 *   - Template vs archetype routing ratio
 *   - Headline word pattern duplicates
 *
 * Output: JSON with checks[], score: { pass, fail, warn }, details
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const TOOLS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(TOOLS_DIR, '..');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let batchMode = false;
let batchReportPath = null;
let htmlPath = null;
let workingDir = null;
let creationType = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch' && args[i + 1]) { batchMode = true; batchReportPath = args[++i]; continue; }
  if (args[i] === '--working-dir' && args[i + 1]) { workingDir = args[++i]; continue; }
  if (args[i] === '--creation-type' && args[i + 1]) { creationType = args[++i]; continue; }
  if (!args[i].startsWith('--') && !htmlPath) { htmlPath = args[i]; }
}

if (!batchMode && !htmlPath) {
  console.error('Usage: node tools/eval-harness.cjs <htmlPath> --working-dir <dir> --creation-type <type>');
  console.error('       node tools/eval-harness.cjs --batch <report.json>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Per-creation checks
// ---------------------------------------------------------------------------

function checkArchetypeFidelity(htmlContent, workDir) {
  const result = { name: 'archetype-fidelity', status: 'skip', details: {} };

  // Read copy.md for archetype signal
  let copyMd = '';
  try { copyMd = fs.readFileSync(path.join(workDir, 'copy.md'), 'utf-8'); } catch { return result; }

  const archetypeMatch = copyMd.match(/archetype[:\s]+(\S+)/i);
  if (!archetypeMatch) { result.details.note = 'No archetype signal in copy.md'; return result; }

  const slug = archetypeMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, '');
  result.details.slug = slug;

  // Load schema.json
  const schemaPath = path.join(PROJECT_ROOT, 'archetypes', slug, 'schema.json');
  let schema;
  try { schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')); }
  catch { result.details.note = `schema.json not found for ${slug}`; return result; }

  // Check field selectors in HTML
  const fields = schema.fields || [];
  const total = fields.length;
  let populated = 0;
  const missing = [];

  for (const field of fields) {
    if (!field.sel) continue;
    // Extract class from selector (e.g., ".headline" -> "headline")
    const className = field.sel.replace(/^\./, '');
    const regex = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 'i');
    if (regex.test(htmlContent)) {
      populated++;
    } else {
      missing.push(field.sel);
    }
  }

  result.details = { slug, total, populated, missing };
  result.status = missing.length === 0 ? 'pass' : populated >= total * 0.6 ? 'warn' : 'fail';
  return result;
}

function checkCopyStructure(workDir, type) {
  const result = { name: 'copy-structure', status: 'skip', details: {} };

  let copyMd = '';
  try { copyMd = fs.readFileSync(path.join(workDir, 'copy.md'), 'utf-8'); }
  catch { result.details.note = 'copy.md not found'; return result; }

  const requiredSections = ['HEADLINE', 'BODY', 'TAGLINE'];
  const foundSections = [];
  const missingSections = [];

  for (const section of requiredSections) {
    const regex = new RegExp(`###?\\s*${section}`, 'i');
    if (regex.test(copyMd)) { foundSections.push(section); }
    else { missingSections.push(section); }
  }

  // Check for archetype or template signal
  const hasArchetype = /archetype[:\s]+\S+/i.test(copyMd);
  const hasTemplate = /template[:\s]+\S+/i.test(copyMd);
  if (!hasArchetype && !hasTemplate) missingSections.push('Archetype/Template');

  // Check accent color
  const hasAccent = /accent|color[:\s]+#/i.test(copyMd);
  if (!hasAccent) missingSections.push('Accent Color');

  // Word count check
  const headlineMatch = copyMd.match(/###?\s*HEADLINE\s*\n(.+)/i);
  const bodyMatch = copyMd.match(/###?\s*BODY\s*\n([\s\S]*?)(?=###|$)/i);
  const taglineMatch = copyMd.match(/###?\s*TAGLINE\s*\n(.+)/i);

  const headline = headlineMatch ? headlineMatch[1].trim() : '';
  const body = bodyMatch ? bodyMatch[1].trim() : '';
  const tagline = taglineMatch ? taglineMatch[1].trim() : '';

  const wordCount = (headline + ' ' + body + ' ' + tagline).split(/\s+/).filter(w => w).length;
  const limit = type === 'instagram' ? 20 : type === 'linkedin' ? 30 : 100;

  result.details = {
    foundSections,
    missingSections,
    hasArchetype,
    hasTemplate,
    wordCount,
    limit,
    overLimit: wordCount > limit,
    headline: headline.slice(0, 80),
    tagline: tagline.slice(0, 80),
  };

  result.status = missingSections.length === 0 && wordCount <= limit * 1.5 ? 'pass'
    : missingSections.length <= 1 ? 'warn' : 'fail';
  return result;
}

function checkAssetUrlIntegrity(htmlContent) {
  const result = { name: 'asset-url-integrity', status: 'pass', details: {} };
  const issues = [];

  // Check for well-formed /api/brand-assets/serve/ URLs
  const assetUrls = htmlContent.match(/\/api\/brand-assets\/serve\/[^\s'")<>]+/g) || [];
  result.details.assetUrlCount = assetUrls.length;

  // Check for malformed URLs (with subdirectories or extensions)
  for (const url of assetUrls) {
    const afterServe = url.split('/api/brand-assets/serve/')[1];
    if (afterServe && afterServe.includes('/')) {
      issues.push(`Malformed asset URL (has subdirectory): ${url}`);
    }
  }

  // Check for @font-face declarations
  const hasFontFace = /@font-face/i.test(htmlContent);
  result.details.hasFontFace = hasFontFace;
  if (!hasFontFace) issues.push('No @font-face declarations found');

  // Check for base64 data URIs (prohibited)
  const hasBase64 = /data:(?:image|font|application)\/[^;]+;base64/i.test(htmlContent);
  if (hasBase64) issues.push('Base64 data URI found (prohibited)');

  // Check for brushstroke/decorative elements (should have 2+)
  const brushMatches = htmlContent.match(/brush|texture|decorative/gi) || [];
  result.details.decorativeElementCount = brushMatches.length;

  result.details.issues = issues;
  result.status = issues.length === 0 ? 'pass' : issues.some(i => i.includes('Base64')) ? 'fail' : 'warn';
  return result;
}

function checkCssHygiene(htmlContent) {
  const result = { name: 'css-hygiene', status: 'pass', details: {} };
  const issues = [];

  // Check for inline style="" attributes (outside <style> blocks)
  let inStyle = false;
  const lines = htmlContent.split('\n');
  let inlineStyleCount = 0;
  for (const line of lines) {
    if (/<style[\s>]/i.test(line)) inStyle = true;
    if (/<\/style>/i.test(line)) { inStyle = false; continue; }
    if (inStyle) continue;
    if (/(?<![a-zA-Z-])style\s*=\s*["'][^"']+["']/i.test(line)) {
      inlineStyleCount++;
    }
  }
  if (inlineStyleCount > 0) {
    issues.push(`${inlineStyleCount} inline style="" attributes found`);
  }

  // Check font fallback is sans-serif
  const fontFamilyDecls = htmlContent.match(/font-family\s*:\s*[^;}{]+/gi) || [];
  for (const decl of fontFamilyDecls) {
    if (/serif(?!\s*-)/i.test(decl) && !/sans-serif/i.test(decl)) {
      issues.push(`Bad font fallback (serif instead of sans-serif): ${decl.trim().slice(0, 60)}`);
    }
    if (/Georgia|Times New Roman|cursive/i.test(decl)) {
      issues.push(`Prohibited font fallback: ${decl.trim().slice(0, 60)}`);
    }
  }

  result.details = { inlineStyleCount, issues };
  result.status = issues.length === 0 ? 'pass' : inlineStyleCount > 0 ? 'fail' : 'warn';
  return result;
}

function checkDecorationsComment(htmlContent) {
  const result = { name: 'decorations-comment', status: 'fail', details: {} };
  const match = htmlContent.match(/<!-- DECORATIONS:\s*brush="([^"]*)"\s*brushAdditional=\[([^\]]*)\]\s*-->/);
  if (match) {
    result.status = 'pass';
    result.details = { brush: match[1] || '(none)', additionalCount: match[2] ? match[2].split(',').filter(Boolean).length : 0 };
  } else {
    result.details = { note: 'DECORATIONS comment not found in HTML' };
  }
  return result;
}

function checkBrandCompliance(absHtmlPath, type) {
  const result = { name: 'brand-compliance', status: 'skip', details: {} };
  const context = type === 'one-pager' ? 'website' : 'social';
  try {
    const output = execSync(
      `node "${path.join(TOOLS_DIR, 'brand-compliance.cjs')}" "${absHtmlPath}" --context ${context}`,
      { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = JSON.parse(output);
    result.details = parsed.summary;
    result.status = parsed.summary.errors === 0 ? 'pass' : 'fail';
  } catch (e) {
    // brand-compliance exits 1 on errors but still outputs valid JSON
    try {
      const parsed = JSON.parse(e.stdout || '');
      result.details = parsed.summary;
      result.status = parsed.summary.errors === 0 ? 'pass' : 'fail';
    } catch {
      result.details = { error: e.message?.slice(0, 200) };
      result.status = 'fail';
    }
  }
  return result;
}

function checkDimensions(absHtmlPath) {
  const result = { name: 'dimensions', status: 'skip', details: {} };
  try {
    const output = execSync(
      `node "${path.join(TOOLS_DIR, 'dimension-check.cjs')}" "${absHtmlPath}"`,
      { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = JSON.parse(output);
    result.details = parsed;
    result.status = parsed.status === 'pass' ? 'pass' : parsed.status === 'fail' ? 'fail' : 'warn';
  } catch (e) {
    try {
      const parsed = JSON.parse(e.stdout || '');
      result.details = parsed;
      result.status = parsed.status === 'pass' ? 'pass' : 'fail';
    } catch {
      result.details = { error: e.message?.slice(0, 200) };
    }
  }
  return result;
}

function checkDecorativeElements(htmlContent) {
  const result = { name: 'decorative-elements', status: 'skip', details: {} };

  // Count background-image references to brand asset URLs (brushstrokes/textures)
  const bgImageMatches = htmlContent.match(/background-image\s*:\s*url\([^)]*\/api\/brand-assets\/serve\/[^)]*\)/gi) || [];
  const brushMatches = bgImageMatches.filter(m => /brush|texture|line|scribble|x-mark/i.test(m));
  result.details.brushstrokeCount = brushMatches.length;

  // Count mask-image references (circle/underline emphasis)
  const maskMatches = htmlContent.match(/mask-image\s*:\s*url\([^)]*\/api\/brand-assets\/serve\/(circle|underline)[^)]*\)/gi) || [];
  result.details.emphasisCount = maskMatches.length;

  // Also count img tags referencing brush assets (older pattern from pattern-seeds)
  const imgBrushMatches = htmlContent.match(/<(?:img|div)[^>]*src=["'][^"']*\/api\/brand-assets\/serve\/brush[^"']*["']/gi) || [];
  const totalDecorative = brushMatches.length + imgBrushMatches.length;
  result.details.totalDecorative = totalDecorative;

  if (totalDecorative < 2) {
    result.status = 'fail';
    result.details.note = `Only ${totalDecorative} decorative element(s) found, minimum 2 required`;
  } else if (maskMatches.length === 0) {
    result.status = 'warn';
    result.details.note = 'Brushstrokes present but no circle/underline emphasis detected';
  } else {
    result.status = 'pass';
  }

  return result;
}

function checkCanvasFill(htmlContent, type) {
  const result = { name: 'canvas-fill', status: 'skip', details: {} };
  if (type === 'one-pager') return result; // not applicable to one-pagers

  // Extract font-size values from CSS
  const fontSizes = [];
  const matches = htmlContent.matchAll(/font-size\s*:\s*(\d+)px/gi);
  for (const m of matches) fontSizes.push(parseInt(m[1]));
  if (fontSizes.length === 0) return result;

  const maxSize = Math.max(...fontSizes);
  result.details.maxFontSize = maxSize;
  result.details.allSizes = [...new Set(fontSizes)].sort((a, b) => b - a).slice(0, 5);

  const minHeadline = type === 'linkedin' ? 52 : 72;
  if (maxSize < minHeadline) {
    result.status = 'warn';
    result.details.note = `Largest font-size is ${maxSize}px, recommended minimum headline is ${minHeadline}px`;
  } else {
    result.status = 'pass';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Per-creation evaluation
// ---------------------------------------------------------------------------

function evaluateCreation(absHtmlPath, workDir, type) {
  if (!fs.existsSync(absHtmlPath)) {
    return {
      htmlPath: absHtmlPath,
      workingDir: workDir,
      creationType: type,
      checks: [{ name: 'html-exists', status: 'fail', details: { note: 'HTML file not found' } }],
      score: { pass: 0, fail: 1, warn: 0 },
    };
  }

  const htmlContent = fs.readFileSync(absHtmlPath, 'utf-8');

  const checks = [
    checkArchetypeFidelity(htmlContent, workDir),
    checkCopyStructure(workDir, type),
    checkAssetUrlIntegrity(htmlContent),
    checkCssHygiene(htmlContent),
    checkDecorationsComment(htmlContent),
    checkDecorativeElements(htmlContent),
    checkCanvasFill(htmlContent, type),
    checkBrandCompliance(absHtmlPath, type),
    checkDimensions(absHtmlPath),
  ];

  const score = {
    pass: checks.filter(c => c.status === 'pass').length,
    fail: checks.filter(c => c.status === 'fail').length,
    warn: checks.filter(c => c.status === 'warn').length,
  };

  return { htmlPath: absHtmlPath, workingDir: workDir, creationType: type, checks, score };
}

// ---------------------------------------------------------------------------
// Batch-level variety evaluation
// ---------------------------------------------------------------------------

function evaluateBatch(results) {
  const varietyChecks = [];

  // 1. Archetype distribution — no single archetype >40%
  const archetypeCounts = {};
  let archetypeTotal = 0;
  for (const r of results) {
    const fidelity = r.checks.find(c => c.name === 'archetype-fidelity');
    if (fidelity?.details?.slug) {
      archetypeCounts[fidelity.details.slug] = (archetypeCounts[fidelity.details.slug] || 0) + 1;
      archetypeTotal++;
    }
  }
  const maxArchetypePct = archetypeTotal > 0 ? Math.max(...Object.values(archetypeCounts)) / archetypeTotal : 0;
  varietyChecks.push({
    name: 'archetype-distribution',
    status: maxArchetypePct > 0.4 && archetypeTotal >= 5 ? 'warn' : 'pass',
    details: { counts: archetypeCounts, total: archetypeTotal, maxPct: Math.round(maxArchetypePct * 100) + '%' },
  });

  // 2. Accent color variety — at least 3 of 4 used across 6+ creations
  const accentColors = new Set();
  for (const r of results) {
    const copy = r.checks.find(c => c.name === 'copy-structure');
    if (copy?.details) {
      // Try to extract accent from workingDir/copy.md
      try {
        const copyMd = fs.readFileSync(path.join(r.workingDir, 'copy.md'), 'utf-8');
        const colorMatch = copyMd.match(/#(?:FF8B58|42B1FF|44B574|C985E5)/i);
        if (colorMatch) accentColors.add(colorMatch[0].toUpperCase());
      } catch { /* ok */ }
    }
  }
  varietyChecks.push({
    name: 'accent-color-variety',
    status: results.length >= 6 && accentColors.size < 3 ? 'warn' : 'pass',
    details: { colorsUsed: [...accentColors], count: accentColors.size, threshold: 3 },
  });

  // 3. Template vs archetype routing ratio
  let templateCount = 0;
  let archetypeCount = 0;
  for (const r of results) {
    const copy = r.checks.find(c => c.name === 'copy-structure');
    if (copy?.details?.hasTemplate) templateCount++;
    else if (copy?.details?.hasArchetype) archetypeCount++;
  }
  varietyChecks.push({
    name: 'routing-ratio',
    status: 'info',
    details: { template: templateCount, archetype: archetypeCount, total: results.length },
  });

  // 4. Headline word patterns — no >2 creations share same first word
  const firstWords = {};
  for (const r of results) {
    const copy = r.checks.find(c => c.name === 'copy-structure');
    if (copy?.details?.headline) {
      const firstWord = copy.details.headline.split(/\s+/)[0]?.toUpperCase();
      if (firstWord) {
        if (!firstWords[firstWord]) firstWords[firstWord] = [];
        firstWords[firstWord].push(r.htmlPath);
      }
    }
  }
  const duplicateStarters = Object.entries(firstWords).filter(([, v]) => v.length > 2);
  varietyChecks.push({
    name: 'headline-variety',
    status: duplicateStarters.length > 0 ? 'warn' : 'pass',
    details: { duplicateStarters: duplicateStarters.map(([word, paths]) => ({ word, count: paths.length })) },
  });

  return varietyChecks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (batchMode) {
  // Read report.json and run batch variety eval
  let report;
  try { report = JSON.parse(fs.readFileSync(batchReportPath, 'utf-8')); }
  catch (e) { console.error(`Error reading report: ${e.message}`); process.exit(1); }

  const results = report.results || report;
  const varietyChecks = evaluateBatch(Array.isArray(results) ? results : [results]);

  const output = {
    mode: 'batch',
    totalCreations: Array.isArray(results) ? results.length : 1,
    varietyChecks,
    score: {
      pass: varietyChecks.filter(c => c.status === 'pass').length,
      fail: varietyChecks.filter(c => c.status === 'fail').length,
      warn: varietyChecks.filter(c => c.status === 'warn').length,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} else {
  // Per-creation eval
  const absHtmlPath = path.resolve(htmlPath);
  const workDir = workingDir || path.dirname(absHtmlPath);
  const type = creationType || 'instagram';

  const result = evaluateCreation(absHtmlPath, workDir, type);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  // Exit code: 1 if any failures
  process.exit(result.score.fail > 0 ? 1 : 0);
}
