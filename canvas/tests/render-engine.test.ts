import { describe, it, expect, afterAll } from 'vitest';
import { renderPreview, shutdownBrowser } from '../src/server/render-engine';

afterAll(async () => {
  await shutdownBrowser();
});

describe('renderPreview', () => {
  it('returns a base64 PNG string for simple HTML', async () => {
    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#ff6600;">
  <h1 style="color:white;padding:40px;">Hello</h1>
</body></html>`;

    const result = await renderPreview(html, 1080, 1080);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
    // PNG magic bytes in base64 start with iVBOR
    expect(result.startsWith('iVBOR')).toBe(true);
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
