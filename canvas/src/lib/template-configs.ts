/**
 * template-configs.ts — 8 template configurations as TypeScript SlotSchemas.
 *
 * These are developer-curated, locked templates. Users cannot modify the field
 * definitions — they are ported faithfully from templates/editor.js TEMPLATES object.
 *
 * Source: templates/editor.js TEMPLATES variable.
 *
 * Each template exports a SlotSchema (field defs, brush config, dimensions) and a
 * TemplateMetadata record (name, description, thumbnailPath, platform, dimensions)
 * for use in the template gallery UI.
 */

import type { SlotSchema } from './slot-schema';

// ─── Template Metadata ────────────────────────────────────────────────────────

export interface TemplateMetadata {
  templateId: string;
  name: string;
  description: string;
  /** Path to thumbnail image, relative to canvas/public/ */
  thumbnailPath: string;
  platform: 'instagram-square' | 'linkedin-landscape' | 'unknown';
  dimensions: { width: number; height: number };
}

// ─── Template Configs (SlotSchemas) ───────────────────────────────────────────

/** t1-quote — Client Testimonial / Quote (1080×1080) */
const t1Quote: SlotSchema = {
  templateId: 't1-quote',
  width: 1080,
  height: 1080,
  fields: [
    { type: 'text', sel: '.name',           label: 'Name',           mode: 'pre',  rows: 2 },
    { type: 'text', sel: '.title',          label: 'Title',          mode: 'pre',  rows: 2 },
    { type: 'text', sel: '.handle',         label: 'Handle',         mode: 'text', rows: 1 },
    { type: 'text', sel: '.category span',  label: 'Side label',     mode: 'text', rows: 1 },
    { type: 'text', sel: '.quote',          label: 'Quote',          mode: 'pre',  rows: 5 },
    { type: 'image', sel: '.photo img',      label: 'Portrait Photo', dims: '353 × 439px' },
  ],
  brush: null,
};

/** t2-app-highlight — App Feature / Product Highlight (1080×1080) */
const t2AppHighlight: SlotSchema = {
  templateId: 't2-app-highlight',
  width: 1080,
  height: 1080,
  fields: [
    { type: 'text',  sel: '.headline',       label: 'Headline',             mode: 'text', rows: 2 },
    { type: 'text',  sel: '.accent-label p', label: 'Accent Label',         mode: 'pre',  rows: 2 },
    { type: 'image', sel: '.mockup img',      label: 'App / Product Mockup', dims: '1105 × 829px' },
  ],
  brush: null,
};

/** t3-partner-alert — Partner Alert (Landscape 1340×630) */
const t3PartnerAlert: SlotSchema = {
  templateId: 't3-partner-alert',
  width: 1340,
  height: 630,
  fields: [
    { type: 'text',  sel: '.headline',       label: 'Headline',     mode: 'text', rows: 2 },
    { type: 'text',  sel: '.accent-label p', label: 'Accent Label', mode: 'br',   rows: 2 },
    { type: 'image', sel: '.phone img',       label: 'Phone Mockup', dims: '945 × 630px' },
  ],
  brush: '.circle-sketch',
  brushLabel: 'circle sketch',
};

