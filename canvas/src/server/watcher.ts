import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { TemplateInfo } from '../lib/templates';

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

            // Create session directory
            const sessionDir = path.join(absDir, sessionId);
            await fs.mkdir(sessionDir, { recursive: true });

            // Build the prompt with output path instructions
            const parts: string[] = [];
            if (template) parts.push(`Template: ${template}`);
            if (customization) parts.push(`Customization: ${JSON.stringify(customization)}`);
            parts.push(prompt || 'Generate a marketing asset');
            parts.push(`\nWrite all generated files to ${sessionDir}/`);
            parts.push(`Write lineage.json to ${sessionDir}/`);
            const fullPrompt = parts.join('\n');

            // Build spawn args
            const args = [
              '-p', fullPrompt,
              '--output-format', 'stream-json',
              '--verbose',
              '--allowedTools', 'Read,Write,Bash,Glob,Grep,Edit,Agent',
            ];

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
            res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

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
                res.write(`event: done\ndata: ${JSON.stringify({ code: 1, sessionId, error: err.message })}\n\n`);
                res.end();
              } catch {
                // Response may already be closed
              }
            });

            // Send done event on close
            child.on('close', (code: number | null) => {
              activeChild = null;
              try {
                res.write(`event: done\ndata: ${JSON.stringify({ code: code ?? 1, sessionId })}\n\n`);
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

          // POST /api/iterate/:sessionId
          const iterateMatch = req.url.match(/^\/api\/iterate\/([^/]+)$/);
          if (iterateMatch && req.method === 'POST') {
            const sessionId = iterateMatch[1];
            const sessionDir = path.join(absDir, sessionId);
            await fs.mkdir(sessionDir, { recursive: true });
            const iterPath = path.join(sessionDir, 'iterate-request.json');
            const body = await readBody(req);
            await fs.writeFile(iterPath, body, 'utf-8');
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
