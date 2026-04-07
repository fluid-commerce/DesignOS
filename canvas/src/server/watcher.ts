import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { nanoid } from 'nanoid';
import type { TemplateInfo } from '../lib/templates';
import {
  createCampaign,
  getCampaigns,
  getCampaign,
  createCreation,
  getCreations,
  createSlide,
  getSlides,
  getSlideById,
  createIteration,
  getIterations,
  updateIterationStatus,
  updateIterationUserState,
  updateIterationGenerationStatus,
  updateCreation,
  createAnnotation,
  getAnnotations,
  createCampaignWithCreations,
  getCampaignPreviewUrls,
  getSavedAssets,
  createSavedAsset,
  deleteSavedAsset,
  getBrandAssets,
  getAllBrandAssets,
  updateBrandAsset,
  getBrandAssetByName,
  getBrandAssetByFilePath,
  insertUploadedAsset,
  getVoiceGuideDocs,
  getVoiceGuideDoc,
  updateVoiceGuideDoc,
  getBrandPatterns,
  updateBrandPattern,
  createBrandPattern,
  deleteBrandPattern,
  getDesignRules,
  getDesignRule,
  updateDesignRule,
  getDesignRulesByArchetype,
  getTemplates,
  getTemplate,
  updateTemplate,
  seedTemplateRoutingMetadata,
  getContextMap,
  upsertContextMapEntry,
  deleteContextMapEntry,
  getContextLogs,
  getBrandStyles,
  getBrandStyleByScope,
  upsertBrandStyle,
  deleteBrandStyle,
} from './db-api';
import { getDb } from '../lib/db';
import { scanAndSeedBrandAssets } from './asset-scanner';
import { seedVoiceGuideIfEmpty, seedBrandPatternsIfEmpty, migratePatternsToMarkdown, splitPatternEntries, seedGlobalVisualStyleIfEmpty, seedFontEnforcementIfEmpty, seedDesignRulesIfEmpty, seedTemplatesIfEmpty, seedContextMapIfEmpty, importSeedDataIfFresh } from './brand-seeder';
import { runDamSync } from './dam-sync';
import { handleChatRoutes } from './chat-routes';
import { collectTransformTargets, type TransformTarget } from '../lib/slot-schema';
import { resolveSlotSchemaForIteration } from '../lib/template-configs';
import { injectArtboardMarginGuide, PREVIEW_CHROME_PADDING_PX } from '../lib/preview-utils';

// ─── Creation dimensions by type ────────────────────────────────────────────
const CREATION_DIMENSIONS: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 627 },
  'one-pager': { width: 816, height: 1056 },
};

// Default channel distribution for a full campaign spread
const DEFAULT_CHANNEL_COUNTS: Record<string, number> = {
  instagram: 3,
  linkedin: 3,
  'one-pager': 1,
};

// Patterns that indicate a single-creation intent (one asset, not a campaign)
const SINGULAR_PATTERNS = [
  /\ba\s+(?:social\s+)?post\b/i,
  /\ban?\s+(?:instagram|ig|insta)\b/i,
  /\ban?\s+(?:linkedin|li)\s+(?:post|image)\b/i,
  /\bone\s+(?:linkedin|instagram|post|one-pager|social)\b/i,
  /^(?:create|make|generate|write|design|do)\s+(?:a|an|one)\s+/i,
  /\ba\s+one-pager\b/i,
  /\ban?\s+image\b/i,
  /\b(?:a\s+)?single\s+(?:instagram|linkedin|post|one-pager|social|image)\b/i,
  /\bjust\s+(?:a\s+)?(?:single\s+)?(?:post|instagram|linkedin|one-pager)\b/i,
  /\bstandalone\s+(?:creation|post|asset|piece|image)\b/i,
  /\b(?:a|one)\s+(?:new\s+)?creation\b/i,
];

// Patterns that indicate campaign intent (overrides singularity)
const CAMPAIGN_PATTERNS = [
  /\bcampaign\b/i,
  /\bseries\b/i,
  /\bmultiple\b/i,
  /\bseveral\b/i,
  /\bposts\b/i,  // plural "posts" = campaign intent
];

/** Infer the creation type from a single-creation prompt. */
function inferCreationType(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/linkedin|li\b/.test(lower)) return 'linkedin';
  if (/one-pager/.test(lower)) return 'one-pager';
  return 'instagram'; // default
}

/**
 * Parses channel hints from a prompt string.
 * Detects keywords like "just linkedin", "instagram only", etc.
 * Also detects singularity — a prompt asking for one creation vs a full campaign.
 * Returns channels array, per-channel counts, singularity flag, and inferred type.
 */
export function parseChannelHints(
  prompt: string
): {
  channels: string[];
  creationCounts: Record<string, number>;
  isSingleCreation: boolean;
  inferredType?: string;
} {
  // Channel-only hints FIRST (existing behavior): "just linkedin" = 3 linkedin creations
  if (/just linkedin|linkedin only|only linkedin/i.test(prompt)) {
    return { channels: ['linkedin'], creationCounts: { linkedin: 3 }, isSingleCreation: false };
  }
  if (/just instagram|instagram only|only instagram/i.test(prompt)) {
    return { channels: ['instagram'], creationCounts: { instagram: 3 }, isSingleCreation: false };
  }
  if (/one-pager only|just (?:a )?one-pager/i.test(prompt)) {
    return { channels: ['one-pager'], creationCounts: { 'one-pager': 1 }, isSingleCreation: false };
  }

  // Singularity check: a singular prompt creates exactly 1 creation
  // Campaign patterns override singularity
  const isSingular = SINGULAR_PATTERNS.some(p => p.test(prompt));
  const isCampaign = CAMPAIGN_PATTERNS.some(p => p.test(prompt));
  const isSingleCreation = isSingular && !isCampaign;

  if (isSingleCreation) {
    const inferredType = inferCreationType(prompt);
    return {
      channels: [inferredType],
      creationCounts: { [inferredType]: 1 },
      isSingleCreation: true,
      inferredType,
    };
  }

  // No hint — return full default spread
  return {
    channels: Object.keys(DEFAULT_CHANNEL_COUNTS),
    creationCounts: { ...DEFAULT_CHANNEL_COUNTS },
    isSingleCreation: false,
  };
}

/**
 * Get or create the singleton "__standalone__" sentinel campaign.
 * Standalone creations (single-asset prompts) are filed under this campaign
 * to satisfy the NOT NULL FK constraint on creations.campaign_id.
 */
function getOrCreateStandaloneCampaign(): string {
  const db = getDb();
  const row = db.prepare("SELECT id FROM campaigns WHERE title = '__standalone__'").get() as { id: string } | undefined;
  if (row) return row.id;
  const campaign = createCampaign({ title: '__standalone__', channels: ['standalone'] });
  return campaign.id;
}

/**
 * Builds a creation list from a channel count map.
 * e.g. { instagram: 3, linkedin: 3, 'one-pager': 1 } => 7 creation specs
 */
function buildCreationList(
  creationCounts: Record<string, number>
): Array<{ title: string; creationType: string; slideCount: number }> {
  const creations: Array<{ title: string; creationType: string; slideCount: number }> = [];
  for (const [type, count] of Object.entries(creationCounts)) {
    for (let i = 1; i <= count; i++) {
      creations.push({ title: `${type} ${i}`, creationType: type, slideCount: 1 });
    }
  }
  return creations;
}

/**
 * Vite plugin that registers API routes and pushes HMR custom events
 * to connected clients when campaign data changes.
 */
