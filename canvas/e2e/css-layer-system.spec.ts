import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * E2E tests for the CSS layer system — validates archetype migration,
 * merge behavior, and pipeline pre-styling.
 * Requires canvas server running at localhost:5174.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHETYPES_DIR = path.resolve(__dirname, '../../archetypes');
const STYLES_DIR = path.resolve(__dirname, '../../styles');

// All archetype slugs
const ARCHETYPE_SLUGS = fs.readdirSync(ARCHETYPES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'components')
  .map(d => d.name)
  .filter(slug => {
    // Only include archetypes with both index.html and schema.json
    return fs.existsSync(path.join(ARCHETYPES_DIR, slug, 'index.html'))
      && fs.existsSync(path.join(ARCHETYPES_DIR, slug, 'schema.json'));
  });

test.describe('Archetype Migration Validation', () => {
  for (const slug of ARCHETYPE_SLUGS) {
    test(`${slug}: uses CSS custom properties (no hardcoded brand values)`, () => {
      const html = fs.readFileSync(
        path.join(ARCHETYPES_DIR, slug, 'index.html'),
        'utf-8'
      );

      // Extract only the <style> block for checking
      const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const css = styleMatch ? styleMatch[1] : '';

      // Should NOT have the global reset (moved to global.css)
      expect(css).not.toMatch(/\*\s*\{\s*box-sizing/);

      // Should NOT redefine .background-layer or .foreground-layer (moved to global.css)
      expect(css).not.toMatch(/\.background-layer\s*\{/);
      expect(css).not.toMatch(/\.foreground-layer\s*\{/);

      // Should NOT have font-family: sans-serif on body (now from global.css)
      const bodyMatch = css.match(/body\s*\{([^}]*)\}/);
      if (bodyMatch) {
        expect(bodyMatch[1]).not.toMatch(/font-family\s*:\s*sans-serif/);
        expect(bodyMatch[1]).not.toMatch(/overflow\s*:\s*hidden/);
      }

      // Should use CSS variables for text colors (at least one)
      expect(css).toMatch(/var\(--text-(primary|body|secondary|muted)\)/);

      // Body should still define width and height
      expect(css).toMatch(/body\s*\{[^}]*width:\s*\d+px/);
    });
  }
});

test.describe('System CSS Files', () => {
  test('global.css exists and contains required custom properties', () => {
    const globalCss = fs.readFileSync(
      path.join(STYLES_DIR, 'global.css'),
      'utf-8'
    );

    // Custom properties
    expect(globalCss).toContain('--brand-accent');
    expect(globalCss).toContain('--text-primary');
    expect(globalCss).toContain('--text-body');
    expect(globalCss).toContain('--text-secondary');
    expect(globalCss).toContain('--text-muted');
    expect(globalCss).toContain('--bg');
    expect(globalCss).toContain('--font-headline');
    expect(globalCss).toContain('--font-body');
    expect(globalCss).toContain('--font-accent');
    expect(globalCss).toContain('--headline-size');

    // Reset
    expect(globalCss).toContain('box-sizing: border-box');

    // Layers
    expect(globalCss).toContain('.background-layer');
    expect(globalCss).toContain('.foreground-layer');

    // Typography classes
    expect(globalCss).toContain('.headline');
    expect(globalCss).toContain('.eyebrow');
    expect(globalCss).toContain('.body-copy');
    expect(globalCss).toContain('.tagline');

    // Component classes
    expect(globalCss).toContain('.stat-card');
    expect(globalCss).toContain('.stat-number');
    expect(globalCss).toContain('.quote-block');
  });

  test('platform CSS files exist with correct dimensions', () => {
    const igCss = fs.readFileSync(
      path.join(STYLES_DIR, 'platforms', 'instagram.css'),
      'utf-8'
    );
    expect(igCss).toContain('width: 1080px');
    expect(igCss).toContain('height: 1080px');
    expect(igCss).toContain('--headline-size: 88px');

    const liCss = fs.readFileSync(
      path.join(STYLES_DIR, 'platforms', 'linkedin.css'),
      'utf-8'
    );
    expect(liCss).toContain('width: 1200px');
    expect(liCss).toContain('height: 627px');

    const opCss = fs.readFileSync(
      path.join(STYLES_DIR, 'platforms', 'one-pager.css'),
      'utf-8'
    );
    expect(opCss).toContain('width: 816px');
    expect(opCss).toContain('height: 1056px');
  });
});

test.describe('Brand Styles DB Seed', () => {
  test('global brand CSS contains Fluid @font-face and variables', async ({ request }) => {
    const res = await request.get('/api/brand-styles/global');
    expect(res.ok()).toBe(true);
    const style = await res.json();

    // @font-face declarations
    expect(style.cssContent).toContain("font-family: 'NeueHaas'");
    expect(style.cssContent).toContain("font-family: 'FLFont'");
    expect(style.cssContent).toContain('/api/brand-assets/serve/Inter-VariableFont');
    expect(style.cssContent).toContain('/api/brand-assets/serve/flfontbold');

    // CSS variables
    expect(style.cssContent).toContain("--font-headline: 'NeueHaas'");
    expect(style.cssContent).toContain("--font-body: 'NeueHaas'");
    expect(style.cssContent).toContain("--font-accent: 'FLFont'");
    expect(style.cssContent).toContain('--brand-accent: #42b1ff');
  });

  test('platform scopes exist (initially empty)', async ({ request }) => {
    for (const scope of ['instagram', 'linkedin', 'one-pager']) {
      const res = await request.get(`/api/brand-styles/${scope}`);
      expect(res.ok()).toBe(true);
      const style = await res.json();
      expect(style.scope).toBe(scope);
      // Platform scopes may be empty (no brand-specific platform overrides yet)
      expect(typeof style.cssContent).toBe('string');
    }
  });
});

test.describe('CSS Merge Integration', () => {
  test('system-styles API returns valid CSS for each scope', async ({ request }) => {
    const res = await request.get('/api/system-styles');
    expect(res.ok()).toBe(true);
    const styles = await res.json();

    // Each scope should contain valid CSS (at minimum a selector or comment)
    for (const scope of ['global', 'instagram', 'linkedin', 'one-pager']) {
      expect(styles[scope].length).toBeGreaterThan(0);
    }

    // Global should contain the full system
    expect(styles.global).toContain(':root');
    expect(styles.global).toContain('.headline');
  });
});
