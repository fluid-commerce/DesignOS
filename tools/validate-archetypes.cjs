#!/usr/bin/env node
/**
 * validate-archetypes.cjs — Validates archetype directories against format spec
 *
 * Checks required files, schema structure, dimension constraints, selector parity,
 * and brand-neutrality rules for archetypes in the archetypes/ directory.
 *
 * Usage: node tools/validate-archetypes.cjs [slug|"all"]
 * Output: JSON violations array to stdout, human summary to stderr
 * Exit code: 1 if any errors, 0 otherwise
 */

const fs = require('node:fs');
const path = require('node:path');

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const ARCHETYPES_DIR = path.resolve(__dirname, '../archetypes');
const REQUIRED_FILES = ['index.html', 'schema.json', 'README.md'];
const REQUIRED_DIMS = { width: 1080, height: 1080 }; // Instagram archetypes
const KNOWN_FIELD_TYPES = ['text', 'image', 'divider'];
const KNOWN_TEXT_MODES = ['text', 'pre', 'br'];

// Directories to skip when listing archetype slugs
const SKIP_DIRS = new Set(['components']);

// ──────────────────────────────────────────────
// Selector extraction
// ──────────────────────────────────────────────

/**
 * Extract the primary class name from a CSS selector.
 * ".headline" -> "headline"
 * ".photo img" -> "photo"
 * ".stat-1-num" -> "stat-1-num"
 * ".category span" -> "category"
 */
function extractClassName(sel) {
  return sel.split(/[\s>+~]/)[0].replace(/^\./, '');
}

// ──────────────────────────────────────────────
// Core validation function
// ──────────────────────────────────────────────

/**
 * Validate a single archetype directory.
 *
 * @param {string} dir - Absolute path to archetype directory
 * @param {string} slug - Archetype slug (directory name)
 * @returns {Array<{severity: string, code: string, slug: string, message: string}>}
 */
function validateArchetype(dir, slug) {
  const violations = [];

  function error(code, message) {
    violations.push({ severity: 'error', code, slug, message });
  }

  function warning(code, message) {
    violations.push({ severity: 'warning', code, slug, message });
  }

  // ── Check 1: Required files exist ──────────────────────────────────────────
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      error('MISSING_FILE', `Missing required file: ${file}`);
    }
  }

  // Stop early if critical files are missing
  const schemaPath = path.join(dir, 'schema.json');
  const htmlPath = path.join(dir, 'index.html');

  const hasSchema = fs.existsSync(schemaPath);
  const hasHtml = fs.existsSync(htmlPath);

  if (!hasSchema && !hasHtml) {
    // Already reported MISSING_FILE for both — nothing more to check
    return violations;
  }

  // ── Check 2: schema.json parses as valid JSON ──────────────────────────────
  let schema = null;
  if (hasSchema) {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    try {
      schema = JSON.parse(raw);
    } catch (e) {
      error('INVALID_JSON', `schema.json is not valid JSON: ${e.message}`);
      return violations; // Can't continue without a parsed schema
    }
  }

  // ── Check 3: schema.json has required top-level fields ────────────────────
  if (schema !== null) {
    if (typeof schema.width !== 'number') {
      error('MISSING_WIDTH', 'schema.json must have a numeric "width" field');
    }
    if (typeof schema.height !== 'number') {
      error('MISSING_HEIGHT', 'schema.json must have a numeric "height" field');
    }
    if (!Array.isArray(schema.fields)) {
      error('MISSING_FIELDS', 'schema.json must have a "fields" array');
    }

    // ── Check 4: Dimensions must be 1080x1080 (Instagram) ─────────────────────
    if (typeof schema.width === 'number' && schema.width !== REQUIRED_DIMS.width) {
      error('WRONG_DIMS', `schema.json width must be ${REQUIRED_DIMS.width}, got ${schema.width}`);
    }
    if (typeof schema.height === 'number' && schema.height !== REQUIRED_DIMS.height) {
      error('WRONG_DIMS', `schema.json height must be ${REQUIRED_DIMS.height}, got ${schema.height}`);
    }

    // ── Check 5: brush must be null or absent ─────────────────────────────────
    if (schema.brush !== null && schema.brush !== undefined) {
      error('NON_NULL_BRUSH', `schema.json "brush" must be null for archetypes, got: ${JSON.stringify(schema.brush)}`);
    }

    // ── Check 6: brushAdditional must be [] or absent ─────────────────────────
    if (schema.brushAdditional !== undefined && schema.brushAdditional !== null) {
      if (!Array.isArray(schema.brushAdditional) || schema.brushAdditional.length > 0) {
        error('NON_EMPTY_BRUSH_ADDITIONAL', `schema.json "brushAdditional" must be [] or absent for archetypes`);
      }
    }

    // ── Check 7: No templateId field ──────────────────────────────────────────
    if (Object.prototype.hasOwnProperty.call(schema, 'templateId')) {
      error('HAS_TEMPLATE_ID', 'schema.json must not have a "templateId" field — use "archetypeId" instead');
    }

    // ── Checks 8-11: Field-level validation ───────────────────────────────────
    if (Array.isArray(schema.fields)) {
      // Read HTML for selector parity check (Check 11)
      let html = '';
      if (hasHtml) {
        html = fs.readFileSync(htmlPath, 'utf8');
      }

      for (let i = 0; i < schema.fields.length; i++) {
        const field = schema.fields[i];
        const fieldRef = `fields[${i}]`;

        // Check 8: Valid field type
        if (!KNOWN_FIELD_TYPES.includes(field.type)) {
          error('UNKNOWN_FIELD_TYPE', `${fieldRef} has unknown type: "${field.type}" (expected one of: ${KNOWN_FIELD_TYPES.join(', ')})`);
          continue; // Can't validate the rest of this field without knowing its type
        }

        // Divider fields only need a label
        if (field.type === 'divider') {
          if (typeof field.label !== 'string' || field.label.trim() === '') {
            error('MISSING_DIVIDER_LABEL', `${fieldRef} (divider) must have a non-empty "label" string`);
          }
          continue;
        }

        // Check 9 (text fields): sel, label, mode are required
        if (field.type === 'text') {
          if (typeof field.sel !== 'string' || field.sel.trim() === '') {
            error('MISSING_SEL', `${fieldRef} (text) must have a non-empty "sel" string`);
          }
          if (typeof field.label !== 'string' || field.label.trim() === '') {
            error('MISSING_LABEL', `${fieldRef} (text) must have a non-empty "label" string`);
          }
          if (!KNOWN_TEXT_MODES.includes(field.mode)) {
            error('UNKNOWN_TEXT_MODE', `${fieldRef} (text) has unknown mode: "${field.mode}" (expected one of: ${KNOWN_TEXT_MODES.join(', ')})`);
          }
        }

        // Check 10 (image fields): sel and label are required
        if (field.type === 'image') {
          if (typeof field.sel !== 'string' || field.sel.trim() === '') {
            error('MISSING_SEL', `${fieldRef} (image) must have a non-empty "sel" string`);
          }
          if (typeof field.label !== 'string' || field.label.trim() === '') {
            error('MISSING_LABEL', `${fieldRef} (image) must have a non-empty "label" string`);
          }
        }

        // Check 11: Selector parity — class name must appear in index.html
        if (typeof field.sel === 'string' && field.sel.trim() !== '' && html !== '') {
          const className = extractClassName(field.sel);
          if (className && !html.includes(className)) {
            error('SELECTOR_NOT_FOUND', `${fieldRef} sel "${field.sel}" — class "${className}" not found in index.html`);
          }
        }
      }
    }
  }

  return violations;
}