export function fluidWatcherPlugin(): Plugin {
  let server: ViteDevServer | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const sendUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      server?.ws.send({
        type: 'custom',
        event: 'fluid:file-change',
        data: { timestamp: Date.now() },
      });
    }, 300);
  };

  return {
    name: 'fluid-watcher',
    configureServer(srv) {
      server = srv;

      const projectRoot = path.resolve(srv.config.root, '..');
      const templatesDir = path.resolve(projectRoot, 'templates');

      // Import from seed-data.json if DB is fresh (before file-based seeders)
      try {
        importSeedDataIfFresh(projectRoot);
      } catch (err) {
        console.warn('[watcher] Seed data import failed:', err);
      }

      // Auto-scan brand assets into DB on startup, then seed patterns from markdown files
      const patternSeedsDir = path.join(projectRoot, 'pattern-seeds');
      scanAndSeedBrandAssets(path.join(projectRoot, 'assets')).then(async () => {
        await seedBrandPatternsIfEmpty(patternSeedsDir);
        // Migrate existing HTML patterns to clean markdown (safe to call multiple times)
        const migrated = await migratePatternsToMarkdown(patternSeedsDir);
        if (migrated > 0) console.log(`[watcher] Migrated ${migrated} patterns to markdown`);
        // Split large pattern entries into individual rules (idempotent)
        const split = await splitPatternEntries(patternSeedsDir);
        if (split > 0) console.log(`[watcher] Split ${split} pattern entries into individual rules`);
      }).catch(err =>
        console.error('[asset-scan] Failed:', err)
      );

      // Seed voice guide docs from source files (non-blocking)
      seedVoiceGuideIfEmpty(path.join(projectRoot, 'voice-guide')).catch(err =>
        console.warn('[watcher] Voice guide seeding failed:', err)
      );

      // Seed Design DNA: global visual style contract + per-deliverable design rules
      seedGlobalVisualStyleIfEmpty().catch(err =>
        console.warn('[watcher] Global visual style seeding failed:', err)
      );
      seedFontEnforcementIfEmpty().catch(err =>
        console.warn('[watcher] Font enforcement seeding failed:', err)
      );
      seedDesignRulesIfEmpty().catch(err =>
        console.warn('[watcher] Design rules seeding failed:', err)
      );
      seedTemplatesIfEmpty().catch(err =>
        console.warn('[watcher] Templates seeding failed:', err)
      );
      try {
        seedTemplateRoutingMetadata();
      } catch (err) {
        console.warn('[watcher] Template routing metadata seeding failed:', err);
      }
      try {
        seedContextMapIfEmpty();
      } catch (err) {
        console.warn('[watcher] Context map seeding failed:', err);
      }

      // Sync brand assets from Fluid DAM on startup (non-blocking)
      const damToken = process.env.VITE_FLUID_DAM_TOKEN;
      if (damToken) {
        runDamSync(damToken, path.join(projectRoot, 'assets')).then(result => {
          console.log(`[dam-sync] Startup sync: ${result.synced} synced, ${result.skipped} skipped, ${result.softDeleted} soft-deleted${result.errors.length ? `, ${result.errors.length} errors` : ''}`);
        }).catch(err => {
          console.warn('[dam-sync] Startup sync failed:', err);
        });
      }

      // SPA fallback: rewrite /app/* navigation routes to /app/ so Vite serves index.html
      // Skip Vite internals, source files, node_modules, and static assets
      srv.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        const pathname = req.url.split('?')[0];
        if (
          pathname.startsWith('/app/') &&
          !pathname.startsWith('/app/@') &&
          !pathname.startsWith('/app/src/') &&
          !pathname.startsWith('/app/node_modules/') &&
          !pathname.startsWith('/app/assets/') &&
          !path.extname(pathname)
        ) {
          req.url = '/app/';
        }
        next();
      });

      // Home page: serve Template Library at / and its static assets (run first)
      srv.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        const pathname = req.url.split('?')[0];
        // Let /app, /api, Vite internals, and existing prefixes through
        if (
          pathname.startsWith('/app') ||
          pathname.startsWith('/api') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/src') ||
          pathname.startsWith('/node_modules') ||
          pathname.startsWith('/fluid-assets') ||
          pathname.startsWith('/templates/') ||
          pathname.startsWith('/preview/')
        ) {
          return next();
        }
        try {
          // Home/index: redirect to React app at /app/create
          if (pathname === '/') {
            res.writeHead(302, { Location: '/app/create' });
            res.end();
            return;
          }
          if (pathname === '/editor' || pathname.startsWith('/editor?')) {
            const html = await fs.readFile(path.join(templatesDir, 'editor.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
          // Serve static files from templates/ (JS libs, etc.)
          const relative = pathname.slice(1) || '';
          const fullPath = path.resolve(templatesDir, relative);
          if (!fullPath.startsWith(templatesDir + path.sep) && fullPath !== templatesDir) return next();
          const stat = await fs.stat(fullPath);
          if (!stat.isFile()) return next();
          const data = await fs.readFile(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          const mime = ext === '.js' ? 'application/javascript' : ext === '.html' ? 'text/html; charset=utf-8' : serveFluidAsset(relative).contentType;
          res.writeHead(200, { 'Content-Type': mime });
          res.end(data);
          return;
        } catch {
          /* file not found or not readable */
        }
        next();
      });

      // Chat API routes (SSE streaming for agent messages)
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/chats')) return next();
        const chatUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const handled = await handleChatRoutes(req, res, chatUrl);
        if (handled) return;
        next();
      });

      // DB-backed asset serving: /api/brand-assets/serve/:name
      // Looks up brand_assets by name, resolves file_path, serves with correct Content-Type
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/brand-assets/serve/')) return next();
        const pathname = req.url.split('?')[0];
        const nameOrPath = decodeURIComponent(pathname.replace('/api/brand-assets/serve/', ''));
        if (!nameOrPath) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing asset name');
          return;
        }

        // Try lookup by name first, then by file_path (for paths like "circles/circle-1")
        let asset = getBrandAssetByName(nameOrPath);
        if (!asset && nameOrPath.includes('/')) {
          // Could be a path segment — try with and without extension
          const withExt = getBrandAssetByFilePath(nameOrPath);
          if (withExt) {
            asset = { file_path: withExt.file_path, mime_type: withExt.mime_type };
          }
        }
        if (!asset) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Asset not found in DB');
          return;
        }

        const fullPath = path.join(projectRoot, 'assets', asset.file_path);
        try {
          const data = await fs.readFile(fullPath);
          // Use mime_type from DB, fallback to extension detection
          const contentType = asset.mime_type || serveFluidAsset(asset.file_path).contentType;
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } catch {
          console.error(`[watcher] Brand asset file not found: ${fullPath} (DB file_path: ${asset.file_path})`);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Asset file not found on disk');
        }
      });

      // Static asset serving for /fluid-assets/ -- serves from project assets/ dir
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/fluid-assets/')) return next();

        const assetPath = req.url.replace('/fluid-assets/', '');
        const fullPath = path.join(projectRoot, 'assets', assetPath);

        try {
          const data = await fs.readFile(fullPath);
          const { contentType } = serveFluidAsset(assetPath);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      });

      // Serve campaign-specific assets from .fluid/campaigns/{cId}/assets/
      const fluidDir = path.join(projectRoot, '.fluid');
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/fluid-campaigns/')) return next();

        const assetPath = req.url.split('?')[0].replace('/fluid-campaigns/', '');
        const fullPath = path.join(fluidDir, 'campaigns', assetPath);

        // Path traversal guard
        const campaignsBase = path.join(fluidDir, 'campaigns');
        if (!fullPath.startsWith(campaignsBase + path.sep)) return next();

        try {
          const data = await fs.readFile(fullPath);
          const { contentType } = serveFluidAsset(assetPath);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      });

      // Serve template HTML files at /templates/:path.html
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/templates/') || !req.url.endsWith('.html')) return next();
        const filePath = req.url.split('?')[0].replace('/templates/', '');
        const templatePath = path.resolve(projectRoot, 'templates', filePath);
        try {
          let html = await fs.readFile(templatePath, 'utf-8');
          // Rewrite any remaining ../../assets/ paths to DB-backed URLs (legacy fallback)
          html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');
          // Remove nav.js script (not needed in preview)
          html = html.replace(/<script src="nav\.js"><\/script>/g, '');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Template not found');
        }
      });

      // Serve patterns library at /patterns/ and /patterns/index.html
      const patternsDir = path.resolve(projectRoot, 'patterns');
      srv.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        const pathname = req.url.split('?')[0];
        if (!pathname.startsWith('/patterns/') && pathname !== '/patterns') return next();
        try {
          if (pathname === '/patterns' || pathname === '/patterns/') {
            const html = await fs.readFile(path.join(patternsDir, 'index.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
          // Serve static files under /patterns/
          const relative = pathname.replace(/^\/patterns\//, '');
          const fullPath = path.resolve(patternsDir, relative);
          if (!fullPath.startsWith(patternsDir + path.sep)) return next();
          const stat = await fs.stat(fullPath);
          if (!stat.isFile()) return next();
          const data = await fs.readFile(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          const mime = ext === '.js' ? 'application/javascript'
            : ext === '.css' ? 'text/css'
            : ext === '.html' ? 'text/html; charset=utf-8'
            : 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime });
          res.end(data);
          return;
        } catch {
          /* file not found */
        }
        next();
      });

      // Serve Template Library: index pages and static files under /templates/
      // (Individual .html files are already served with asset rewriting by the middleware above.)
      srv.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        const pathname = req.url.split('?')[0];
        if (!pathname.startsWith('/templates/') && pathname !== '/templates') return next();
        try {
          // Root index
          if (pathname === '/templates' || pathname === '/templates/') {
            const html = await fs.readFile(path.join(templatesDir, 'index.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
          // Subdirectory indices: /templates/social/, /templates/social, /templates/one-pagers/, /templates/one-pagers
          const relative = pathname.replace(/^\/templates\/?/, '').replace(/\/$/, '') || '';
          const hasTrailingSlash = pathname.endsWith('/');
          const segs = relative.split('/').filter(Boolean);
          if (segs.length === 1 && (hasTrailingSlash || relative === segs[0])) {
            const subIndex = path.join(templatesDir, segs[0], 'index.html');
            try {
              const html = await fs.readFile(subIndex, 'utf-8');
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
              return;
            } catch {
              /* no index in this subdir */
            }
          }
          // Static files under /templates/ (e.g. editor.html, editor.js, nav.js)
          let filePath = path.resolve(templatesDir, relative);
          if (!filePath.startsWith(templatesDir + path.sep) && filePath !== templatesDir) return next();
          let stat = await fs.stat(filePath).catch(() => null);
          // Allow /templates/editor?t=... to serve editor.html
          if (!stat?.isFile() && !path.extname(relative)) {
            const withHtml = path.join(path.dirname(filePath), path.basename(filePath) + '.html');
            const statHtml = await fs.stat(withHtml).catch(() => null);
            if (statHtml?.isFile()) {
              filePath = withHtml;
              stat = statHtml;
            }
          }
          if (stat?.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            let data: Buffer | string = await fs.readFile(filePath);
            if (ext === '.html') {
              let html = data.toString('utf-8');
              html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');
              html = html.replace(/<script src="nav\.js"><\/script>/g, '');
              data = html;
            }
            const mime = ext === '.js' ? 'application/javascript'
              : ext === '.css' ? 'text/css'
              : ext === '.html' ? 'text/html; charset=utf-8'
              : 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime });
            res.end(data);
            return;
          }
        } catch {
          /* not found */
        }
        next();
      });

      // Full-size preview screen: /preview/templates/:name.html — top bar, decorative bg, iframe, bottom bar with prev/next
      const previewTemplateOrder = [
        't1-quote', 't2-app-highlight', 't3-partner-alert', 't4-fluid-ad',
        't5-partner-announcement', 't6-employee-spotlight', 't7-carousel', 't8-quarterly-stats',
      ];
      const previewMeta: Record<string, { w: number; h: number; label: string; carouselTotal?: number }> = {
        't1-quote': { w: 1080, h: 1080, label: '01 Client Testimonial / Quote' },
        't2-app-highlight': { w: 1080, h: 1080, label: '02 App Feature / Product Highlight' },
        't3-partner-alert': { w: 1340, h: 630, label: '03 Partner Alert (Landscape)' },
        't4-fluid-ad': { w: 1080, h: 1080, label: '04 Fluid Capabilities — Instagram Ad' },
        't5-partner-announcement': { w: 1340, h: 630, label: '05 Partner Announcement (Landscape)' },
        't6-employee-spotlight': { w: 1080, h: 1080, label: '06 Employee Spotlight' },
        't7-carousel': { w: 1080, h: 1080, label: '07 Carousel — Insights', carouselTotal: 4 },
        't8-quarterly-stats': { w: 1080, h: 1080, label: '08 Quarterly Stats — Carousel', carouselTotal: 4 },
      };
      srv.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url?.startsWith('/preview/templates/') || !req.url.endsWith('.html')) return next();
        const fileName = req.url.replace('/preview/templates/', '').split('?')[0];
        const templateSlug = fileName.replace(/\.html$/, '');
        const meta = previewMeta[templateSlug] || { w: 1080, h: 1080, label: templateSlug };
        const idx = previewTemplateOrder.indexOf(templateSlug);
        const prevSlug = idx >= 0 ? previewTemplateOrder[(idx - 1 + previewTemplateOrder.length) % previewTemplateOrder.length] : null;
        const nextSlug = idx >= 0 ? previewTemplateOrder[(idx + 1) % previewTemplateOrder.length] : null;
        const prevLabel = prevSlug ? previewMeta[prevSlug]?.label ?? prevSlug : null;
        const nextLabel = nextSlug ? previewMeta[nextSlug]?.label ?? nextSlug : null;
        const prevHref = prevSlug ? '/preview/templates/' + prevSlug + '.html' : '#';
        const nextHref = nextSlug ? '/preview/templates/' + nextSlug + '.html' : '#';
        // Template files live under templates/social/ (preview list is all social)
        const iframeSrc = '/templates/social/' + fileName;
        const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Preview — ${templateSlug}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; margin: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #fff; overflow: hidden; }
    .preview-top {
      position: fixed; top: 0; left: 0; right: 0; z-index: 20;
      height: 52px;
      display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
      background: rgba(10,10,10,0.97); border-bottom: 1px solid #1c1c1c;
      font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .preview-top .left { display: flex; align-items: center; gap: 20px; }
    .preview-top .right { display: flex; align-items: center; gap: 20px; }
    .preview-top a { color: #44B2FF; text-decoration: none; }
    .preview-top a:hover { text-decoration: underline; }
    .preview-top .back { color: rgba(255,255,255,0.7); }
    .preview-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; }
    .preview-bg-text { position: absolute; font-size: clamp(20px, 3.5vw, 42px); font-weight: 800; color: rgba(255,255,255,0.05); white-space: nowrap; pointer-events: none; }
    .preview-bg-text.a { top: 14%; left: 4%; }
    .preview-bg-text.b { bottom: 20%; right: 6%; }
    .preview-bg-accent { position: absolute; width: 35%; height: 5px; background: linear-gradient(90deg, transparent, rgba(68,178,255,0.2), transparent); border-radius: 3px; pointer-events: none; }
    .preview-bg-accent.one { top: 24%; left: 4%; transform: rotate(-3deg); }
    .preview-bg-accent.two { bottom: 24%; right: 8%; transform: rotate(2deg); }
    .preview-logos { position: fixed; inset: 0; z-index: 5; pointer-events: none; }
    .preview-logos .flag { position: absolute; bottom: 60px; left: 20px; width: 24px; height: 24px; opacity: 0.4; object-fit: contain; }
    .preview-logos .wc { position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%); font-size: 9px; letter-spacing: 0.25em; color: rgba(255,255,255,0.3); }
    .preview-logos .fluid { position: absolute; bottom: 54px; right: 20px; width: 48px; height: 18px; opacity: 0.4; object-fit: contain; }
    .preview-wrap {
      position: fixed; inset: 52px 0 56px 0; z-index: 10;
      height: calc(100vh - 108px);
      display: flex; align-items: center; justify-content: center;
      padding: ${PREVIEW_CHROME_PADDING_PX}px;
      overflow: hidden;
    }
    .preview-stage {
      flex: 0 0 auto;
      /* Size to fit within 80vh and available width while keeping aspect ratio */
      width: min(80vw, 80vh * ${meta.w} / ${meta.h});
      height: min(80vh, 80vw * ${meta.h} / ${meta.w});
      max-width: ${meta.w}px;
      max-height: ${meta.h}px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
      background: #000;
    }
    .preview-scale-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .preview-scale-wrap iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: ${meta.w}px;
      height: ${meta.h}px;
      border: none;
      transform-origin: 0 0;
    }
    .preview-bottom {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
      height: 56px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      background: rgba(10,10,10,0.97); border-top: 1px solid #1c1c1c;
      font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.05em;
    }
    .preview-bottom .label { color: rgba(255,255,255,0.85); font-weight: 600; }
    .preview-bottom .brand { color: rgba(255,255,255,0.4); font-size: 10px; letter-spacing: 0.08em; }
    .preview-bottom a { color: #44B2FF; text-decoration: none; font-size: 11px; max-width: 28%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .preview-bottom a:hover { text-decoration: underline; }
    .preview-bottom .prev { text-align: left; min-width: 0; flex: 1; }
    .preview-bottom .next { text-align: right; min-width: 0; flex: 1; }
    .preview-bottom .center { flex-shrink: 0; padding: 0 16px; }
    .preview-carousel-arrow {
      position: fixed; top: 50%; transform: translateY(-50%);
      width: 48px; height: 48px; z-index: 25;
      background: rgba(10,10,10,0.9); border: 1px solid #333; border-radius: 50%;
      color: #44B2FF; font-size: 20px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color .15s, background .15s;
    }
    .preview-carousel-arrow:hover { border-color: #44B2FF; background: rgba(68,178,255,0.1); }
    .preview-carousel-prev { left: 20px; }
    .preview-carousel-next { right: 20px; }
    .preview-slide-indicator { color: rgba(255,255,255,0.5); font-size: 10px; margin-left: 8px; }
  </style>
</head>
<body>
  <nav class="preview-top">
    <div class="left">
      <a class="back" href="/">← Back to library</a>
    </div>
    <div class="right">
      <a href="/">Create new asset</a>
      <a href="/" id="preview-dl">Download</a>
      <a href="#" id="preview-share">Share link</a>
    </div>
  </nav>
  <div class="preview-bg">
    <div class="preview-bg-text a">YOUR ONE STOP SHOP FOR</div>
    <div class="preview-bg-text b">APP FEATURE HIGHLIGHT</div>
    <div class="preview-bg-accent one"></div>
    <div class="preview-bg-accent two"></div>
  </div>
  <div class="preview-logos">
    <img class="flag" src="/fluid-assets/logos/flag-icon.svg" alt="" />
    <span class="wc">WE-COMMERCE</span>
    <img class="fluid" src="/fluid-assets/logos/fluid-logo.svg" alt="fluid" />
  </div>
  <div class="preview-wrap" data-carousel-total="${meta.carouselTotal || 0}">
    <div class="preview-stage" data-native-w="${meta.w}" data-native-h="${meta.h}">
      <div class="preview-scale-wrap">
        <iframe id="preview-iframe" src="${iframeSrc}" title="Template preview"></iframe>
      </div>
    </div>
  </div>
  ${meta.carouselTotal ? `<button type="button" class="preview-carousel-arrow preview-carousel-prev" id="preview-carousel-prev" aria-label="Previous slide">←</button><button type="button" class="preview-carousel-arrow preview-carousel-next" id="preview-carousel-next" aria-label="Next slide">→</button>` : ''}
  <footer class="preview-bottom">
    <span class="prev">${prevLabel ? `<a href="${prevHref}">← ${prevLabel}</a>` : '<span class="label">' + meta.label + '</span>'}</span>
    <span class="center label">${meta.label}${meta.carouselTotal ? ' <span id="preview-slide-indicator" class="preview-slide-indicator">01 / ' + String(meta.carouselTotal).padStart(2, '0') + '</span>' : ''}</span>
    <span class="next">${nextLabel ? `<a href="${nextHref}">${nextLabel} →</a>` : '<span class="label">' + meta.label + '</span>'}</span>
  </footer>
  <script>
    document.getElementById('preview-share').addEventListener('click', function(e) {
      e.preventDefault();
      navigator.clipboard.writeText(window.location.href);
      var el = this;
      el.textContent = 'Link copied!';
      setTimeout(function() { el.textContent = 'Share link'; }, 1500);
    });
    (function scalePreview() {
      var stage = document.querySelector('.preview-stage');
      var wrap = document.querySelector('.preview-scale-wrap');
      var iframe = wrap && wrap.querySelector('iframe');
      if (!stage || !wrap || !iframe) return;
      var nw = parseInt(stage.getAttribute('data-native-w'), 10) || 1080;
      var nh = parseInt(stage.getAttribute('data-native-h'), 10) || 1080;
      function updateScale() {
        var w = wrap.offsetWidth;
        var h = wrap.offsetHeight;
        var s = Math.min(w / nw, h / nh);
        iframe.style.transform = 'scale(' + s + ')';
      }
      updateScale();
      var ro = new ResizeObserver(updateScale);
      ro.observe(wrap);
    })();
    (function carouselNav() {
      var wrap = document.querySelector('.preview-wrap');
      var total = parseInt(wrap && wrap.getAttribute('data-carousel-total'), 10) || 0;
      if (total < 1) return;
      var iframe = document.getElementById('preview-iframe');
      var prevBtn = document.getElementById('preview-carousel-prev');
      var nextBtn = document.getElementById('preview-carousel-next');
      var ind = document.getElementById('preview-slide-indicator');
      var current = 1;
      function sendSlide(n) {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'setSlide', slide: n }, '*');
        }
      }
      function updateIndicator() {
        if (ind) ind.textContent = String(current).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      }
      if (prevBtn) prevBtn.addEventListener('click', function() {
        current = (current - 2 + total) % total + 1;
        sendSlide(current);
        updateIndicator();
      });
      if (nextBtn) nextBtn.addEventListener('click', function() {
        current = (current % total) + 1;
        sendSlide(current);
        updateIndicator();
      });
      if (iframe) iframe.addEventListener('load', function() { sendSlide(1); current = 1; updateIndicator(); });
      updateIndicator();
    })();
  </script>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(previewHtml);
      });

      // ─── Campaign hierarchy API middleware ────────────────────────────────
      // All /api/campaigns/* routes. Handled BEFORE the session-based routes.
      // DB calls are sync (better-sqlite3). Returns JSON with proper status codes.
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = req.url.split('?')[0]; // strip query string
        const method = req.method ?? 'GET';

        try {
          // ── Campaigns ───────────────────────────────────────────────────

          // GET /api/campaigns
          if (url === '/api/campaigns' && method === 'GET') {
            const campaigns = getCampaigns();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(campaigns));
            return;
          }

          // POST /api/campaigns
          if (url === '/api/campaigns' && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            // Accept either 'title' or 'name' for the campaign name
            const title = body.title || body.name;
            if (!title) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'title (or name) is required' }));
              return;
            }
            body.title = title;
            if (!Array.isArray(body.channels)) body.channels = [];
            // Atomic creation with creations if creations array provided
            if (Array.isArray(body.creations)) {
              const result = createCampaignWithCreations(
                { title: body.title, channels: body.channels },
                body.creations
              );
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } else {
              const campaign = createCampaign({ title: body.title, channels: body.channels });
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(campaign));
            }
            return;
          }

          // ── Brand assets (catalog served via /fluid-assets/) ───────────────

          // POST /api/uploads/chat-image — persist a chat sidebar image upload
          if (url?.startsWith('/api/uploads/chat-image') && method === 'POST') {
            try {
              const contentType = req.headers['content-type'] ?? 'image/png';
              const fileName = req.headers['x-filename'] as string ?? `upload-${nanoid()}.png`;
              const uploadId = nanoid();

              // Accumulate body as Buffer
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const buffer = Buffer.concat(chunks);

              // Determine extension from content-type
              const extMap: Record<string, string> = {
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/webp': '.webp',
                'image/gif': '.gif',
              };
              const ext = extMap[contentType] ?? '.png';
              const storedName = `upload-${uploadId}${ext}`;

              // Write to assets/uploads/ directory (permanent storage)
              const uploadsDir = path.resolve(projectRoot, 'assets', 'uploads');
              await fs.mkdir(uploadsDir, { recursive: true });
              const filePath = path.join(uploadsDir, storedName);
              await fs.writeFile(filePath, buffer);

              // Persist to brand_assets DB with source='upload'
              const asset = insertUploadedAsset({
                id: uploadId,
                name: storedName,
                filePath: `assets/uploads/${storedName}`,
                mimeType: contentType,
                sizeBytes: buffer.length,
                description: fileName.replace(/\.[^.]+$/, ''), // Strip extension for description
              });

              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ id: asset.id, url: asset.url, name: asset.name }));
            } catch (err) {
              console.error('[api] POST /api/uploads/chat-image failed:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(err) }));
            }
            return;
          }

          // POST /api/dam-sync — trigger manual DAM sync
          if (url === '/api/dam-sync' && method === 'POST') {
            const token = process.env.VITE_FLUID_DAM_TOKEN;
            if (!token) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'VITE_FLUID_DAM_TOKEN not configured' }));
              return;
            }
            try {
              const result = await runDamSync(token, path.join(projectRoot, 'assets'));
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(err) }));
            }
            return;
          }

          // GET /api/brand-assets or GET /api/brand-assets?category=brushstrokes
          if ((url === '/api/brand-assets' || url.startsWith('/api/brand-assets?')) && method === 'GET') {
            const searchParams = new URL(req.url!, 'http://localhost').searchParams;
            const category = searchParams.get('category') ?? undefined;
            const includeDeleted = searchParams.get('include_deleted') === 'true';
            const assets = includeDeleted ? getAllBrandAssets(category) : getBrandAssets(category);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(assets));
            return;
          }

          // PUT /api/brand-assets/:id
          const brandAssetIdMatch = url.match(/^\/api\/brand-assets\/([^/?]+)$/);
          if (brandAssetIdMatch && method === 'PUT') {
            const body = JSON.parse(await readBody(req));
            updateBrandAsset(brandAssetIdMatch[1], body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Voice Guide ────────────────────────────────────────────────────

          // GET /api/voice-guide — returns all voice guide docs
          if (url === '/api/voice-guide' && method === 'GET') {
            const docs = getVoiceGuideDocs();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(docs));
            return;
          }

          // PUT /api/voice-guide/:slug — update a voice guide doc's content
          const voiceGuideSlugMatch = url.match(/^\/api\/voice-guide\/([^/]+)$/);
          if (voiceGuideSlugMatch && method === 'PUT') {
            const slug = voiceGuideSlugMatch[1];
            const body = JSON.parse(await readBody(req));
            if (typeof body.content !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'content is required' }));
              return;
            }
            updateVoiceGuideDoc(slug, body.content);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // GET /api/voice-guide/:slug — returns a single voice guide doc
          if (voiceGuideSlugMatch && method === 'GET') {
            const slug = voiceGuideSlugMatch[1];
            const doc = getVoiceGuideDoc(slug);
            if (!doc) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Voice guide doc not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(doc));
            return;
          }

          // ── Brand Patterns ─────────────────────────────────────────────────

          // GET /api/brand-patterns or GET /api/brand-patterns?category=design-tokens
          if ((url === '/api/brand-patterns' || url.startsWith('/api/brand-patterns?')) && method === 'GET') {
            const category = new URL(req.url!, 'http://localhost').searchParams.get('category') ?? undefined;
            const patterns = getBrandPatterns(category);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(patterns));
            return;
          }

          // POST /api/brand-patterns — create a new rule
          if (url === '/api/brand-patterns' && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (!body.label || !body.category || typeof body.content !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'label, category, and content are required' }));
              return;
            }
            const pattern = createBrandPattern({
              label: body.label,
              category: body.category,
              content: body.content,
              weight: typeof body.weight === 'number' ? body.weight : undefined,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(pattern));
            return;
          }

          // PUT /api/brand-patterns/:slug
          const brandPatternSlugMatch = url.match(/^\/api\/brand-patterns\/([^/?]+)$/);
          if (brandPatternSlugMatch && method === 'PUT') {
            const body = JSON.parse(await readBody(req));
            const updates: { content?: string; weight?: number; label?: string } = {};
            if (typeof body.content === 'string') updates.content = body.content;
            if (typeof body.weight === 'number') updates.weight = body.weight;
            if (typeof body.label === 'string') updates.label = body.label;
            if (Object.keys(updates).length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'at least one of content, weight, or label is required' }));
              return;
            }
            updateBrandPattern(brandPatternSlugMatch[1], updates);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // DELETE /api/brand-patterns/:slug
          const brandPatternDeleteMatch = url.match(/^\/api\/brand-patterns\/([^/?]+)$/);
          if (brandPatternDeleteMatch && method === 'DELETE') {
            const result = deleteBrandPattern(brandPatternDeleteMatch[1]);
            if (result === 'not_found') {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Pattern not found' }));
              return;
            }
            if (result === 'is_core') {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Cannot delete core patterns' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Design Rules ───────────────────────────────────────────────────

          // GET /api/design-rules/archetype/:slug — must come before /:id route
          const designRulesArchetypeMatch = url.match(/^\/api\/design-rules\/archetype\/([^/?]+)/);
          if (designRulesArchetypeMatch && method === 'GET') {
            const slug = designRulesArchetypeMatch[1];
            const platform = new URL(req.url!, 'http://localhost').searchParams.get('platform') ?? undefined;
            const rules = getDesignRulesByArchetype(slug, platform);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rules));
            return;
          }

          // GET /api/design-rules or GET /api/design-rules?scope=X&platform=Y
          if ((url === '/api/design-rules' || url.startsWith('/api/design-rules?')) && method === 'GET') {
            const params = new URL(req.url!, 'http://localhost').searchParams;
            const scope = params.get('scope') ?? undefined;
            const platform = params.get('platform') ?? undefined;
            const rules = getDesignRules(scope, platform);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rules));
            return;
          }

          // GET /api/design-rules/:id
          const designRuleIdMatch = url.match(/^\/api\/design-rules\/([^/?]+)$/);
          if (designRuleIdMatch && method === 'GET') {
            const rule = getDesignRule(designRuleIdMatch[1]);
            if (!rule) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rule));
            return;
          }

          // PUT /api/design-rules/:id
          if (designRuleIdMatch && method === 'PUT') {
            const body = JSON.parse(await readBody(req));
            if (typeof body.content !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'content is required' }));
              return;
            }
            updateDesignRule(designRuleIdMatch[1], body.content);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Context Map ────────────────────────────────────────────────────

          // GET /api/context-map — returns all context map entries
          if (url === '/api/context-map' && method === 'GET') {
            const entries = getContextMap();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(entries));
            return;
          }

          // POST /api/context-map — create a new context map entry
          if (url === '/api/context-map' && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const entry = upsertContextMapEntry({
              creationType: body.creation_type,
              stage: body.stage,
              page: body.page,
              sections: body.sections,
              priority: body.priority,
              maxTokens: body.max_tokens,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(entry));
            return;
          }

          // PUT /api/context-map/:id — update an existing context map entry
          const contextMapPutMatch = url.match(/^\/api\/context-map\/([^/?]+)$/);
          if (contextMapPutMatch && method === 'PUT') {
            const id = contextMapPutMatch[1];
            const body = JSON.parse(await readBody(req));
            const entry = upsertContextMapEntry({
              id,
              creationType: body.creation_type,
              stage: body.stage,
              page: body.page,
              sections: body.sections,
              priority: body.priority,
              maxTokens: body.max_tokens,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(entry));
            return;
          }

          // DELETE /api/context-map/:id — remove a context map entry
          if (contextMapPutMatch && method === 'DELETE') {
            const id = contextMapPutMatch[1];
            const deleted = deleteContextMapEntry(id);
            if (deleted) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ deleted: true }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Not found' }));
            }
            return;
          }

          // GET /api/context-log — returns recent context log entries with optional filters
          if ((url === '/api/context-log' || url.startsWith('/api/context-log?')) && method === 'GET') {
            const params = new URL(req.url!, 'http://localhost').searchParams;
            const creationType = params.get('creation_type') ?? undefined;
            const stage = params.get('stage') ?? undefined;
            const limitStr = params.get('limit');
            const limit = limitStr ? parseInt(limitStr, 10) : 50;
            const logs = getContextLogs({ creationType, stage, limit });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(logs));
            return;
          }

          // ── Templates (DB-backed) ──────────────────────────────────────────

          // GET /api/templates/:id/full — template + design rules merged
          const templateFullMatch = url.match(/^\/api\/db-templates\/([^/?]+)\/full$/);
          if (templateFullMatch && method === 'GET') {
            const template = getTemplate(templateFullMatch[1]);
            if (!template) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Not found' }));
              return;
            }
            const designRules = getDesignRulesByArchetype(template.file);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...template, designRules }));
            return;
          }

          // GET /api/db-templates/:id
          const templateIdMatch = url.match(/^\/api\/db-templates\/([^/?]+)$/);
          if (templateIdMatch && method === 'GET') {
            const template = getTemplate(templateIdMatch[1]);
            if (!template) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(template));
            return;
          }

          // PUT /api/db-templates/:id
          if (templateIdMatch && method === 'PUT') {
            const body = JSON.parse(await readBody(req));
            updateTemplate(templateIdMatch[1], body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // GET /api/db-templates or GET /api/db-templates?type=social
          if ((url === '/api/db-templates' || url.startsWith('/api/db-templates?')) && method === 'GET') {
            const type = new URL(req.url!, 'http://localhost').searchParams.get('type') ?? undefined;
            const templates = getTemplates(type);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(templates));
            return;
          }

          // ── Saved assets (user library) ────────────────────────────────────

          // GET /api/assets
          if (url === '/api/assets' && method === 'GET') {
            const assets = getSavedAssets();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(assets));
            return;
          }

          // POST /api/assets
          if (url === '/api/assets' && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (!body.url || typeof body.url !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'url is required' }));
              return;
            }
            const asset = createSavedAsset({
              url: body.url,
              name: body.name ?? null,
              mimeType: body.mimeType ?? null,
              source: body.source === 'upload' ? 'upload' : 'dam',
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(asset));
            return;
          }

          // DELETE /api/assets/:id
          const assetIdMatch = url.match(/^\/api\/assets\/([^/]+)$/);
          if (assetIdMatch && method === 'DELETE') {
            deleteSavedAsset(assetIdMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // GET /api/campaigns/:id
          const campaignIdMatch = url.match(/^\/api\/campaigns\/([^/]+)$/);
          if (campaignIdMatch && method === 'GET') {
            const campaign = getCampaign(campaignIdMatch[1]);
            if (!campaign) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Campaign not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(campaign));
            return;
          }

          // GET /api/campaigns/:id/preview-urls — returns up to 4 preview entries
          const campaignPreviewMatch = url.match(/^\/api\/campaigns\/([^/]+)\/preview-urls$/);
          if (campaignPreviewMatch && method === 'GET') {
            const urls = getCampaignPreviewUrls(campaignPreviewMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ urls }));
            return;
          }

          // PATCH /api/creations/:id — agent-driven creation rename
          const creationPatchMatch = url.match(/^\/api\/creations\/([^/]+)$/);
          if (creationPatchMatch && method === 'PATCH') {
            const body = JSON.parse(await readBody(req));
            if (!body.title) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'title is required' }));
              return;
            }
            try {
              updateCreation(creationPatchMatch[1], { title: body.title });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Creation not found' }));
            }
            return;
          }

          // ── Creations ─────────────────────────────────────────────────

          // GET /api/campaigns/:id/creations
          const campaignCreationsMatch = url.match(/^\/api\/campaigns\/([^/]+)\/creations$/);
          if (campaignCreationsMatch && method === 'GET') {
            const creations = getCreations(campaignCreationsMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(creations));
            return;
          }

          // POST /api/campaigns/:id/creations
          if (campaignCreationsMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (!body.title || !body.creationType || body.slideCount == null) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'title, creationType, and slideCount are required' }));
              return;
            }
            const creation = createCreation({
              campaignId: campaignCreationsMatch[1],
              title: body.title,
              creationType: body.creationType,
              slideCount: body.slideCount,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(creation));
            return;
          }

          // ── Slides ────────────────────────────────────────────────────

          // GET /api/creations/:id/slides
          const creationSlidesMatch = url.match(/^\/api\/creations\/([^/]+)\/slides$/);
          if (creationSlidesMatch && method === 'GET') {
            const slides = getSlides(creationSlidesMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(slides));
            return;
          }

          // POST /api/creations/:id/slides
          if (creationSlidesMatch && method === 'POST') {
            try {
              const body = JSON.parse(await readBody(req));
              if (body.slideIndex == null) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'slideIndex is required' }));
                return;
              }
              const slide = createSlide({ creationId: creationSlidesMatch[1], slideIndex: body.slideIndex });
              console.log(`[api] Created slide ${slide.id} for creation ${creationSlidesMatch[1]}`);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(slide));
            } catch (err) {
              console.error('[api] POST /api/creations/:id/slides failed:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(err) }));
            }
            return;
          }

          // ── Iterations ──────────────────────────────────────────────────

          // GET /api/slides/:id/iterations
          const slideIterationsMatch = url.match(/^\/api\/slides\/([^/]+)\/iterations$/);
          if (slideIterationsMatch && method === 'GET') {
            try {
              const iterations = getIterations(slideIterationsMatch[1]);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(iterations));
            } catch (err) {
              console.error('[watcher] GET /api/slides/:id/iterations failed:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to load iterations', detail: err instanceof Error ? err.message : String(err) }));
            }
            return;
          }

          // POST /api/slides/:id/iterations
          if (slideIterationsMatch && method === 'POST') {
            try {
              const targetSlideId = slideIterationsMatch[1];
              if (!getSlideById(targetSlideId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Slide not found', slideId: targetSlideId }));
                return;
              }
              const rawBody = await readBody(req);
              const body = JSON.parse(rawBody);
              if (body.iterationIndex == null || !body.htmlPath || !body.source) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'iterationIndex, htmlPath, and source are required' }));
                return;
              }
              console.log(`[api] Creating iteration for slide ${targetSlideId}`);
              const iteration = createIteration({
                slideId: targetSlideId,
                iterationIndex: body.iterationIndex,
                htmlPath: body.htmlPath,
                slotSchema: body.slotSchema ?? null,
                aiBaseline: body.aiBaseline ?? null,
                source: body.source,
                templateId: body.templateId ?? null,
              });
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(iteration));
            } catch (err) {
              console.error('[api] POST /api/slides/:id/iterations failed:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(err) }));
            }
            return;
          }

          // GET /api/iterations/:id — returns iteration + html content from disk
          const iterationByIdMatch = url.match(/^\/api\/iterations\/([^/]+)$/);
          if (iterationByIdMatch && method === 'GET') {
            const iterationId = iterationByIdMatch[1];
            // Find the iteration by scanning all slides is complex; instead we look it
            // up by querying the slide that holds it. Use a direct DB approach:
            // getIterations returns by slideId, but we need by iterationId.
            // Use the db-api's getIterationById helper if available, or implement inline.
            const { getDb } = await import('../lib/db.js');
            const db = getDb();
            const row = db.prepare('SELECT * FROM iterations WHERE id = ?').get(iterationId) as Record<string, unknown> | undefined;
            if (!row) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Iteration not found' }));
              return;
            }
            const storedSlotSchema = row.slot_schema ? JSON.parse(row.slot_schema as string) : null;
            const tmplId = (row.template_id as string | null) ?? null;
            const htmlPath = row.html_path as string;
            const iteration = {
              id: row.id as string,
              slideId: row.slide_id as string,
              iterationIndex: row.iteration_index as number,
              htmlPath,
              slotSchema: resolveSlotSchemaForIteration(storedSlotSchema, tmplId, htmlPath),
              aiBaseline: row.ai_baseline ? JSON.parse(row.ai_baseline as string) : null,
              userState: row.user_state ? JSON.parse(row.user_state as string) : null,
              status: row.status as string,
              source: row.source as string,
              generationStatus: (row.generation_status as string) ?? 'complete',
              templateId: tmplId,
              createdAt: row.created_at as number,
            };
            // Load HTML content from disk
            let htmlContent: string | null = null;
            if (iteration.htmlPath) {
              try {
                htmlContent = await fs.readFile(
                  path.resolve(srv.config.root, '..', iteration.htmlPath),
                  'utf-8'
                );
              } catch { /* file may not exist */ }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...iteration, htmlContent }));
            return;
          }

          // GET /api/iterations/:id/html — serves HTML with path rewrites, saved state, and postMessage listener
          const iterHtmlMatch = url.match(/^\/api\/iterations\/([^/]+)\/html$/);
          if (iterHtmlMatch && method === 'GET') {
            const iterationId = iterHtmlMatch[1];
            const { getDb } = await import('../lib/db.js');
            const db = getDb();
            const row = db.prepare(
              'SELECT html_path, user_state, slot_schema, template_id FROM iterations WHERE id = ?'
            ).get(iterationId) as {
              html_path: string;
              user_state: string | null;
              slot_schema: string | null;
              template_id: string | null;
            } | undefined;
            if (!row?.html_path) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }
            const projectRoot = path.resolve(srv.config.root, '..');
            const socialTemplatesDir = path.resolve(projectRoot, 'templates/social');
            const fluidDir = path.resolve(projectRoot, '.fluid');

            // Try multiple path resolution strategies to find the HTML file
            let templatePath = '';
            let found = false;

            // Strategy 1: stored html_path resolved against project root
            const storedPath = path.resolve(projectRoot, row.html_path);
            try {
              await fs.access(storedPath);
              templatePath = storedPath;
              found = true;
              const stat = await fs.stat(storedPath);
              console.log(`[watcher] iter ${iterationId} resolved via strategy 1: ${storedPath} (${stat.size} bytes)`);
            } catch { /* noop */ }

            // Strategy 2: stored html_path resolved against .fluid/ directory
            if (!found) {
              const fluidPath = path.resolve(fluidDir, row.html_path);
              try { await fs.access(fluidPath); templatePath = fluidPath; found = true; } catch { /* noop */ }
            }

            // Strategy 3: canonical path .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html
            // Hierarchy is hoisted so Strategy 7 can also use it
            const hierarchy = !found ? db.prepare(`
              SELECT c.campaign_id, s.creation_id, i.slide_id
              FROM iterations i
              JOIN slides s ON s.id = i.slide_id
              JOIN creations c ON c.id = s.creation_id
              WHERE i.id = ?
            `).get(iterationId) as { campaign_id: string; creation_id: string; slide_id: string } | undefined : undefined;
            if (!found && hierarchy) {
              const canonicalPath = path.join(fluidDir, 'campaigns', hierarchy.campaign_id, hierarchy.creation_id, hierarchy.slide_id, `${iterationId}.html`);
              try { await fs.access(canonicalPath); templatePath = canonicalPath; found = true; } catch { /* noop */ }
            }

            // Strategy 4: fallback to templates/social/ by basename
            if (!found) {
              const fallbackPath = path.join(socialTemplatesDir, path.basename(row.html_path));
              try { await fs.access(fallbackPath); templatePath = fallbackPath; found = true; } catch { /* noop */ }
            }

            // Strategy 5: strip leading .fluid/ prefix and resolve from fluidDir
            if (!found && row.html_path.startsWith('.fluid/')) {
              const strippedPath = row.html_path.replace(/^\.fluid\//, '');
              const stripped = path.resolve(fluidDir, strippedPath);
              try { await fs.access(stripped); templatePath = stripped; found = true; } catch { /* noop */ }
            }

            // Strategy 6: strip leading .fluid/ and resolve from projectRoot/.fluid/
            if (!found && row.html_path.startsWith('.fluid/')) {
              const fromRoot = path.resolve(projectRoot, row.html_path);
              try { await fs.access(fromRoot); templatePath = fromRoot; found = true; } catch { /* noop */ }
            }

            // Strategy 7: skip slide directory level — some iterations were written
            // at campaign/creation/iter.html instead of campaign/creation/slide/iter.html
            if (!found && hierarchy) {
              const noSlidePath = path.join(fluidDir, 'campaigns', hierarchy.campaign_id, hierarchy.creation_id, `${iterationId}.html`);
              try { await fs.access(noSlidePath); templatePath = noSlidePath; found = true; } catch { /* noop */ }
            }

            if (!found) {
              const tried = [
                `stored: ${path.resolve(projectRoot, row.html_path)}`,
                `fluid: ${path.resolve(fluidDir, row.html_path)}`,
                `canonical: .fluid/campaigns/.../${iterationId}.html`,
                `template: ${path.join(socialTemplatesDir, path.basename(row.html_path))}`,
                ...(row.html_path.startsWith('.fluid/') ? [`stripped: ${path.resolve(fluidDir, row.html_path.replace(/^\.fluid\//, ''))}`] : []),
              ];
              console.error(`[watcher] Iteration ${iterationId} html_path="${row.html_path}" — tried ${tried.length} strategies, none found:\n  ${tried.join('\n  ')}`);
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(`HTML file not found on disk (tried: stored="${row.html_path}", canonical=.fluid/campaigns/.../${iterationId}.html)`);
              return;
            }
            try {
              let html = await fs.readFile(templatePath, 'utf-8');
              console.log(`[watcher] iter ${iterationId}: serving ${templatePath} (${html.length} chars, ${html.split('\n').length} lines)`);
              // Rewrite relative asset paths for serving via /fluid-assets/
              html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');
              html = html.replace(/<script src="nav\.js"><\/script>/g, '');
              // Ensure iframe resolves relative URLs from app origin (fixes missing assets when editing)
              if (!/<base\s/i.test(html)) {
                const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
                const host = req.headers.host || 'localhost';
                const baseHref = proto + '://' + host + '/';
                html = html.replace(/<head[^>]*>/i, (m) => m + '<base href="' + baseHref + '">');
              }
              const userState: Record<string, string> = row.user_state ? JSON.parse(row.user_state) : {};
              const isZipExport = new URL(req.url!, 'http://localhost').searchParams.get('export') === 'zip';
              const assetsDir = path.join(projectRoot, 'assets');

              if (isZipExport) {
                const archiver = (await import('archiver')).default;
                const archive = archiver('zip', { zlib: { level: 6 } });

                res.writeHead(200, {
                  'Content-Type': 'application/zip',
                  'Content-Disposition': `attachment; filename="fluid-asset-${iterationId}.zip"`,
                });

                archive.pipe(res);

                // Rewrite DB-backed URLs to relative paths for local opening
                let exportHtml = html;

                // Handle /api/brand-assets/serve/:name URLs — resolve name to file_path via DB
                const dbAssetRegex = /\/api\/brand-assets\/serve\/([^"'\s)]+)/g;
                const dbSeen = new Set<string>();
                let dbMatch;
                while ((dbMatch = dbAssetRegex.exec(html)) !== null) {
                  const name = decodeURIComponent(dbMatch[1]);
                  if (dbSeen.has(name)) continue;
                  dbSeen.add(name);
                  const asset = getBrandAssetByName(name);
                  if (asset) {
                    const fullAssetPath = path.join(assetsDir, asset.file_path);
                    try {
                      await fs.access(fullAssetPath);
                      archive.file(fullAssetPath, { name: `assets/${asset.file_path}` });
                    } catch { /* skip missing files */ }
                  }
                }
                // Rewrite /api/brand-assets/serve/:name to relative assets/ paths
                exportHtml = exportHtml.replace(/\/api\/brand-assets\/serve\/([^"'\s)]+)/g, (_full, encodedName) => {
                  const name = decodeURIComponent(encodedName);
                  const asset = getBrandAssetByName(name);
                  return asset ? `assets/${asset.file_path}` : `assets/${name}`;
                });

                // Handle legacy /fluid-assets/ URLs
                exportHtml = exportHtml.replace(/\/fluid-assets\//g, 'assets/');
                archive.append(exportHtml, { name: 'index.html' });

                // Collect legacy /fluid-assets/ references and add files
                const assetRegex = /\/fluid-assets\/([^"'\s)]+)/g;
                const seen = new Set<string>();
                let match;
                while ((match = assetRegex.exec(html)) !== null) {
                  const relPath = match[1];
                  if (seen.has(relPath)) continue;
                  seen.add(relPath);
                  const fullPath = path.join(assetsDir, relPath);
                  try {
                    await fs.access(fullPath);
                    archive.file(fullPath, { name: `assets/${relPath}` });
                  } catch { /* skip missing files */ }
                }

                await archive.finalize();
                return;
              }

              html = injectArtboardMarginGuide(html);
              const initialValuesJson = JSON.stringify(userState).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
              let pickTargets: TransformTarget[] = [];
              try {
                const storedSchema = row.slot_schema ? JSON.parse(row.slot_schema) : null;
                const schema = resolveSlotSchemaForIteration(
                  storedSchema,
                  row.template_id,
                  row.html_path
                );
                if (schema) pickTargets = collectTransformTargets(schema);
              } catch {
                pickTargets = [];
              }
              const pickTargetsJson = JSON.stringify(pickTargets).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
              // Apply saved slot values on load, then add postMessage listener for live edits
              const listenerScript =
                '<script id="__tmpl_listener__">' +
                'var PICK_TARGETS=' + pickTargetsJson + ';' +
                'var __fluidLastOutline=null;' +
                'var __fluidEditingEl=null;' +
                '(function(){var h=document.head||document.documentElement;var id="__fluid_artboard_css";if(document.getElementById(id))return;var st=document.createElement("style");st.id=id;' +
                'st.textContent=' +
                '".fluid-artboard-editing{' +
                'caret-color:#fff!important;' +
                '-webkit-user-select:text!important;user-select:text!important;' +
                'outline:1px solid rgba(255,255,255,.35)!important;' +
                'outline-offset:3px!important;' +
                'box-shadow:inset 0 0 0 1px rgba(68,178,255,.45),0 0 0 1px rgba(68,178,255,.25)!important;' +
                'cursor:text!important;' +
                '}' +
                '.fluid-artboard-editing::selection{' +
                'background:rgba(68,178,255,.45)!important;color:#fff!important;' +
                '}' +
                '.fluid-artboard-editing[data-fluid-text-mode=\\"pre\\"]{white-space:pre-wrap!important}' +
                'body,body>*{overflow:visible!important}";' +
                'h.appendChild(st);})();' +
                'function __fluidSetText(el,text,mode){' +
                'if(!el)return;' +
                /* Check if element has child elements (decorative spans, circles, etc.).
                   If so, compare current innerText with new text — if unchanged, skip
                   the assignment entirely to preserve inline markup structure. */
                'var hasKids=false;for(var ci=0;ci<el.childNodes.length;ci++){' +
                'if(el.childNodes[ci].nodeType===1){hasKids=true;break;}}' +
                'if(hasKids){' +
                'var cur=(el.innerText||"").replace(/\\r\\n/g,"\\n").replace(/\\r/g,"\\n").trim();' +
                'var nxt=(text||"").replace(/\\r\\n/g,"\\n").replace(/\\r/g,"\\n").trim();' +
                'if(cur===nxt)return;' +
                '}' +
                /* No child elements, or text actually changed — apply directly */
                'if(mode==="br"){var tmp=document.createElement("div");tmp.textContent=text;el.innerHTML=tmp.innerHTML.replace(/\\n/g,"<br>");}' +
                'else{el.textContent=text;}' +
                '}' +
                'function __fluidApplyPickOutline(el){' +
                'if(__fluidLastOutline){__fluidLastOutline.style.outline="";__fluidLastOutline.style.outlineOffset="";__fluidLastOutline=null;}' +
                'if(el){el.style.outline="2px solid #44B2FF";el.style.outlineOffset="2px";__fluidLastOutline=el;}' +
                '}' +
                'function __fluidFsPx(fp,fpx){' +
                'if(!fp||fp==="inherit")return null;' +
                'if(fp==="custom")return(typeof fpx==="number"&&isFinite(fpx)&&fpx>=8)?Math.round(Math.min(500,Math.max(8,fpx))):null;' +
                'var M={h1:112,h2:88,h3:64,h4:48,h5:36,h6:28,p1:24,p2:20,p3:16};' +
                'var n=M[fp];return typeof n==="number"?n:null;' +
                '}' +
                'function __fluidApplyTextBoxObj(el,o){' +
                'if(!el||!el.style||!o)return;' +
                'el.style.boxSizing="border-box";' +
                'var diTB=window.getComputedStyle(el).display;' +
                'if(diTB==="inline")el.style.display="inline-block";' +
                'var fixWo=o.w!=null&&typeof o.w==="number"&&isFinite(o.w)&&o.w>=1;' +
                'if(fixWo){' +
                'el.style.whiteSpace="normal";' +
                'el.style.overflowWrap="anywhere";' +
                'el.style.wordBreak="break-word";' +
                'el.style.width=o.w+"px";el.style.maxWidth=o.w+"px";' +
                '}else{' +
                'el.style.whiteSpace="";el.style.overflowWrap="";el.style.wordBreak="";' +
                'el.style.width="";el.style.maxWidth="";' +
                '}' +
                'el.style.overflowX="visible";' +
                'if(o.h==null||o.h===""){el.style.height="auto";el.style.maxHeight="none";el.style.overflowY="visible";}' +
                'else{el.style.height=o.h+"px";el.style.maxHeight="";el.style.overflowY="auto";}' +
                'if(o.l!=null)el.style.left=o.l+"px";' +
                'if(o.t!=null)el.style.top=o.t+"px";' +
                'if(o.align==="left"||o.align==="center"||o.align==="right")el.style.textAlign=o.align;' +
                'var _fsp=__fluidFsPx(o.fontPreset,o.fontSizePx);' +
                'if(_fsp!=null)el.style.fontSize=_fsp+"px";' +
                '}' +
                'function __fluidPlaceCaretFromPoint(x,y){' +
                'try{' +
                'if(typeof x==="number"&&typeof y==="number"&&x>=0&&y>=0&&document.caretRangeFromPoint){' +
                'var r=document.caretRangeFromPoint(x,y);' +
                'if(r){var s=window.getSelection();s.removeAllRanges();s.addRange(r);return;}' +
                '}' +
                'var el=__fluidEditingEl;if(el){var rng=document.createRange();rng.selectNodeContents(el);rng.collapse(false);var s2=window.getSelection();s2.removeAllRanges();s2.addRange(rng);}' +
                '}catch(_pc){}' +
                '}' +
                'function __fluidEndArtboardEdit(el){' +
                'if(!el||!el.classList||!el.classList.contains("fluid-artboard-editing"))return;' +
                'try{' +
                'var sel=el.getAttribute("data-fluid-slot-sel");' +
                'var mode=el.getAttribute("data-fluid-text-mode")||"text";' +
                'var val=(el.innerText||"").replace(/\\r\\n/g,"\\n").replace(/\\r/g,"\\n");' +
                'if(sel)window.parent.postMessage({type:"fluidArtboardTextInput",sel:sel,value:val,mode:mode},"*");' +
                '}catch(_e2){}' +
                'el.removeAttribute("contenteditable");el.classList.remove("fluid-artboard-editing");' +
                'el.removeAttribute("data-fluid-slot-sel");el.removeAttribute("data-fluid-text-mode");' +
                'try{el.style.caretColor="";el.style.removeProperty("-webkit-user-select");el.style.removeProperty("user-select");el.style.cursor="";}catch(_st2){}' +
                'if(__fluidEditingEl===el)__fluidEditingEl=null;' +
                '}' +
                'function __fluidStartArtboardEdit(el,p,e){' +
                'if(__fluidEditingEl&&__fluidEditingEl!==el)__fluidEndArtboardEdit(__fluidEditingEl);' +
                'el.setAttribute("contenteditable","true");' +
                'el.classList.add("fluid-artboard-editing");' +
                'el.setAttribute("data-fluid-slot-sel",p.sel);' +
                'el.setAttribute("data-fluid-text-mode",p.mode||"text");' +
                'try{el.style.caretColor="#fff";el.style.setProperty("-webkit-user-select","text");el.style.setProperty("user-select","text");el.style.cursor="text";}catch(_st){}' +
                '__fluidEditingEl=el;' +
                '__fluidApplyPickOutline(el);' +
                'window.parent.postMessage({type:"fluidPickElement",sel:p.sel,label:p.label||"",kind:"text"},"*");' +
                'el.focus({preventScroll:true});' +
                'if(e&&typeof e.clientX==="number"&&typeof e.clientY==="number")__fluidPlaceCaretFromPoint(e.clientX,e.clientY);' +
                'else __fluidPlaceCaretFromPoint(-1,-1);' +
                '}' +
                '(function(){' +
                'var initial=' + initialValuesJson + ';' +
                'var TX_PREFIX="__transform__:";var TB_PREFIX="__textbox__:";' +
                'for(var sel in initial){' +
                'var v=initial[sel];' +
                'if(sel==="__brushTransform__"){' +
                'try{' +
                'var tmap=typeof v==="string"?JSON.parse(v):v;' +
                'for(var bsel in tmap){' +
                'var bel=document.querySelector(bsel);' +
                'if(bel&&bel.style){bel.style.transformOrigin="50% 50%";bel.style.transform=tmap[bsel]||"";}' +
                '}' +
                '}catch(_){}' +
                'continue;}' +
                'if(sel.indexOf(TX_PREFIX)===0){' +
                'var tsel=sel.substring(TX_PREFIX.length);' +
                'var tel=document.querySelector(tsel);' +
                'if(tel&&typeof v==="string"){' +
                'tel.style.transform=v;tel.style.transformOrigin="50% 50%";' +
                'var cs0=window.getComputedStyle(tel);' +
                'var Ls0=cs0.left,Ts0=cs0.top;' +
                'if((Ls0.indexOf("px")>=0||Ls0==="0px")&&(Ts0.indexOf("px")>=0||Ts0==="0px")){' +
                'var L0=parseFloat(Ls0)||0,T0=parseFloat(Ts0)||0;' +
                'if(L0!==0||T0!==0){tel.style.left="0px";tel.style.top="0px";tel.style.right="auto";tel.style.bottom="auto";}' +
                '}' +
                '}' +
                'continue;}' +
                'if(sel.indexOf(TB_PREFIX)===0){' +
                'var bsel=sel.substring(TB_PREFIX.length);' +
                'var bel=document.querySelector(bsel);' +
                'if(bel&&typeof v==="string"){' +
                'try{__fluidApplyTextBoxObj(bel,JSON.parse(v));}catch(_tb){}' +
                '}' +
                'continue;}' +
                'var el=document.querySelector(sel);if(!el)continue;' +
                'if(el.tagName==="IMG"&&typeof v==="string"){' +
                'var src=null;' +
                'if(v.indexOf("blob:")===0){src=null;}' +
                'else if(v.indexOf("data:")===0){src=v;}' +
                'else if(v.indexOf("http")===0){try{var u=new URL(v);if(u.origin===location.origin&&(u.pathname.indexOf("/fluid-assets/")===0||u.pathname.indexOf("/api/brand-assets/serve/")===0))src=u.pathname;else src=v;}catch(e){src=v;}}' +
                'else if(v.indexOf("/")===0){src=v;}' +
                'else if(v.indexOf("fluid-assets/")===0){src=location.origin+"/"+v;}' +
                'else if(v.indexOf("assets/")===0){src=location.origin+"/fluid-assets/"+v.substring(7);}' +
                'if(src)el.src=src;}' +
                'else{__fluidSetText(el,v,v.indexOf("\\n")>=0?"br":"text");}' +
                '}' +
                '})();' +
                'document.addEventListener("click",function(e){' +
                'if(!PICK_TARGETS||!PICK_TARGETS.length)return;' +
                'var raw=e.target;' +
                'var t=(raw&&raw.nodeType===3)?raw.parentElement:raw;' +
                'if(!t||t.nodeType!==1)return;' +
                'if(__fluidEditingEl&&__fluidEditingEl.contains(t))return;' +
                'var tag=(t.tagName||"").toUpperCase();' +
                'if(tag==="INPUT"||tag==="TEXTAREA"||tag==="BUTTON"||tag==="SELECT")return;' +
                'var cur=t;' +
                'while(cur&&cur!==document.documentElement){' +
                'for(var pi=0;pi<PICK_TARGETS.length;pi++){' +
                'var p=PICK_TARGETS[pi];' +
                'if(cur.matches&&p.sel&&cur.matches(p.sel)){' +
                'e.preventDefault();e.stopPropagation();' +
                '__fluidApplyPickOutline(cur);' +
                'window.parent.postMessage({type:"fluidPickElement",sel:p.sel,label:p.label||"",kind:p.kind||"image"},"*");' +
                'return;}' +
                '}' +
                'cur=cur.parentElement;}' +
                '},true);' +
                'document.addEventListener("dblclick",function(e){' +
                'if(!PICK_TARGETS||!PICK_TARGETS.length)return;' +
                'var raw=e.target;' +
                'var t=(raw&&raw.nodeType===3)?raw.parentElement:raw;' +
                'if(!t||t.nodeType!==1)return;' +
                'var tag=(t.tagName||"").toUpperCase();' +
                'if(tag==="INPUT"||tag==="TEXTAREA"||tag==="BUTTON"||tag==="SELECT")return;' +
                'var cur=t;' +
                'while(cur&&cur!==document.documentElement){' +
                'for(var pi=0;pi<PICK_TARGETS.length;pi++){' +
                'var p=PICK_TARGETS[pi];' +
                'if(p.kind==="text"&&cur.matches&&p.sel&&cur.matches(p.sel)){' +
                'e.preventDefault();e.stopPropagation();' +
                '__fluidStartArtboardEdit(cur,p,e);' +
                'return;}' +
                '}' +
                'cur=cur.parentElement;}' +
                '},true);' +
                'document.addEventListener("input",function(e){' +
                'var el=e.target;' +
                'if(!el||el.nodeType!==1||!el.classList||!el.classList.contains("fluid-artboard-editing"))return;' +
                'var sel=el.getAttribute("data-fluid-slot-sel");' +
                'if(!sel)return;' +
                'var mode=el.getAttribute("data-fluid-text-mode")||"text";' +
                'var val=(el.innerText||"").replace(/\\r\\n/g,"\\n").replace(/\\r/g,"\\n");' +
                'window.parent.postMessage({type:"fluidArtboardTextInput",sel:sel,value:val,mode:mode},"*");' +
                '},true);' +
                'document.addEventListener("focusout",function(e){' +
                'var el=e.target;' +
                'if(!el||!el.classList||!el.classList.contains("fluid-artboard-editing"))return;' +
                'var rt=e.relatedTarget;' +
                'if(rt&&el.contains(rt))return;' +
                '__fluidEndArtboardEdit(el);' +
                '},true);' +
                'document.addEventListener("keydown",function(e){' +
                'if(e.key!=="Escape")return;' +
                'var el=__fluidEditingEl;' +
                'if(!el)return;' +
                'e.preventDefault();e.stopPropagation();' +
                '__fluidEndArtboardEdit(el);' +
                '},true);' +
                'window.addEventListener("message",function(e){' +
                'var d=e.data;if(!d)return;' +
                'if(d.type==="fluidClearPick"){__fluidApplyPickOutline(null);return;}' +
                'if(d.type==="fluidStartArtboardEdit"&&d.sel){' +
                'var elEdit=document.querySelector(d.sel);if(!elEdit)return;' +
                'for(var pj=0;pj<PICK_TARGETS.length;pj++){' +
                'var pEdit=PICK_TARGETS[pj];' +
                'if(pEdit.kind==="text"&&pEdit.sel===d.sel){__fluidStartArtboardEdit(elEdit,pEdit,null);return;}' +
                '}' +
                'return;}' +
                'if(d.type==="readValues"){' +
                'var sel=d.selectors||[],vals={};' +
                'for(var i=0;i<sel.length;i++){' +
                'var el=document.querySelector(sel[i]);' +
                'if(el){vals[sel[i]]=el.tagName==="IMG"?el.src:el.textContent||"";}' +
                '}' +
                'window.parent.postMessage({type:"readValuesResult",values:vals},"*");' +
                'return;' +
                '}' +
                'if(d.type!=="tmpl")return;' +
                'var el=document.querySelector(d.sel);if(!el)return;' +
                'var ae=document.activeElement;' +
                'if(el.getAttribute("contenteditable")==="true"&&ae&&(el===ae||el.contains(ae)))return;' +
                'if(d.action==="img"){el.src=d.value;}' +
                'else if(d.action==="textBox"){' +
                'if(el.style){' +
                'el.style.boxSizing="border-box";' +
                'var diTB2=window.getComputedStyle(el).display;' +
                'if(diTB2==="inline")el.style.display="inline-block";' +
                'var hugW=d.widthMode==="hug";' +
                'var fixW=d.width&&d.width!=="auto";' +
                'var fullReset=!hugW&&!fixW&&(!d.height||d.height==="auto");' +
                'if(fullReset){' +
                'el.style.width="";el.style.maxWidth="";el.style.height="";' +
                'el.style.whiteSpace="";el.style.overflowWrap="";el.style.wordBreak="";' +
                'el.style.overflowX="";el.style.overflowY="";' +
                'el.style.textAlign="";' +
                'el.style.fontSize="";' +
                '}else{' +
                'if(hugW){' +
                'el.style.whiteSpace="";el.style.overflowWrap="";el.style.wordBreak="";' +
                'el.style.width="";el.style.maxWidth="";' +
                '}else{' +
                'el.style.whiteSpace="normal";' +
                'el.style.overflowWrap="anywhere";' +
                'el.style.wordBreak="break-word";' +
                'el.style.width=d.width;el.style.maxWidth=d.width;' +
                '}' +
                'el.style.overflowX="visible";' +
                'if(!d.height||d.height==="auto"){el.style.height="auto";el.style.maxHeight="none";el.style.overflowY="visible";}' +
                'else{el.style.height=d.height;el.style.maxHeight="";el.style.overflowY="auto";}' +
                '}' +
                'if("left" in d && d.left)el.style.left=d.left;' +
                'if("top" in d && d.top)el.style.top=d.top;' +
                'if("textAlign" in d && d.textAlign)el.style.textAlign=d.textAlign;' +
                'if(d.clearFontSize)el.style.fontSize="";' +
                'else if(d.fontSize)el.style.fontSize=d.fontSize;' +
                '}' +
                '}' +
                'else if(d.action==="imgStyle"){' +
                'if("objectFit"in d)el.style.objectFit=d.objectFit;' +
                'if("objectPosition"in d)el.style.objectPosition=d.objectPosition;' +
                '}else if(d.action==="transform"){' +
                'if(("transform"in d)&&el.style){' +
                'var csT=window.getComputedStyle(el);' +
                'var Ls=csT.left,Ts=csT.top;' +
                'if((Ls.indexOf("px")>=0||Ls==="0px")&&(Ts.indexOf("px")>=0||Ts==="0px")){' +
                'var Lj=parseFloat(Ls)||0,Tj=parseFloat(Ts)||0;' +
                'if(Lj!==0||Tj!==0){' +
                'el.style.left="0px";el.style.top="0px";' +
                'el.style.right="auto";el.style.bottom="auto";' +
                '}' +
                '}' +
                'el.style.transform=d.transform||"";el.style.transformOrigin="50% 50%";' +
                '}' +
                '}else{__fluidSetText(el,d.value,d.mode==="br"?"br":"text");}' +
                '});</script>';
              html = html.replace('</body>', listenerScript + '</body>');
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
            } catch (err) {
              console.error(`[watcher] fs.readFile failed for iteration ${iterationId} at ${templatePath}:`, err);
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('HTML file not found on disk');
            }
            return;
          }

          // PATCH /api/iterations/:id/status
          const iterStatusMatch = url.match(/^\/api\/iterations\/([^/]+)\/status$/);
          if (iterStatusMatch && method === 'PATCH') {
            const body = JSON.parse(await readBody(req));
            if (!body.status) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'status is required' }));
              return;
            }
            updateIterationStatus(iterStatusMatch[1], body.status);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // PATCH /api/iterations/:id/user-state
          const iterUserStateMatch = url.match(/^\/api\/iterations\/([^/]+)\/user-state$/);
          if (iterUserStateMatch && method === 'PATCH') {
            const body = JSON.parse(await readBody(req));
            if (!body.userState) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'userState is required' }));
              return;
            }
            updateIterationUserState(iterUserStateMatch[1], body.userState);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Annotations ─────────────────────────────────────────────────

          // GET /api/iterations/:id/annotations
          const iterAnnotsMatch = url.match(/^\/api\/iterations\/([^/]+)\/annotations$/);
          if (iterAnnotsMatch && method === 'GET') {
            const annotations = getAnnotations(iterAnnotsMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(annotations));
            return;
          }

          // POST /api/iterations/:id/annotations
          if (iterAnnotsMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (!body.type || !body.author || !body.text) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'type, author, and text are required' }));
              return;
            }
            const annotation = createAnnotation({
              iterationId: iterAnnotsMatch[1],
              type: body.type,
              author: body.author,
              text: body.text,
              x: body.x,
              y: body.y,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(annotation));
            return;
          }

          // ─── System Styles API (read-only, from disk) ────────────────────────
          if (url === '/api/system-styles' && method === 'GET') {
            const stylesDir = path.resolve(projectRoot, 'styles');
            const scopes: Record<string, string> = {};
            try {
              scopes.global = await fs.readFile(path.join(stylesDir, 'global.css'), 'utf-8');
            } catch { scopes.global = '/* global.css not found */'; }
            try {
              scopes.instagram = await fs.readFile(path.join(stylesDir, 'platforms', 'instagram.css'), 'utf-8');
            } catch { scopes.instagram = ''; }
            try {
              scopes.linkedin = await fs.readFile(path.join(stylesDir, 'platforms', 'linkedin.css'), 'utf-8');
            } catch { scopes.linkedin = ''; }
            try {
              scopes['one-pager'] = await fs.readFile(path.join(stylesDir, 'platforms', 'one-pager.css'), 'utf-8');
            } catch { scopes['one-pager'] = ''; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(scopes));
            return;
          }

          // ─── Brand Styles API ────────────────────────────────────────────────
          if (url === '/api/brand-styles' && method === 'GET') {
            const styles = getBrandStyles();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(styles));
            return;
          }

          const brandStylesScopeMatch = url.match(/^\/api\/brand-styles\/([^/]+)$/);
          if (brandStylesScopeMatch) {
            const scope = decodeURIComponent(brandStylesScopeMatch[1]);

            if (method === 'GET') {
              const style = getBrandStyleByScope(scope);
              if (!style) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Scope not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(style));
              return;
            }

            if (method === 'PUT') {
              const body = JSON.parse(await readBody(req));
              const { cssContent } = body;
              const style = upsertBrandStyle(scope, cssContent ?? '');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(style));
              return;
            }

            if (method === 'DELETE') {
              const deleted = deleteBrandStyle(scope);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ deleted }));
              return;
            }
          }

        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
          return;
        }

        // Not a campaign route — pass to next middleware
        next();
      });

      // API middleware for session discovery
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = req.url.split('?')[0];
        const method = req.method ?? 'GET';

        try {
          // GET /api/templates -- return template listing
          if (req.url === '/api/templates' && req.method === 'GET') {
            const templates = await discoverTemplates(projectRoot);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(templates));
            return;
          }

          next();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

