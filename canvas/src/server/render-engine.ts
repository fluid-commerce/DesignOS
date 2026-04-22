import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { getBrandAssetByName, getBrandAssetByFilePath } from './db-api';
import { logChatEvent } from './observability';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let shutdownHooksRegistered = false;

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function registerShutdownHooksOnce(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  // Close the Chromium process when Node exits. Covers Ctrl-C, `kill`, and
  // Vite's own dev-server teardown. We guard against double-registration via
  // the flag above (HMR reloads this module but not the process).
  const handler = async (signal?: NodeJS.Signals) => {
    await shutdownBrowser();
    if (signal) process.exit(0);
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
  process.once('beforeExit', () => {
    void shutdownBrowser();
  });
}

export async function ensureBrowser(): Promise<BrowserContext> {
  if (context) return context;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  registerShutdownHooksOnce();
  return context;
}

export async function shutdownBrowser(): Promise<void> {
  try {
    if (context) {
      await context.close();
      context = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
  } catch {
    // Best-effort shutdown — swallow errors so we never block process exit.
  }
}

export async function renderPreview(
  html: string,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error('render_preview aborted');
  const ctx = await ensureBrowser();
  if (signal?.aborted) throw new Error('render_preview aborted');
  const page = await ctx.newPage();

  try {
    await page.setViewportSize({ width, height });
    if (signal?.aborted) throw new Error('render_preview aborted');

    // Rewrite /fluid-assets/ URLs to absolute file paths
    const assetsDir = path.join(PROJECT_ROOT, 'assets');
    let resolvedHtml = html.replace(/\/fluid-assets\//g, `file://${assetsDir}/`);

    // Resolve /api/brand-assets/serve/{name} → file:// by looking up the DB.
    // The name in the URL may not match the on-disk file_path, so we must query.
    resolvedHtml = resolvedHtml.replace(
      /\/api\/brand-assets\/serve\/([^"'\s)>]+)/g,
      (_match, rawName: string) => {
        try {
          const name = decodeURIComponent(rawName);
          let asset = getBrandAssetByName(name);
          if (!asset && name.includes('/')) {
            asset = getBrandAssetByFilePath(name);
          }
          if (asset) {
            return `file://${path.join(assetsDir, asset.file_path)}`;
          }
        } catch (err) {
          // DB lookup failures here would otherwise produce broken preview
          // images with zero signal — log so the failure shows up in
          // chat_events post-mortems.
          logChatEvent('tool_error', {
            tool: 'render_preview',
            phase: 'asset_resolve_fail',
            name: rawName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        // Fallback: best-effort direct mapping
        return `file://${assetsDir}/${rawName}`;
      },
    );

    // Write to temp file so file:// URLs resolve correctly. Include a random
    // suffix so parallel renders don't collide on Date.now().
    const tmpFile = path.join(
      os.tmpdir(),
      `fluid-render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
    );
    await fs.writeFile(tmpFile, resolvedHtml, 'utf-8');

    try {
      // 10-second timeout for page load
      await page.goto(`file://${tmpFile}`, {
        waitUntil: 'networkidle',
        timeout: 10000,
      });
      if (signal?.aborted) throw new Error('render_preview aborted');

      // Brief pause for fonts/images to load
      await page.waitForTimeout(200);
      if (signal?.aborted) throw new Error('render_preview aborted');

      // JPEG at 75% quality — 3-5x smaller than PNG, sufficient for layout checks
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 75 });
      return screenshot.toString('base64');
    } finally {
      // Always clean up the temp file, even if rendering threw.
      try {
        await fs.unlink(tmpFile);
      } catch {}
    }
  } catch (err) {
    // Non-fatal — creation still saves, just without visual self-check
    throw new Error(`Render preview failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await page.close();
  }
}
