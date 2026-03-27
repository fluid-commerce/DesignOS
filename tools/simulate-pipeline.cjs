#!/usr/bin/env node
/**
 * simulate-pipeline.cjs — CLI harness for pipeline simulation and testing.
 *
 * Usage:
 *   node tools/simulate-pipeline.cjs "Create an Instagram post about Fluid Connect"
 *   node tools/simulate-pipeline.cjs --pipeline "Create an Instagram post about Fluid Connect"
 *   node tools/simulate-pipeline.cjs --live "Launch a campaign for Payments"
 *   node tools/simulate-pipeline.cjs --dry-run "Just a linkedin post about FairShare"
 *   node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json
 *
 * Modes:
 *   (default)   Build pipeline prompts, then output a JSON manifest for Claude Code
 *               subagent execution (copy → layout → styling → spec-check).
 *   --pipeline  Dump pipeline prompts/context to _pipeline/ for manual inspection.
 *   --live      Run the full pipeline with real Anthropic API calls (requires API key)
 *   --dry-run   DB records + filesystem only (no prompt building, no API calls)
 *   --batch     Read prompts from file (one per line), run sequentially
 *   --report    Write JSON report to file
 *
 * Both default and --pipeline modes create a _pipeline/ directory in each creation's working dir with:
 *   _pipeline/copy-system.txt          — exact system prompt for copy stage
 *   _pipeline/copy-user.txt            — exact user prompt for copy stage
 *   _pipeline/copy-injected-context.txt — pre-injected brand context
 *   _pipeline/layout-system.txt        — exact system prompt for layout stage
 *   _pipeline/layout-user.txt          — exact user prompt (includes Design DNA)
 *   _pipeline/styling-system.txt       — exact system prompt for styling stage
 *   _pipeline/styling-user.txt         — exact user prompt
 *   _pipeline/styling-asset-manifest.txt — pre-injected asset URLs
 *   _pipeline/spec-check-user.txt      — exact spec-check prompt
 *   _pipeline/context.json             — creation metadata (IDs, paths, type)
 *   _pipeline/tools.json               — tool schemas available per stage
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const TOOLS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(TOOLS_DIR, '..');
const CANVAS_DIR = path.join(PROJECT_ROOT, 'canvas');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let prompt = '';
let liveMode = false;
let dryRun = false;
let pipelineOnly = false;
let batchFile = null;
let reportFile = null;
let stepMode = null;       // --step init|copy|layout|styling|spec-check|micro-fix|fix|attach-schema
let stepWorkingDir = null;  // --working-dir for --step mode
let stepCampaignCtx = null; // --campaign-context for --step copy
let stepTarget = null;      // --target for --step fix
let stepIssues = null;      // --issues for --step fix

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live') { liveMode = true; continue; }
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--pipeline') { pipelineOnly = true; continue; }
  if (args[i] === '--prompt' && args[i + 1]) { prompt = args[++i]; continue; }
  if (args[i] === '--batch' && args[i + 1]) { batchFile = args[++i]; continue; }
  if (args[i] === '--report' && args[i + 1]) { reportFile = args[++i]; continue; }
  if (args[i] === '--step' && args[i + 1]) { stepMode = args[++i]; continue; }
  if (args[i] === '--working-dir' && args[i + 1]) { stepWorkingDir = args[++i]; continue; }
  if (args[i] === '--campaign-context' && args[i + 1]) { stepCampaignCtx = args[++i]; continue; }
  if (args[i] === '--target' && args[i + 1]) { stepTarget = args[++i]; continue; }
  if (args[i] === '--issues' && args[i + 1]) { stepIssues = args[++i]; continue; }
  if (!prompt && !args[i].startsWith('--')) { prompt = args[i]; }
}

if (!prompt && !batchFile && !stepMode) {
  console.error(`simulate-pipeline — Test the generation pipeline from CLI

Usage:
  node tools/simulate-pipeline.cjs "Your prompt here"
  node tools/simulate-pipeline.cjs --pipeline "Your prompt here"
  node tools/simulate-pipeline.cjs --live "Your prompt here"
  node tools/simulate-pipeline.cjs --dry-run "Your prompt here"
  node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json
  node tools/simulate-pipeline.cjs --step <mode> [--working-dir <dir>] "prompt"

Modes:
  (default)   Build prompts + spawn Claude Code subagents to generate assets
  --pipeline  Dump pipeline prompts/context to _pipeline/ for inspection only
  --live      Run the real Anthropic API pipeline
  --dry-run   DB records + filesystem only (fastest)
  --step      Build prompts for one stage at a time (init|copy|layout|styling|spec-check|micro-fix|fix|attach-schema)
`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// --step mode helper
// ---------------------------------------------------------------------------

/**
 * Run a --step command via a temporary tsx script that imports the real
 * api-pipeline.ts functions. Returns JSON to stdout.
 */
function runStepViaTsx(stepName, tsxBody) {
    const tmpScript = path.join(CANVAS_DIR, `_sim-step-${stepName}-${Date.now()}.mts`);
    fs.writeFileSync(tmpScript, tsxBody);

    // tsx creates an IPC socket under TMPDIR. The sandbox may set TMPDIR to
    // a path it can't actually create (e.g. /tmp/claude). Use /tmp/claude-1000
    // which the sandbox pre-creates and guarantees writable.
    const safeTmpDir = fs.existsSync('/tmp/claude-1000') ? '/tmp/claude-1000'
      : (process.env.TMPDIR || '/tmp');

    try {
      const output = execSync(
        `cd "${CANVAS_DIR}" && npx tsx "${tmpScript}"`,
        { encoding: 'utf-8', timeout: 30000, env: { ...process.env, FLUID_DB_PATH: DB_PATH, TMPDIR: safeTmpDir } }
      );
      return output.trim().split('\n').pop();
    } finally {
      try { fs.unlinkSync(tmpScript); } catch { /* ok */ }
    }
  }

