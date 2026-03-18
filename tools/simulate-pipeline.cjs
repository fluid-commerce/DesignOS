#!/usr/bin/env node
/**
 * simulate-pipeline.cjs — CLI harness for running the real generation pipeline
 * without the Vite dev server or browser UI.
 *
 * Usage:
 *   node tools/simulate-pipeline.cjs "Create an Instagram post about Fluid Connect"
 *   node tools/simulate-pipeline.cjs --prompt "Launch a campaign for Payments" --dry-run
 *   node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json
 *
 * Modes:
 *   (default)   Run the full pipeline with real Anthropic API calls
 *   --dry-run   Set up DB records + filesystem only (no API calls), for agent simulation
 *   --batch     Read prompts from file (one per line), run sequentially, output report
 *   --report    Write JSON report to file (brand compliance results, timing, etc.)
 *
 * This uses the SAME code paths as the app:
 *   - parseChannelHints() for campaign/single detection
 *   - createCampaign/createCreation/createSlide/createIteration for DB records
 *   - runApiPipeline() for the actual 4-stage pipeline (unless --dry-run)
 *   - brand-compliance.cjs for spec-check
 *
 * The only difference from the app is: no SSE streaming to a browser,
 * and ServerResponse is replaced with a no-op mock.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Resolve project root (this script lives in tools/)
// ---------------------------------------------------------------------------
const TOOLS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(TOOLS_DIR, '..');
const CANVAS_DIR = path.join(PROJECT_ROOT, 'canvas');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let prompt = '';
let dryRun = false;
let batchFile = null;
let reportFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--prompt' && args[i + 1]) { prompt = args[++i]; continue; }
  if (args[i] === '--batch' && args[i + 1]) { batchFile = args[++i]; continue; }
  if (args[i] === '--report' && args[i + 1]) { reportFile = args[++i]; continue; }
  if (!prompt && !args[i].startsWith('--')) { prompt = args[i]; }
}

if (!prompt && !batchFile) {
  console.error('Usage: node tools/simulate-pipeline.cjs "Your prompt here"');
  console.error('       node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json');
  console.error('       node tools/simulate-pipeline.cjs --prompt "..." --dry-run');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load .env (same logic as api-pipeline.ts)
// ---------------------------------------------------------------------------
const envPaths = [
  path.resolve(PROJECT_ROOT, '.env'),
  path.resolve(CANVAS_DIR, '.env'),
];
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match && !process.env[match[1].trim()]) {
          process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch { /* skip */ }
}

// ---------------------------------------------------------------------------
// We need to use tsx to import TypeScript modules from the canvas/src tree.
// Instead, we use the compiled DB directly and replicate the key functions.
// ---------------------------------------------------------------------------

// Import better-sqlite3 from canvas node_modules
const DB_PATH = process.env.FLUID_DB_PATH || path.join(CANVAS_DIR, 'fluid.db');

let Database;
try {
  Database = require(path.join(CANVAS_DIR, 'node_modules/better-sqlite3'));
} catch {
  console.error('Error: Run "cd canvas && npm install" first.');
  process.exit(1);
}

