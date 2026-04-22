'use strict';
/**
 * schema-validation.test.cjs — Characterization tests for schema-validation.cjs
 *
 * Covers:
 *   1. Valid schema that passes all Gold Standard checks (or at least reaches validate path)
 *   2. Missing {% schema %} block
 *   3. Invalid JSON inside schema block
 *   4. Schema with wrong shape (settings is an object not array)
 *   5. Schema missing required Gold Standard counts (e.g. only 2 font sizes)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('./helpers/run-cli.cjs');

/** Write a temp .liquid file and return its path. Caller cleans up. */
function writeTmpLiquid(name, content) {
  const filePath = path.join(os.tmpdir(), `sv-test-${process.pid}-${name}.liquid`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/** Build a minimal Gold-Standard-compliant schema block with all required settings. */
function fullGoldStandardSchema() {
  const fontSizeOptions = [
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
    'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
    'text-7xl', 'text-8xl', 'text-9xl',
  ].map(v => ({ value: v, label: v }));

  const colorOptions = [
    'text-primary', 'text-secondary', 'text-tertiary', 'text-accent',
    'text-accent-secondary', 'text-white', 'text-black',
    'text-success', 'text-warning', 'text-error', 'text-info',
    'text-muted', 'text-inherit',
  ].map(v => ({ value: v, label: v }));

  const weightOptions = [
    'light', 'normal', 'medium', 'semibold', 'bold',
  ].map(v => ({ value: v, label: v }));

  const schema = {
    name: 'Test Section',
    settings: [
      // font sizes (desktop)
      { type: 'select', id: 'font_size_desktop', label: 'Font size desktop', options: fontSizeOptions },
      // colors
      { type: 'select', id: 'text_color', label: 'Color', options: colorOptions },
      // weights
      { type: 'select', id: 'font_weight', label: 'Weight', options: weightOptions },
      // button settings
      { type: 'checkbox', id: 'button_show', label: 'Show button' },
      { type: 'text',     id: 'button_text', label: 'Button text' },
      { type: 'text',     id: 'button_url',  label: 'Button URL' },
      { type: 'select',   id: 'button_style', label: 'Button style', options: [{ value: 'filled' }, { value: 'outline' }, { value: 'ghost' }] },
      { type: 'select',   id: 'button_color', label: 'Button color', options: Array.from({ length: 10 }, (_, i) => ({ value: `color-${i}` })) },
      { type: 'select',   id: 'button_size',  label: 'Button size', options: [{ value: 'btn-xs' }, { value: 'btn-sm' }, { value: 'btn-md' }, { value: 'btn-lg' }, { value: 'btn-xl' }] },
      { type: 'select',   id: 'button_weight', label: 'Button weight', options: weightOptions },
      // section settings
      { type: 'select', id: 'background_color',           label: 'Background color' },
      { type: 'image_picker', id: 'background_image',     label: 'Background image' },
      { type: 'select', id: 'section_padding_y_mobile',   label: 'Section padding mobile', options: [{ value: 'py-xs' }, { value: 'py-sm' }, { value: 'py-md' }, { value: 'py-lg' }, { value: 'py-xl' }, { value: 'py-2xl' }, { value: 'py-3xl' }] },
      { type: 'select', id: 'section_padding_y_desktop',  label: 'Section padding desktop', options: [{ value: 'py-xs' }] },
      { type: 'select', id: 'section_border_radius',      label: 'Section border radius', options: [{ value: 'rounded-none' }] },
      // container settings
      { type: 'select',       id: 'container_background_color',  label: 'Container background color' },
      { type: 'image_picker', id: 'container_background_image',  label: 'Container background image' },
      { type: 'select',       id: 'container_border_radius',     label: 'Container border radius' },
      { type: 'select',       id: 'container_padding_y_mobile',  label: 'Container padding y mobile' },
      { type: 'select',       id: 'container_padding_y_desktop', label: 'Container padding y desktop' },
      { type: 'select',       id: 'container_padding_x_mobile',  label: 'Container padding x mobile' },
      { type: 'select',       id: 'container_padding_x_desktop', label: 'Container padding x desktop' },
    ],
  };

  return `
<div>content</div>
{% schema %}
${JSON.stringify(schema, null, 2)}
{% endschema %}
`;
}

// ─── Test 1: Valid schema — reaches validation (may have some Gold Standard misses
//             but must NOT exit 2 and must output JSON) ────────────────────────

test('schema-validation: valid liquid with full Gold Standard schema exits 0', () => {
  const filePath = writeTmpLiquid('valid', fullGoldStandardSchema());
  try {
    const r = runCli('schema-validation.cjs', [filePath]);
    // Must exit 0 (all checks pass)
    assert.equal(r.status, 0, `Expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
    // stdout must be valid JSON
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'pass', `Expected status=pass, got: ${parsed.status}`);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Test 2: Missing {% schema %} block — exit 2 ─────────────────────────────

test('schema-validation: no schema block exits 2 with error message', () => {
  const filePath = writeTmpLiquid('no-schema', '<div>No schema here</div>');
  try {
    const r = runCli('schema-validation.cjs', [filePath]);
    assert.equal(r.status, 2, `Expected exit 2, got ${r.status}\nstderr: ${r.stderr}`);
    assert.ok(
      r.stdout.includes('No {% schema %} block') || r.stderr.includes('No {% schema %} block'),
      `Expected "No {% schema %} block" message\nstdout: ${r.stdout}\nstderr: ${r.stderr}`
    );
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Test 3: Invalid JSON in schema block — exit 2 ───────────────────────────

test('schema-validation: invalid JSON in schema block exits 2 with parse error', () => {
  const filePath = writeTmpLiquid('bad-json', `
<div>content</div>
{% schema %}
{ this is not json!!!
{% endschema %}
`);
  try {
    const r = runCli('schema-validation.cjs', [filePath]);
    assert.equal(r.status, 2, `Expected exit 2, got ${r.status}\nstderr: ${r.stderr}`);
    // Should mention JSON parse error in output
    const combined = r.stdout + r.stderr;
    assert.ok(
      combined.includes('parse') || combined.includes('JSON') || combined.includes('Invalid'),
      `Expected JSON parse error message\ncombined: ${combined}`
    );
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Test 4: Schema with wrong shape (settings is object not array) ───────────

test('schema-validation: settings as object (not array) exits 1 with shape error', () => {
  const badSchema = {
    name: 'Bad Shape',
    settings: { type: 'select', id: 'color', label: 'Color' }, // object, not array
  };
  const filePath = writeTmpLiquid('bad-shape', `
<div>content</div>
{% schema %}
${JSON.stringify(badSchema)}
{% endschema %}
`);
  try {
    const r = runCli('schema-validation.cjs', [filePath]);
    // With zod validation: should exit 2 (invalid schema structure)
    // OR exit 1 (fails Gold Standard checks because settings isn't iterable)
    // Either is acceptable — the key is it should NOT exit 0
    assert.notEqual(r.status, 0, `Expected non-zero exit, got 0\nstdout: ${r.stdout}`);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Test 5: Schema missing required Gold Standard counts ─────────────────────

test('schema-validation: schema with only 2 font sizes exits 1 with font size error', () => {
  const sparseSchema = {
    name: 'Sparse Schema',
    settings: [
      { type: 'select', id: 'font_size_desktop', label: 'Font size desktop',
        options: [{ value: 'text-xs' }, { value: 'text-sm' }] }, // only 2, needs 13
    ],
  };
  const filePath = writeTmpLiquid('sparse', `
<div>content</div>
{% schema %}
${JSON.stringify(sparseSchema)}
{% endschema %}
`);
  try {
    const r = runCli('schema-validation.cjs', [filePath]);
    assert.equal(r.status, 1, `Expected exit 1, got ${r.status}\nstderr: ${r.stderr}`);
    // Output should mention font size issue
    const combined = r.stdout + r.stderr;
    assert.ok(
      combined.includes('font') || combined.includes('Font') || combined.includes('schema-font-size'),
      `Expected font size error message\ncombined: ${combined}`
    );
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Test 6: File not found — exit 2 ─────────────────────────────────────────

test('schema-validation: nonexistent file exits 2 with file-not-found message', () => {
  const r = runCli('schema-validation.cjs', ['/tmp/nonexistent-sv-test-file.liquid']);
  assert.equal(r.status, 2, `Expected exit 2, got ${r.status}`);
  assert.ok(
    r.stderr.includes('not found') || r.stderr.includes('File not found'),
    `Expected "not found" message\nstderr: ${r.stderr}`
  );
});
