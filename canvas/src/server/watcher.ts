import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { runApiPipeline, type PipelineContext } from './api-pipeline';
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
  getVoiceGuideDocs,
  getVoiceGuideDoc,
  updateVoiceGuideDoc,
  getBrandPatterns,
} from './db-api';
import { getDb } from '../lib/db';
import { scanAndSeedBrandAssets } from './asset-scanner';
import { seedVoiceGuideIfEmpty, seedBrandPatternsIfEmpty } from './brand-seeder';
import { runDamSync } from './dam-sync';

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
  /^(?:create|make|generate|write|design)\s+(?:a|an|one)\s+/i,
  /\ba\s+one-pager\b/i,
  /\ban?\s+image\b/i,
  /\b(?:a\s+)?single\s+(?:instagram|linkedin|post|one-pager|social|image)\b/i,
  /\bjust\s+(?:a\s+)?(?:single\s+)?(?:post|instagram|linkedin|one-pager)\b/i,
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
 * Vite plugin that watches .fluid/working/ and pushes HMR custom events
 * to connected clients when files change.
 */
export function fluidWatcherPlugin(workingDir: string): Plugin {
  let server: ViteDevServer | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeCampaignGeneration: string | null = null; // campaign-level lock

  return {
    name: 'fluid-watcher',
    configureServer(srv) {
      server = srv;
      const absDir = path.resolve(srv.config.root, workingDir);

      // Ensure the working directory exists
      fs.mkdir(absDir, { recursive: true }).catch(() => {});

      const watcher = watch(absDir, {
        ignoreInitial: true,
        depth: 4,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

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

      watcher.on('add', sendUpdate);
      watcher.on('change', sendUpdate);
      watcher.on('unlink', sendUpdate);
      watcher.on('addDir', sendUpdate);

      // Periodic re-scan fallback: catches edge cases chokidar misses
      let lastKnownMtime = 0;
      const rescanInterval = setInterval(async () => {
        try {
          const stat = await fs.stat(absDir);
          const mtime = stat.mtimeMs;
          if (mtime > lastKnownMtime) {
            lastKnownMtime = mtime;
            sendUpdate();
          }
        } catch { /* dir may not exist yet */ }
      }, 5000);

      // Cleanup on server close
      srv.httpServer?.on('close', () => {
        watcher.close();
        clearInterval(rescanInterval);
      });

      const projectRoot = path.resolve(srv.config.root, '..');
      const templatesDir = path.resolve(projectRoot, 'templates');

      // Auto-scan brand assets into DB on startup (non-blocking)
      scanAndSeedBrandAssets(path.join(projectRoot, 'assets')).catch(err =>
        console.error('[asset-scan] Failed:', err)
      );

      // Seed voice guide docs and brand patterns from source files (non-blocking)
      seedVoiceGuideIfEmpty(path.join(projectRoot, 'voice-guide')).catch(err =>
        console.warn('[watcher] Voice guide seeding failed:', err)
      );
      seedBrandPatternsIfEmpty(path.join(projectRoot, 'patterns/index.html')).catch(err =>
        console.warn('[watcher] Brand patterns seeding failed:', err)
      );

      // Sync brand assets from Fluid DAM on startup (non-blocking)
      const damToken = process.env.VITE_FLUID_DAM_TOKEN;
      if (damToken) {
        runDamSync(damToken, path.join(projectRoot, 'assets')).then(result => {
          console.log(`[dam-sync] Startup sync: ${result.synced} synced, ${result.skipped} skipped, ${result.softDeleted} soft-deleted${result.errors.length ? `, ${result.errors.length} errors` : ''}`);
        }).catch(err => {
          console.warn('[dam-sync] Startup sync failed:', err);
        });
      }

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
          // Home/index: redirect to React app at /app/
          if (pathname === '/') {
            res.writeHead(302, { Location: '/app/' });
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

      // Serve template HTML files at /templates/:path.html with asset path rewriting
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/templates/') || !req.url.endsWith('.html')) return next();
        const filePath = req.url.split('?')[0].replace('/templates/', '');
        const templatePath = path.resolve(projectRoot, 'templates', filePath);
        try {
          let html = await fs.readFile(templatePath, 'utf-8');
          // Rewrite relative asset paths for serving via /fluid-assets/
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
      padding: 24px;
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
            const body = JSON.parse(await readBody(req));
            if (body.slideIndex == null) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'slideIndex is required' }));
              return;
            }
            const slide = createSlide({ creationId: creationSlidesMatch[1], slideIndex: body.slideIndex });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(slide));
            return;
          }

          // ── Iterations ──────────────────────────────────────────────────

          // GET /api/slides/:id/iterations
          const slideIterationsMatch = url.match(/^\/api\/slides\/([^/]+)\/iterations$/);
          if (slideIterationsMatch && method === 'GET') {
            const iterations = getIterations(slideIterationsMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(iterations));
            return;
          }

          // POST /api/slides/:id/iterations
          if (slideIterationsMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (body.iterationIndex == null || !body.htmlPath || !body.source) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'iterationIndex, htmlPath, and source are required' }));
              return;
            }
            const iteration = createIteration({
              slideId: slideIterationsMatch[1],
              iterationIndex: body.iterationIndex,
              htmlPath: body.htmlPath,
              slotSchema: body.slotSchema ?? null,
              aiBaseline: body.aiBaseline ?? null,
              source: body.source,
              templateId: body.templateId ?? null,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(iteration));
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
            const iteration = {
              id: row.id as string,
              slideId: row.slide_id as string,
              iterationIndex: row.iteration_index as number,
              htmlPath: row.html_path as string,
              slotSchema: row.slot_schema ? JSON.parse(row.slot_schema as string) : null,
              aiBaseline: row.ai_baseline ? JSON.parse(row.ai_baseline as string) : null,
              userState: row.user_state ? JSON.parse(row.user_state as string) : null,
              status: row.status as string,
              source: row.source as string,
              generationStatus: (row.generation_status as string) ?? 'complete',
              templateId: (row.template_id as string | null) ?? null,
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
            const row = db.prepare('SELECT html_path, user_state FROM iterations WHERE id = ?').get(iterationId) as { html_path: string; user_state: string | null } | undefined;
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
            try { await fs.access(storedPath); templatePath = storedPath; found = true; } catch { /* noop */ }

            // Strategy 2: stored html_path resolved against .fluid/ directory
            if (!found) {
              const fluidPath = path.resolve(fluidDir, row.html_path);
              try { await fs.access(fluidPath); templatePath = fluidPath; found = true; } catch { /* noop */ }
            }

            // Strategy 3: canonical path .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html
            if (!found) {
              const hierarchy = db.prepare(`
                SELECT c.campaign_id, s.creation_id, i.slide_id
                FROM iterations i
                JOIN slides s ON s.id = i.slide_id
                JOIN creations c ON c.id = s.creation_id
                WHERE i.id = ?
              `).get(iterationId) as { campaign_id: string; creation_id: string; slide_id: string } | undefined;
              if (hierarchy) {
                const canonicalPath = path.join(fluidDir, 'campaigns', hierarchy.campaign_id, hierarchy.creation_id, hierarchy.slide_id, `${iterationId}.html`);
                try { await fs.access(canonicalPath); templatePath = canonicalPath; found = true; } catch { /* noop */ }
              }
            }

            // Strategy 4: fallback to templates/social/ by basename
            if (!found) {
              const fallbackPath = path.join(socialTemplatesDir, path.basename(row.html_path));
              try { await fs.access(fallbackPath); templatePath = fallbackPath; found = true; } catch { /* noop */ }
            }

            if (!found) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(`HTML file not found on disk (tried: stored="${row.html_path}", canonical=.fluid/campaigns/.../${iterationId}.html)`);
              return;
            }
            try {
              let html = await fs.readFile(templatePath, 'utf-8');
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

                // Rewrite /fluid-assets/ to relative assets/ paths for local opening
                let exportHtml = html.replace(/\/fluid-assets\//g, 'assets/');
                archive.append(exportHtml, { name: 'index.html' });

                // Collect all /fluid-assets/ references from original HTML and add files
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

              const initialValuesJson = JSON.stringify(userState).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
              // Apply saved slot values on load, then add postMessage listener for live edits
              const listenerScript =
                '<script id="__tmpl_listener__">' +
                '(function(){' +
                'var initial=' + initialValuesJson + ';' +
                'for(var sel in initial){' +
                'var el=document.querySelector(sel);if(!el)continue;' +
                'var v=initial[sel];' +
                'if(el.tagName==="IMG"&&typeof v==="string"){' +
                'var src=null;' +
                'if(v.indexOf("blob:")===0){src=null;}' +
                'else if(v.indexOf("data:")===0){src=v;}' +
                'else if(v.indexOf("http")===0){try{var u=new URL(v);if(u.origin===location.origin&&u.pathname.indexOf("/fluid-assets/")===0)src=u.pathname;else src=v;}catch(e){src=v;}}' +
                'else if(v.indexOf("/")===0){src=v;}' +
                'else if(v.indexOf("fluid-assets/")===0){src=location.origin+"/"+v;}' +
                'else if(v.indexOf("assets/")===0){src=location.origin+"/fluid-assets/"+v.substring(7);}' +
                'if(src)el.src=src;}' +
                'else if(v.indexOf("\\n")>=0){var x=document.createElement("div");x.textContent=v;el.innerHTML=x.innerHTML.replace(/\\n/g,"<br>");}' +
                'else{el.textContent=v;}' +
                '}' +
                '})();' +
                'window.addEventListener("message",function(e){' +
                'var d=e.data;if(!d)return;' +
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
                'if(d.action==="img"){el.src=d.value;}' +
                'else if(d.action==="imgStyle"){' +
                'if("objectFit"in d)el.style.objectFit=d.objectFit;' +
                'if("objectPosition"in d)el.style.objectPosition=d.objectPosition;' +
                '}else if(d.action==="transform"){' +
                'if("transform"in d&&el.style)el.style.transform=d.transform||"";' +
                '}else if(d.mode==="br"){' +
                'var x=document.createElement("div");x.textContent=d.value;' +
                'el.innerHTML=x.innerHTML.replace(/\\n/g,"<br>");' +
                '}else{el.textContent=d.value;}'; +
                '});</script>';
              html = html.replace('</body>', listenerScript + '</body>');
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
            } catch {
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

        try {
          // GET /api/templates -- return template listing
          if (req.url === '/api/templates' && req.method === 'GET') {
            const templates = await discoverTemplates(projectRoot);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(templates));
            return;
          }

          // POST /api/generate/cancel -- force-clear stuck generation lock
          if (req.url === '/api/generate/cancel' && req.method === 'POST') {
            const wasCampaign = activeCampaignGeneration;
            activeCampaignGeneration = null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: true,
              message: wasCampaign ? `Campaign ${wasCampaign} cancelled` : 'No active generation',
            }));
            return;
          }

          // POST /api/generate -- run API pipeline and stream SSE
          if (req.url === '/api/generate' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const { prompt, template, customization, skillType } = body;

            // ── CAMPAIGN MODE: Multi-creation parallel API generation ────────

            // Parse channels from prompt (shared by both API and CLI paths)
            const { channels, creationCounts, isSingleCreation } = parseChannelHints(prompt || '');
            const creationList = buildCreationList(creationCounts);

            // Title from first 30 chars of prompt
            const rawTitle = (prompt || 'Marketing Campaign').trim();
            const campaignTitle = rawTitle.length > 30 ? rawTitle.slice(0, 30) : rawTitle;

            // existingCampaignId: skip campaign creation if adding to existing
            const existingCampaignId: string | undefined = body.existingCampaignId;

            // Pre-create all Campaign/Creation/Slide/Iteration records BEFORE running pipelines
            // (Shared between API and CLI paths)
            const projectRoot = path.resolve(srv.config.root, '..');
            const fluidDir = path.join(projectRoot, '.fluid');

            let campaignId: string;
            const creationSlideIterMap: Array<{
              creation: { id: string; title: string; creationType: string };
              slideId: string;
              iterationId: string;
              htmlPath: string;
              absHtmlPath: string;
            }> = [];

            // Campaign-level lock check (shared)
            if (activeCampaignGeneration !== null) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Campaign generation already in progress', campaignId: activeCampaignGeneration }));
              return;
            }

            try {
              if (existingCampaignId) {
                campaignId = existingCampaignId;
              } else if (isSingleCreation) {
                // Single-creation prompts: file under sentinel "__standalone__" campaign
                // and create the creation directly (not via createCampaignWithCreations)
                campaignId = getOrCreateStandaloneCampaign();
                for (const spec of creationList) {
                  createCreation({
                    campaignId,
                    title: spec.title,
                    creationType: spec.creationType,
                    slideCount: spec.slideCount,
                  });
                }
              } else {
                const { campaign } = createCampaignWithCreations(
                  { title: campaignTitle, channels },
                  creationList
                );
                campaignId = campaign.id;
              }

              // Create slides and iterations for each creation
              const savedCreations = getCreations(campaignId);
              // Use only the newly-created creations (all if new campaign, or just the new ones)
              const targetCreations = existingCampaignId
                ? savedCreations.slice(-creationList.length)
                : isSingleCreation
                  ? savedCreations.slice(-creationList.length)
                  : savedCreations;

              for (const creation of targetCreations) {
                const slide = createSlide({ creationId: creation.id, slideIndex: 0 });
                const iterationId = nanoid();
                const htmlRelPath = `.fluid/campaigns/${campaignId}/${creation.id}/${slide.id}/${iterationId}.html`;
                const absHtmlPath = path.join(projectRoot, htmlRelPath);
                fsSync.mkdirSync(path.dirname(absHtmlPath), { recursive: true });
                createIteration({
                  id: iterationId,  // Pass pre-generated ID so DB row id matches html_path
                  slideId: slide.id,
                  iterationIndex: 0,
                  htmlPath: htmlRelPath,
                  source: 'ai',
                  generationStatus: 'pending',
                });
                creationSlideIterMap.push({
                  creation: { id: creation.id, title: creation.title, creationType: creation.creationType },
                  slideId: slide.id,
                  iterationId,
                  htmlPath: htmlRelPath,
                  absHtmlPath,
                });
              }
            } catch (err) {
              console.error('[watcher] Failed to pre-create campaign structure:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to create campaign structure' }));
              return;
            }

            // Set campaign-level lock
            activeCampaignGeneration = campaignId;

            // Set SSE headers
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });
            (res as any).flushHeaders?.();

            // Stream campaignId to client IMMEDIATELY after DB creation
            res.write(`data: ${JSON.stringify({ type: 'session', campaignId, creationCount: creationSlideIterMap.length, isSingleCreation, creationIds: creationSlideIterMap.map(m => m.creation.id) })}\n\n`);

            // ── API MODE: Anthropic SDK pipeline ──────────────────────────
            let apiCompletedCount = 0;
            const apiTotalCount = creationSlideIterMap.length;

            // Client disconnect cleanup
            req.on('close', () => { activeCampaignGeneration = null; });

            // Run N parallel API pipelines — one per creation
            for (const entry of creationSlideIterMap) {
              const pipelineCtx: PipelineContext = {
                prompt: prompt || 'Generate a marketing creation',
                creationType: entry.creation.creationType,
                workingDir: path.join(path.dirname(entry.absHtmlPath), 'working'),
                htmlOutputPath: entry.absHtmlPath,
                creationId: entry.creation.id,
                campaignId,
              };

              // Fire and forget — each pipeline runs independently in parallel
              runApiPipeline(pipelineCtx, res)
                .then(() => {
                  try { updateIterationGenerationStatus(entry.iterationId, 'complete'); } catch { /* non-fatal */ }
                })
                .catch((err: Error) => {
                  try {
                    res.write(`event: stderr\ndata: ${JSON.stringify({ creationId: entry.creation.id, text: `Pipeline error: ${err.message}` })}\n\n`);
                  } catch { /* client disconnected */ }
                })
                .finally(() => {
                  apiCompletedCount++;
                  if (apiCompletedCount >= apiTotalCount) {
                    activeCampaignGeneration = null;
                    try {
                      res.write(`event: done\ndata: ${JSON.stringify({ code: 0, campaignId })}\n\n`);
                      res.end();
                    } catch { /* client disconnected */ }
                  }
                });
            }

            return;
          }

          if (req.url === '/api/sessions') {
            const sessions = await discoverSessionsFromDir(absDir);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sessions));
            return;
          }

          const sessionMatch = req.url.match(/^\/api\/sessions\/([^/]+)$/);
          if (sessionMatch) {
            const sessionId = sessionMatch[1];
            const data = await loadSessionFromDir(absDir, sessionId);
            if (!data) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Session not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
          }

          // GET /api/annotations/:sessionId
          const annotGetMatch = req.url.match(/^\/api\/annotations\/([^/]+)$/);
          if (annotGetMatch && req.method === 'GET') {
            const sessionId = annotGetMatch[1];
            const annotPath = path.join(absDir, sessionId, 'annotations.json');
            try {
              const raw = await fs.readFile(annotPath, 'utf-8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(raw);
            } catch {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No annotations' }));
            }
            return;
          }

          // POST /api/annotations/:sessionId
          if (annotGetMatch && req.method === 'POST') {
            const sessionId = annotGetMatch[1];
            const annotDir = path.join(absDir, sessionId);
            await fs.mkdir(annotDir, { recursive: true });
            const annotPath = path.join(annotDir, 'annotations.json');
            const body = await readBody(req);
            await fs.writeFile(annotPath, body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
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
 * Discover sessions from the working directory.
 * Session directories match pattern YYYYMMDD-HHMMSS.
 */
async function discoverSessionsFromDir(workingDir: string) {
  const { discoverSessions } = await import('../lib/sessions.js');
  return discoverSessions(workingDir);
}

/**
 * Load a specific session's full data.
 */
async function loadSessionFromDir(workingDir: string, sessionId: string) {
  const { loadSession } = await import('../lib/sessions.js');
  return loadSession(workingDir, sessionId);
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
 * Server-managed lineage update after generation completes.
 * Discovers HTML files written by the LLM into the round directory,
 * then atomically updates lineage.json with the new round/variations.
 *
 * The LLM NEVER touches lineage.json — this function owns it.
 */
async function updateLineageAfterGeneration(
  sessionDir: string,
  roundDir: string,
  roundNumber: number,
  prompt: string,
  isIteration: boolean
): Promise<void> {
  const lineagePath = path.join(sessionDir, 'lineage.json');

  // Read current lineage
  let lineage: any;
  try {
    const raw = await fs.readFile(lineagePath, 'utf-8');
    lineage = JSON.parse(raw);
  } catch {
    // Should not happen — lineage.json is created before generation starts
    return;
  }

  // Discover HTML files the LLM wrote into the round directory
  let roundFiles: string[];
  try {
    roundFiles = await fs.readdir(roundDir);
  } catch {
    roundFiles = [];
  }

  // Clean up if LLM ignored instructions and wrote lineage.json in round dir
  if (roundFiles.includes('lineage.json')) {
    await fs.unlink(path.join(roundDir, 'lineage.json')).catch(() => {});
  }

  const htmlFiles = roundFiles.filter(
    (f) => f.endsWith('.html') && !f.startsWith('.') && f !== 'copy.html' && f !== 'layout.html' && f !== 'index.html'
  );

  const variations = htmlFiles.map((f, i) => ({
    id: `r${roundNumber}-v${i + 1}`,
    path: `round-${roundNumber}/${f}`,
    status: 'unmarked' as const,
    specCheck: 'draft' as const,
  }));

  if (!lineage.rounds) lineage.rounds = [];

  if (isIteration) {
    // Append new round — never modify existing rounds
    lineage.rounds.push({
      roundNumber,
      prompt,
      variations,
      winnerId: null,
      timestamp: new Date().toISOString(),
    });
  } else {
    // First round: update the placeholder round with discovered variations
    const round1 = lineage.rounds.find((r: any) => r.roundNumber === 1);
    if (round1) {
      round1.variations = variations;
    }
  }

  // Atomic write: write to temp file then rename
  const tmpPath = lineagePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(lineage, null, 2), 'utf-8');
  await fs.rename(tmpPath, lineagePath);
}

/**
 * Auto-ingest HTML files from a round directory into the campaign hierarchy.
 * Checks which files already have iteration records (created via push_asset)
 * and creates records for any orphans. This ensures all generated versions
 * appear in the campaign dashboard even if the agent wrote them directly to disk.
 */
async function autoIngestHtmlToIterations(
  roundDir: string,
  slideId: string,
  campaignId: string,
  creationId: string,
  projectRoot: string,
): Promise<void> {
  let roundFiles: string[];
  try {
    roundFiles = await fs.readdir(roundDir);
  } catch {
    return; // round dir may not exist
  }

  const htmlFiles = roundFiles.filter(
    (f) => f.endsWith('.html') && !f.startsWith('.') && f !== 'copy.html' && f !== 'layout.html' && f !== 'index.html'
  );

  if (htmlFiles.length === 0) return;

  // Check existing iterations for this slide to avoid duplicates
  const existingIterations = getIterations(slideId);
  const existingPaths = new Set(existingIterations.map((it) => it.htmlPath));

  for (let i = 0; i < htmlFiles.length; i++) {
    // Build the relative path that would be stored in the DB.
    // push_asset stores paths as: campaigns/{campaignId}/{creationId}/{slideId}/{iterationId}.html
    // For disk-written files, we use the working dir path relative to project root.
    const absPath = path.join(roundDir, htmlFiles[i]);
    const relPath = path.relative(projectRoot, absPath);

    // Skip if an iteration already references this path
    if (existingPaths.has(relPath)) continue;

    // Also check if any iteration htmlPath contains this filename (push_asset uses different paths)
    const alreadyCovered = existingIterations.length > 0;

    // Only create iterations if NONE exist for this slide (meaning agent didn't use push_asset at all)
    if (alreadyCovered) continue;

    createIteration({
      slideId,
      iterationIndex: i,
      htmlPath: relPath,
      source: 'ai',
    });
  }
}

/**
 * Discover templates from the project's templates/ directory.
 * Reads social/ and one-pagers/ subdirectories, excludes index.html,
 * rewrites asset paths from ../../assets/ to /fluid-assets/.
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