let nanoid;
try {
  // nanoid v3 (CJS) or v4+ (ESM) — try CJS first
  const mod = require(path.join(CANVAS_DIR, 'node_modules/nanoid'));
  nanoid = mod.nanoid || mod.default?.nanoid;
} catch {
  // Fallback: simple random ID
  nanoid = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return Array.from({ length: 21 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Replicate parseChannelHints (same logic as watcher.ts)
// ---------------------------------------------------------------------------
const SINGULAR_PATTERNS = [
  /\ba\s+(?:social\s+)?post\b/i,
  /\ban?\s+(?:instagram|ig|insta)\b/i,
  /\bone\s+(?:linkedin|instagram|post|one-pager|social)\b/i,
  /^(?:create|make|generate|write|design)\s+(?:a|an|one)\s+/i,
  /\ba\s+one-pager\b/i,
  /\ban?\s+image\b/i,
  /\b(?:a\s+)?single\s+/i,
  /\bjust\s+(?:a\s+)?(?:single\s+)?(?:post|instagram|linkedin|one-pager)\b/i,
];

const CAMPAIGN_PATTERNS = [
  /\bcampaign\b/i,
  /\bseries\b/i,
  /\bmultiple\b/i,
  /\bseveral\b/i,
  /\bposts\b/i,
];

const DEFAULT_CHANNEL_COUNTS = { instagram: 3, linkedin: 3, 'one-pager': 1 };

function inferCreationType(prompt) {
  if (/linkedin/i.test(prompt)) return 'linkedin';
  if (/one-pager/i.test(prompt)) return 'one-pager';
  return 'instagram';
}

function parseChannelHints(prompt) {
  if (/just linkedin|linkedin only|only linkedin/i.test(prompt)) {
    return { channels: ['linkedin'], creationCounts: { linkedin: 3 }, isSingleCreation: false };
  }
  if (/just instagram|instagram only|only instagram/i.test(prompt)) {
    return { channels: ['instagram'], creationCounts: { instagram: 3 }, isSingleCreation: false };
  }
  if (/one-pager only|just (?:a )?one-pager/i.test(prompt)) {
    return { channels: ['one-pager'], creationCounts: { 'one-pager': 1 }, isSingleCreation: false };
  }

  const isSingular = SINGULAR_PATTERNS.some(p => p.test(prompt));
  const isCampaign = CAMPAIGN_PATTERNS.some(p => p.test(prompt));
  const isSingleCreation = isSingular && !isCampaign;

  if (isSingleCreation) {
    const inferredType = inferCreationType(prompt);
    return { channels: [inferredType], creationCounts: { [inferredType]: 1 }, isSingleCreation: true };
  }

  return { channels: Object.keys(DEFAULT_CHANNEL_COUNTS), creationCounts: { ...DEFAULT_CHANNEL_COUNTS }, isSingleCreation: false };
}

// ---------------------------------------------------------------------------
// DB helpers (same as db-api.ts)
// ---------------------------------------------------------------------------
function createCampaign({ title, channels }) {
  const id = nanoid();
  const now = Date.now();
  db.prepare('INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, JSON.stringify(channels), now, now);
  return { id, title };
}

function getOrCreateStandaloneCampaign() {
  const row = db.prepare("SELECT id FROM campaigns WHERE title = '__standalone__'").get();
  if (row) return row.id;
  return createCampaign({ title: '__standalone__', channels: ['standalone'] }).id;
}

function createCreation({ campaignId, title, creationType, slideCount }) {
  const id = nanoid();
  const now = Date.now();
  db.prepare('INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, campaignId, title, creationType, slideCount, now);
  return { id, title, creationType };
}

function createSlide({ creationId, slideIndex }) {
  const id = nanoid();
  const now = Date.now();
  db.prepare('INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, ?, ?)')
    .run(id, creationId, slideIndex, now);
  return { id };
}

function createIteration({ id, slideId, iterationIndex, htmlPath, source, generationStatus }) {
  const iterId = id || nanoid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO iterations (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, template_id, generation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(iterId, slideId, iterationIndex, htmlPath, null, null, null, 'unmarked', source, null, generationStatus, now);
  return { id: iterId };
}

// ---------------------------------------------------------------------------
// Pre-create campaign structure (same as watcher.ts /api/generate handler)
// ---------------------------------------------------------------------------
function preCreateCampaign(promptText) {
  const { channels, creationCounts, isSingleCreation } = parseChannelHints(promptText);

  // Build creation list
  const creationList = [];
  for (const [type, count] of Object.entries(creationCounts)) {
    for (let i = 1; i <= count; i++) {
      creationList.push({ title: `${type} ${i}`, creationType: type, slideCount: 1 });
    }
  }

  // Create or reuse campaign
  let campaignId;
  if (isSingleCreation) {
    campaignId = getOrCreateStandaloneCampaign();
  } else {
    const title = promptText.length > 30 ? promptText.slice(0, 30) : promptText;
    const campaign = createCampaign({ title, channels });
    campaignId = campaign.id;
  }

  // Create all creations, slides, iterations
  const creationMap = [];
  for (const spec of creationList) {
    const creation = createCreation({ campaignId, ...spec });
    const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
    const iterationId = nanoid();
    const htmlRelPath = `.fluid/campaigns/${campaignId}/${creation.id}/${slide.id}/${iterationId}.html`;
    const absHtmlPath = path.join(PROJECT_ROOT, htmlRelPath);
    const workingDir = path.join(path.dirname(absHtmlPath), 'working');

    // Create filesystem dirs
    fs.mkdirSync(path.dirname(absHtmlPath), { recursive: true });
    fs.mkdirSync(workingDir, { recursive: true });

    createIteration({
      id: iterationId,
      slideId: slide.id,
      iterationIndex: 0,
      htmlPath: htmlRelPath,
      source: 'ai',
      generationStatus: 'pending',
    });

    creationMap.push({
      creation: { id: creation.id, title: creation.title, creationType: creation.creationType },
      slideId: slide.id,
      iterationId,
      htmlPath: htmlRelPath,
      absHtmlPath,
      workingDir,
    });
  }

  return { campaignId, isSingleCreation, creationMap };
}

// ---------------------------------------------------------------------------
// Brand compliance checker
// ---------------------------------------------------------------------------
function runBrandCompliance(htmlPath, context) {
  try {
    const result = execSync(
      `node "${path.join(TOOLS_DIR, 'brand-compliance.cjs')}" "${htmlPath}" --context ${context}`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (e) {
    return { violations: [], summary: { errors: -1, warnings: 0 }, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Main: run simulation
// ---------------------------------------------------------------------------
async function runSimulation(promptText) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PROMPT: "${promptText}"`);
  console.log(`${'='.repeat(70)}\n`);

  // Step 1: Parse and pre-create
  const { campaignId, isSingleCreation, creationMap } = preCreateCampaign(promptText);
  console.log(`Campaign: ${campaignId} (${isSingleCreation ? 'standalone' : 'campaign'})`);
  console.log(`Creations: ${creationMap.length}`);
  for (const c of creationMap) {
    console.log(`  - ${c.creation.title} (${c.creation.creationType}) → ${c.htmlPath}`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] DB records and filesystem created. Skipping pipeline execution.');
    console.log('Working directories ready for agent simulation:\n');
    for (const c of creationMap) {
      console.log(`  ${c.workingDir}`);
    }
    return {
      prompt: promptText,
      campaignId,
      isSingleCreation,
      creations: creationMap.map(c => ({
        id: c.creation.id,
        type: c.creation.creationType,
        iterationId: c.iterationId,
        htmlPath: c.absHtmlPath,
        workingDir: c.workingDir,
      })),
      dryRun: true,
    };
  }

  // Step 2: Run actual pipeline (requires tsx and Anthropic API key)
  console.log('\nRunning pipeline...');
  const results = [];

  for (const c of creationMap) {
    const pipelineStart = Date.now();
    console.log(`\n  [${c.creation.title}] Starting pipeline...`);

    try {
      // Use tsx to run the pipeline in-process
      // We call a small wrapper that imports api-pipeline.ts and runs it
      const wrapperScript = `
        import { runApiPipeline } from '${CANVAS_DIR}/src/server/api-pipeline';
        const ctx = {
          prompt: ${JSON.stringify(promptText)},
          creationType: ${JSON.stringify(c.creation.creationType)},
          workingDir: ${JSON.stringify(c.workingDir)},
          htmlOutputPath: ${JSON.stringify(c.absHtmlPath)},
          creationId: ${JSON.stringify(c.creation.id)},
          campaignId: ${JSON.stringify(campaignId)},
        };
        // Mock ServerResponse (no-op for CLI)
        const mockRes = { write: () => {}, end: () => {} };
        try {
          await runApiPipeline(ctx, mockRes);
          console.log(JSON.stringify({ success: true, duration: Date.now() - ${pipelineStart} }));
        } catch (err) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        }
      `;

      const tmpScript = path.join(c.workingDir, '_run-pipeline.mts');
      fs.writeFileSync(tmpScript, wrapperScript);

      const output = execSync(
        `cd "${CANVAS_DIR}" && npx tsx "${tmpScript}"`,
        { encoding: 'utf-8', timeout: 300000, env: { ...process.env, FLUID_DB_PATH: DB_PATH } }
      );

      const lastLine = output.trim().split('\n').pop();
      const pipelineResult = JSON.parse(lastLine);

      // Clean up temp script
      try { fs.unlinkSync(tmpScript); } catch { /* ok */ }

      // Run brand compliance
      const context = c.creation.creationType === 'one-pager' ? 'website' : 'social';
      let compliance = { summary: { errors: -1 } };
      if (fs.existsSync(c.absHtmlPath)) {
        compliance = runBrandCompliance(c.absHtmlPath, context);
        // Update DB status
        db.prepare("UPDATE iterations SET generation_status = 'complete' WHERE id = ?").run(c.iterationId);
      }

      const result = {
        creation: c.creation.title,
        type: c.creation.creationType,
        success: pipelineResult.success,
        duration: Date.now() - pipelineStart,
        compliance: compliance.summary,
        violations: (compliance.violations || []).map(v => v.message),
        htmlExists: fs.existsSync(c.absHtmlPath),
        htmlSize: fs.existsSync(c.absHtmlPath) ? fs.statSync(c.absHtmlPath).size : 0,
      };

      results.push(result);
      const status = result.compliance.errors === 0 ? 'PASS' : result.compliance.errors > 0 ? 'FAIL' : '???';
      console.log(`  [${c.creation.title}] ${status} (${result.duration}ms, ${result.htmlSize}b)`);
    } catch (err) {
      results.push({
        creation: c.creation.title,
        type: c.creation.creationType,
        success: false,
        error: err.message,
        duration: Date.now() - pipelineStart,
      });
      console.log(`  [${c.creation.title}] ERROR: ${err.message.slice(0, 100)}`);
    }
  }

  // Step 3: Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.compliance?.errors === 0).length;
  const failed = results.filter(r => r.compliance?.errors > 0).length;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} pass / ${failed} fail / ${results.length} total`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);

  return {
    prompt: promptText,
    campaignId,
    isSingleCreation,
    totalDuration,
    results,
    summary: { total: results.length, passed, failed },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const prompts = batchFile
    ? fs.readFileSync(batchFile, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean)
    : [prompt];

  const allResults = [];

  for (const p of prompts) {
    const result = await runSimulation(p);
    allResults.push(result);
  }

  if (reportFile) {
    fs.writeFileSync(reportFile, JSON.stringify(allResults, null, 2));
    console.log(`\nReport written to: ${reportFile}`);
  }

  // Final summary for batch mode
  if (prompts.length > 1) {
    const totalCreations = allResults.reduce((sum, r) => sum + (r.results?.length || r.creations?.length || 0), 0);
    const totalPassed = allResults.reduce((sum, r) => sum + (r.summary?.passed || 0), 0);
    const totalFailed = allResults.reduce((sum, r) => sum + (r.summary?.failed || 0), 0);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`BATCH SUMMARY: ${prompts.length} prompts, ${totalCreations} creations`);
    console.log(`Pass: ${totalPassed} | Fail: ${totalFailed} | Rate: ${totalCreations > 0 ? Math.round(totalPassed / totalCreations * 100) : 0}%`);
  }

  db.close();
})();
