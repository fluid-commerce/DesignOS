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
    social_families: ['NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold'],
    website_families: ['Syne', 'DM Sans', 'Space Mono', 'Inter', 'NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold'],
    allowed_families: ['NeueHaasDisplay', 'NeueHaas', 'FLFont', 'flfontbold', 'Inter', 'Syne', 'DM Sans', 'Space Mono'],
  },
  thresholds: { error: 81, warning: 51, info: 21, hint: 1 },
};

function loadRulesFromDb() {
  let extraHex = new Set();
  let dbFontNames = [];

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

    // Load font names from brand_assets to build dynamic allowlist
    try {
      const fontAssets = db.prepare(
        "SELECT name FROM brand_assets WHERE category = 'fonts' AND (dam_deleted = 0 OR dam_deleted IS NULL)"
      ).all();
      dbFontNames = fontAssets.map(a => a.name);
    } catch { /* fallback to hardcoded list */ }

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
      // DB font names extend the hardcoded base (not replace) — DB asset names
      // like "Inter-VariableFont" don't match CSS font-family names, and primary
      // brand fonts (NeueHaasDisplay) may not be in brand_assets at all.
      allowed_families: [...new Set([...BASE_RULES.fonts.allowed_families, ...dbFontNames])],
      social_families: [...new Set([...BASE_RULES.fonts.social_families, ...dbFontNames])],
      website_families: [...new Set([...BASE_RULES.fonts.website_families, ...dbFontNames])],
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

function checkInlineStyles(lines, rules, context) {
  const violations = [];
  let insideStyleBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<style[\s>]/i.test(line)) insideStyleBlock = true;
    if (/<\/style>/i.test(line)) { insideStyleBlock = false; continue; }
    if (insideStyleBlock) continue;
    if (/(?<![a-zA-Z-])style\s*=\s*["'][^"']+["']/i.test(line)) {
      violations.push({
        line: i + 1, column: 1,
        rule: 'style-no-inline',
        severity: severityFromWeight(90, rules.thresholds),
        weight: 90,
        message: 'Inline style attribute found. All styling must be in <style> blocks using CSS classes.',
        found: line.trim().slice(0, 80),
      });
    }
  }
  return violations;
}

function checkDecorativeImgTags(lines, rules, context) {
  const violations = [];
  const decorativeClassPattern = /brush|texture|decorative|circle|sketch|overlay/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const imgMatches = line.matchAll(/<img\b[^>]*>/gi);
    for (const m of imgMatches) {
      const tag = m[0];
      const hasEmptyAlt = /alt\s*=\s*["']\s*["']/i.test(tag);
      const hasNoAlt = !/alt\s*=/i.test(tag);
      const hasDecorativeClass = decorativeClassPattern.test(tag);
      if (hasEmptyAlt || hasNoAlt || hasDecorativeClass) {
        violations.push({
          line: i + 1, column: m.index + 1,
          rule: 'img-no-decorative',
          severity: severityFromWeight(85, rules.thresholds),
          weight: 85,
          message: 'Decorative element uses <img> tag. Use <div> with background-image + background-size: contain instead.',
          found: tag.slice(0, 100),
        });
      }
    }
  }
  return violations;
}