function executeStepMode() {
  if (stepMode === 'init' && !prompt) {
    console.error('Error: --step init requires a prompt argument.');
    process.exit(1);
  }
  if (stepMode !== 'init' && !stepWorkingDir) {
    console.error('Error: --step ' + stepMode + ' requires --working-dir <dir>.');
    process.exit(1);
  }

  try {
    if (stepMode === 'init') {
      // Create DB records for all creations, return manifest
      const { campaignId, isSingleCreation, creationMap } = preCreateCampaign(prompt);
      const manifest = {
        campaignId,
        isSingleCreation,
        creations: creationMap.map(c => ({
          creationId: c.creation.id,
          creationType: c.creation.creationType,
          title: c.creation.title,
          iterationId: c.iterationId,
          workingDir: c.workingDir,
          htmlOutputPath: c.absHtmlPath,
          pipelineDir: path.join(c.workingDir, '_pipeline'),
        })),
      };
      // Create _pipeline dirs and write per-creation manifests
      for (const c of manifest.creations) {
        fs.mkdirSync(c.pipelineDir, { recursive: true });
        fs.writeFileSync(path.join(c.pipelineDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      }
      console.log(JSON.stringify(manifest));
      db.close();
      process.exit(0);
    }

    const pipelineDir = path.join(stepWorkingDir, '_pipeline');
    fs.mkdirSync(pipelineDir, { recursive: true });

    // Read manifest to get context
    let manifestData = {};
    try {
      manifestData = JSON.parse(fs.readFileSync(path.join(pipelineDir, 'manifest.json'), 'utf-8'));
    } catch { /* ok — not all steps need it */ }

    // Find this creation in the manifest
    const thisCreation = (manifestData.creations || []).find(c => c.workingDir === stepWorkingDir) || {};
    const creationType = thisCreation.creationType || 'instagram';
    const htmlOutputPath = thisCreation.htmlOutputPath || path.join(stepWorkingDir, 'output.html');
    const creationId = thisCreation.creationId || '';
    const iterationId = thisCreation.iterationId || '';
    const campaignId = manifestData.campaignId || '';

    if (stepMode === 'copy') {
      const campaignCtxArg = stepCampaignCtx ? JSON.stringify(stepCampaignCtx) : 'undefined';
      const result = runStepViaTsx('copy', `
import { buildCopyPrompt, buildSystemPrompt, buildPhotoAvailabilitySummary, scanArchetypes, filterArchetypesByPlatform, STAGE_TOOLS } from './src/server/api-pipeline.js';
import { loadContextMap } from './src/server/db-api.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ctx = ${JSON.stringify({ prompt, creationType, workingDir: stepWorkingDir, htmlOutputPath, creationId, campaignId })};
const pipelineDir = ${JSON.stringify(pipelineDir)};
const campaignContext = ${campaignCtxArg};

let contextMap; try { contextMap = loadContextMap(); } catch { contextMap = new Map(); }

// Scan archetypes and build list
const archetypes = await scanArchetypes();
const platformArchetypes = filterArchetypesByPlatform(archetypes, ctx.creationType);
const archetypeList = [...platformArchetypes.values()].map(a => '- ' + a.slug + ': ' + a.description).join('\\n');
const photoSummary = buildPhotoAvailabilitySummary(ctx.creationType, archetypes);

// Build copy prompts
const copyUser = buildCopyPrompt(ctx, campaignContext, archetypeList, photoSummary);
const copySystem = buildSystemPrompt('copy', ctx);

await fs.writeFile(path.join(pipelineDir, 'copy-system.txt'), copySystem);
await fs.writeFile(path.join(pipelineDir, 'copy-user.txt'), copyUser);

// Dump tool schemas
const tools = STAGE_TOOLS['copy'].map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
await fs.writeFile(path.join(pipelineDir, 'tools.json'), JSON.stringify(tools, null, 2));

console.log(JSON.stringify({ ok: true }));
`);
      console.log(result);
    }

    else if (stepMode === 'layout') {
      const result = runStepViaTsx('layout', `
import { buildLayoutPrompt, buildSystemPrompt, scanArchetypes, filterArchetypesByPlatform, resolveArchetypeSlug, STAGE_TOOLS } from './src/server/api-pipeline.js';
import { loadContextMap, getDesignDnaForPipeline } from './src/server/db-api.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ctx = ${JSON.stringify({ prompt, creationType, workingDir: stepWorkingDir, htmlOutputPath, creationId, campaignId })};
const pipelineDir = ${JSON.stringify(pipelineDir)};

// Read copy.md to detect routing signal
let copyMd = '';
try { copyMd = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8'); } catch {}

const archetypes = await scanArchetypes();
let isTemplatePath = false;
let resolvedTemplateId = '';
let resolvedArchetypeSlug = '';
let archetypeHtml: string | undefined;
let templateHtml: string | undefined;

// Check template signal first
const templateMatch = copyMd.match(/template[:\\s]+(\\S+)/i);
if (templateMatch) {
  resolvedTemplateId = templateMatch[1].toLowerCase().trim();
  const templateSubdir = ctx.creationType === 'one-pager' ? 'one-pagers' : 'social';
  const PROJECT_ROOT = path.resolve(process.cwd(), '..');
  const templateHtmlPath = path.join(PROJECT_ROOT, 'templates', templateSubdir, resolvedTemplateId + '.html');
  try {
    await fs.access(templateHtmlPath);
    templateHtml = await fs.readFile(templateHtmlPath, 'utf-8');
    isTemplatePath = true;
  } catch { /* fall through to archetype */ }
}

if (!isTemplatePath) {
  const archetypeMatch = copyMd.match(/archetype[:\\s]+(\\S+)/i);
  const platformArchetypes = filterArchetypesByPlatform(archetypes, ctx.creationType);
  if (archetypeMatch) {
    const result = resolveArchetypeSlug(archetypeMatch[1], platformArchetypes.size > 0 ? platformArchetypes : archetypes);
    resolvedArchetypeSlug = result.slug;
  } else if (platformArchetypes.size > 0) {
    resolvedArchetypeSlug = [...platformArchetypes.keys()].sort()[0];
  }
  const meta = archetypes.get(resolvedArchetypeSlug);
  if (meta) {
    try { archetypeHtml = await fs.readFile(meta.htmlPath, 'utf-8'); } catch {}
  }
}

// Load context + Design DNA
let contextMap; try { contextMap = loadContextMap(); } catch { contextMap = new Map(); }
const designDna = isTemplatePath ? '' : (() => {
  try {
    const dna = getDesignDnaForPipeline(ctx.creationType, resolvedArchetypeSlug);
    const parts = ['## Design DNA', dna.globalStyle, dna.socialGeneral, dna.platformRules];
    if (dna.archetypeNotes) parts.push(dna.archetypeNotes);
    return parts.join('\\n\\n');
  } catch { return ''; }
})();

// Build layout prompts
const inputHtml = isTemplatePath ? templateHtml : archetypeHtml;
const inputId = isTemplatePath ? resolvedTemplateId : (resolvedArchetypeSlug || undefined);
const layoutUser = buildLayoutPrompt(ctx, inputHtml, inputId);
const layoutSystem = buildSystemPrompt('layout', ctx, designDna || undefined);

await fs.writeFile(path.join(pipelineDir, 'layout-system.txt'), layoutSystem);
await fs.writeFile(path.join(pipelineDir, 'layout-user.txt'), layoutUser);

const tools = STAGE_TOOLS['layout'].map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
await fs.writeFile(path.join(pipelineDir, 'tools.json'), JSON.stringify(tools, null, 2));

console.log(JSON.stringify({
  routing: isTemplatePath ? 'template' : 'archetype',
  resolvedId: isTemplatePath ? resolvedTemplateId : resolvedArchetypeSlug,
  isTemplatePath,
  matched: true,
}));
`);
      console.log(result);
    }

    else if (stepMode === 'styling') {
      const result = runStepViaTsx('styling', `
import { buildStylingPrompt, buildSystemPrompt, scanArchetypes, filterArchetypesByPlatform, resolveArchetypeSlug, STAGE_TOOLS } from './src/server/api-pipeline.js';
import { loadContextMap, getDesignDnaForPipeline, getBrandAssets, getBrandPatterns } from './src/server/db-api.js';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';

const ctx = ${JSON.stringify({ prompt, creationType, workingDir: stepWorkingDir, htmlOutputPath, creationId, campaignId })};
const pipelineDir = ${JSON.stringify(pipelineDir)};

// Check if template path (skip styling)
let copyMd = '';
try { copyMd = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8'); } catch {}
const templateMatch = copyMd.match(/template[:\\s]+(\\S+)/i);
if (templateMatch) {
  const templateSubdir = ctx.creationType === 'one-pager' ? 'one-pagers' : 'social';
  const PROJECT_ROOT = path.resolve(process.cwd(), '..');
  const templateHtmlPath = path.join(PROJECT_ROOT, 'templates', templateSubdir, templateMatch[1].toLowerCase().trim() + '.html');
  try {
    await fs.access(templateHtmlPath);
    console.log(JSON.stringify({ skipped: true, reason: 'template-path' }));
    process.exit(0);
  } catch { /* fall through */ }
}

// Archetype-based styling
const archetypes = await scanArchetypes();
const archetypeMatch = copyMd.match(/archetype[:\\s]+(\\S+)/i);
const platformArchetypes = filterArchetypesByPlatform(archetypes, ctx.creationType);
let resolvedSlug = '';
if (archetypeMatch) {
  resolvedSlug = resolveArchetypeSlug(archetypeMatch[1], platformArchetypes.size > 0 ? platformArchetypes : archetypes).slug;
} else if (platformArchetypes.size > 0) {
  resolvedSlug = [...platformArchetypes.keys()].sort()[0];
}

const meta = archetypes.get(resolvedSlug);
let imageSlotLabels: string[] = [];
if (meta) {
  try {
    const raw = fsSync.readFileSync(meta.schemaPath, 'utf-8');
    const schema = JSON.parse(raw);
    imageSlotLabels = (schema.fields || []).filter((f: any) => f.type === 'image').map((f: any) => f.label);
  } catch {}
}

// Build Design DNA
let designDna = '';
try {
  const dna = getDesignDnaForPipeline(ctx.creationType, resolvedSlug);
  const parts = ['## Design DNA', dna.globalStyle, dna.socialGeneral, dna.platformRules];
  if (dna.archetypeNotes) parts.push(dna.archetypeNotes);
  designDna = parts.join('\\n\\n');
} catch {}

// Build asset manifest
const assets = getBrandAssets();
const manifestLines = ['## Pre-loaded Asset URLs', ''];
const byCategory = new Map();
for (const a of assets) {
  if (!byCategory.has(a.category)) byCategory.set(a.category, []);
  byCategory.get(a.category).push(a);
}
for (const [cat, catAssets] of byCategory) {
  manifestLines.push('### ' + cat);
  for (const a of catAssets) {
    const serveUrl = '/api/brand-assets/serve/' + encodeURIComponent(a.name);
    if (a.mimeType?.startsWith('font/') || a.name.includes('Font') || a.name.includes('font')) {
      manifestLines.push('- **' + a.name + '**: fontSrc=\`url(\\'' + serveUrl + '\\') format(\\'truetype\\')\`');
    } else {
      manifestLines.push('- **' + a.name + '**: imgSrc=\`' + serveUrl + '\` | cssUrl=\`url(\\'' + serveUrl + '\\')\`');
    }
  }
  manifestLines.push('');
}
const assetManifest = manifestLines.join('\\n');

let contextMap; try { contextMap = loadContextMap(); } catch { contextMap = new Map(); }

const stylingUser = buildStylingPrompt(ctx, undefined, !!meta, imageSlotLabels);
const injected = [designDna, assetManifest].filter(Boolean).join('\\n\\n');
const stylingSystem = buildSystemPrompt('styling', ctx, injected || undefined);

await fs.writeFile(path.join(pipelineDir, 'styling-system.txt'), stylingSystem);
await fs.writeFile(path.join(pipelineDir, 'styling-user.txt'), stylingUser);

const tools = STAGE_TOOLS['styling'].map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
await fs.writeFile(path.join(pipelineDir, 'tools.json'), JSON.stringify(tools, null, 2));

console.log(JSON.stringify({ ok: true, archetypeSlug: resolvedSlug, imageSlotLabels }));
`);
      console.log(result);
    }

    else if (stepMode === 'spec-check') {
      // Spec-check prompt is simple — no tsx needed
      const specCheckUser = [
        `Validate the HTML at ${htmlOutputPath} against the brand's design specs.`,
        `Use run_brand_check tool on that file.`,
        `Write a JSON report to ${stepWorkingDir}/spec-report.json with format:`,
        `{ "overall": "pass" | "fail", "blocking_issues": [{ "description": "...", "severity": "...", "fix_target": "copy" | "layout" | "styling" }] }`,
        `Use empty blocking_issues array when overall is "pass".`,
      ].join('\n');
      fs.writeFileSync(path.join(pipelineDir, 'spec-check-user.txt'), specCheckUser);

      // Spec-check system prompt
      const specCheckSystem = [
        `You are a spec-check agent working on a ${creationType} creation for the brand.`,
        '',
        '## Context',
        `- Working directory: ${stepWorkingDir}`,
        `- HTML output path: ${htmlOutputPath}`,
        `- Creation type: ${creationType}`,
        '',
        '## Available Tools',
        'read_file, write_file, run_brand_check',
      ].join('\n');
      fs.writeFileSync(path.join(pipelineDir, 'spec-check-system.txt'), specCheckSystem);

      const tools = [
        { name: 'read_file', description: 'Read a file from disk.' },
        { name: 'write_file', description: 'Write content to a file on disk.' },
        { name: 'run_brand_check', description: 'Run brand-compliance validation on an HTML file.' },
      ];
      fs.writeFileSync(path.join(pipelineDir, 'tools.json'), JSON.stringify(tools, null, 2));
      console.log(JSON.stringify({ ok: true }));
    }

    else if (stepMode === 'micro-fix') {
      // Apply regex-based micro-fixes (same as api-pipeline.ts tryMicroFix)
      const MICRO_FIXABLE_RULES = new Set(['color-bg-pure-black']);
      let specReport;
      try {
        specReport = JSON.parse(fs.readFileSync(path.join(stepWorkingDir, 'spec-report.json'), 'utf-8'));
      } catch { console.log(JSON.stringify({ fixed: false, reason: 'no-spec-report' })); db.close(); process.exit(0); }

      const violations = specReport.blocking_issues || [];
      if (!violations.every(v => MICRO_FIXABLE_RULES.has(v.rule))) {
        console.log(JSON.stringify({ fixed: false, reason: 'not-all-micro-fixable' }));
        db.close();
        process.exit(0);
      }

      let html = fs.readFileSync(htmlOutputPath, 'utf-8');
      let modified = false;
      for (const v of violations) {
        if (v.rule === 'color-bg-pure-black' && v.found) {
          const darkGray = v.found.replace('#', '').toLowerCase();
          const pattern = new RegExp(`#${darkGray}`, 'gi');
          const newHtml = html.replace(pattern, '#000000');
          if (newHtml !== html) { html = newHtml; modified = true; }
        }
      }
      if (modified) {
        fs.writeFileSync(htmlOutputPath, html, 'utf-8');
      }
      console.log(JSON.stringify({ fixed: modified }));
    }

    else if (stepMode === 'fix') {
      if (!stepTarget) { console.error('Error: --step fix requires --target <copy|layout|styling>'); process.exit(1); }
      if (!stepIssues) { console.error('Error: --step fix requires --issues "<json>"'); process.exit(1); }
      const result = runStepViaTsx('fix', `
import { buildSystemPrompt } from './src/server/api-pipeline.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ctx = ${JSON.stringify({ prompt, creationType, workingDir: stepWorkingDir, htmlOutputPath, creationId, campaignId })};
const pipelineDir = ${JSON.stringify(pipelineDir)};
const target = ${JSON.stringify(stepTarget)};
const issues = ${stepIssues};

const fixUser = [
  'FIX: You are the ' + target + ' agent. Re-read and fix the following issues in your domain.',
  'Issues: ' + JSON.stringify(issues, null, 2),
  '',
  'Read the relevant files in ' + ctx.workingDir + '/ and fix only the issues listed above.',
  'Rewrite the relevant file with the fixes applied.',
].join('\\n');

const fixSystem = buildSystemPrompt(target as any, ctx);

await fs.writeFile(path.join(pipelineDir, 'fix-' + target + '-system.txt'), fixSystem);
await fs.writeFile(path.join(pipelineDir, 'fix-' + target + '-user.txt'), fixUser);

console.log(JSON.stringify({ ok: true, target }));
`);
      console.log(result);
    }

    else if (stepMode === 'attach-schema') {
      const result = runStepViaTsx('attach-schema', `
import { attachSlotSchema, scanArchetypes, resolveArchetypeSlug, filterArchetypesByPlatform } from './src/server/api-pipeline.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ctx = ${JSON.stringify({ prompt, creationType, workingDir: stepWorkingDir, htmlOutputPath, creationId, campaignId, iterationId })};

let copyMd = '';
try { copyMd = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8'); } catch {}

const archetypes = await scanArchetypes();
const archetypeMatch = copyMd.match(/archetype[:\\s]+(\\S+)/i);
const platformArchetypes = filterArchetypesByPlatform(archetypes, ctx.creationType);
let resolvedSlug = '';
if (archetypeMatch) {
  resolvedSlug = resolveArchetypeSlug(archetypeMatch[1], platformArchetypes.size > 0 ? platformArchetypes : archetypes).slug;
} else if (platformArchetypes.size > 0) {
  resolvedSlug = [...platformArchetypes.keys()].sort()[0];
}

const meta = archetypes.get(resolvedSlug);
if (meta) {
  await attachSlotSchema(ctx, resolvedSlug, meta.schemaPath);
  console.log(JSON.stringify({ ok: true, archetypeSlug: resolvedSlug }));
} else {
  console.log(JSON.stringify({ ok: false, reason: 'no-archetype-found' }));
}
`);
      console.log(result);
    }

    else {
      console.error(`Unknown --step mode: ${stepMode}`);
      console.error('Valid modes: init, copy, layout, styling, spec-check, micro-fix, fix, attach-schema');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error in --step ${stepMode}: ${err.message}`);
    process.exit(1);
  }

  db.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
for (const envPath of [path.resolve(PROJECT_ROOT, '.env'), path.resolve(CANVAS_DIR, '.env')]) {
  try {
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* skip */ }
}

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
const DB_PATH = process.env.FLUID_DB_PATH || path.join(CANVAS_DIR, 'fluid.db');

let Database;
try { Database = require(path.join(CANVAS_DIR, 'node_modules/better-sqlite3')); }
catch { console.error('Error: Run "cd canvas && npm install" first.'); process.exit(1); }

let nanoid;
try {
  const mod = require(path.join(CANVAS_DIR, 'node_modules/nanoid'));
  nanoid = mod.nanoid || mod.default?.nanoid;
} catch {
  nanoid = () => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return Array.from({ length: 21 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  };
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure core tables exist (matches canvas/src/lib/db.ts initSchema)
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, channels TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS creations (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, title TEXT NOT NULL,
    creation_type TEXT NOT NULL, slide_count INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );
  CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY, creation_id TEXT NOT NULL, slide_index INTEGER NOT NULL,
    created_at INTEGER NOT NULL, FOREIGN KEY (creation_id) REFERENCES creations(id)
  );
  CREATE TABLE IF NOT EXISTS iterations (
    id TEXT PRIMARY KEY, slide_id TEXT NOT NULL, iteration_index INTEGER NOT NULL,
    html_path TEXT NOT NULL, slot_schema TEXT, ai_baseline TEXT, user_state TEXT,
    status TEXT NOT NULL DEFAULT 'unmarked', source TEXT NOT NULL DEFAULT 'ai',
    template_id TEXT, generation_status TEXT NOT NULL DEFAULT 'complete',
    created_at INTEGER NOT NULL, FOREIGN KEY (slide_id) REFERENCES slides(id)
  );
`);

// ---------------------------------------------------------------------------
// Channel detection (replicated from watcher.ts — must stay in sync)
// ---------------------------------------------------------------------------
const SINGULAR_PATTERNS = [
  /\ba\s+(?:social\s+)?post\b/i, /\ban?\s+(?:instagram|ig|insta)\b/i,
  /\bone\s+(?:linkedin|instagram|post|one-pager|social)\b/i,
  /^(?:create|make|generate|write|design)\s+(?:a|an|one)\s+/i,
  /\ba\s+one-pager\b/i, /\ban?\s+image\b/i, /\b(?:a\s+)?single\s+/i,
  /\bjust\s+(?:a\s+)?(?:single\s+)?(?:post|instagram|linkedin|one-pager)\b/i,
];
const CAMPAIGN_PATTERNS = [/\bcampaign\b/i, /\bseries\b/i, /\bmultiple\b/i, /\bseveral\b/i, /\bposts\b/i];
const DEFAULT_CHANNEL_COUNTS = { instagram: 3, linkedin: 3, 'one-pager': 1 };

function inferCreationType(p) {
  if (/linkedin/i.test(p)) return 'linkedin';
  if (/one-pager/i.test(p)) return 'one-pager';
  return 'instagram';
}

function parseChannelHints(p) {
  if (/just linkedin|linkedin only|only linkedin/i.test(p))
    return { channels: ['linkedin'], creationCounts: { linkedin: 3 }, isSingleCreation: false };
  if (/just instagram|instagram only|only instagram/i.test(p))
    return { channels: ['instagram'], creationCounts: { instagram: 3 }, isSingleCreation: false };
  if (/one-pager only|just (?:a )?one-pager/i.test(p))
    return { channels: ['one-pager'], creationCounts: { 'one-pager': 1 }, isSingleCreation: false };

  const isSingular = SINGULAR_PATTERNS.some(r => r.test(p));
  const isCampaign = CAMPAIGN_PATTERNS.some(r => r.test(p));
  if (isSingular && !isCampaign) {
    const t = inferCreationType(p);
    return { channels: [t], creationCounts: { [t]: 1 }, isSingleCreation: true };
  }
  return { channels: Object.keys(DEFAULT_CHANNEL_COUNTS), creationCounts: { ...DEFAULT_CHANNEL_COUNTS }, isSingleCreation: false };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
function createCampaign({ title, channels }) {
  const id = nanoid(); const now = Date.now();
  db.prepare('INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, title, JSON.stringify(channels), now, now);
  return { id, title };
}
function getOrCreateStandaloneCampaign() {
  const row = db.prepare("SELECT id FROM campaigns WHERE title = '__standalone__'").get();
  if (row) return row.id;
  return createCampaign({ title: '__standalone__', channels: ['standalone'] }).id;
}
function createCreation({ campaignId, title, creationType, slideCount }) {
  const id = nanoid(); const now = Date.now();
  db.prepare('INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, campaignId, title, creationType, slideCount, now);
  return { id, title, creationType };
}
function createSlide({ creationId, slideIndex }) {
  const id = nanoid(); const now = Date.now();
  db.prepare('INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, ?, ?)').run(id, creationId, slideIndex, now);
  return { id };
}
function createIteration({ id, slideId, iterationIndex, htmlPath, source, generationStatus }) {
  const iterId = id || nanoid(); const now = Date.now();
  db.prepare(`INSERT INTO iterations (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, template_id, generation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(iterId, slideId, iterationIndex, htmlPath, null, null, null, 'unmarked', source, null, generationStatus, now);
  return { id: iterId };
}

// ---------------------------------------------------------------------------
// Pre-create campaign structure
// ---------------------------------------------------------------------------
function preCreateCampaign(promptText) {
  const { channels, creationCounts, isSingleCreation } = parseChannelHints(promptText);
  const creationList = [];
  for (const [type, count] of Object.entries(creationCounts)) {
    for (let i = 1; i <= count; i++) creationList.push({ title: `${type} ${i}`, creationType: type, slideCount: 1 });
  }

  let campaignId;
  if (isSingleCreation) { campaignId = getOrCreateStandaloneCampaign(); }
  else { campaignId = createCampaign({ title: promptText.slice(0, 30), channels }).id; }

  const creationMap = [];
  for (const spec of creationList) {
    const creation = createCreation({ campaignId, ...spec });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iterationId = nanoid();
    const htmlRelPath = `.fluid/campaigns/${campaignId}/${creation.id}/${slide.id}/${iterationId}.html`;
    const absHtmlPath = path.join(PROJECT_ROOT, htmlRelPath);
    const workingDir = path.join(path.dirname(absHtmlPath), 'working');
    fs.mkdirSync(path.dirname(absHtmlPath), { recursive: true });
    fs.mkdirSync(workingDir, { recursive: true });
    createIteration({ id: iterationId, slideId: slide.id, iterationIndex: 0, htmlPath: htmlRelPath, source: 'ai', generationStatus: 'pending' });
    creationMap.push({ creation: { id: creation.id, title: creation.title, creationType: creation.creationType }, slideId: slide.id, iterationId, htmlPath: htmlRelPath, absHtmlPath, workingDir });
  }
  return { campaignId, isSingleCreation, creationMap };
}

// ---------------------------------------------------------------------------
// Brand compliance
// ---------------------------------------------------------------------------
function runBrandCompliance(htmlPath, context) {
  try {
    const r = execSync(`node "${path.join(TOOLS_DIR, 'brand-compliance.cjs')}" "${htmlPath}" --context ${context}`, { encoding: 'utf-8', timeout: 10000 });
    return JSON.parse(r);
  } catch (e) { return { violations: [], summary: { errors: -1 }, error: e.message }; }
}

// ---------------------------------------------------------------------------
// Build pipeline prompts via tsx (imports the real api-pipeline.ts functions)
// ---------------------------------------------------------------------------
function buildPipelinePrompts(promptText, creationMap, campaignId) {
  // Write a tsx script that imports the real functions and dumps prompts to JSON
  const tmpScript = path.join(CANVAS_DIR, '_simulate-build-prompts.mts');

  const creationSpecs = creationMap.map(c => ({
    prompt: promptText,
    creationType: c.creation.creationType,
    workingDir: c.workingDir,
    htmlOutputPath: c.absHtmlPath,
    creationId: c.creation.id,
    campaignId: campaignId,
  }));

  const scriptContent = `
import { buildCopyPrompt, buildLayoutPrompt, buildStylingPrompt, buildSystemPrompt } from './src/server/api-pipeline.js';
import { getBrandAssets, getBrandPatterns, getVoiceGuideDocs, loadContextMap, getDesignDnaForPipeline } from './src/server/db-api.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const specs = ${JSON.stringify(creationSpecs)};

// Load context map once
let contextMap;
try { contextMap = loadContextMap(); } catch { contextMap = new Map(); }

// Helper to compute loadContextForStage (imported indirectly via buildSystemPrompt)
// We'll build system prompts for each stage to capture the full prompt

const results = [];

for (const ctx of specs) {
  const pipelineDir = path.join(ctx.workingDir, '_pipeline');
  await fs.mkdir(pipelineDir, { recursive: true });

  // Build copy stage prompts
  const copyUser = buildCopyPrompt(ctx);
  const copySystem = buildSystemPrompt('copy', ctx);
  await fs.writeFile(path.join(pipelineDir, 'copy-system.txt'), copySystem);
  await fs.writeFile(path.join(pipelineDir, 'copy-user.txt'), copyUser);

  // Build layout stage prompts (with placeholder for Design DNA — actual DNA depends on copy output)
  const layoutUser = buildLayoutPrompt(ctx);
  const layoutSystem = buildSystemPrompt('layout', ctx);
  await fs.writeFile(path.join(pipelineDir, 'layout-system.txt'), layoutSystem);
  await fs.writeFile(path.join(pipelineDir, 'layout-user.txt'), layoutUser);

  // Build styling stage prompts
  const stylingUser = buildStylingPrompt(ctx);
  const stylingSystem = buildSystemPrompt('styling', ctx);
  await fs.writeFile(path.join(pipelineDir, 'styling-system.txt'), stylingSystem);
  await fs.writeFile(path.join(pipelineDir, 'styling-user.txt'), stylingUser);

  // Build spec-check prompt
  const specCheckUser = [
    'Validate the HTML at ' + ctx.htmlOutputPath + ' against the brand\\'s design specs.',
    'Use run_brand_check tool on that file.',
    'Write a JSON report to ' + ctx.workingDir + '/spec-report.json with format:',
    '{ "overall": "pass" | "fail", "blocking_issues": [{ "description": "...", "severity": "...", "fix_target": "copy" | "layout" | "styling" }] }',
    'Use empty blocking_issues array when overall is "pass".',
  ].join('\\n');
  await fs.writeFile(path.join(pipelineDir, 'spec-check-user.txt'), specCheckUser);

  // Dump brand asset manifest
  const assets = getBrandAssets();
  const assetManifest = assets.map(a => ({
    name: a.name,
    category: a.category,
    url: '/api/brand-assets/serve/' + encodeURIComponent(a.name),
    mimeType: a.mimeType,
  }));
  await fs.writeFile(path.join(pipelineDir, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2));

  // Dump voice guide list
  const voiceDocs = getVoiceGuideDocs();
  await fs.writeFile(path.join(pipelineDir, 'voice-guide-list.json'), JSON.stringify(voiceDocs.map(d => ({ slug: d.slug, label: d.label })), null, 2));

  // Dump brand pattern list
  const patterns = getBrandPatterns();
  await fs.writeFile(path.join(pipelineDir, 'brand-patterns-list.json'), JSON.stringify(patterns.map(p => ({ slug: p.slug, label: p.label, category: p.category })), null, 2));

  // Dump creation context
  await fs.writeFile(path.join(pipelineDir, 'context.json'), JSON.stringify({
    ...ctx,
    pipelineDir,
    stages: ['copy', 'layout', 'styling', 'spec-check'],
    models: { copy: 'claude-sonnet-4-20250514', layout: 'claude-haiku-4-5-20251001', styling: 'claude-sonnet-4-20250514', 'spec-check': 'claude-sonnet-4-20250514' },
  }, null, 2));

  results.push({ creationId: ctx.creationId, creationType: ctx.creationType, pipelineDir });
}

console.log(JSON.stringify(results));
`;

  fs.writeFileSync(tmpScript, scriptContent);

  // tsx IPC socket: use sandbox-safe temp dir (see runStepViaTsx comment)
  const _safeTmpDir = fs.existsSync('/tmp/claude-1000') ? '/tmp/claude-1000'
    : (process.env.TMPDIR || '/tmp');

  try {
    const output = execSync(
      `cd "${CANVAS_DIR}" && npx tsx "${tmpScript}"`,
      { encoding: 'utf-8', timeout: 30000, env: { ...process.env, FLUID_DB_PATH: DB_PATH, TMPDIR: _safeTmpDir } }
    );
    const lastLine = output.trim().split('\n').pop();
    return JSON.parse(lastLine);
  } catch (e) {
    console.error('Warning: Failed to build pipeline prompts via tsx:', e.message?.slice(0, 200));
    console.error('Falling back to dry-run mode (DB + filesystem only).');
    return null;
  } finally {
    try { fs.unlinkSync(tmpScript); } catch { /* ok */ }
  }
}

// ---------------------------------------------------------------------------
// Execute --step mode if active (must be after DB + constants are loaded)
// ---------------------------------------------------------------------------
if (stepMode) {
  executeStepMode();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runSimulation(promptText) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PROMPT: "${promptText}"`);
  console.log(`${'='.repeat(70)}\n`);

  // Step 1: Pre-create DB records + filesystem
  const { campaignId, isSingleCreation, creationMap } = preCreateCampaign(promptText);
  console.log(`Campaign: ${campaignId} (${isSingleCreation ? 'standalone' : 'campaign'})`);
  console.log(`Creations: ${creationMap.length}`);
  for (const c of creationMap) {
    console.log(`  - ${c.creation.title} (${c.creation.creationType})`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] DB records + filesystem created.\n');
    for (const c of creationMap) console.log(`  ${c.workingDir}`);
    return { prompt: promptText, campaignId, isSingleCreation, mode: 'dry-run', creations: creationMap.length };
  }

  if (liveMode) {
    // Run actual Anthropic API pipeline via tsx
    console.log('\n[LIVE] Running real pipeline with Anthropic API...\n');
    const results = [];
    for (const c of creationMap) {
      const start = Date.now();
      console.log(`  [${c.creation.title}] Running pipeline...`);
      const wrapperScript = path.join(c.workingDir, '_run-pipeline.mts');
      fs.writeFileSync(wrapperScript, `
        import { runApiPipeline } from '${CANVAS_DIR}/src/server/api-pipeline';
        const ctx = ${JSON.stringify({ prompt: promptText, creationType: c.creation.creationType, workingDir: c.workingDir, htmlOutputPath: c.absHtmlPath, creationId: c.creation.id, campaignId })};
        const mockRes = { write: () => {}, end: () => {} };
        try { await runApiPipeline(ctx, mockRes); console.log(JSON.stringify({ ok: true })); }
        catch (e) { console.log(JSON.stringify({ ok: false, error: e.message })); }
      `);
      try {
        const __safeTmpDir = fs.existsSync('/tmp/claude-1000') ? '/tmp/claude-1000' : (process.env.TMPDIR || '/tmp');
        const out = execSync(`cd "${CANVAS_DIR}" && npx tsx "${wrapperScript}"`, { encoding: 'utf-8', timeout: 300000, env: { ...process.env, FLUID_DB_PATH: DB_PATH, TMPDIR: __safeTmpDir } });
        const result = JSON.parse(out.trim().split('\n').pop());
        const ctx2 = c.creation.creationType === 'one-pager' ? 'website' : 'social';
        let comp = { summary: { errors: -1 } };
        if (fs.existsSync(c.absHtmlPath)) {
          comp = runBrandCompliance(c.absHtmlPath, ctx2);
          db.prepare("UPDATE iterations SET generation_status = 'complete' WHERE id = ?").run(c.iterationId);
        }
        const status = comp.summary.errors === 0 ? 'PASS' : comp.summary.errors > 0 ? 'FAIL' : '???';
        console.log(`  [${c.creation.title}] ${status} (${Date.now() - start}ms)`);
        results.push({ creation: c.creation.title, type: c.creation.creationType, success: result.ok, compliance: comp.summary, duration: Date.now() - start });
      } catch (e) {
        console.log(`  [${c.creation.title}] ERROR: ${e.message?.slice(0, 80)}`);
        results.push({ creation: c.creation.title, type: c.creation.creationType, success: false, error: e.message });
      } finally {
        try { fs.unlinkSync(wrapperScript); } catch { /* ok */ }
      }
    }
    const passed = results.filter(r => r.compliance?.errors === 0).length;
    const failed = results.filter(r => r.compliance?.errors > 0).length;
    console.log(`\nResults: ${passed} pass / ${failed} fail / ${results.length} total`);
    return { prompt: promptText, campaignId, isSingleCreation, mode: 'live', results, summary: { total: results.length, passed, failed } };
  }

  // --pipeline mode: build pipeline prompts + context for inspection only
  if (pipelineOnly) {
    console.log('\nBuilding pipeline prompts and context...\n');
    const promptResults = buildPipelinePrompts(promptText, creationMap, campaignId);

    if (promptResults) {
      for (const r of promptResults) {
        console.log(`  [${r.creationType}] Pipeline context → ${r.pipelineDir}`);
      }
      console.log(`\nPipeline prompts ready. Each creation's working/_pipeline/ contains:`);
      console.log(`  copy-system.txt, copy-user.txt         — Copy stage prompts`);
      console.log(`  layout-system.txt, layout-user.txt     — Layout stage prompts`);
      console.log(`  styling-system.txt, styling-user.txt   — Styling stage prompts`);
      console.log(`  spec-check-user.txt                    — Spec-check prompt`);
      console.log(`  asset-manifest.json                    — All brand asset URLs`);
      console.log(`  voice-guide-list.json                  — Available voice guide docs`);
      console.log(`  brand-patterns-list.json               — Available brand patterns`);
      console.log(`  context.json                           — Creation metadata + model assignments`);
      console.log(`\nA Claude Code agent can now read these files and execute each stage.`);
    } else {
      console.log('  (prompt building failed — working dirs ready for manual setup)');
    }

    return { prompt: promptText, campaignId, isSingleCreation, mode: 'pipeline', creations: creationMap.length, promptsBuilt: !!promptResults };
  }

  // Default mode: build pipeline prompts, then output JSON manifest for subagent execution
  console.log('\nBuilding pipeline prompts and context...\n');
  const promptResults = buildPipelinePrompts(promptText, creationMap, campaignId);

  if (!promptResults) {
    console.error('ERROR: Failed to build pipeline prompts. Cannot proceed with subagent mode.');
    console.error('Try --pipeline or --dry-run mode instead.');
    return { prompt: promptText, campaignId, isSingleCreation, mode: 'error', creations: creationMap.length };
  }

  // Build the subagent manifest — one entry per creation with all stage details
  const manifest = {
    prompt: promptText,
    campaignId,
    isSingleCreation,
    creations: creationMap.map((c, i) => {
      const pipelineDir = promptResults[i].pipelineDir;
      return {
        creationId: c.creation.id,
        creationType: c.creation.creationType,
        title: c.creation.title,
        iterationId: c.iterationId,
        workingDir: c.workingDir,
        htmlOutputPath: c.absHtmlPath,
        pipelineDir,
        stages: [
          {
            name: 'copy',
            model: 'sonnet',
            systemPrompt: path.join(pipelineDir, 'copy-system.txt'),
            userPrompt: path.join(pipelineDir, 'copy-user.txt'),
            output: path.join(c.workingDir, 'copy.md'),
            description: `Generate marketing copy for ${c.creation.creationType}: "${promptText}"`,
          },
          {
            name: 'layout',
            model: 'haiku',
            systemPrompt: path.join(pipelineDir, 'layout-system.txt'),
            userPrompt: path.join(pipelineDir, 'layout-user.txt'),
            dependsOn: 'copy',
            output: path.join(c.workingDir, 'layout.html'),
            description: `Create structural HTML layout from copy.md for ${c.creation.creationType}`,
          },
          {
            name: 'styling',
            model: 'sonnet',
            systemPrompt: path.join(pipelineDir, 'styling-system.txt'),
            userPrompt: path.join(pipelineDir, 'styling-user.txt'),
            dependsOn: 'layout',
            output: c.absHtmlPath,
            description: `Apply brand styling to produce final HTML for ${c.creation.creationType}`,
          },
          {
            name: 'spec-check',
            model: 'sonnet',
            userPrompt: path.join(pipelineDir, 'spec-check-user.txt'),
            dependsOn: 'styling',
            output: path.join(c.workingDir, 'spec-report.json'),
            description: `Run brand compliance check on final HTML for ${c.creation.creationType}`,
          },
        ],
        brandContext: {
          assetManifest: path.join(pipelineDir, 'asset-manifest.json'),
          voiceGuides: path.join(pipelineDir, 'voice-guide-list.json'),
          brandPatterns: path.join(pipelineDir, 'brand-patterns-list.json'),
        },
      };
    }),
  };

  // Write manifest to each creation's pipeline dir and to a top-level location
  const manifestPath = path.join(PROJECT_ROOT, '.fluid', '_simulate-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  for (const c of manifest.creations) {
    fs.writeFileSync(path.join(c.pipelineDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`  [${c.creationType}] Pipeline context → ${c.pipelineDir}`);
  }

  console.log(`\nManifest written to: ${manifestPath}`);
  console.log(`\nReady for subagent execution. ${manifest.creations.length} creation(s), 4 stages each.`);
  console.log(`Stages per creation: copy → layout → styling → spec-check`);

  // Output manifest as last line of stdout for programmatic consumption
  console.log('\n__MANIFEST__');
  console.log(JSON.stringify(manifest));

  return { prompt: promptText, campaignId, isSingleCreation, mode: 'simulate', creations: creationMap.length, manifestPath };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const prompts = batchFile
    ? fs.readFileSync(batchFile, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean)
    : [prompt];

  const allResults = [];
  for (const p of prompts) allResults.push(await runSimulation(p));

  if (reportFile) {
    fs.writeFileSync(reportFile, JSON.stringify(allResults, null, 2));
    console.log(`\nReport: ${reportFile}`);
  }

  if (prompts.length > 1) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`BATCH: ${prompts.length} prompts, ${allResults.reduce((s, r) => s + (r.creations || r.results?.length || 0), 0)} creations`);
  }

  db.close();
})();
