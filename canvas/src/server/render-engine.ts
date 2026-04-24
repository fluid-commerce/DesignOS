import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { nanoid } from 'nanoid';
import { getBrandAssetByName, getBrandAssetByFilePath } from './db-api';
import { logChatEvent } from './observability';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let shutdownHooksRegistered = false;

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

/**
 * 1x1 fully-transparent PNG. Used as the fallback URL when a
 * /api/brand-assets/serve/{name} reference can't be resolved via DB lookup.
 * Chromium loads this instantly, the CSS mask-image rule still parses, and
 * the underlying element renders as if no mask was applied — visually
 * identical to "mask absent" rather than a broken-image box.
 */
export const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

export interface RewriteAssetUrlsResult {
  html: string;
  /** Asset names that couldn't be resolved via DB — rewritten to transparent PNG. */
  unresolved: string[];
  /** Any /api/brand-assets/ URLs still present after rewrite (first 3). Diagnostic only. */
  leftoverApiUrls: string[];
}

/**
 * Rewrite brand-asset URLs in an HTML string so Chromium can load them from
 * the local filesystem when the page is served via a `file://` origin.
 *
 * Rewrites two URL families:
 *   - `/fluid-assets/...` → `file://{assetsDir}/...` (unconditional)
 *   - `/api/brand-assets/serve/{name}` → `file://{assetsDir}/{asset.file_path}`
 *     via DB lookup. If the name isn't in the DB, falls back to a transparent
 *     1x1 PNG data URL (and records the name in `unresolved`).
 *
 * After rewriting, scans for any remaining `/api/brand-assets/` URLs and
 * returns the first 3 as `leftoverApiUrls` so callers can log diagnostics —
 * leftovers indicate an unrewritten reference that will silently fail under
 * `file://` origin.
 *
 * Pure with respect to input (modulo the DB, which the tests swap via
 * FLUID_DB_PATH). Exported so it can be unit-tested without launching
 * Chromium.
 */
export function rewriteAssetUrls(html: string, assetsDir: string): RewriteAssetUrlsResult {
  const unresolved: string[] = [];

  // Rewrite /fluid-assets/ URLs to absolute file paths
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
      // Fallback: asset name doesn't exist in the DB. A direct file://
      // mapping to a missing path would fail silently under Chromium with
      // no useful signal; a transparent 1x1 PNG renders cleanly and is
      // visually equivalent to "mask absent" for mask-image/background-image
      // use cases. Log so the failure shows up in chat_events post-mortems.
      unresolved.push(rawName);
      logChatEvent('tool_error', {
        tool: 'render_preview',
        phase: 'asset_unresolvable',
        name: rawName,
      });
      return TRANSPARENT_PNG_DATA_URL;
    },
  );

  // Pre-flight scan: any /api/brand-assets/ URLs still in the HTML after
  // rewrite indicate the LLM produced a reference shape our rewriter
  // doesn't recognize. Diagnostic only — don't block rendering.
  let leftoverApiUrls: string[] = [];
  if (/\/api\/brand-assets\//.test(resolvedHtml)) {
    leftoverApiUrls = resolvedHtml.match(/\/api\/brand-assets[^"'\s)>]*/g)?.slice(0, 3) ?? [];
    logChatEvent('tool_error', {
      tool: 'render_preview',
      phase: 'unrewritten_api_url',
      html_excerpt: leftoverApiUrls,
    });
  }

  return { html: resolvedHtml, unresolved, leftoverApiUrls };
}

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

    const assetsDir = path.join(PROJECT_ROOT, 'assets');
    const { html: resolvedHtml } = rewriteAssetUrls(html, assetsDir);

    const tmpFile = path.join(os.tmpdir(), `fluid-render-${nanoid(10)}.html`);
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
