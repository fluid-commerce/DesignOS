#!/usr/bin/env node
/**
 * scaffold.cjs (CLI-04) — Generates Gold Standard .liquid skeleton
 *
 * Creates a .liquid file with all required schema settings pre-filled
 * per Gold Standard requirements. Output passes schema-validation.cjs.
 *
 * Usage: node tools/scaffold.cjs section-name [--output path]
 * Output: JSON to stdout, human summary to stderr
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '..', 'templates', 'gold-standard');

function toKebab(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function toTitle(str) {
  return str.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function generateFontSizeOptions(prefix) {
  const sizes = [
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
    'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
    'text-7xl', 'text-8xl', 'text-9xl',
  ];
  return sizes.map(s => ({
    value: prefix ? `${prefix}${s}` : s,
    label: s,
  }));
}

function generateColorOptions() {
  return [
    { value: 'text-primary', label: 'Primary' },
    { value: 'text-secondary', label: 'Secondary' },
    { value: 'text-tertiary', label: 'Tertiary' },
    { value: 'text-accent', label: 'Accent' },
    { value: 'text-accent-secondary', label: 'Accent Secondary' },
    { value: 'text-white', label: 'White' },
    { value: 'text-black', label: 'Black' },
    { value: 'text-success', label: 'Success' },
    { value: 'text-warning', label: 'Warning' },
    { value: 'text-error', label: 'Error' },
    { value: 'text-info', label: 'Info' },
    { value: 'text-muted', label: 'Muted' },
    { value: 'text-inherit', label: 'Inherit' },
  ];
}

function generateWeightOptions() {
  return [
    { value: 'font-light', label: 'Light' },
    { value: 'font-normal', label: 'Normal' },
    { value: 'font-medium', label: 'Medium' },
    { value: 'font-semibold', label: 'Semibold' },
    { value: 'font-bold', label: 'Bold' },
  ];
}

function generateFontFamilyOptions() {
  return [
    { value: 'font-primary', label: 'Primary' },
    { value: 'font-body', label: 'Body' },
    { value: 'font-handwritten', label: 'Handwritten' },
    { value: 'font-serif', label: 'Serif' },
  ];
}

function generateBgColorOptions() {
  return [
    { value: 'bg-neutral', label: 'Neutral' },
    { value: 'bg-primary', label: 'Primary' },
    { value: 'bg-secondary', label: 'Secondary' },
    { value: 'bg-accent', label: 'Accent' },
    { value: 'bg-accent-secondary', label: 'Accent Secondary' },
    { value: 'bg-dark', label: 'Dark' },
    { value: 'bg-light', label: 'Light' },
    { value: 'bg-white', label: 'White' },
    { value: 'bg-black', label: 'Black' },
    { value: 'bg-success', label: 'Success' },
    { value: 'bg-warning', label: 'Warning' },
    { value: 'bg-error', label: 'Error' },
    { value: 'bg-transparent', label: 'Transparent' },
  ];
}

function generatePaddingOptions(prefix) {
  const sizes = ['py-xs', 'py-sm', 'py-md', 'py-lg', 'py-xl', 'py-2xl', 'py-3xl'];
  return sizes.map(s => ({
    value: prefix ? `${prefix}${s}` : s,
    label: s,
  }));
}

function generatePaddingXOptions(prefix) {
  const sizes = ['px-xs', 'px-sm', 'px-md', 'px-lg', 'px-xl', 'px-2xl', 'px-3xl'];
  return sizes.map(s => ({
    value: prefix ? `${prefix}${s}` : s,
    label: s,
  }));
}

function generateRadiusOptions() {
  return [
    { value: 'rounded-none', label: 'None' },
    { value: 'rounded-sm', label: 'Small' },
    { value: 'rounded', label: 'Default' },
    { value: 'rounded-md', label: 'Medium' },
    { value: 'rounded-lg', label: 'Large' },
    { value: 'rounded-xl', label: 'Extra Large' },
    { value: 'rounded-2xl', label: '2XL' },
    { value: 'rounded-3xl', label: '3XL' },
  ];
}

function generateButtonColorOptions() {
  return [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'accent', label: 'Accent' },
    { value: 'accent-secondary', label: 'Accent Secondary' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'success', label: 'Success' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'white', label: 'White' },
  ];
}

function generateButtonSizeOptions() {
  return [
    { value: 'btn-xs', label: 'Extra Small' },
    { value: 'btn-sm', label: 'Small' },
    { value: 'btn-md', label: 'Medium' },
    { value: 'btn-lg', label: 'Large' },
    { value: 'btn-xl', label: 'Extra Large' },
  ];
}

function generateTextElementSettings(prefix, label) {
  return [
    {
      type: 'textarea',
      id: `${prefix}_content`,
      label: `${label} Content`,
      default: '',
    },
    {
      type: 'select',
      id: `${prefix}_font_family`,
      label: `${label} Font Family`,
      options: generateFontFamilyOptions(),
      default: 'font-primary',
    },
    {
      type: 'select',
      id: `${prefix}_font_size_mobile`,
      label: `${label} Font Size Mobile`,
      options: generateFontSizeOptions(''),
      default: 'text-base',
    },
    {
      type: 'select',
      id: `${prefix}_font_size_desktop`,
      label: `${label} Font Size Desktop`,
      options: generateFontSizeOptions('lg:'),
      default: 'lg:text-lg',
    },
    {
      type: 'select',
      id: `${prefix}_font_weight`,
      label: `${label} Font Weight`,
      options: generateWeightOptions(),
      default: 'font-normal',
    },
    {
      type: 'select',
      id: `${prefix}_color`,
      label: `${label} Color`,
      options: generateColorOptions(),
      default: 'text-primary',
    },
  ];
}

function generateButtonSettings(prefix) {
  return [
    {
      type: 'checkbox',
      id: `${prefix}_show_button`,
      label: 'Show Button',
      default: false,
    },
    {
      type: 'text',
      id: `${prefix}_button_text`,
      label: 'Button Text',
      default: 'Click Here',
    },
    {
      type: 'url',
      id: `${prefix}_button_url`,
      label: 'Button URL',
      default: '#',
    },
    {
      type: 'select',
      id: `${prefix}_button_style`,
      label: 'Button Style',
      options: [
        { value: 'filled', label: 'Filled' },
        { value: 'outline', label: 'Outline' },
        { value: 'ghost', label: 'Ghost' },
      ],
      default: 'filled',
    },
    {
      type: 'select',
      id: `${prefix}_button_color`,
      label: 'Button Color',
      options: generateButtonColorOptions(),
      default: 'primary',
    },
    {
      type: 'select',
      id: `${prefix}_button_size`,
      label: 'Button Size',
      options: generateButtonSizeOptions(),
      default: 'btn-md',
    },
    {
      type: 'select',
      id: `${prefix}_button_font_weight`,
      label: 'Button Font Weight',
      options: generateWeightOptions(),
      default: 'font-medium',
    },
  ];
}

function generateSectionSettings() {
  return [
    {
      type: 'select',
      id: 'background_color',
      label: 'Background Color',
      options: generateBgColorOptions(),
      default: 'bg-neutral',
    },
    {
      type: 'image_picker',
      id: 'background_image',
      label: 'Background Image',
    },
    {
      type: 'select',
      id: 'section_padding_y_mobile',
      label: 'Section Padding Y (Mobile)',
      options: generatePaddingOptions(''),
      default: 'py-xl',
    },
    {
      type: 'select',
      id: 'section_padding_y_desktop',
      label: 'Section Padding Y (Desktop)',
      options: generatePaddingOptions('lg:'),
      default: 'lg:py-3xl',
    },
    {
      type: 'select',
      id: 'section_border_radius',
      label: 'Section Border Radius',
      options: generateRadiusOptions(),
      default: 'rounded-none',
    },
  ];
}

function generateContainerSettings() {
  return [
    {
      type: 'select',
      id: 'container_background_color',
      label: 'Container Background Color',
      options: [...generateBgColorOptions(), { value: 'transparent', label: 'Transparent' }],
      default: 'transparent',
    },
    {
      type: 'image_picker',
      id: 'container_background_image',
      label: 'Container Background Image',
    },
    {
      type: 'select',
      id: 'container_border_radius',
      label: 'Container Border Radius',
      options: generateRadiusOptions(),
      default: 'rounded-none',
    },
    {
      type: 'select',
      id: 'container_padding_y_mobile',
      label: 'Container Padding Y (Mobile)',
      options: generatePaddingOptions(''),
      default: 'py-md',
    },
    {
      type: 'select',
      id: 'container_padding_y_desktop',
      label: 'Container Padding Y (Desktop)',
      options: generatePaddingOptions('lg:'),
      default: 'lg:py-xl',
    },
    {
      type: 'select',
      id: 'container_padding_x_mobile',
      label: 'Container Padding X (Mobile)',
      options: generatePaddingXOptions(''),
      default: 'px-md',
    },
    {
      type: 'select',
      id: 'container_padding_x_desktop',
      label: 'Container Padding X (Desktop)',
      options: generatePaddingXOptions('lg:'),
      default: 'lg:px-xl',
    },
  ];
}

function generateLiquid(sectionName) {
  const kebab = toKebab(sectionName);
  const title = toTitle(sectionName);

  // Build schema
  const schema = {
    name: title,
    tag: 'section',
    class: `section-${kebab}`,
    settings: [
      // Content settings - Heading
      ...generateTextElementSettings('heading', 'Heading'),
      // Content settings - Body
      ...generateTextElementSettings('body', 'Body'),
      // Interactive - Button
      ...generateButtonSettings(''),
      // Layout - Section settings
      ...generateSectionSettings(),
      // Layout - Container settings
      ...generateContainerSettings(),
    ],
  };

  const schemaJSON = JSON.stringify(schema, null, 2);

  const liquid = `<!-- ${title} Section -->
<!-- Generated by scaffold.cjs — Gold Standard compliant -->
<!-- SLOT markers indicate where content agents inject generated copy/visuals -->

<section
  class="{{ section.settings.background_color | default: 'bg-neutral' }} {{ section.settings.section_padding_y_mobile | default: 'py-xl' }} {{ section.settings.section_padding_y_desktop | default: 'lg:py-3xl' }} {{ section.settings.section_border_radius | default: 'rounded-none' }}"
  {% if section.settings.background_image %}
  style="background-image: url('{{ section.settings.background_image | image_url }}'); background-size: cover; background-position: center;"
  {% endif %}
>
  <div class="container {{ section.settings.container_background_color | default: 'transparent' }} {{ section.settings.container_border_radius | default: 'rounded-none' }} {{ section.settings.container_padding_y_mobile | default: 'py-md' }} {{ section.settings.container_padding_y_desktop | default: 'lg:py-xl' }} {{ section.settings.container_padding_x_mobile | default: 'px-md' }} {{ section.settings.container_padding_x_desktop | default: 'lg:px-xl' }}"
    {% if section.settings.container_background_image %}
    style="background-image: url('{{ section.settings.container_background_image | image_url }}'); background-size: cover; background-position: center;"
    {% endif %}
  >
    <!-- SLOT: heading -->
    {% if section.settings.heading_content != blank %}
    <h2 class="{{ section.settings.heading_font_family | default: 'font-primary' }} {{ section.settings.heading_font_size_mobile | default: 'text-3xl' }} {{ section.settings.heading_font_size_desktop | default: 'lg:text-4xl' }} {{ section.settings.heading_font_weight | default: 'font-bold' }} {{ section.settings.heading_color | default: 'text-primary' }}">
      {{ section.settings.heading_content }}
    </h2>
    {% endif %}

    <!-- SLOT: body_copy -->
    {% if section.settings.body_content != blank %}
    <div class="{{ section.settings.body_font_family | default: 'font-body' }} {{ section.settings.body_font_size_mobile | default: 'text-base' }} {{ section.settings.body_font_size_desktop | default: 'lg:text-lg' }} {{ section.settings.body_font_weight | default: 'font-normal' }} {{ section.settings.body_color | default: 'text-primary' }}">
      {{ section.settings.body_content }}
    </div>
    {% endif %}

    <!-- SLOT: button -->
    {% if section.settings.show_button %}
    <a href="{{ section.settings.button_url | default: '#' }}"
       class="btn btn-{{ section.settings.button_style | default: 'filled' }}-{{ section.settings.button_color | default: 'primary' }} {{ section.settings.button_size | default: 'btn-md' }} {{ section.settings.button_font_weight | default: 'font-medium' }} {{ settings.button_border_radius | default: 'rounded' }}">
      {{ section.settings.button_text | default: 'Click Here' }}
    </a>
    {% endif %}
  </div>
</section>

{% schema %}
${schemaJSON}
{% endschema %}
`;

  return liquid;
}

// --- Main ---
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`scaffold.cjs (CLI-04) — Generate Gold Standard .liquid skeleton

Usage: node tools/scaffold.cjs <section-name> [--output path]

Generates a .liquid file with all required schema settings pre-filled:
  - 13 font size options per text element (mobile + desktop)
  - 13 color options per text element
  - 5 font weight options
  - 4 font family options
  - 7 button settings (show, text, url, style, color, size, weight)
  - 5 section settings (bg color, bg image, padding y mobile/desktop, radius)
  - 7 container settings (bg, image, radius, padding x/y mobile/desktop)

The generated skeleton passes schema-validation.cjs with zero errors.

Options:
  --output path  Write to specific path (default: templates/gold-standard/<name>.liquid)

Output:
  stdout: JSON summary
  stderr: Human-readable summary
`);
  process.exit(0);
}

const allArgs = process.argv.slice(2);
const args = allArgs.filter(a => !a.startsWith('--'));
const outputIdx = allArgs.indexOf('--output');
let outputPath = null;
if (outputIdx !== -1 && allArgs[outputIdx + 1]) {
  outputPath = path.resolve(allArgs[outputIdx + 1]);
}

if (args.length === 0) {
  process.stderr.write('Error: No section name provided.\nUsage: node tools/scaffold.cjs <section-name> [--output path]\n');
  process.exit(2);
}

const sectionName = args[0];
const kebab = toKebab(sectionName);

if (!outputPath) {
  if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
    fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  }
  outputPath = path.join(DEFAULT_OUTPUT_DIR, `${kebab}.liquid`);
}

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const liquid = generateLiquid(sectionName);

fs.writeFileSync(outputPath, liquid, 'utf-8');

const result = {
  status: 'created',
  section_name: sectionName,
  output: outputPath,
  settings_count: {
    text_elements: 2,
    settings_per_text_element: 6,
    button_settings: 7,
    section_settings: 5,
    container_settings: 7,
    total: 2 * 6 + 7 + 5 + 7,
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');

process.stderr.write(`\nScaffold: ${sectionName}\n`);
process.stderr.write(`  Output: ${outputPath}\n`);
process.stderr.write(`  Text elements: ${result.settings_count.text_elements} (heading, body)\n`);
process.stderr.write(`  Settings per text element: ${result.settings_count.settings_per_text_element}\n`);
process.stderr.write(`  Button settings: ${result.settings_count.button_settings}\n`);
process.stderr.write(`  Section settings: ${result.settings_count.section_settings}\n`);
process.stderr.write(`  Container settings: ${result.settings_count.container_settings}\n`);
process.stderr.write(`  Total settings: ${result.settings_count.total}\n`);
process.stderr.write(`\n  Run: node tools/schema-validation.cjs ${outputPath}\n`);
process.stderr.write(`  to verify Gold Standard compliance.\n\n`);
