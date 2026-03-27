#!/usr/bin/env node
/**
 * visual-eval.cjs — Playwright screenshot + art director visual evaluation.
 *
 * Screenshots a generated HTML file and a random reference template,
 * saves PNGs for Claude vision-based comparison by the orchestrator.
 *
 * Usage:
 *   node tools/visual-eval.cjs <htmlPath> --creation-type <instagram|linkedin|one-pager>
 *
 * Output:
 *   - {workingDir}/screenshot-generated.png — screenshot of the generated HTML
 *   - {workingDir}/screenshot-reference.png — screenshot of a random reference template
 *   - JSON to stdout: { generatedScreenshot, referenceScreenshot, referenceTemplate, dimensions }
 *
 * The orchestrator then spawns a sim-executor agent (sonnet) with the art director
 * rubric prompt + both images for multimodal evaluation.
 */

const fs = require('node:fs');
const path = require('node:path');

const TOOLS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(TOOLS_DIR, '..');
const CANVAS_DIR = path.join(PROJECT_ROOT, 'canvas');

// Ensure TMPDIR points to a writable directory. The sandbox may set TMPDIR to
// /tmp/claude which doesn't exist and can't be created. /tmp/claude-1000 is
// pre-created by the sandbox and guaranteed writable.
if (fs.existsSync('/tmp/claude-1000')) {
  process.env.TMPDIR = '/tmp/claude-1000';
}

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let htmlPath = null;
let creationType = 'instagram';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--creation-type' && args[i + 1]) { creationType = args[++i]; continue; }
  if (!args[i].startsWith('--') && !htmlPath) { htmlPath = args[i]; }
}

if (!htmlPath) {
  console.error('Usage: node tools/visual-eval.cjs <htmlPath> --creation-type <type>');
  process.exit(1);
}

const absHtmlPath = path.resolve(htmlPath);
const workingDir = path.dirname(absHtmlPath);

// ---------------------------------------------------------------------------
// Platform dimensions
// ---------------------------------------------------------------------------
const PLATFORM_DIMS = {
  instagram: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 627 },
  'one-pager': { width: 816, height: 1056 },
};

// ---------------------------------------------------------------------------
// Reference template mapping (by platform)
// ---------------------------------------------------------------------------
const REFERENCE_TEMPLATES = {
  instagram: [
    'templates/social/t1-quote.html',
    'templates/social/t2-app-highlight.html',
    'templates/social/t4-fluid-ad.html',
    'templates/social/t6-employee-spotlight.html',
    'templates/social/t7-carousel.html',
    'templates/social/t8-quarterly-stats.html',
  ],
  linkedin: [
    'templates/social/t3-partner-alert.html',
    'templates/social/t5-partner-announcement.html',
  ],
  'one-pager': [
    'templates/one-pagers/case-study.html',
    'templates/one-pagers/product-feature.html',
    'templates/one-pagers/company-overview.html',
  ],
};

// ---------------------------------------------------------------------------
// DB setup for asset path resolution
// ---------------------------------------------------------------------------
let Database, db;
const DB_PATH = process.env.FLUID_DB_PATH || path.join(CANVAS_DIR, 'fluid.db');

// Load .env
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

try {
  Database = require(path.join(CANVAS_DIR, 'node_modules/better-sqlite3'));
  db = new Database(DB_PATH, { readonly: true });
} catch {
  db = null;
}

/**
 * Find a brand asset on disk by name.
 * Checks the DB for file_path, falls back to scanning assets/ directory.
 */
function findAssetOnDisk(assetName) {
  // Try DB lookup first
  if (db) {
    try {
      const row = db.prepare(
        'SELECT file_path FROM brand_assets WHERE name = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) LIMIT 1'
      ).get(assetName);
      if (row && row.file_path && fs.existsSync(row.file_path)) {
        return row.file_path;
      }
    } catch { /* fall through */ }
  }

  // Scan assets/ directory
  const assetsDir = path.join(PROJECT_ROOT, 'assets');
  if (fs.existsSync(assetsDir)) {
    try {
      const entries = fs.readdirSync(assetsDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name === assetName) {
          return path.join(entry.parentPath || entry.path, entry.name);
        }
      }
    } catch { /* ok */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Screenshot via Playwright
// ---------------------------------------------------------------------------
async function screenshotHtml(targetHtmlPath, width, height, outputPngPath) {
  let chromium;
  try {
    chromium = require(path.join(CANVAS_DIR, 'node_modules/playwright')).chromium;
  } catch {
    try {
      chromium = require('playwright').chromium;
    } catch {
      throw new Error('Playwright not installed. Run: npx playwright install chromium');
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });

  // Intercept brand asset URLs → serve from local filesystem
  await page.route('**/api/brand-assets/serve/**', async (route) => {
    const url = route.request().url();
    const assetName = decodeURIComponent(url.split('/api/brand-assets/serve/')[1]);
    const assetPath = findAssetOnDisk(assetName);
    if (assetPath) {
      await route.fulfill({ path: assetPath });
    } else {
      await route.abort();
    }
  });

  await page.goto(`file://${path.resolve(targetHtmlPath)}`);
  await page.waitForTimeout(1000); // allow fonts + images to load

  const buffer = await page.screenshot({ type: 'png' });
  fs.writeFileSync(outputPngPath, buffer);

  await browser.close();
  return outputPngPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(absHtmlPath)) {
    console.error(`Error: HTML file not found: ${absHtmlPath}`);
    process.exit(1);
  }

  const dims = PLATFORM_DIMS[creationType] || PLATFORM_DIMS.instagram;

  // 1. Screenshot the generated output
  const generatedPng = path.join(workingDir, 'screenshot-generated.png');
  try {
    await screenshotHtml(absHtmlPath, dims.width, dims.height, generatedPng);
  } catch (err) {
    console.error(`Warning: Failed to screenshot generated HTML: ${err.message}`);
    const result = {
      generatedScreenshot: null,
      referenceScreenshot: null,
      referenceTemplate: null,
      dimensions: dims,
      error: err.message,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }

  // 2. Screenshot a random reference template
  const candidates = REFERENCE_TEMPLATES[creationType] || REFERENCE_TEMPLATES.instagram;
  const refTemplatePath = path.join(PROJECT_ROOT, candidates[Math.floor(Math.random() * candidates.length)]);
  const referencePng = path.join(workingDir, 'screenshot-reference.png');

  let refTemplate = path.basename(refTemplatePath);
  try {
    if (fs.existsSync(refTemplatePath)) {
      await screenshotHtml(refTemplatePath, dims.width, dims.height, referencePng);
    } else {
      console.error(`Warning: Reference template not found: ${refTemplatePath}`);
      refTemplate = null;
    }
  } catch (err) {
    console.error(`Warning: Failed to screenshot reference template: ${err.message}`);
    refTemplate = null;
  }

  // 3. Output result
  const result = {
    generatedScreenshot: generatedPng,
    referenceScreenshot: refTemplate ? referencePng : null,
    referenceTemplate: refTemplate,
    dimensions: dims,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (db) try { db.close(); } catch { /* ok */ }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  if (db) try { db.close(); } catch { /* ok */ }
  process.exit(1);
});
