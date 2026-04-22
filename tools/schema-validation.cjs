#!/usr/bin/env node
/**
 * schema-validation.cjs (CLI-01) — Validates .liquid schema completeness
 *
 * Extracts {% schema %}...{% endschema %} block from .liquid files and
 * validates against Gold Standard requirements.
 *
 * Usage: node tools/schema-validation.cjs path/to/file.liquid
 * Output: JSON results to stdout, human summary to stderr
 * Exit code: 1 if required counts not met, 0 if passing
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');
const { LiquidSchemaSchema } = require('./schemas/gold-standard.cjs');

// Gold Standard count requirements — authoritative values from brand docs.
// These are semantic business rules (not structural shape); they stay hand-written.
// The structural shape of a {% schema %} block is validated by LiquidSchemaSchema (zod).
const GOLD_STANDARD_REQUIREMENTS = {
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

function loadRules() {
  return { schema: GOLD_STANDARD_REQUIREMENTS };
}

function extractSchema(content) {
  const match = content.match(/\{%[-\s]*schema\s*[-\s]*%\}([\s\S]*?)\{%[-\s]*endschema\s*[-\s]*%\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return { _parse_error: e.message, _raw: match[1] };
  }
}

function countSelectOptions(settings, labelPattern) {
  // Find select-type settings whose label or id matches the pattern
  let count = 0;
  const foundOptions = [];

  if (!Array.isArray(settings)) return { count: 0, options: [] };

  for (const setting of settings) {
    if (setting.type !== 'select') continue;

    const label = (setting.label || setting.id || '').toLowerCase();
    if (labelPattern.test(label)) {
      if (Array.isArray(setting.options)) {
        count = Math.max(count, setting.options.length);
        foundOptions.push(...setting.options.map(o => o.value || o.label || o));
      }
    }
  }

  return { count, options: foundOptions };
}

function findSettingsByPattern(settings, idPattern) {
  if (!Array.isArray(settings)) return [];
  return settings.filter(s => idPattern.test(s.id || s.label || ''));
}

function flattenSettings(schema) {
  const settings = [];

  // Top-level settings
  if (Array.isArray(schema.settings)) {
    settings.push(...schema.settings);
  }

  // Block-level settings
  if (Array.isArray(schema.blocks)) {
    for (const block of schema.blocks) {
      if (Array.isArray(block.settings)) {
        settings.push(...block.settings);
      }
    }
  }

  return settings;
}

function validateSchema(schema, rules) {
  const issues = [];
  const schemaRules = rules.schema;
  const allSettings = flattenSettings(schema);

  // Check font size options
  const fontSizeMobile = countSelectOptions(allSettings, /font.?size.*mobile|mobile.*font.?size|size.*mobile/i);
  const fontSizeDesktop = countSelectOptions(allSettings, /font.?size.*desktop|desktop.*font.?size|size.*desktop/i);
  const fontSizeBest = Math.max(fontSizeMobile.count, fontSizeDesktop.count);

  if (fontSizeBest < schemaRules.font_size_count) {
    const missing = schemaRules.font_size_count - fontSizeBest;
    const expectedOpts = schemaRules.font_size_options;
    const foundOpts = fontSizeBest === fontSizeMobile.count ? fontSizeMobile.options : fontSizeDesktop.options;
    const missingOpts = expectedOpts.filter(o => !foundOpts.includes(o));

    issues.push({
      rule: 'schema-font-size-count',
      severity: 'error',
      weight: 100,
      message: `Font sizes: ${fontSizeBest}/${schemaRules.font_size_count} (missing ${missing})`,
      expected: schemaRules.font_size_count,
      found: fontSizeBest,
      missing_options: missingOpts.length > 0 ? missingOpts : undefined,
    });
  }

  // Check color options
  const colorSettings = countSelectOptions(allSettings, /\bcolor\b/i);
  if (colorSettings.count < schemaRules.color_count) {
    const missing = schemaRules.color_count - colorSettings.count;
    issues.push({
      rule: 'schema-color-count',
      severity: 'error',
      weight: 100,
      message: `Colors: ${colorSettings.count}/${schemaRules.color_count} (missing ${missing})`,
      expected: schemaRules.color_count,
      found: colorSettings.count,
    });
  }

  // Check weight options
  const weightSettings = countSelectOptions(allSettings, /\bweight\b/i);
  if (weightSettings.count < schemaRules.weight_count) {
    const missing = schemaRules.weight_count - weightSettings.count;
    issues.push({
      rule: 'schema-weight-count',
      severity: 'error',
      weight: 95,
      message: `Font weights: ${weightSettings.count}/${schemaRules.weight_count} (missing ${missing})`,
      expected: schemaRules.weight_count,
      found: weightSettings.count,
    });
  }

  // Check button settings
  const requiredButtonSettings = schemaRules.button_settings;
  const buttonSettingsFound = [];
  for (const reqSetting of requiredButtonSettings) {
    const found = allSettings.some(s => {
      const id = (s.id || '').toLowerCase();
      return id.includes('button') && id.includes(reqSetting.toLowerCase());
    });
    if (found) buttonSettingsFound.push(reqSetting);
  }

  if (buttonSettingsFound.length < requiredButtonSettings.length) {
    const missing = requiredButtonSettings.filter(s => !buttonSettingsFound.includes(s));
    issues.push({
      rule: 'schema-button-settings',
      severity: 'error',
      weight: 95,
      message: `Button settings: ${buttonSettingsFound.length}/${requiredButtonSettings.length} (missing: ${missing.join(', ')})`,
      expected: requiredButtonSettings.length,
      found: buttonSettingsFound.length,
      missing_settings: missing,
    });
  }

  // Check section settings
  const requiredSectionSettings = schemaRules.section_settings;
  const sectionFound = [];
  for (const reqSetting of requiredSectionSettings) {
    const found = allSettings.some(s => {
      const id = (s.id || '').toLowerCase();
      return id === reqSetting.toLowerCase() || id.includes(reqSetting.toLowerCase().replace(/_/g, ''));
    });
    if (found) sectionFound.push(reqSetting);
  }

  if (sectionFound.length < requiredSectionSettings.length) {
    const missing = requiredSectionSettings.filter(s => !sectionFound.includes(s));
    issues.push({
      rule: 'schema-section-settings',
      severity: 'error',
      weight: 90,
      message: `Section settings: ${sectionFound.length}/${requiredSectionSettings.length} (missing: ${missing.join(', ')})`,
      expected: requiredSectionSettings.length,
      found: sectionFound.length,
      missing_settings: missing,
    });
  }

  // Check container settings
  const requiredContainerSettings = schemaRules.container_settings;
  const containerFound = [];
  for (const reqSetting of requiredContainerSettings) {
    const found = allSettings.some(s => {
      const id = (s.id || '').toLowerCase();
      return id === reqSetting.toLowerCase() || id.includes(reqSetting.toLowerCase().replace(/_/g, ''));
    });
    if (found) containerFound.push(reqSetting);
  }

  if (containerFound.length < requiredContainerSettings.length) {
    const missing = requiredContainerSettings.filter(s => !containerFound.includes(s));
    issues.push({
      rule: 'schema-container-settings',
      severity: 'error',
      weight: 90,
      message: `Container settings: ${containerFound.length}/${requiredContainerSettings.length} (missing: ${missing.join(', ')})`,
      expected: requiredContainerSettings.length,
      found: containerFound.length,
      missing_settings: missing,
    });
  }

  return issues;
}

// --- Main ---
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`schema-validation.cjs (CLI-01) — Validate .liquid schema completeness

Usage: node tools/schema-validation.cjs <file.liquid>

Validates that a .liquid file's schema block meets Gold Standard requirements:
  - 13 font size options per text element
  - 13 color options per text element
  - 5 font weight options per text element
  - 7 button settings per button
  - 5 section settings
  - 7 container settings

Output:
  stdout: JSON validation results
  stderr: Human-readable summary

Exit codes:
  0  Schema passes all checks
  1  Schema has shortfalls
  2  Tool error (no schema found, parse error)
`);
  process.exit(0);
}

const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (args.length === 0) {
  process.stderr.write('Error: No file path provided.\nUsage: node tools/schema-validation.cjs <file.liquid>\n');
  process.exit(2);
}

const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  process.stderr.write(`Error: File not found: ${filePath}\n`);
  process.exit(2);
}

const rules = loadRules();
const content = fs.readFileSync(filePath, 'utf-8');
const schema = extractSchema(content);

if (!schema) {
  const result = {
    file: filePath,
    status: 'error',
    message: 'No {% schema %} block found in file',
    issues: [],
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(`\nSchema Validation: ${path.basename(filePath)}\n  ERROR: No {% schema %} block found\n\n`);
  process.exit(2);
}

if (schema._parse_error) {
  const result = {
    file: filePath,
    status: 'error',
    message: `Schema JSON parse error: ${schema._parse_error}`,
    issues: [],
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(`\nSchema Validation: ${path.basename(filePath)}\n  ERROR: Invalid JSON in schema block: ${schema._parse_error}\n\n`);
  process.exit(2);
}

// Validate structural shape of the parsed schema block with zod
const shapeCheck = LiquidSchemaSchema.safeParse(schema);
if (!shapeCheck.success) {
  const zodMessages = shapeCheck.error.issues.map(i => {
    const p = i.path.length > 0 ? i.path.join('.') : 'root';
    return `${p}: ${i.message}`;
  }).join('; ');
  const result = {
    file: filePath,
    status: 'error',
    message: `Schema has invalid structure: ${zodMessages}`,
    issues: [],
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(`\nSchema Validation: ${path.basename(filePath)}\n  ERROR: Invalid schema structure: ${zodMessages}\n\n`);
  process.exit(2);
}

const issues = validateSchema(schema, rules);

const result = {
  file: filePath,
  status: issues.length === 0 ? 'pass' : 'fail',
  issues,
  summary: {
    total: issues.length,
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');

// Human summary to stderr
process.stderr.write(`\nSchema Validation: ${path.basename(filePath)}\n`);

if (issues.length === 0) {
  process.stderr.write(`  ${pc.green('PASS')} — All Gold Standard requirements met\n\n`);
} else {
  for (const issue of issues) {
    const color = issue.severity === 'error' ? pc.red : pc.yellow;
    process.stderr.write(`  ${color(issue.severity.toUpperCase())} [${issue.rule}] ${issue.message}\n`);
  }
  process.stderr.write(`\n  ${pc.red(`${result.summary.errors} errors`)}, ${pc.yellow(`${result.summary.warnings} warnings`)}\n\n`);
}

process.exit(issues.length > 0 ? 1 : 0);
