import { describe, it, expect } from 'vitest';
import {
  mergeCssLayers,
  extractStyleBlock,
  inlineResolvedCss,
  type MergeLayer,
} from '../server/css-merge';

describe('mergeCssLayers', () => {
  it('merges two layers — later overrides earlier per-property', () => {
    const layers: MergeLayer[] = [
      { label: 'base', css: ':root { --bg: #000; --accent: blue; }' },
      { label: 'brand', css: ':root { --accent: red; }' },
    ];
    const result = mergeCssLayers(layers);
    expect(result).toContain('--bg: #000');
    expect(result).toContain('--accent: red');
    expect(result).not.toContain('--accent: blue');
  });

  it('preserves @font-face rules from brand layer', () => {
    const layers: MergeLayer[] = [
      { label: 'global', css: 'body { color: white; }' },
      {
        label: 'brand',
        css: "@font-face { font-family: 'NeueHaas'; src: url('/fonts/neuehaas.woff2'); }",
      },
    ];
    const result = mergeCssLayers(layers);
    expect(result).toContain('@font-face');
    expect(result).toContain('NeueHaas');
    expect(result).toContain('color: white');
  });

  it('deduplicates identical @font-face rules', () => {
    const fontFace = "@font-face { font-family: 'Test'; src: url('/test.woff2'); }";
    const layers: MergeLayer[] = [
      { label: 'a', css: fontFace },
      { label: 'b', css: fontFace },
    ];
    const result = mergeCssLayers(layers);
    const matches = result.match(/@font-face/g);
    expect(matches?.length).toBe(1);
  });

  it('handles empty layers gracefully', () => {
    const layers: MergeLayer[] = [
      { label: 'empty', css: '' },
      { label: 'global', css: 'body { color: white; }' },
    ];
    const result = mergeCssLayers(layers);
    expect(result).toContain('color: white');
  });

  it('handles malformed CSS gracefully', () => {
    const layers: MergeLayer[] = [
      { label: 'bad', css: 'this is not { valid css !!!}}}' },
      { label: 'good', css: 'body { color: red; }' },
    ];
    // Should not throw
    const result = mergeCssLayers(layers);
    expect(result).toContain('color: red');
  });

  it('preserves selector order from first appearance', () => {
    const layers: MergeLayer[] = [
      { label: 'a', css: '.headline { color: white; } .body { color: gray; }' },
      { label: 'b', css: '.headline { font-size: 24px; }' },
    ];
    const result = mergeCssLayers(layers);
    const headlineIndex = result.indexOf('.headline');
    const bodyIndex = result.indexOf('.body');
    expect(headlineIndex).toBeLessThan(bodyIndex);
  });

  it('system defaults + platform + brand produces correct cascade', () => {
    const layers: MergeLayer[] = [
      { label: 'global', css: ':root { --headline-size: 72px; --body-size: 18px; }' },
      { label: 'instagram', css: ':root { --headline-size: 88px; }' },
      { label: 'brand', css: ':root { --font-headline: "NeueHaas", sans-serif; }' },
    ];
    const result = mergeCssLayers(layers);
    expect(result).toContain('--headline-size: 88px');
    expect(result).toContain('--body-size: 18px');
    // css-tree may format with or without space after comma — check key values
    expect(result).toContain('--font-headline:');
    expect(result).toContain('NeueHaas');
  });

  it('respects !important in earlier layers', () => {
    const layers: MergeLayer[] = [
      { label: 'base', css: 'body { color: white !important; }' },
      { label: 'override', css: 'body { color: red; }' },
    ];
    const result = mergeCssLayers(layers);
    expect(result).toContain('color: white !important');
    expect(result).not.toContain('color: red');
  });
});

describe('extractStyleBlock', () => {
  it('extracts CSS from a style tag', () => {
    const html = '<html><head><style>body { color: red; }</style></head></html>';
    expect(extractStyleBlock(html)).toBe('body { color: red; }');
  });

  it('returns empty string when no style tag exists', () => {
    expect(extractStyleBlock('<html><body>Hi</body></html>')).toBe('');
  });
});

describe('inlineResolvedCss', () => {
  it('replaces existing style block', () => {
    const html = '<html><head><style>old</style></head><body></body></html>';
    const result = inlineResolvedCss(html, 'new { color: red; }');
    expect(result).toContain('new { color: red; }');
    expect(result).not.toContain('old');
  });

  it('inserts style before </head> when no style exists', () => {
    const html = '<html><head><meta charset="UTF-8"/></head><body></body></html>';
    const result = inlineResolvedCss(html, 'body { color: red; }');
    expect(result).toContain('<style>');
    expect(result).toContain('body { color: red; }');
  });

  it('preserves inline style attributes', () => {
    const html =
      '<html><head><style>old</style></head><body><div style="position:absolute;left:10px">Hi</div></body></html>';
    const result = inlineResolvedCss(html, 'body { color: red; }');
    expect(result).toContain('style="position:absolute;left:10px"');
  });
});