/** t4-fluid-ad — Fluid Capabilities — Instagram Ad (1080×1080) */
const t4FluidAd: SlotSchema = {
  templateId: 't4-fluid-ad',
  width: 1080,
  height: 1080,
  fields: [
    { type: 'text', sel: '.headline', label: 'Headline', mode: 'br',   rows: 3 },
    { type: 'text', sel: '.tagline',  label: 'Tagline',  mode: 'text', rows: 1 },
    { type: 'text', sel: '.handle',   label: 'Handle',   mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(1) .feature-name',  label: 'Feature 1 Name',  mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(1) .feature-label', label: 'Feature 1 Label', mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(2) .feature-name',  label: 'Feature 2 Name',  mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(2) .feature-label', label: 'Feature 2 Label', mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(3) .feature-name',  label: 'Feature 3 Name',  mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(3) .feature-label', label: 'Feature 3 Label', mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(4) .feature-name',  label: 'Feature 4 Name',  mode: 'text', rows: 1 },
    { type: 'text', sel: '.features .feature-item:nth-child(4) .feature-label', label: 'Feature 4 Label', mode: 'text', rows: 1 },
    { type: 'image', sel: '.phone img', label: 'Phone Mockup', dims: '680 × 920px' },
  ],
  brush: '.circle-brush',
  brushLabel: 'circle brush',
};

/** t5-partner-announcement — Partner Announcement (Landscape 1340×630) */
const t5PartnerAnnouncement: SlotSchema = {
  templateId: 't5-partner-announcement',
  width: 1340,
  height: 630,
  fields: [
    { type: 'text',  sel: '.headline',          label: 'Headline',       mode: 'text', rows: 3 },
    { type: 'text',  sel: '.person-name',        label: 'Person Name',    mode: 'text', rows: 1 },
    { type: 'text',  sel: '.person-title',       label: 'Person Title',   mode: 'text', rows: 1 },
    { type: 'image', sel: '.person-photo img',   label: 'Person Portrait', dims: '263 × 327px' },
  ],
  brush: '.circle-brush-wrap',
  brushLabel: 'circle brush',
};

/** t6-employee-spotlight — Employee Spotlight (1080×1080) */
const t6EmployeeSpotlight: SlotSchema = {
  templateId: 't6-employee-spotlight',
  width: 1080,
  height: 1080,
  fields: [
    { type: 'text',  sel: '.headline',           label: 'Headline',         mode: 'br',   rows: 3 },
    { type: 'text',  sel: '.category span',      label: 'Side label',       mode: 'text', rows: 1 },
    { type: 'text',  sel: '.employee-name',       label: 'Employee Name',    mode: 'text', rows: 1 },
    { type: 'text',  sel: '.employee-title',      label: 'Employee Title',   mode: 'text', rows: 1 },
    { type: 'image', sel: '.employee-photo img',  label: 'Employee Portrait', dims: '263 × 327px' },
  ],
  brush: null,
};

/** t7-carousel — Carousel: Insights (1080×1080, 4 slides) */
const t7Carousel: SlotSchema = {
  templateId: 't7-carousel',
  width: 1080,
  height: 1080,
  carouselCount: 4,
  fields: [
    /* Slide 1 */
    { type: 'divider', label: 'Slide 01 — Cover' },
    { type: 'text',  sel: '[data-slide="1"] .slide-counter',     label: 'Counter · slide 1',   mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="1"] .slide-label span',  label: 'Side label · slide 1', mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="1"] .s1-headline', label: 'Headline',       mode: 'br',   rows: 3 },
    { type: 'text',  sel: '[data-slide="1"] .s1-name',     label: 'Employee Name',  mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="1"] .s1-title',    label: 'Employee Title', mode: 'text', rows: 1 },
    { type: 'image', sel: '[data-slide="1"] .s1-photo img', label: 'Portrait Photo', dims: '263 × 327px' },
    /* Slide 2 */
    { type: 'divider', label: 'Slide 02 — Intro Text' },
    { type: 'text',  sel: '[data-slide="2"] .slide-counter',     label: 'Counter · slide 2',   mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="2"] .slide-label span',  label: 'Side label · slide 2', mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="2"] .s2-body',     label: 'Body Copy',      mode: 'pre',  rows: 6 },
    /* Slide 3 */
    { type: 'divider', label: 'Slide 03 — Tool Feature' },
    { type: 'text',  sel: '[data-slide="3"] .slide-counter',     label: 'Counter · slide 3',   mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="3"] .slide-label span',  label: 'Side label · slide 3', mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="3"] .s3-tool-name',        label: 'Tool Name',    mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="3"] .s3-body',             label: 'Description',  mode: 'pre',  rows: 5 },
    { type: 'text',  sel: '[data-slide="3"] .s3-difficulty-value', label: 'Difficulty',   mode: 'text', rows: 1 },
    { type: 'image', sel: '[data-slide="3"] .s3-screenshot img',   label: 'Screenshot',   dims: '852 × 399px' },
    /* Slide 4 */
    { type: 'divider', label: 'Slide 04 — App Feature' },
    { type: 'text',  sel: '[data-slide="4"] .slide-counter',     label: 'Counter · slide 4',   mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="4"] .slide-label span',  label: 'Side label · slide 4', mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="4"] .s4-feature-name', label: 'Feature Name', mode: 'text', rows: 1 },
    { type: 'text',  sel: '[data-slide="4"] .s4-body-1',       label: 'Paragraph 1',  mode: 'pre',  rows: 4 },
    { type: 'text',  sel: '[data-slide="4"] .s4-body-2',       label: 'Paragraph 2',  mode: 'pre',  rows: 4 },
  ],
  brush: '[data-slide="2"] .s2-arrow',
  brushLabel: 'arrow',
};

