#!/usr/bin/env node
/**
 * compile-rules.cjs — Compiles brand docs into rules.json
 *
 * Reads brand/*.md files and extracts machine-checkable rules
 * into a structured JSON file for CLI validation tools.
 *
 * Usage: node tools/compile-rules.cjs
 * Output: tools/rules.json
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const fs = require('node:fs');
const path = require('node:path');

const BRAND_DIR = path.resolve(__dirname, '..', 'brand');
const OUTPUT_PATH = path.resolve(__dirname, 'rules.json');

function readBrandDoc(filename) {
  const filepath = path.join(BRAND_DIR, filename);
  if (!fs.existsSync(filepath)) {
    process.stderr.write(`Warning: ${filename} not found at ${filepath}\n`);
    return '';
  }
  return fs.readFileSync(filepath, 'utf-8');
}

function extractHexColors(text) {
  const hexes = new Set();
  const matches = text.matchAll(/#([0-9a-fA-F]{3,8})\b/g);
  for (const m of matches) {
    const hex = '#' + m[1];
    // Only collect 3 or 6 char hex (standard color codes)
    if (hex.length === 4 || hex.length === 7) {
      hexes.add(hex.toUpperCase());
    }
  }
  return [...hexes];
}

function compileRules() {
  const designTokens = readBrandDoc('design-tokens.md');
  const socialSpecs = readBrandDoc('social-post-specs.md');
  const websiteSpecs = readBrandDoc('website-section-specs.md');
  const assetUsage = readBrandDoc('asset-usage.md');

  // --- Colors ---
  const socialAccentColors = ['#FF8B58', '#42B1FF', '#44B574', '#C985E5'];
  const socialAllowedHex = [
    '#000000', '#FFFFFF',
    ...socialAccentColors,
  ];

  const websiteAllowedHex = [
    '#050505', '#0A0A0A', '#111111', '#161616',
    '#F5F0E8',
    '#FF5500', '#00AAFF', '#00E87A',
    '#888888',
    '#1A1A1A', '#222222',
    '#000000', '#FFFFFF',
  ];

  const allowedRgbaPatterns = [
    'rgba(255,255,255,0.45)',
    'rgba(255,255,255,0.25)',
    'rgba(255,255,255,0.03)',
    'rgba(255,255,255,0.06)',
  ];

  const colorRules = [
    {
      id: 'color-bg-pure-black',
      pattern: 'background[^:]*:\\s*#(191919|1a1a1a|111|222)',
      message: 'Social posts use pure #000 background, not dark gray',
      weight: 95,
      context: 'social'
    },
    {
      id: 'color-one-accent',
      pattern: null,
      message: 'Use only one accent color per post — never mix accent colors within a single design',
      weight: 95,
      context: 'social',
      check: 'multi-accent'
    },
    {
      id: 'color-text-primary-white',
      pattern: null,
      message: 'Primary text color must be #ffffff on social posts',
      weight: 90,
      context: 'social'
    },
  ];

  // --- Fonts ---
  const allowedFamilies = [
    'NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold', 'Inter',
    'Syne', 'DM Sans', 'Space Mono',
  ];

  const socialFontFamilies = ['NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold', 'Inter'];
  const websiteFontFamilies = ['Syne', 'DM Sans', 'Space Mono', 'Inter'];

  const fontRules = [
    {
      id: 'font-social-only',
      pattern: null,
      message: 'Social posts should use NeueHaasDisplay + FLFont. Do not use website fonts (Syne, DM Sans, Space Mono) in social posts.',
      weight: 85,
      context: 'social'
    },
    {
      id: 'font-website-only',
      pattern: null,
      message: 'Website sections should use Syne + DM Sans + Space Mono. Do not use social fonts (NeueHaasDisplay) in website sections.',
      weight: 85,
      context: 'website'
    },
    {
      id: 'font-flfont-tagline-only',
      pattern: null,
      message: 'FLFont Bold is for taglines and emphasis only. Never use for body copy or headlines.',
      weight: 90,
      context: 'all'
    },
  ];

  // --- Spacing ---
  const spacingRules = [
    {
      id: 'spacing-ig-footer',
      pattern: null,
      message: 'Instagram footer padding should be 22px 68px',
      weight: 85,
      context: 'social',
      expected: 'padding: 22px 68px'
    },
    {
      id: 'spacing-li-footer',
      pattern: null,
      message: 'LinkedIn footer padding should be 18px 72px',
      weight: 85,
      context: 'social',
      expected: 'padding: 18px 72px'
    },
    {
      id: 'spacing-no-hardcode-website',
      pattern: null,
      message: 'Website sections must not hard-code pixel spacing — use var(--space-*) CSS variables',
      weight: 100,
      context: 'website'
    },
  ];

  // --- Schema (Gold Standard counts) ---
  const schema = {
    font_size_count: 13,
    font_size_options: [
      'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
      'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
      'text-7xl', 'text-8xl', 'text-9xl',
    ],
    color_count: 13,
    color_options: [
      'text-primary', 'text-secondary', 'text-tertiary', 'text-accent',
      'text-accent-secondary', 'text-white', 'text-black',
      'text-success', 'text-warning', 'text-error', 'text-info',
      'text-muted', 'text-inherit',
    ],
    weight_count: 5,
    weight_options: ['light', 'normal', 'medium', 'semibold', 'bold'],
    font_family_count: 4,
    font_family_options: ['primary', 'body', 'handwritten', 'serif'],
    button_settings: ['show', 'text', 'url', 'style', 'color', 'size', 'weight'],
    button_style_options: ['filled', 'outline', 'ghost'],
    button_color_count: 10,
    button_size_options: ['btn-xs', 'btn-sm', 'btn-md', 'btn-lg', 'btn-xl'],
    section_settings: [
      'background_color', 'background_image',
      'section_padding_y_mobile', 'section_padding_y_desktop',
      'section_border_radius',
    ],
    section_padding_options: ['py-xs', 'py-sm', 'py-md', 'py-lg', 'py-xl', 'py-2xl', 'py-3xl'],
    section_radius_options: [
      'rounded-none', 'rounded-sm', 'rounded', 'rounded-md',
      'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl',
    ],
    container_settings: [
      'container_background_color', 'container_background_image',
      'container_border_radius',
      'container_padding_y_mobile', 'container_padding_y_desktop',
      'container_padding_x_mobile', 'container_padding_x_desktop',
    ],
  };

  // --- Dimensions ---
  const dimensions = {
    instagram: { width: 1080, height: 1080 },
    linkedin_landscape: { width: 1200, height: 627 },
    linkedin_tall: { width: 1340, height: 630 },
  };

  // --- Opacity ---
  const opacity = {
    brushstrokes: { min: 0.10, max: 0.25, weight: 90 },
    circle_sketches: { min: 0.5, max: 0.7, weight: 85 },
    side_labels: { value: 0.35, weight: 70 },
    slide_numbers: { value: 0.40, weight: 70 },
    ghost_text: { min: 0.04, max: 0.06, weight: 65 },
  };

  // --- Thresholds ---
  const thresholds = {
    error: 81,
    warning: 51,
    info: 21,
    hint: 1,
  };

  // --- Assemble ---
  const rules = {
    version: '1.0.0',
    compiled: new Date().toISOString(),
    colors: {
      social: {
        allowed_hex: socialAllowedHex,
        accent_colors: socialAccentColors,
        background: '#000000',
      },
      website: {
        allowed_hex: websiteAllowedHex,
      },
      allowed_rgba_patterns: allowedRgbaPatterns,
      rules: colorRules,
    },
    fonts: {
      allowed_families: allowedFamilies,
      social_families: socialFontFamilies,
      website_families: websiteFontFamilies,
      rules: fontRules,
    },
    spacing: {
      rules: spacingRules,
    },
    schema,
    dimensions,
    opacity,
    thresholds,
  };

  return rules;
}

// --- Main ---
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`compile-rules.cjs — Compile brand docs into rules.json

Usage: node tools/compile-rules.cjs

Reads brand/*.md files and extracts machine-checkable rules into tools/rules.json.
No arguments required. Reads from brand/ directory relative to script location.
`);
  process.exit(0);
}

const rules = compileRules();

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(rules, null, 2) + '\n', 'utf-8');

const summary = {
  status: 'compiled',
  output: OUTPUT_PATH,
  version: rules.version,
  compiled: rules.compiled,
  stats: {
    color_rules: rules.colors.rules.length,
    font_rules: rules.fonts.rules.length,
    spacing_rules: rules.spacing.rules.length,
    social_hex_count: rules.colors.social.allowed_hex.length,
    website_hex_count: rules.colors.website.allowed_hex.length,
    dimensions: Object.keys(rules.dimensions).length,
  },
};

// JSON to stdout
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

// Human summary to stderr
process.stderr.write(`\nRules compiled successfully\n`);
process.stderr.write(`  Version: ${rules.version}\n`);
process.stderr.write(`  Output: ${OUTPUT_PATH}\n`);
process.stderr.write(`  Color rules: ${summary.stats.color_rules}\n`);
process.stderr.write(`  Font rules: ${summary.stats.font_rules}\n`);
process.stderr.write(`  Spacing rules: ${summary.stats.spacing_rules}\n`);
process.stderr.write(`  Social hex colors: ${summary.stats.social_hex_count}\n`);
process.stderr.write(`  Website hex colors: ${summary.stats.website_hex_count}\n`);
process.stderr.write(`  Dimension targets: ${summary.stats.dimensions}\n`);
process.stderr.write(`\n`);
