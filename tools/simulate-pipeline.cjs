#!/usr/bin/env node
/**
 * simulate-pipeline.cjs — CLI harness for pipeline simulation and testing.
 *
 * Usage:
 *   node tools/simulate-pipeline.cjs "Create an Instagram post about Fluid Connect"
 *   node tools/simulate-pipeline.cjs --live "Launch a campaign for Payments"
 *   node tools/simulate-pipeline.cjs --dry-run "Just a linkedin post about FairShare"
 *   node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json
 *
 * Modes:
 *   (default)   Set up DB records + filesystem + dump exact pipeline prompts/context
 *               for each stage. Ready for a Claude Code agent to pick up and simulate.
 *   --live      Run the full pipeline with real Anthropic API calls (requires API key)
 *   --dry-run   DB records + filesystem only (no prompt building, no API calls)
 *   --batch     Read prompts from file (one per line), run sequentially
 *   --report    Write JSON report to file
 *
 * Default mode creates a _pipeline/ directory in each creation's working dir with:
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
let batchFile = null;
let reportFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live') { liveMode = true; continue; }
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--prompt' && args[i + 1]) { prompt = args[++i]; continue; }
  if (args[i] === '--batch' && args[i + 1]) { batchFile = args[++i]; continue; }
  if (args[i] === '--report' && args[i + 1]) { reportFile = args[++i]; continue; }
  if (!prompt && !args[i].startsWith('--')) { prompt = args[i]; }
}

if (!prompt && !batchFile) {
  console.error(`simulate-pipeline — Test the generation pipeline from CLI

Usage:
  node tools/simulate-pipeline.cjs "Your prompt here"
  node tools/simulate-pipeline.cjs --live "Your prompt here"
  node tools/simulate-pipeline.cjs --dry-run "Your prompt here"
  node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json

Modes:
  (default)   Build prompts + context for agent simulation (no API calls)
  --live      Run the real Anthropic API pipeline
  --dry-run   DB records + filesystem only (fastest)
`);
  process.exit(1);
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

  try {
    const output = execSync(
      `cd "${CANVAS_DIR}" && npx tsx "${tmpScript}"`,
      { encoding: 'utf-8', timeout: 30000, env: { ...process.env, FLUID_DB_PATH: DB_PATH } }
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
        const out = execSync(`cd "${CANVAS_DIR}" && npx tsx "${wrapperScript}"`, { encoding: 'utf-8', timeout: 300000, env: { ...process.env, FLUID_DB_PATH: DB_PATH } });
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

  // Default mode: build pipeline prompts + context
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

  return { prompt: promptText, campaignId, isSingleCreation, mode: 'simulate', creations: creationMap.length, promptsBuilt: !!promptResults };
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
