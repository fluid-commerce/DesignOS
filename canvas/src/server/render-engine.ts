import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export async function ensureBrowser(): Promise<BrowserContext> {
  if (context) return context;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  return context;
}

export async function shutdownBrowser(): Promise<void> {
  if (context) { await context.close(); context = null; }
  if (browser) { await browser.close(); browser = null; }
}

export async function renderPreview(
  html: string,
  width: number,
  height: number
): Promise<string> {
  const ctx = await ensureBrowser();
  const page = await ctx.newPage();

  try {
    await page.setViewportSize({ width, height });

    // Rewrite /fluid-assets/ URLs to absolute file paths
    const assetsDir = path.join(PROJECT_ROOT, 'assets');
    const resolvedHtml = html.replace(
      /\/fluid-assets\//g,
      `file://${assetsDir}/`
    ).replace(
      /\/api\/brand-assets\/serve\//g,
      `file://${assetsDir}/`
    );

    // Write to temp file so file:// URLs resolve correctly
    const tmpFile = path.join(os.tmpdir(), `fluid-render-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, resolvedHtml, 'utf-8');

    await page.goto(`file://${tmpFile}`, { waitUntil: 'networkidle' });

    // Brief pause for fonts/images to load
    await page.waitForTimeout(200);

    const screenshot = await page.screenshot({ type: 'png' });
    const base64 = screenshot.toString('base64');

    fs.unlinkSync(tmpFile);
    return base64;
  } finally {
    await page.close();
  }
}