// ──────────────────────────────────────────────
// Directory helpers
// ──────────────────────────────────────────────

/**
 * Return all archetype slugs (subdirectory names, excluding skip-list entries).
 */
function listArchetypeSlugs() {
  if (!fs.existsSync(ARCHETYPES_DIR)) return [];

  return fs.readdirSync(ARCHETYPES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map(entry => entry.name);
}

// ──────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────

function main() {
  const arg = process.argv[2]; // slug or "all" or undefined

  // If archetypes/ directory doesn't exist: success, nothing to validate
  if (!fs.existsSync(ARCHETYPES_DIR)) {
    process.stdout.write('[]\n');
    process.stderr.write('No archetypes directory found\n');
    process.exit(0);
  }

  let slugs = [];

  if (!arg || arg === 'all') {
    slugs = listArchetypeSlugs();

    if (slugs.length === 0) {
      process.stdout.write('[]\n');
      process.stderr.write('No archetypes found (empty directory)\n');
      process.exit(0);
    }
  } else {
    // Validate single slug
    slugs = [arg];
    const dir = path.join(ARCHETYPES_DIR, arg);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      const violations = [{
        severity: 'error',
        code: 'MISSING_DIR',
        slug: arg,
        message: `Archetype directory not found: archetypes/${arg}`,
      }];
      process.stdout.write(JSON.stringify(violations, null, 2) + '\n');
      process.stderr.write(`${arg}: 1 error, 0 warnings\n`);
      process.exit(1);
    }
  }

  // Run validation on each slug
  const allViolations = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const slug of slugs) {
    const dir = path.join(ARCHETYPES_DIR, slug);
    const violations = validateArchetype(dir, slug);

    allViolations.push(...violations);

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;
    totalErrors += errors;
    totalWarnings += warnings;

    process.stderr.write(`${slug}: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}\n`);
  }

  // Summary line when validating multiple archetypes
  if (slugs.length > 1) {
    process.stderr.write(`\nTotal: ${slugs.length} archetype${slugs.length !== 1 ? 's' : ''}, ${totalErrors} error${totalErrors !== 1 ? 's' : ''}, ${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}\n`);
  }

  process.stdout.write(JSON.stringify(allViolations, null, 2) + '\n');
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
