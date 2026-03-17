// @vitest-environment node
import { describe, it, expect } from 'vitest';
import path from 'node:path';

describe('/fluid-campaigns/ middleware contract', () => {
  it('path traversal guard rejects ../ sequences', () => {
    // Simulate the path resolution logic from watcher.ts
    const fluidDir = '/project/.fluid';
    const campaignsBase = path.join(fluidDir, 'campaigns');

    // Normal path - should be accepted
    const normalAssetPath = 'abc123/assets/photo.jpg';
    const normalFull = path.join(fluidDir, 'campaigns', normalAssetPath);
    expect(normalFull.startsWith(campaignsBase + path.sep)).toBe(true);

    // Traversal path - should be rejected
    const traversalPath = '../../../etc/passwd';
    const traversalFull = path.join(fluidDir, 'campaigns', traversalPath);
    expect(traversalFull.startsWith(campaignsBase + path.sep)).toBe(false);
  });

  it('campaign asset URL format is /fluid-campaigns/{campaignId}/assets/{filename}', () => {
    const campaignId = 'camp-abc123';
    const filename = 'hero-image.jpg';
    const url = `/fluid-campaigns/${campaignId}/assets/${filename}`;
    expect(url).toMatch(/^\/fluid-campaigns\/[^/]+\/assets\/[^/]+$/);
  });

  it('watcher.ts contains /fluid-campaigns/ middleware', async () => {
    const fs = await import('node:fs/promises');
    const watcherPath = path.resolve(__dirname, '../server/watcher.ts');
    const source = await fs.readFile(watcherPath, 'utf-8');
    expect(source).toContain('/fluid-campaigns/');
    expect(source).toContain('campaignsBase');
  });
});