/** t8-quarterly-stats — Quarterly Stats: Carousel (1080×1080, 4 slides) */
const t8QuarterlyStats: SlotSchema = {
  templateId: 't8-quarterly-stats',
  width: 1080,
  height: 1080,
  carouselCount: 4,
  fields: [
    /* Slide 1 */
    { type: 'divider', label: 'Slide 01 — Cover' },
    { type: 'text', sel: '[data-slide="1"] .slide-counter',     label: 'Counter · slide 1',   mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .slide-label span',  label: 'Side label · slide 1', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .s1-eyebrow',    label: 'Eyebrow (e.g. Fluid · Q1 2026)', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .s1-quarter',    label: 'Quarter (e.g. Q1)',               mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .s1-year',       label: 'Year',                            mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .s1-hero-num',   label: 'Hero Stat (e.g. +34%)',           mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="1"] .s1-hero-label', label: 'Hero Label',                      mode: 'text', rows: 1 },
    /* Slide 2 */
    { type: 'divider', label: 'Slide 02 — Three Stats' },
    { type: 'text', sel: '[data-slide="2"] .slide-counter',     label: 'Counter · slide 2',   mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .slide-label span',  label: 'Side label · slide 2', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-intro',           label: 'Intro Copy',    mode: 'pre',  rows: 3 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-1 .s2-num',   label: 'Stat 1 Number', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-1 .s2-lbl',   label: 'Stat 1 Label',  mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-2 .s2-num',   label: 'Stat 2 Number', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-2 .s2-lbl',   label: 'Stat 2 Label',  mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-3 .s2-num',   label: 'Stat 3 Number', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-col-3 .s2-lbl',   label: 'Stat 3 Label',  mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="2"] .s2-footnote',         label: 'Footnote',      mode: 'pre',  rows: 2 },
    /* Slide 3 */
    { type: 'divider', label: 'Slide 03 — AI Efficiency' },
    { type: 'text', sel: '[data-slide="3"] .slide-counter',     label: 'Counter · slide 3',   mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="3"] .slide-label span',  label: 'Side label · slide 3', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="3"] .s3-eyebrow',   label: 'Eyebrow',        mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="3"] .s3-big-num',   label: 'Big Number',     mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="3"] .s3-unit',      label: 'Unit Label',     mode: 'pre',  rows: 2 },
    { type: 'text', sel: '[data-slide="3"] .s3-body',      label: 'Body Copy',      mode: 'pre',  rows: 4 },
    { type: 'text', sel: '[data-slide="3"] .s3-secondary', label: 'Secondary Note', mode: 'text', rows: 1 },
    /* Slide 4 */
    { type: 'divider', label: 'Slide 04 — Outlook' },
    { type: 'text', sel: '[data-slide="4"] .slide-counter',     label: 'Counter · slide 4',   mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .slide-label span',  label: 'Side label · slide 4', mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-eyebrow',              label: "Eyebrow (e.g. What's Next)", mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-headline',             label: 'Headline',                    mode: 'br',   rows: 3 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-1 .s4-mini-num',  label: 'Mini Stat 1 Number',          mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-1 .s4-mini-lbl',  label: 'Mini Stat 1 Label',           mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-2 .s4-mini-num',  label: 'Mini Stat 2 Number',          mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-2 .s4-mini-lbl',  label: 'Mini Stat 2 Label',           mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-3 .s4-mini-num',  label: 'Mini Stat 3 Number',          mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-mini-3 .s4-mini-lbl',  label: 'Mini Stat 3 Label',           mode: 'text', rows: 1 },
    { type: 'text', sel: '[data-slide="4"] .s4-tagline',               label: 'Tagline',                     mode: 'pre',  rows: 2 },
  ],
  brush: null,
};

// ─── Catalog ────────────────────────────────────────────────────────────────

/** All 8 template schemas, keyed by templateId */
export const TEMPLATE_SCHEMAS: Record<string, SlotSchema> = {
  't1-quote':                t1Quote,
  't2-app-highlight':        t2AppHighlight,
  't3-partner-alert':        t3PartnerAlert,
  't4-fluid-ad':             t4FluidAd,
  't5-partner-announcement': t5PartnerAnnouncement,
  't6-employee-spotlight':   t6EmployeeSpotlight,
  't7-carousel':             t7Carousel,
  't8-quarterly-stats':      t8QuarterlyStats,
};