function checkHeadlineLetterSpacing(lines, rules, context) {
  const violations = [];
  const joined = lines.join('\n');
  // Find CSS rules for headline-like classes
  const ruleRegex = /\.(headline|title|heading|hero-text|main-text)[^{]*\{[^}]*letter-spacing\s*:\s*([^;}\s]+)/gi;
  let match;
  while ((match = ruleRegex.exec(joined)) !== null) {
    const value = match[2].trim();
    const numericValue = parseFloat(value);
    // Flag if letter-spacing is positive or zero (should be negative like -0.03em)
    if (!isNaN(numericValue) && numericValue >= 0) {
      // Find line number
      const beforeMatch = joined.slice(0, match.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
      violations.push({
        line: lineNum, column: 1,
        rule: 'typography-headline-letter-spacing',
        severity: severityFromWeight(85, rules.thresholds),
        weight: 85,
        message: `Headline letter-spacing should be negative (e.g., -0.03em). Found: ${value}`,
        found: value,
      });
    }
  }
  return violations;
}

function checkTitleTag(lines, rules, context) {
  const joined = lines.join('\n');
  if (/<title[^>]*>.*<\/title>/is.test(joined)) return [];
  return [{
    line: 1, column: 1,
    rule: 'html-title-missing',
    severity: severityFromWeight(70, rules.thresholds),
    weight: 70,
    message: 'HTML document is missing a <title> tag.',
    found: null,
  }];
}

function checkMinimumElementGap(lines, rules, context) {
  const violations = [];
  const joined = lines.join('\n');
  // Extract top: Npx values from CSS rules targeting text-like elements
  const topRegex = /\.(headline|title|body|subtext|tagline|text|copy|description)[^{]*\{[^}]*top\s*:\s*(\d+)px/gi;
  const tops = [];
  let match;
  while ((match = topRegex.exec(joined)) !== null) {
    const beforeMatch = joined.slice(0, match.index);
    const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
    tops.push({ className: match[1], top: parseInt(match[2]), line: lineNum });
  }
  tops.sort((a, b) => a.top - b.top);
  for (let i = 1; i < tops.length; i++) {
    const gap = tops[i].top - tops[i - 1].top;
    if (gap > 0 && gap < 20) {
      violations.push({
        line: tops[i].line, column: 1,
        rule: 'layout-minimum-gap',
        severity: severityFromWeight(65, rules.thresholds),
        weight: 65,
        message: `Text elements .${tops[i - 1].className} and .${tops[i].className} are only ${gap}px apart (minimum: 20px).`,
        found: `${gap}px`,
      });
    }
  }
  return violations;
}

function checkMultilingualAccents(lines, rules, context) {
  const violations = [];
  // Common words where accents are frequently dropped in uppercase
  const accentPairs = [
    [/\bTECNOLOGIA\b/, 'TECNOLOGIA', 'TECNOLOGIA (should be TECNOLOGIA with accent if applicable)'],
    [/\bCAFE\b(?![\w-])/, 'CAFE', 'CAFE (should be CAFE with accent if applicable)'],
    [/\bRESUME\b/, 'RESUME', 'RESUME (should be RESUME with accent if applicable)'],
  ];
  // More general: check if text-transform: uppercase is used on content containing accented chars
  const joined = lines.join('\n');
  const uppercaseBlocks = /text-transform\s*:\s*uppercase/gi;
  if (uppercaseBlocks.test(joined)) {
    // Advisory: uppercase transform preserves accents in modern browsers, just flag for awareness
    // No violation — modern CSS handles this correctly
  }
  // Check for HTML entities that suggest accent was manually removed
  for (let i = 0; i < lines.length; i++) {
    if (/[A-Z]{4,}/.test(lines[i])) {
      // Check if adjacent to a known accent-prone word pattern
      for (const [pattern, word, msg] of accentPairs) {
        if (pattern.test(lines[i])) {
          violations.push({
            line: i + 1, column: 1,
            rule: 'text-multilingual-accent',
            severity: severityFromWeight(55, rules.thresholds),
            weight: 55,
            message: msg,
            found: word,
          });
        }
      }
    }
  }
  return violations;
}

function checkCopyWordCount(lines, rules, context) {
  if (context === 'website') return [];
  const violations = [];
  const joined = lines.join('\n');
  // Strip everything inside <style> tags
  let textContent = joined.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Strip footer content (class containing "footer" or "brand-bar")
  textContent = textContent.replace(/<[^>]*class="[^"]*(?:footer|brand-bar|brand-logo)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  // Strip all HTML tags
  textContent = textContent.replace(/<[^>]+>/g, ' ');
  // Strip HTML entities
  textContent = textContent.replace(/&[a-z]+;/gi, ' ');
  // Count words (non-empty tokens)
  const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const isInstagram = /1080\s*x?\s*1080|width:\s*1080px/i.test(joined);
  const isLinkedIn = /1200\s*x?\s*627|1340\s*x?\s*630|width:\s*1200px|width:\s*1340px/i.test(joined);

  const limit = isInstagram ? 20 : isLinkedIn ? 30 : 0;
  if (limit > 0 && wordCount > limit * 1.5) {
    // Only flag if significantly over (1.5x) to avoid false positives from HTML artifacts
    violations.push({
      line: 1, column: 1,
      rule: 'copy-word-count',
      severity: severityFromWeight(75, rules.thresholds),
      weight: 75,
      message: `Total visible copy is ~${wordCount} words (limit: ${limit} for ${isInstagram ? 'Instagram' : 'LinkedIn'}). Reduce headline + body + tagline.`,
      found: `${wordCount} words`,
    });
  }
  return violations;
}

function checkBodyCopyColor(lines, rules, context) {
  if (context === 'website') return [];
  const violations = [];
  const joined = lines.join('\n');
  // Find CSS rules for body-copy-like classes
  const bodyClassRegex = /\.(body|copy|description|subtext|body-text|body-copy|sub-copy)[^{]*\{([^}]*)\}/gi;
  let match;
  while ((match = bodyClassRegex.exec(joined)) !== null) {
    const block = match[2];
    const colorMatch = block.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (!colorMatch) continue;
    const colorValue = colorMatch[1].trim();
    // Check if it's approximately white at 45% opacity
    // Accept: rgba(255,255,255,0.45), rgba(255,255,255,0.4-0.5), #ffffff73 (hex+alpha ~45%)
    const isRgbaWhite = /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0\.4[0-9]*|0\.50?)\s*\)/i.test(colorValue);
    // #ffffff73 = white at ~45% opacity (0x73/0xFF = 0.45)
    const isHexWhiteAlpha = /^#(?:fff|ffffff)(?:70|71|72|73|74|75|76|77|78|79|7a|7b|7c|7d|80)$/i.test(colorValue);
    // Also accept color: white with separate opacity
    const hasOpacity = block.match(/opacity\s*:\s*(0\.4[0-9]*|0\.50?)\s*;?/i);
    const isWhiteWithOpacity = /^(?:#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i.test(colorValue) && hasOpacity;

    if (!isRgbaWhite && !isHexWhiteAlpha && !isWhiteWithOpacity) {
      const beforeMatch = joined.slice(0, match.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
      violations.push({
        line: lineNum, column: 1,
        rule: 'color-body-copy',
        severity: severityFromWeight(80, rules.thresholds),
        weight: 80,
        message: `Body copy color should be approximately white at 45% opacity (e.g., rgba(255,255,255,0.45)). Found: ${colorValue}`,
        found: colorValue,
      });
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
  ...checkInlineStyles(lines, rules, context),
  ...checkDecorativeImgTags(lines, rules, context),
  ...checkHeadlineLetterSpacing(lines, rules, context),
  ...checkTitleTag(lines, rules, context),
  ...checkMinimumElementGap(lines, rules, context),
  ...checkMultilingualAccents(lines, rules, context),
  ...checkCopyWordCount(lines, rules, context),
  ...checkBodyCopyColor(lines, rules, context),
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
