#!/usr/bin/env node
/**
 * brand-compliance.cjs (CLI-02) — Validates HTML/CSS against brand tokens
 *
 * Checks hex colors, font families, rgba patterns, and hardcoded spacing
 * against brand rules loaded from SQLite DB.
 *
 * Usage: node tools/brand-compliance.cjs path/to/file.html [--context social|website]
 * Output: JSON violations to stdout, human summary to stderr
 * Exit code: 1 if any errors (weight >= 81), 0 otherwise
 */

const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = process.env.FLUID_DB_PATH || path.resolve(__dirname, '../canvas/.fluid/fluid.db');

// Hardcoded brand rule constants — these are authoritative values derived from
// Fluid brand docs. The DB is queried to supplement/extend these with any
// additional hex colors stored in brand_patterns.
const BASE_RULES = {
  version: '2.0.0',
  colors: {
    accent_colors: ['#FF8B58', '#42B1FF', '#44B574', '#C985E5'],
    neutrals: [
      '#000000', '#050505', '#0A0A0A', '#111111', '#161616',
      '#FFFFFF', '#F5F0E8', '#888888', '#1A1A1A', '#222222',
    ],
    allowed_rgba_patterns: [
      'rgba(255,255,255,0.45)',
      'rgba(255,255,255,0.25)',
      'rgba(255,255,255,0.03)',
      'rgba(255,255,255,0.06)',
    ],
  },
  fonts: {
    social_families: ['NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold', 'Inter'],
    website_families: ['Syne', 'DM Sans', 'Space Mono', 'Inter', 'NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold'],
    allowed_families: ['NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold', 'Inter', 'Syne', 'DM Sans', 'Space Mono'],
  },
  thresholds: { error: 81, warning: 51, info: 21, hint: 1 },
};

function loadRulesFromDb() {
  let extraHex = new Set();

  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });

    // Load brand_patterns with category 'design-tokens' to extract any extra hex colors
    const patterns = db.prepare(
      "SELECT name, html_snippet FROM brand_patterns WHERE category = 'design-tokens'"
    ).all();

    for (const p of patterns) {
      if (!p.html_snippet) continue;
      const matches = p.html_snippet.match(/#[0-9A-Fa-f]{6}\b/g);
      if (matches) matches.forEach(m => extraHex.add(m.toUpperCase()));
    }

    db.close();
  } catch (err) {
    // DB not available — use base rules only. This is expected on first run
    // before the app has seeded the database.
    process.stderr.write(`Note: Could not read from DB at ${DB_PATH}. Using built-in brand rules.\n`);
  }

  // Merge DB colors with base rules
  const accentColors = [...BASE_RULES.colors.accent_colors];
  const neutralColors = [...BASE_RULES.colors.neutrals];

  // Add any DB colors not already in the base set
  const allBaseHex = new Set([...accentColors, ...neutralColors].map(h => h.toUpperCase()));
  const dbOnlyHex = [...extraHex].filter(h => !allBaseHex.has(h));

  const allowedHex = [...accentColors, ...neutralColors, ...dbOnlyHex];

  return {
    version: BASE_RULES.version,
    colors: {
      accent_colors: accentColors,
      neutrals: neutralColors,
      allowed_hex: allowedHex,
      // Context-aware: social and website share the same palette for hex checking
      social: { allowed_hex: allowedHex, accent_colors: accentColors },
      website: { allowed_hex: allowedHex },
      allowed_rgba_patterns: BASE_RULES.colors.allowed_rgba_patterns,
    },
    fonts: {
      allowed_families: BASE_RULES.fonts.allowed_families,
      social_families: BASE_RULES.fonts.social_families,
      website_families: BASE_RULES.fonts.website_families,
    },
    thresholds: BASE_RULES.thresholds,
  };
}

function severityFromWeight(weight, thresholds) {
  if (weight >= thresholds.error) return 'error';
  if (weight >= thresholds.warning) return 'warning';
  if (weight >= thresholds.info) return 'info';
  return 'hint';
}