/** Template metadata for the gallery UI */
export const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    templateId: 't1-quote',
    name: 'Client Testimonial / Quote',
    description: 'Portrait photo with name, title, handle, and pull quote',
    thumbnailPath: 'templates/thumbnails/template_1.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
  {
    templateId: 't2-app-highlight',
    name: 'App Feature / Product Highlight',
    description: 'Headline, accent label, and app/product mockup',
    thumbnailPath: 'templates/thumbnails/template_2.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
  {
    templateId: 't3-partner-alert',
    name: 'Partner Alert (Landscape)',
    description: 'Headline, accent label, phone mockup, and movable circle sketch',
    thumbnailPath: 'templates/thumbnails/template_3.png',
    platform: 'linkedin-landscape',
    dimensions: { width: 1340, height: 630 },
  },
  {
    templateId: 't4-fluid-ad',
    name: 'Fluid Capabilities — Instagram Ad',
    description: 'Headline, 4 feature items, phone mockup, and movable circle brush',
    thumbnailPath: 'templates/thumbnails/template_4.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
  {
    templateId: 't5-partner-announcement',
    name: 'Partner Announcement (Landscape)',
    description: 'Headline, person name/title/portrait, and movable circle brush',
    thumbnailPath: 'templates/thumbnails/template_5.png',
    platform: 'linkedin-landscape',
    dimensions: { width: 1340, height: 630 },
  },
  {
    templateId: 't6-employee-spotlight',
    name: 'Employee Spotlight',
    description: 'Headline, employee name/title, and portrait photo',
    thumbnailPath: 'templates/thumbnails/template_6.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
  {
    templateId: 't7-carousel',
    name: 'Carousel — Insights',
    description: '4-slide carousel: cover, intro text, tool feature, app feature. Movable counter, side label, and arrow on slide 2.',
    thumbnailPath: 'templates/thumbnails/template_7.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
  {
    templateId: 't8-quarterly-stats',
    name: 'Quarterly Stats — Carousel',
    description: '4-slide carousel: cover stat, three stats, AI efficiency, outlook',
    thumbnailPath: 'templates/thumbnails/template_8.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  },
];

// ─── Accessor functions ──────────────────────────────────────────────────────

/**
 * Get the SlotSchema for a template by ID.
 * Returns undefined if the template does not exist.
 */
export function getTemplateSchema(templateId: string): SlotSchema | undefined {
  return TEMPLATE_SCHEMAS[templateId];
}

/**
 * Guess template id from stored html_path (e.g. `social/t1-quote.html` → `t1-quote`).
 */
export function inferTemplateIdFromHtmlPath(htmlPath: string | null | undefined): string | undefined {
  if (!htmlPath || typeof htmlPath !== 'string') return undefined;
  const base = htmlPath.split(/[/\\]/).pop()?.replace(/\.html$/i, '') ?? '';
  if (base && TEMPLATE_SCHEMAS[base]) return base;
  return undefined;
}

function isUsableStoredSlotSchema(s: unknown): s is SlotSchema {
  if (!s || typeof s !== 'object') return false;
  const o = s as SlotSchema;
  return (
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    Array.isArray(o.fields) &&
    o.fields.length > 0
  );
}

/**
 * Use DB slot_schema when it has fields; otherwise fall back to the canonical schema for
 * `template_id` or inferred id from `html_path` (fixes empty pick targets + missing sidebar fields).
 */
export function resolveSlotSchemaForIteration(
  stored: unknown,
  templateId: string | null | undefined,
  htmlPath: string | null | undefined
): SlotSchema | null {
  const tid =
    (templateId && String(templateId).trim()) || inferTemplateIdFromHtmlPath(htmlPath ?? undefined) || '';
  const canonical = tid ? getTemplateSchema(tid) : undefined;

  if (isUsableStoredSlotSchema(stored)) {
    /** Keep editor fields from DB but refresh brush/chrome targets from canonical (template HTML + pick list evolve). */
    if (canonical && canonical.templateId === tid) {
      return {
        ...stored,
        brush: canonical.brush !== undefined ? canonical.brush : stored.brush,
        brushLabel: canonical.brushLabel !== undefined ? canonical.brushLabel : stored.brushLabel,
        brushAdditional:
          canonical.brushAdditional !== undefined ? canonical.brushAdditional : stored.brushAdditional,
        carouselCount:
          canonical.carouselCount !== undefined ? canonical.carouselCount : stored.carouselCount,
      };
    }
    return stored;
  }
  if (tid && canonical) return canonical;
  return null;
}

/**
 * Get the metadata record for a template by ID.
 * Returns undefined if the template does not exist.
 */
export function getTemplateMetadata(templateId: string): TemplateMetadata | undefined {
  return TEMPLATE_METADATA.find((m) => m.templateId === templateId);
}

/**
 * Get all template IDs.
 */
export function getTemplateIds(): string[] {
  return Object.keys(TEMPLATE_SCHEMAS);
}
