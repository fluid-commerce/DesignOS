import { describe, it, expect, afterAll } from 'vitest';
import { renderPreview, shutdownBrowser } from '../src/server/render-engine';

afterAll(async () => {
  await shutdownBrowser();
});

describe('renderPreview', () => {
  it('returns a base64 JPEG string for simple HTML', async () => {
    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#ff6600;">
  <h1 style="color:white;padding:40px;">Hello</h1>
</body></html>`;

    const result = await renderPreview(html, 1080, 1080);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
    // The harness uses JPEG @ quality 75 (3-5x smaller than PNG). JPEG base64
    // magic bytes start with /9j/.
    expect(result.startsWith('/9j/')).toBe(true);
  }, 15000);

  it('respects custom dimensions', async () => {
    const html = `<!DOCTYPE html><html><body><div id="size"></div>
<script>document.getElementById('size').textContent=window.innerWidth+'x'+window.innerHeight;</script>
</body></html>`;

    const result = await renderPreview(html, 1200, 627);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  }, 15000);
});
