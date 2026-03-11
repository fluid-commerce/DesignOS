import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

// We test the handler logic extracted into a helper, not the full Vite plugin
// Import the helper functions that will be added to watcher.ts
import { discoverTemplates, serveFluidAsset } from '../server/watcher';

vi.mock('node:fs/promises');

describe('GET /api/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns JSON array of TemplateInfo objects', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    // Mock social dir
    mockReaddir.mockImplementation(async (dirPath: any) => {
      const p = String(dirPath);
      if (p.includes('social')) return ['problem-first.html'] as any;
      if (p.includes('one-pagers')) return ['case-study.html'] as any;
      return [];
    });

    mockReadFile.mockImplementation(async (filePath: any) => {
      return '<div>Template HTML</div>';
    });

    const templates = await discoverTemplates('/fake/root');
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBe(2);
    expect(templates[0]).toMatchObject({
      id: 'problem-first',
      name: 'Problem First',
      category: 'social',
      dimensions: { width: 1080, height: 1080 },
    });
    expect(templates[1]).toMatchObject({
      id: 'case-study',
      name: 'Case Study',
      category: 'one-pager',
      dimensions: { width: 816, height: 1056 },
    });
  });

  it('social templates have dimensions {1080, 1080}', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
      const p = String(dirPath);
      if (p.includes('social')) return ['stat-proof.html'] as any;
      if (p.includes('one-pagers')) return [] as any;
      return [];
    });
    vi.mocked(fs.readFile).mockResolvedValue('<div>social</div>');

    const templates = await discoverTemplates('/fake/root');
    expect(templates[0].dimensions).toEqual({ width: 1080, height: 1080 });
  });

  it('one-pager templates have dimensions {816, 1056}', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
      const p = String(dirPath);
      if (p.includes('social')) return [] as any;
      if (p.includes('one-pagers')) return ['company-overview.html'] as any;
      return [];
    });
    vi.mocked(fs.readFile).mockResolvedValue('<div>one-pager</div>');

    const templates = await discoverTemplates('/fake/root');
    expect(templates[0].dimensions).toEqual({ width: 816, height: 1056 });
  });

  it('excludes index.html files from template listing', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
      const p = String(dirPath);
      if (p.includes('social')) return ['index.html', 'quote.html'] as any;
      if (p.includes('one-pagers')) return ['index.html'] as any;
      return [];
    });
    vi.mocked(fs.readFile).mockResolvedValue('<div>tmpl</div>');

    const templates = await discoverTemplates('/fake/root');
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe('quote');
  });

  it('rewrites asset paths from ../../assets/ to /fluid-assets/', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
      const p = String(dirPath);
      if (p.includes('social')) return ['test.html'] as any;
      if (p.includes('one-pagers')) return [] as any;
      return [];
    });
    vi.mocked(fs.readFile).mockResolvedValue(
      '<img src="../../assets/logos/logo.svg"><link href="../../assets/fonts/font.woff2">'
    );

    const templates = await discoverTemplates('/fake/root');
    expect(templates[0].html).toContain('/fluid-assets/logos/logo.svg');
    expect(templates[0].html).toContain('/fluid-assets/fonts/font.woff2');
    expect(templates[0].html).not.toContain('../../assets/');
  });
});

describe('GET /fluid-assets/', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves SVG with correct content-type', async () => {
    const result = serveFluidAsset('logo.svg');
    expect(result.contentType).toBe('image/svg+xml');
  });

  it('serves PNG with correct content-type', async () => {
    const result = serveFluidAsset('photo.png');
    expect(result.contentType).toBe('image/png');
  });

  it('serves WOFF2 with correct content-type', async () => {
    const result = serveFluidAsset('font.woff2');
    expect(result.contentType).toBe('font/woff2');
  });

  it('serves JPG with correct content-type', async () => {
    const result = serveFluidAsset('photo.jpg');
    expect(result.contentType).toBe('image/jpeg');
  });
});
