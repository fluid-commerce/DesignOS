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

      // Static asset serving for /fluid-assets/ -- serves from project assets/ dir
      const projectRoot = path.resolve(srv.config.root, '..');
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
        const assetFile = req.url.replace('/template-assets/', '');
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

          // GET /api/iterations/:id/html — serves raw HTML for iframe preview
          const iterHtmlMatch = url.match(/^\/api\/iterations\/([^/]+)\/html$/);
          if (iterHtmlMatch && method === 'GET') {
            const { getDb } = await import('../lib/db.js');
            const db = getDb();
            const row = db.prepare('SELECT html_path FROM iterations WHERE id = ?').get(iterHtmlMatch[1]) as { html_path: string } | undefined;
            if (!row?.html_path) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }
            try {
              const htmlContent = await fs.readFile(
                path.resolve(srv.config.root, '..', row.html_path),
                'utf-8'
              );
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(htmlContent);
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

            // Send session ID immediately
            res.write(`data: ${JSON.stringify({ type: 'session', sessionId: actualSessionId })}\n\n`);

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

            // On close: server updates lineage.json, then sends done event
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
              try {
                res.write(`event: done\ndata: ${JSON.stringify({ code: code ?? 1, sessionId: actualSessionId })}\n\n`);
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