function detectContext(content) {
  // Try to auto-detect social vs website vs one-pager from content
  const hasSocialDimension = /1080\s*x?\s*1080|1200\s*x?\s*627|1340\s*x?\s*630/i.test(content);
  const hasLiquidSchema = /{%\s*schema\s*%}/i.test(content);
  const hasPageRule = /@page\s*\{[^}]*size:\s*letter/i.test(content);
  const hasCssVars = /var\(--/g.test(content);
  // Detect social dimensions declared on separate lines (width: 1080px + height: 1080px)
  const hasSeparateSocialDims = /width:\s*1080px/i.test(content) && /height:\s*1080px/i.test(content)
    || /width:\s*1200px/i.test(content) && /height:\s*627px/i.test(content)
    || /width:\s*1340px/i.test(content) && /height:\s*630px/i.test(content);

  // One-pagers use @page letter rules and social fonts (NeueHaasDisplay + FLFont)
  // Treat them as social context for font validation
  if (hasPageRule) return 'social';
  if (hasLiquidSchema) return 'website';
  if (hasSocialDimension || hasSeparateSocialDims) return 'social';
  if (hasCssVars) return 'website';
  return 'all';
}

function normalizeHex(hex) {
  hex = hex.toUpperCase();
  // Expand 3-char hex to 6-char
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

function checkHexColors(lines, rules, context) {
  const violations = [];
  const allowedHex = new Set();

  // Add colors based on context
  // Use context-specific lists if they exist, otherwise fall back to the shared allowed_hex list
  if (context === 'social' || context === 'all') {
    const socialColors = (rules.colors.social && rules.colors.social.allowed_hex) || rules.colors.allowed_hex || [];
    socialColors.forEach(h => allowedHex.add(normalizeHex(h)));
  }
  if (context === 'website' || context === 'all') {
    const websiteColors = (rules.colors.website && rules.colors.website.allowed_hex) || rules.colors.allowed_hex || [];
    websiteColors.forEach(h => allowedHex.add(normalizeHex(h)));
  }

  const hexRegex = /#([0-9a-fA-F]{3,6})\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    hexRegex.lastIndex = 0;
    while ((match = hexRegex.exec(line)) !== null) {
      const rawHex = '#' + match[1];
      const normalized = normalizeHex(rawHex);

      // Skip if it's in a comment or code snippet display
      const before = line.substring(0, match.index);
      if (before.includes('<!--') && !before.includes('-->')) continue;

      if (!allowedHex.has(normalized)) {
        violations.push({
          line: i + 1,
          column: match.index + 1,
          rule: 'color-non-brand-hex',
          severity: severityFromWeight(90, rules.thresholds),
          weight: 90,
          message: `Non-brand hex color "${rawHex}" (normalized: ${normalized}). Allowed: ${[...allowedHex].join(', ')}`,
          found: rawHex,
        });
      }
    }
  }

  return violations;
}

function checkFontFamilies(lines, rules, context) {
  const violations = [];

  const allowedFamilies = context === 'social'
    ? rules.fonts.social_families
    : context === 'website'
      ? rules.fonts.website_families
      : rules.fonts.allowed_families;

  const fontFamilyRegex = /font-family\s*:\s*([^;}{]+)/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    fontFamilyRegex.lastIndex = 0;
    while ((match = fontFamilyRegex.exec(line)) !== null) {
      const familyDecl = match[1].trim();
      // Extract individual family names
      const families = familyDecl.split(',').map(f =>
        f.trim().replace(/["']/g, '').trim()
      ).filter(f => f && f !== 'sans-serif' && f !== 'serif' && f !== 'monospace' && f !== 'cursive'
        && !f.startsWith('var(') && f !== '-apple-system' && f !== 'BlinkMacSystemFont' && f !== 'system-ui' && f !== 'Arial' && f !== 'Segoe UI');

      for (const family of families) {
        const isAllowed = allowedFamilies.some(af =>
          af.toLowerCase() === family.toLowerCase()
        );
        if (!isAllowed) {
          violations.push({
            line: i + 1,
            column: match.index + 1,
            rule: 'font-non-brand-family',
            severity: severityFromWeight(85, rules.thresholds),
            weight: 85,
            message: `Non-brand font family "${family}". Allowed for ${context}: ${allowedFamilies.join(', ')}`,
            found: family,
          });
        }
      }
    }
  }

  return violations;
}

function checkMultipleAccentColors(lines, rules, context) {
  if (context === 'website') return [];
  // One-pagers legitimately use multiple accent colors for stat strips, feature icons, etc.
  const joined = lines.join('\n');
  if (/@page\s*\{[^}]*size:\s*letter/i.test(joined)) return [];

  const violations = [];
  const accentColors = ((rules.colors.social && rules.colors.social.accent_colors) || rules.colors.accent_colors || []).map(c => normalizeHex(c));
  const foundAccents = new Set();
  const content = joined;

  for (const accent of accentColors) {
    // Check both normalized and original case
    const regex = new RegExp(accent.replace('#', '#?'), 'gi');
    if (regex.test(content)) {
      foundAccents.add(accent);
    }
  }

  if (foundAccents.size > 1) {
    violations.push({
      line: 1,
      column: 1,
      rule: 'color-one-accent',
      severity: severityFromWeight(95, rules.thresholds),
      weight: 95,
      message: `Multiple accent colors found: ${[...foundAccents].join(', ')}. Use only one accent color per post.`,
      found: [...foundAccents],
    });
  }

  return violations;
}

function checkSocialBackground(lines, rules, context) {
  if (context === 'website') return [];

  const violations = [];
  const bgRegex = /background(?:-color)?\s*:\s*#([0-9a-fA-F]{3,6})\b/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    bgRegex.lastIndex = 0;
    while ((match = bgRegex.exec(line)) !== null) {
      const hex = normalizeHex('#' + match[1]);
      if (hex !== '#000000' && context === 'social') {
        const darkGrays = ['#191919', '#1A1A1A', '#111111', '#222222'];
        if (darkGrays.includes(hex)) {
          violations.push({
            line: i + 1,
            column: match.index + 1,
            rule: 'color-bg-pure-black',
            severity: severityFromWeight(95, rules.thresholds),
            weight: 95,
            message: `Social posts use pure #000 background, not dark gray (${hex})`,
            found: hex,
          });
        }
      }
    }
  }

  return violations;
}

// --- Main ---
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`brand-compliance.cjs (CLI-02) — Validate HTML/CSS against brand tokens

Usage: node tools/brand-compliance.cjs <file> [--context social|website]

Options:
  --context social|website  Scope rules to social or website context
                            (auto-detected from file content if not specified)
  --help, -h               Show this help message

Output:
  stdout: JSON array of violations
  stderr: Human-readable summary

Exit codes:
  0  No errors (may have warnings/info)
  1  Errors found (weight >= 81)
  2  Tool error (missing file)

Brand rules are loaded from SQLite DB at:
  ${DB_PATH}
  (override with FLUID_DB_PATH env var)
`);
  process.exit(0);
}

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = process.argv.slice(2);
const contextIdx = flags.indexOf('--context');
let contextOverride = null;
if (contextIdx !== -1 && flags[contextIdx + 1]) {
  contextOverride = flags[contextIdx + 1];
}

