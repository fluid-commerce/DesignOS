import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Vite plugin that watches .fluid/working/ and pushes HMR custom events
 * to connected clients when files change.
 */
export function fluidWatcherPlugin(workingDir: string): Plugin {
  let server: ViteDevServer | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    name: 'fluid-watcher',
    configureServer(srv) {
      server = srv;
      const absDir = path.resolve(srv.config.root, workingDir);

      // Ensure the working directory exists
      fs.mkdir(absDir, { recursive: true }).catch(() => {});

      const watcher = watch(absDir, {
        ignoreInitial: true,
        depth: 3,
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

      // API middleware for session discovery
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        try {
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
