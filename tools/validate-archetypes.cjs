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
const { ArchetypeSchema } = require('./schemas/archetype.cjs');

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

// Allow FLUID_ARCHETYPES_DIR env var for testability in isolation
const ARCHETYPES_DIR = process.env.FLUID_ARCHETYPES_DIR
  ? path.resolve(process.env.FLUID_ARCHETYPES_DIR)
  : path.resolve(__dirname, '../archetypes');
const REQUIRED_FILES = ['index.html', 'schema.json', 'README.md'];
const KNOWN_FIELD_TYPES = ['text', 'image', 'divider'];
const KNOWN_TEXT_MODES = ['text', 'pre', 'br'];

// ── Platform dimension lookup ────────────────────────────────────────────────

/**
 * Determine platform for a given slug + parsed schema.
 * Priority: schema.platform (explicit) > slug suffix convention (implicit).
 * This allows new 4:5 archetypes without a suffix to declare their platform directly.
 */
function getPlatformForSlug(slug, schema) {
  // Prefer explicit schema.platform when present (forward-contract for new archetypes)
  if (schema && typeof schema.platform === 'string' && schema.platform !== '') {
    return schema.platform;
  }
  // Fall back to slug suffix convention for legacy archetypes
  if (slug.endsWith('-li')) return 'linkedin-landscape';
  if (slug.endsWith('-op')) return 'one-pager';
  return 'instagram-square';
}

const PLATFORM_DIMS = {
  'instagram-square':    { width: 1080, height: 1080 },
  'instagram-portrait':  { width: 1080, height: 1350 },
  'linkedin-landscape':  { width: 1200, height: 627  },
  'one-pager':           { width: 612,  height: 792  },
};

