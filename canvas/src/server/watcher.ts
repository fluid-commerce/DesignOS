import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { TemplateInfo } from '../lib/templates';
import {
  createCampaign,
  getCampaigns,
  getCampaign,
  createAsset,
  getAssets,
  createFrame,
  getFrames,
  createIteration,
  getIterations,
  updateIterationStatus,
  updateIterationUserState,
  createAnnotation,
  getAnnotations,
  createCampaignWithAssets,
} from './db-api';

/**
 * Vite plugin that watches .fluid/working/ and pushes HMR custom events
 * to connected clients when files change.
 */
export function fluidWatcherPlugin(workingDir: string): Plugin {
  let server: ViteDevServer | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeChild: ChildProcess | null = null;

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
      const jonathanLibraryDir = path.resolve(projectRoot, "Reference/Context/Jonathan's Codebase");

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
          pathname.startsWith('/template-assets') ||
          pathname.startsWith('/template-fonts') ||
          pathname.startsWith('/templates/') ||
          pathname.startsWith('/preview/')
        ) {
          return next();
        }
        try {
          if (pathname === '/') {
            const html = await fs.readFile(path.join(jonathanLibraryDir, 'index.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
          if (pathname === '/editor' || pathname.startsWith('/editor?')) {
            const html = await fs.readFile(path.join(jonathanLibraryDir, 'editor.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
          const relative = pathname.slice(1) || '';
          const fullPath = path.resolve(jonathanLibraryDir, relative);
          if (!fullPath.startsWith(jonathanLibraryDir + path.sep) && fullPath !== jonathanLibraryDir) return next();
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

      // Serve template assets and fonts from Jonathan's codebase
      const jonathanTemplateDir = path.resolve(srv.config.root, '..', "Reference/Context/Jonathan's Codebase/templates");
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/template-assets/')) return next();
        const assetFile = req.url.replace('/template-assets/', '').split('?')[0];
        const assetPath = path.join(jonathanTemplateDir, 'assets', assetFile);
        try {
          const data = await fs.readFile(assetPath);
          const { contentType } = serveFluidAsset(assetFile);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        } catch {
          res.writeHead(404); res.end('Not found');
        }
      });
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/template-fonts/')) return next();
        const fontFile = req.url.replace('/template-fonts/', '');
        const fontPath = path.resolve(jonathanTemplateDir, '..', 'fonts', fontFile);
        try {
          const data = await fs.readFile(fontPath);
          const ext = path.extname(fontFile).toLowerCase();
          const ct = ext === '.ttf' ? 'font/ttf' : ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': ct });
          res.end(data);
        } catch {
          res.writeHead(404); res.end('Not found');
        }
      });

      // Serve Jonathan's template HTML files at /templates/:id.html with asset path rewriting
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/templates/') || !req.url.endsWith('.html')) return next();
        const fileName = req.url.replace('/templates/', '');
        const templatePath = path.resolve(srv.config.root, '..', 'Reference/Context/Jonathan\'s Codebase/templates', fileName);
        try {
          let html = await fs.readFile(templatePath, 'utf-8');
          // Rewrite asset paths for serving
          html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');
          html = html.replace(/(?<!\/fluid-)assets\//g, '/template-assets/');
          html = html.replace(/\.\.\/fonts\//g, '/template-fonts/');
          // Remove nav.js script (not needed in preview)
          html = html.replace(/<script src="nav\.js"><\/script>/g, '');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Template not found');
        }
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
        const iframeSrc = '/templates/' + fileName;
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
      <a href="/app/">Create new asset</a>
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
    <img class="flag" src="/template-assets/flag-icon.svg" alt="" />
    <span class="wc">WE-COMMERCE</span>
    <img class="fluid" src="/template-assets/fluid-logo.svg" alt="fluid" />
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
            // Atomic creation with assets if assets array provided
            if (Array.isArray(body.assets)) {
              const result = createCampaignWithAssets(
                { title: body.title, channels: body.channels },
                body.assets
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

          // ── Assets ──────────────────────────────────────────────────────

          // GET /api/campaigns/:id/assets
          const campaignAssetsMatch = url.match(/^\/api\/campaigns\/([^/]+)\/assets$/);
          if (campaignAssetsMatch && method === 'GET') {
            const assets = getAssets(campaignAssetsMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(assets));
            return;
          }

          // POST /api/campaigns/:id/assets
          if (campaignAssetsMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (!body.title || !body.assetType || body.frameCount == null) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'title, assetType, and frameCount are required' }));
              return;
            }
            const asset = createAsset({
              campaignId: campaignAssetsMatch[1],
              title: body.title,
              assetType: body.assetType,
              frameCount: body.frameCount,
            });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(asset));
            return;
          }

          // ── Frames ──────────────────────────────────────────────────────

          // GET /api/assets/:id/frames
          const assetFramesMatch = url.match(/^\/api\/assets\/([^/]+)\/frames$/);
          if (assetFramesMatch && method === 'GET') {
            const frames = getFrames(assetFramesMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(frames));
            return;
          }

          // POST /api/assets/:id/frames
          if (assetFramesMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (body.frameIndex == null) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'frameIndex is required' }));
              return;
            }
            const frame = createFrame({ assetId: assetFramesMatch[1], frameIndex: body.frameIndex });
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(frame));
            return;
          }

          // ── Iterations ──────────────────────────────────────────────────

          // GET /api/frames/:id/iterations
          const frameIterationsMatch = url.match(/^\/api\/frames\/([^/]+)\/iterations$/);
          if (frameIterationsMatch && method === 'GET') {
            const iterations = getIterations(frameIterationsMatch[1]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(iterations));
            return;
          }

          // POST /api/frames/:id/iterations
          if (frameIterationsMatch && method === 'POST') {
            const body = JSON.parse(await readBody(req));
            if (body.iterationIndex == null || !body.htmlPath || !body.source) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'iterationIndex, htmlPath, and source are required' }));
              return;
            }
            const iteration = createIteration({
              frameId: frameIterationsMatch[1],
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
            // Find the iteration by scanning all frames is complex; instead we look it
            // up by querying the frame that holds it. Use a direct DB approach:
            // getIterations returns by frameId, but we need by iterationId.
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
              frameId: row.frame_id as string,
              iterationIndex: row.iteration_index as number,
              htmlPath: row.html_path as string,
              slotSchema: row.slot_schema ? JSON.parse(row.slot_schema as string) : null,
              aiBaseline: row.ai_baseline ? JSON.parse(row.ai_baseline as string) : null,
              userState: row.user_state ? JSON.parse(row.user_state as string) : null,
              status: row.status as string,
              source: row.source as string,
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
            const { getDb } = await import('../lib/db.js');
            const db = getDb();
            const row = db.prepare('SELECT html_path, user_state FROM iterations WHERE id = ?').get(iterHtmlMatch[1]) as { html_path: string; user_state: string | null } | undefined;
            if (!row?.html_path) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }
            const projectRoot = path.resolve(srv.config.root, '..');
            const jonathanTemplatesDir = path.resolve(projectRoot, "Reference/Context/Jonathan's Codebase/templates");
            let templatePath = path.resolve(projectRoot, row.html_path);
            try {
              await fs.access(templatePath);
            } catch {
              templatePath = path.join(jonathanTemplatesDir, path.basename(row.html_path));
            }
            try {
              let html = await fs.readFile(templatePath, 'utf-8');
              // Same path rewrites as /templates/ so assets and fonts load
              html = html.replace(/\.\.\/\.\.\/assets\//g, '/fluid-assets/');
              html = html.replace(/(?<!\/fluid-)assets\//g, '/template-assets/');
              html = html.replace(/\.\.\/fonts\//g, '/template-fonts/');
              html = html.replace(/<script src="nav\.js"><\/script>/g, '');
              // Ensure iframe resolves relative URLs from app origin (fixes missing assets when editing)
              if (!/<base\s/i.test(html)) {
                const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
                const host = req.headers.host || 'localhost';
                const baseHref = proto + '://' + host + '/';
                html = html.replace(/<head[^>]*>/i, (m) => m + '<base href="' + baseHref + '">');
              }
              const userState: Record<string, string> = row.user_state ? JSON.parse(row.user_state) : {};
              const isDownload = req.url?.includes('download=1');
              const templateAssetsDir = path.join(jonathanTemplatesDir, 'assets');

              async function toDataUrl(assetPath: string): Promise<string> {
                try {
                  const data = await fs.readFile(assetPath);
                  const ext = path.extname(assetPath).toLowerCase();
                  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'application/octet-stream';
                  return 'data:' + mime + ';base64,' + (data instanceof Buffer ? data.toString('base64') : Buffer.from(data).toString('base64'));
                } catch {
                  return '';
                }
              }

              if (isDownload) {
                const imgSrcRegex = /src="(\/template-assets\/[^"]+)"/g;
                let match;
                const replacements: { from: string; to: string }[] = [];
                while ((match = imgSrcRegex.exec(html)) !== null) {
                  const assetFile = match[1].replace(/^\/template-assets\//, '').replace(/\?.*$/, '');
                  const dataUrl = await toDataUrl(path.join(templateAssetsDir, assetFile));
                  if (dataUrl) replacements.push({ from: match[0], to: `src="${dataUrl}"` });
                }
                for (const { from, to } of replacements) {
                  html = html.replace(from, to);
                }
                for (const sel of Object.keys(userState)) {
                  const v = userState[sel];
                  if (typeof v === 'string' && (v.startsWith('/template-assets/') || v.startsWith('http') && v.includes('/template-assets/'))) {
                    const assetFile = v.replace(/^.*\/template-assets\//, '').replace(/\?.*$/, '');
                    const dataUrl = await toDataUrl(path.join(templateAssetsDir, assetFile));
                    if (dataUrl) userState[sel] = dataUrl;
                  }
                }
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
                'else if(v.indexOf("http")===0){try{var u=new URL(v);if(u.origin===location.origin&&u.pathname.indexOf("/template-assets/")===0)src=u.pathname;else src=v;}catch(e){src=v;}}' +
                'else if(v.indexOf("/")===0){src=v;}' +
                'else if(v.indexOf("template-assets/")===0){src=location.origin+"/"+v;}' +
                'else if(v.indexOf("assets/")===0){src=location.origin+"/template-assets/"+v.substring(6);}' +
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
            if (activeChild) {
              try { activeChild.kill('SIGKILL'); } catch { /* already dead */ }
              activeChild = null;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, message: 'Generation cancelled' }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, message: 'No active generation' }));
            }
            return;
          }

          // POST /api/generate -- spawn claude CLI and stream SSE
          if (req.url === '/api/generate' && req.method === 'POST') {
            // Concurrent generation lock -- with stale process detection
            if (activeChild) {
              // Check if the child is actually still running
              try {
                // kill(0) tests if process exists without killing it
                process.kill(activeChild.pid!, 0);
              } catch {
                // Process is dead but lock wasn't cleared -- release it
                activeChild = null;
              }
            }
            if (activeChild) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Generation already in progress' }));
              return;
            }

            const body = JSON.parse(await readBody(req));
            const { prompt, template, customization, skillType } = body;

            // Generate session ID: YYYYMMDD-HHMMSS
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const sessionId = [
              now.getFullYear(),
              pad(now.getMonth() + 1),
              pad(now.getDate()),
              '-',
              pad(now.getHours()),
              pad(now.getMinutes()),
              pad(now.getSeconds()),
            ].join('');

            // Detect iteration mode
            const { sessionId: reqSessionId, iterationContext } = body;
            const isIteration = !!(reqSessionId && iterationContext);

            // For iteration: reuse existing session dir; for new: create fresh
            let actualSessionId: string;
            let actualSessionDir: string;
            let roundNumber: number;

            if (isIteration) {
              actualSessionId = reqSessionId;
              actualSessionDir = path.join(absDir, actualSessionId);
              roundNumber = (iterationContext.currentRound || 0) + 1;
            } else {
              actualSessionId = sessionId;
              actualSessionDir = path.join(absDir, sessionId);
              roundNumber = 1;
              await fs.mkdir(actualSessionDir, { recursive: true });
            }

            // ── Auto-create Campaign > Asset > Frame in SQLite ──────────────
            // This bridges the gap between AI sidebar generation and the
            // campaign dashboard. Without this, generated assets only exist
            // on disk in .fluid/working/ and never appear in the campaign view.
            let campaignId: string | null = null;
            let assetId: string | null = null;
            let frameId: string | null = null;

            if (!isIteration) {
              try {
                const titleWords = (prompt || 'Marketing Asset').split(/\s+/).slice(0, 6).join(' ');
                const campaignTitle = titleWords.length > 40 ? titleWords.slice(0, 40) + '...' : titleWords;
                const platform = body.skillType || 'social';

                const campaign = createCampaign({
                  title: campaignTitle,
                  channels: [platform],
                });
                campaignId = campaign.id;

                const asset = createAsset({
                  campaignId: campaign.id,
                  title: campaignTitle,
                  assetType: platform,
                  frameCount: 1,
                });
                assetId = asset.id;

                const frame = createFrame({
                  assetId: asset.id,
                  frameIndex: 0,
                });
                frameId = frame.id;
              } catch (err) {
                console.error('[watcher] Failed to auto-create campaign hierarchy:', err);
                // Non-fatal: generation still proceeds, just won't appear in dashboard
              }
            }

            // Each round gets its own subdirectory for file isolation.
            // This prevents iteration N from overwriting iteration N-1's files.
            const roundDir = path.join(actualSessionDir, `round-${roundNumber}`);
            await fs.mkdir(roundDir, { recursive: true });

            // Generate a human-readable title from the prompt
            const titleWords = (prompt || 'Marketing Asset').split(/\s+/).slice(0, 6).join(' ');
            const title = titleWords.length > 40 ? titleWords.slice(0, 40) + '...' : titleWords;

            // Write lineage.json immediately so session is discoverable.
            // Server OWNS lineage.json — the LLM never touches it.
            if (!isIteration) {
              const platform = body.skillType || 'general';
              const lineage = {
                sessionId: actualSessionId,
                created: now.toISOString(),
                platform,
                product: null,
                template: template || null,
                title,
                rounds: [{
                  roundNumber: 1,
                  prompt: prompt || 'Generate a marketing asset',
                  variations: [],
                  winnerId: null,
                  timestamp: now.toISOString(),
                }],
              };
              await fs.writeFile(
                path.join(actualSessionDir, 'lineage.json'),
                JSON.stringify(lineage, null, 2),
                'utf-8'
              );
            }

            // Build the prompt with output path instructions.
            // Output goes into the round subdirectory — NOT the session root.
            // The LLM is NOT told about lineage.json at all.
            const parts: string[] = [];
            if (template) parts.push(`Template: ${template}`);
            if (customization) parts.push(`Customization: ${JSON.stringify(customization)}`);
            parts.push(prompt || 'Generate a marketing asset');
            parts.push(`\nWrite all generated HTML output files to: ${roundDir}/`);
            parts.push(`IMPORTANT: Do NOT create, read, or modify any file named lineage.json. The system manages that file automatically.`);

            // Tell agent about campaign hierarchy so it can use push_asset MCP tool
            if (campaignId && assetId && frameId) {
              parts.push(`\n--- CAMPAIGN CONTEXT ---`);
              parts.push(`A campaign has been created for this generation. After generating each HTML variation, push it to the campaign using the push_asset MCP tool with these IDs:`);
              parts.push(`  campaignId: ${campaignId}`);
              parts.push(`  assetId: ${assetId}`);
              parts.push(`  frameId: ${frameId}`);
              parts.push(`Call push_asset once for each variation you generate, passing the full HTML as the "html" parameter.`);
            }

            if (isIteration) {
              // Iteration mode: write winner HTML to a temp file to avoid E2BIG
              const winnerPath = path.join(actualSessionDir, '.iteration-winner.html');
              await fs.writeFile(winnerPath, iterationContext.winnerHtml || '', 'utf-8');

              parts.push(`\n--- ITERATION CONTEXT ---`);
              parts.push(`This is Round ${roundNumber} of an iterative design session.`);
              parts.push(`Previous winner HTML is saved at: ${winnerPath}`);
              parts.push(`Read that file to see the current version you need to improve.`);
              if (iterationContext.annotations?.length > 0) {
                parts.push(`\nAnnotations from reviewer:`);
                for (const ann of iterationContext.annotations) {
                  parts.push(`- ${ann.text}${ann.x != null ? ` (at ${ann.x}%, ${ann.y}%)` : ''}`);
                }
              }
              parts.push(`\nGenerate an improved version addressing the feedback above.`);
              parts.push(`Write output HTML files to: ${roundDir}/`);
            }
            const fullPrompt = parts.join('\n');

            // Build spawn args — include MCP tools so agent can read annotations/statuses
            const projectRoot = path.resolve(srv.config.root, '..');
            const mcpConfigPath = path.join(projectRoot, '.mcp.json');
            const args = [
              '-p', fullPrompt,
              '--output-format', 'stream-json',
              '--verbose',
              '--allowedTools', 'Read,Write,Bash,Glob,Grep,Edit,Agent,mcp__fluid-canvas__read_annotations,mcp__fluid-canvas__read_statuses,mcp__fluid-canvas__read_history,mcp__fluid-canvas__push_asset',
            ];

            // Add MCP config if it exists
            try {
              await fs.access(mcpConfigPath);
              args.push('--mcp-config', mcpConfigPath);
            } catch { /* no MCP config, skip */ }

            // Add skill system prompt if available
            if (skillType) {
              const skillPath = path.resolve(
                srv.config.root,
                `skills/${skillType}/SKILL.md`,
              );
              try {
                await fs.access(skillPath);
                args.push('--append-system-prompt-file', skillPath);
              } catch { /* skill file not found, skip */ }
            }

            // Use 'ignore' for stdin: claude -p reads the prompt from
            // args, not stdin. 'inherit' hangs in Vite server context
            // because there's no interactive TTY.
            const child = spawn('claude', args, {
              cwd: projectRoot,
              stdio: ['ignore', 'pipe', 'pipe'],
              env: (() => { const e = { ...process.env }; delete e.CLAUDECODE; return e; })(),
            });
            activeChild = child;

            // Set SSE headers
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });
            (res as any).flushHeaders?.();

            // Send session ID + campaign IDs immediately
            res.write(`data: ${JSON.stringify({ type: 'session', sessionId: actualSessionId, campaignId, assetId, frameId })}\n\n`);

            // Stream stdout line by line as SSE data events
            if (child.stdout) {
              const rl = createInterface({ input: child.stdout });
              rl.on('line', (line: string) => {
                if (line.trim()) {
                  res.write(`data: ${line}\n\n`);
                }
              });
            }

            // Forward stderr as event: stderr
            if (child.stderr) {
              const stderrRl = createInterface({ input: child.stderr });
              stderrRl.on('line', (line: string) => {
                if (line.trim()) {
                  res.write(`event: stderr\ndata: ${JSON.stringify({ text: line })}\n\n`);
                }
              });
            }

            // Handle spawn errors (e.g. binary not found).
            // Without this, activeChild stays locked forever.
            child.on('error', (err: Error) => {
              activeChild = null;
              try {
                res.write(`event: stderr\ndata: ${JSON.stringify({ text: `Spawn error: ${err.message}` })}\n\n`);
                res.write(`event: done\ndata: ${JSON.stringify({ code: 1, sessionId: actualSessionId, error: err.message })}\n\n`);
                res.end();
              } catch {
                // Response may already be closed
              }
            });

            // On close: server updates lineage.json, ingests orphan HTML files, then sends done event
            child.on('close', async (code: number | null) => {
              activeChild = null;
              try {
                // Server-managed lineage update: discover files the LLM wrote
                // into the round directory and update lineage.json atomically.
                await updateLineageAfterGeneration(
                  actualSessionDir, roundDir, roundNumber, prompt || '', isIteration
                );
              } catch (err) {
                console.error('[watcher] Failed to update lineage:', err);
              }

              // Auto-ingest: if the agent wrote HTML files to disk but didn't
              // call push_asset, create iteration records so they show up in
              // the campaign dashboard.
              if (frameId) {
                try {
                  await autoIngestHtmlToIterations(
                    roundDir, frameId, campaignId!, assetId!,
                    path.resolve(srv.config.root, '..')
                  );
                } catch (err) {
                  console.error('[watcher] Failed to auto-ingest HTML to iterations:', err);
                }
              }

              try {
                res.write(`event: done\ndata: ${JSON.stringify({ code: code ?? 1, sessionId: actualSessionId, campaignId })}\n\n`);
                res.end();
              } catch {
                // Response may already be closed (e.g. client disconnected)
              }
            });

            // Safety timeout: kill child after 5 minutes to prevent stuck locks
            const safetyTimeout = setTimeout(() => {
              if (activeChild === child) {
                try {
                  child.kill('SIGTERM');
                  // Force kill after 5 seconds if SIGTERM doesn't work
                  setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch { /* already dead */ }
                  }, 5000);
                } catch { /* already dead */ }
              }
            }, 5 * 60 * 1000);

            // Clear safety timeout when child exits normally
            child.on('close', () => clearTimeout(safetyTimeout));
            child.on('error', () => clearTimeout(safetyTimeout));

            // Kill child if client disconnects
            req.on('close', () => {
              clearTimeout(safetyTimeout);
              if (activeChild === child) {
                child.kill('SIGTERM');
                activeChild = null;
              }
            });

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
 * and creates records for any orphans. This ensures all generated variations
 * appear in the campaign dashboard even if the agent wrote them directly to disk.
 */
async function autoIngestHtmlToIterations(
  roundDir: string,
  frameId: string,
  campaignId: string,
  assetId: string,
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

  // Check existing iterations for this frame to avoid duplicates
  const existingIterations = getIterations(frameId);
  const existingPaths = new Set(existingIterations.map((it) => it.htmlPath));

  for (let i = 0; i < htmlFiles.length; i++) {
    // Build the relative path that would be stored in the DB.
    // push_asset stores paths as: campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html
    // For disk-written files, we use the working dir path relative to project root.
    const absPath = path.join(roundDir, htmlFiles[i]);
    const relPath = path.relative(projectRoot, absPath);

    // Skip if an iteration already references this path
    if (existingPaths.has(relPath)) continue;

    // Also check if any iteration htmlPath contains this filename (push_asset uses different paths)
    const alreadyCovered = existingIterations.length > 0;

    // Only create iterations if NONE exist for this frame (meaning agent didn't use push_asset at all)
    if (alreadyCovered) continue;

    createIteration({
      frameId,
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