/**
 * Read the full request body as a string.
 */
function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}


/**
 * MIME type map for static asset serving.
 */
const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

/**
 * Get content-type for a fluid asset file path.
 * Exported for testing.
 */
export function serveFluidAsset(filePath: string): { contentType: string } {
  const ext = path.extname(filePath).toLowerCase();
  return { contentType: MIME_TYPES[ext] || 'application/octet-stream' };
}


/**
 * Discover templates from the project's templates/ directory.
 * Reads social/ and one-pagers/ subdirectories, excludes index.html,
 * rewrites any remaining ../../assets/ paths to /fluid-assets/ (legacy fallback).
 * Exported for testing.
 */
export async function discoverTemplates(projectRoot: string): Promise<TemplateInfo[]> {
  const templates: TemplateInfo[] = [];

  const categories: Array<{ dir: string; category: 'social' | 'one-pager'; dims: { width: number; height: number } }> = [
    { dir: 'templates/social', category: 'social', dims: { width: 1080, height: 1080 } },
    { dir: 'templates/one-pagers', category: 'one-pager', dims: { width: 816, height: 1056 } },
  ];

  for (const cat of categories) {
    const dirPath = path.join(projectRoot, cat.dir);
    let files: string[];
    try {
      files = (await fs.readdir(dirPath)) as string[];
    } catch {
      continue; // directory may not exist
    }

    for (const file of files) {
      if (!file.endsWith('.html') || file === 'index.html') continue;

      const filePath = path.join(dirPath, file);
      let html = await fs.readFile(filePath, 'utf-8');

      // Rewrite relative asset paths to absolute /fluid-assets/ paths
      html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');

      const id = file.replace('.html', '');
      const name = id
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      templates.push({
        id,
        name,
        category: cat.category,
        html,
        dimensions: cat.dims,
      });
    }
  }

  return templates;
}