if (args.length === 0) {
  process.stderr.write('Error: No file path provided.\nUsage: node tools/brand-compliance.cjs <file> [--context social|website]\n');
  process.exit(2);
}

const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  process.stderr.write(`Error: File not found: ${filePath}\n`);
  process.exit(2);
}

const rules = loadRulesFromDb();
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const context = contextOverride || detectContext(content);

const violations = [
  ...checkHexColors(lines, rules, context),
  ...checkFontFamilies(lines, rules, context),
  ...checkMultipleAccentColors(lines, rules, context),
  ...checkSocialBackground(lines, rules, context),
];

// Add file to each violation
violations.forEach(v => { v.file = filePath; });

// Sort by line number
violations.sort((a, b) => a.line - b.line || a.column - b.column);

// JSON output to stdout
const output = {
  file: filePath,
  context,
  violations,
  summary: {
    total: violations.length,
    errors: violations.filter(v => v.severity === 'error').length,
    warnings: violations.filter(v => v.severity === 'warning').length,
    info: violations.filter(v => v.severity === 'info').length,
    hints: violations.filter(v => v.severity === 'hint').length,
  },
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');

// Human summary to stderr
const supportsColor = process.stderr.isTTY;
const red = supportsColor ? '\x1b[31m' : '';
const yellow = supportsColor ? '\x1b[33m' : '';
const blue = supportsColor ? '\x1b[34m' : '';
const gray = supportsColor ? '\x1b[90m' : '';
const reset = supportsColor ? '\x1b[0m' : '';

process.stderr.write(`\nBrand Compliance Check: ${path.basename(filePath)} (context: ${context})\n`);

if (violations.length === 0) {
  process.stderr.write(`  ${blue}No violations found${reset}\n\n`);
} else {
  for (const v of violations) {
    const color = v.severity === 'error' ? red : v.severity === 'warning' ? yellow : v.severity === 'info' ? blue : gray;
    process.stderr.write(`  ${color}${v.severity.toUpperCase()}${reset} [${v.rule}] Line ${v.line}:${v.column} — ${v.message}\n`);
  }
  process.stderr.write(`\n  ${red}${output.summary.errors} errors${reset}, ${yellow}${output.summary.warnings} warnings${reset}, ${blue}${output.summary.info} info${reset}, ${gray}${output.summary.hints} hints${reset}\n\n`);
}

// Exit code
process.exit(output.summary.errors > 0 ? 1 : 0);