// Fields required on meta for instagram-portrait archetypes
const INSTAGRAM_PORTRAIT_META_REQUIRED = ['category', 'imageRole', 'useCases', 'slotCount'];

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

  // ── Check 3–7: Validate schema shape with zod ────────────────────────────
  if (schema !== null) {
    const parseResult = ArchetypeSchema.safeParse(schema);

    if (!parseResult.success) {
      // Map zod issues to legacy error codes where possible
      for (const issue of parseResult.error.issues) {
        const pathStr = issue.path.length > 0 ? issue.path.join('.') : 'root';

        if (issue.message === "must not have a 'templateId' field — use 'archetypeId' instead") {
          error('HAS_TEMPLATE_ID', 'schema.json must not have a "templateId" field — use "archetypeId" instead');
          continue;
        }

        // Map zod path-based issues to legacy codes
        const topKey = issue.path[0];
        if (topKey === 'width') {
          error('MISSING_WIDTH', 'schema.json must have a numeric "width" field');
          continue;
        }
        if (topKey === 'height') {
          error('MISSING_HEIGHT', 'schema.json must have a numeric "height" field');
          continue;
        }
        if (topKey === 'fields') {
          const fieldIdx = issue.path[1];
          const fieldRef = typeof fieldIdx === 'number' ? `fields[${fieldIdx}]` : 'fields';
          const subKey = issue.path[2];

          if (issue.path.length === 1) {
            // fields itself is invalid
            error('MISSING_FIELDS', 'schema.json must have a "fields" array');
            continue;
          }

          // Discriminated union mismatch — unknown type
          if (issue.code === 'invalid_union_discriminator') {
            const rawField = Array.isArray(schema.fields) ? schema.fields[fieldIdx] : null;
            const actualType = rawField ? String(rawField.type ?? '(missing)') : '(unknown)';
            error('UNKNOWN_FIELD_TYPE', `${fieldRef} has unknown type: "${actualType}" (expected one of: ${KNOWN_FIELD_TYPES.join(', ')})`);
            continue;
          }

          // Field-level sub-key issues
          if (subKey === 'sel') {
            const rawField = Array.isArray(schema.fields) ? schema.fields[fieldIdx] : null;
            const ftype = rawField ? rawField.type : '';
            error('MISSING_SEL', `${fieldRef} (${ftype}) must have a non-empty "sel" string`);
            continue;
          }
          if (subKey === 'label') {
            const rawField = Array.isArray(schema.fields) ? schema.fields[fieldIdx] : null;
            const ftype = rawField ? rawField.type : '';
            if (ftype === 'divider') {
              error('MISSING_DIVIDER_LABEL', `${fieldRef} (divider) must have a non-empty "label" string`);
            } else {
              error('MISSING_LABEL', `${fieldRef} (${ftype}) must have a non-empty "label" string`);
            }
            continue;
          }
          if (subKey === 'mode') {
            const rawField = Array.isArray(schema.fields) ? schema.fields[fieldIdx] : null;
            const actualMode = rawField ? String(rawField.mode ?? '(missing)') : '(unknown)';
            error('UNKNOWN_TEXT_MODE', `${fieldRef} (text) has unknown mode: "${actualMode}" (expected one of: ${KNOWN_TEXT_MODES.join(', ')})`);
            continue;
          }
          if (subKey === 'brushAdditional') {
            error('NON_EMPTY_BRUSH_ADDITIONAL', 'schema.json "brushAdditional" must be [] or absent for archetypes');
            continue;
          }
        }

        if (topKey === 'brush') {
          error('NON_NULL_BRUSH', `schema.json "brush" must be null for archetypes, got: ${JSON.stringify(schema.brush)}`);
          continue;
        }
        if (topKey === 'brushAdditional') {
          error('NON_EMPTY_BRUSH_ADDITIONAL', 'schema.json "brushAdditional" must be [] or absent for archetypes');
          continue;
        }

        // Fallthrough: emit generic SCHEMA_INVALID
        error('SCHEMA_INVALID', `schema.json structural error at "${pathStr}": ${issue.message}`);
      }
    }

    // ── Check 4: Dimensions must match platform ─────────────────────────────
    // (Semantic check — can't be expressed in zod without knowing the slug)
    const platform = getPlatformForSlug(slug, schema);
    const requiredDims = PLATFORM_DIMS[platform];
    if (!requiredDims) {
      error('UNKNOWN_PLATFORM', `Unknown platform "${platform}" — not in PLATFORM_DIMS`);
    } else {
      if (typeof schema.width === 'number' && schema.width !== requiredDims.width) {
        error('WRONG_DIMS', `schema.json width must be ${requiredDims.width} for ${platform}, got ${schema.width}`);
      }
      if (typeof schema.height === 'number' && schema.height !== requiredDims.height) {
        error('WRONG_DIMS', `schema.json height must be ${requiredDims.height} for ${platform}, got ${schema.height}`);
      }
    }

    // ── Check 4b: instagram-portrait archetypes must have meta sub-object ───
    if (platform === 'instagram-portrait') {
      if (!schema.meta || typeof schema.meta !== 'object') {
        error('MISSING_META', 'instagram-portrait archetypes must have a "meta" object in schema.json');
      } else {
        for (const field of INSTAGRAM_PORTRAIT_META_REQUIRED) {
          if (schema.meta[field] === undefined || schema.meta[field] === null) {
            error('MISSING_META_FIELD', `schema.json meta.${field} is required for instagram-portrait archetypes`);
          }
        }
        // useCases must have at least 1 entry
        if (Array.isArray(schema.meta.useCases) && schema.meta.useCases.length === 0) {
          error('EMPTY_USE_CASES', 'schema.json meta.useCases must have at least 1 entry');
        }
        // slotCount must be a positive integer
        if (typeof schema.meta.slotCount === 'number' && schema.meta.slotCount < 1) {
          error('INVALID_SLOT_COUNT', 'schema.json meta.slotCount must be >= 1');
        }
      }
    }

    // ── Check 11: Selector parity — class names must appear in index.html ────
    if (Array.isArray(schema.fields)) {
      let html = '';
      if (hasHtml) {
        html = fs.readFileSync(htmlPath, 'utf8');
      }

      for (let i = 0; i < schema.fields.length; i++) {
        const field = schema.fields[i];
        if (field.type === 'divider') continue;
        if (typeof field.sel === 'string' && field.sel.trim() !== '' && html !== '') {
          const className = extractClassName(field.sel);
          if (className && !html.includes(className)) {
            error('SELECTOR_NOT_FOUND', `fields[${i}] sel "${field.sel}" — class "${className}" not found in index.html`);
          }
        }
      }
    }

    // ── Check 12: One-pager must have @page rule ────────────────────────────
    if (platform === 'one-pager' && hasHtml) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      if (!/@page\s*\{/.test(htmlContent)) {
        error('MISSING_PAGE_RULE', 'One-pager archetypes must include @page { ... } rule in <style>');
      }
    }

    // ── Check 13: If platform derived from suffix, schema.platform must agree ─
    // When schema.platform is present, it IS the authoritative value (already used
    // in getPlatformForSlug above). Only flag a mismatch if the schema omits platform
    // but has dims that conflict with slug-suffix inference — that's a misconfiguration.
    if (!schema.platform) {
      const suffixPlatform = (() => {
        if (slug.endsWith('-li')) return 'linkedin-landscape';
        if (slug.endsWith('-op')) return 'one-pager';
        return 'instagram-square';
      })();
      if (platform !== suffixPlatform) {
        // This shouldn't happen when schema.platform is absent, but guard defensively
        warning('PLATFORM_INFERRED', `No schema.platform field; inferring "${platform}" from slug suffix "${slug}"`);
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
