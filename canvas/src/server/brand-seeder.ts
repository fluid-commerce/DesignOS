/**
 * Seed functions for populating voice_guide_docs, brand_patterns, and
 * template_design_rules tables from existing source files and hardcoded content.
 *
 * All functions are idempotent: they check if data already exists before inserting.
 * Server-only module — NEVER import from React components or client code.
 */

import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';
import * as fs from 'node:fs/promises';
import fsSync from 'node:fs';
import * as path from 'node:path';

// ─── Voice Guide ─────────────────────────────────────────────────────────────

const VOICE_GUIDE_DOCS = [
  { slug: 'what-is-fluid', label: 'What Is Fluid', file: 'What_Is_Fluid.md' },
  { slug: 'the-problem', label: "The Problem We're Solving", file: 'The_Problem_Were_Solving.md' },
  { slug: 'why-wecommerce', label: 'Why WeCommerce Exists', file: 'Why_WeCommerce_Exists.md' },
  { slug: 'voice-and-style', label: 'Voice and Style Guide', file: 'Voice_and_Style_Guide.md' },
  { slug: 'builder', label: 'Builder', file: 'Builder.md' },
  { slug: 'checkout', label: 'Checkout', file: 'Checkout.md' },
  { slug: 'droplets', label: 'Droplets', file: 'Droplets.md' },
  { slug: 'fluid-connect', label: 'Fluid Connect', file: 'Fluid_Connect.md' },
  { slug: 'fluid-payments', label: 'Fluid Payments', file: 'Fluid_Payments.md' },
  { slug: 'fair-share', label: 'FairShare', file: 'FairShare.md' },
  { slug: 'corporate-tools', label: 'Corporate Tools', file: 'Corporate_Tools.md' },
  { slug: 'app-rep-tools', label: 'App Rep Tools', file: 'App_Rep_Tools.md' },
  { slug: 'blitz-week', label: 'What Is Blitz Week', file: 'What_is_Blitz_Week.md' },
];

/**
 * Seeds voice_guide_docs table from .md files if the table is empty.
 * @param voiceGuideDir — absolute path to the voice-guide/ directory
 * @returns number of rows that exist after seeding (inserted or pre-existing)
 */
export async function seedVoiceGuideIfEmpty(voiceGuideDir: string): Promise<number> {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM voice_guide_docs').get() as { c: number }).c;
  if (count > 0) return count;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO voice_guide_docs (id, slug, label, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  let order = 0;
  let inserted = 0;
  for (const doc of VOICE_GUIDE_DOCS) {
    try {
      const content = await fs.readFile(path.join(voiceGuideDir, doc.file), 'utf-8');
      insert.run(nanoid(), doc.slug, doc.label, content, order++, Date.now());
      inserted++;
    } catch {
      // Skip missing files gracefully
      order++;
    }
  }
  return inserted;
}

// ─── Brand Patterns ──────────────────────────────────────────────────────────

interface PatternSource {
  slug: string;
  label: string;
  category: string;
  file: string;
  weight: number;
  isCore: boolean;
}

const PATTERN_SOURCES: PatternSource[] = [
  // Colors
  {
    slug: 'color-palette',
    label: 'Color Palette',
    category: 'colors',
    file: 'color-palette.md',
    weight: 90,
    isCore: true,
  },
  {
    slug: 'rgba-overlay-patterns',
    label: 'RGBA Overlay Patterns',
    category: 'colors',
    file: 'rgba-overlay-patterns.md',
    weight: 80,
    isCore: false,
  },
  {
    slug: 'opacity-patterns',
    label: 'Opacity Patterns',
    category: 'colors',
    file: 'opacity-patterns.md',
    weight: 80,
    isCore: false,
  },
  // Typography
  {
    slug: 'typography',
    label: 'Typography',
    category: 'typography',
    file: 'typography.md',
    weight: 90,
    isCore: true,
  },
  {
    slug: 'social-typography-scale',
    label: 'Social Typography Scale',
    category: 'typography',
    file: 'social-typography-scale.md',
    weight: 85,
    isCore: false,
  },
  {
    slug: 'flfont-tagline-patterns',
    label: 'FLFont Tagline Patterns',
    category: 'typography',
    file: 'flfont-tagline-patterns.md',
    weight: 80,
    isCore: false,
  },
  {
    slug: 'uppercase-patterns',
    label: 'Uppercase Patterns',
    category: 'typography',
    file: 'uppercase-patterns.md',
    weight: 80,
    isCore: false,
  },
  {
    slug: 'typographic-treatments',
    label: 'Typographic Treatments',
    category: 'typography',
    file: 'typographic-treatments.md',
    weight: 80,
    isCore: false,
  },
  // Logos
  {
    slug: 'footer-structure',
    label: 'Footer Structure',
    category: 'logos',
    file: 'footer-structure.md',
    weight: 85,
    isCore: false,
  },
  // Images
  {
    slug: 'photos-mockups',
    label: 'Photos & Mockups',
    category: 'images',
    file: 'photos-mockups.md',
    weight: 70,
    isCore: false,
  },
  // Decorations
  {
    slug: 'decorative-minimums',
    label: 'Decorative Minimums',
    category: 'decorations',
    file: 'decorative-minimums.md',
    weight: 90,
    isCore: false,
  },
  {
    slug: 'brushstroke-textures',
    label: 'Brushstroke Textures',
    category: 'decorations',
    file: 'brushstroke-textures.md',
    weight: 85,
    isCore: false,
  },
  {
    slug: 'circles-underlines',
    label: 'Circles & Underlines',
    category: 'decorations',
    file: 'circles-underlines.md',
    weight: 85,
    isCore: false,
  },
  {
    slug: 'line-textures',
    label: 'Line Textures',
    category: 'decorations',
    file: 'line-textures.md',
    weight: 70,
    isCore: false,
  },
  {
    slug: 'scribble-textures',
    label: 'Scribble Textures',
    category: 'decorations',
    file: 'scribble-textures.md',
    weight: 70,
    isCore: false,
  },
  {
    slug: 'x-mark-textures',
    label: 'X-Mark Textures',
    category: 'decorations',
    file: 'x-mark-textures.md',
    weight: 70,
    isCore: false,
  },
  // Archetypes
  {
    slug: 'layout-archetypes',
    label: 'Layout Archetypes',
    category: 'archetypes',
    file: 'layout-archetypes.md',
    weight: 90,
    isCore: true,
  },
];

/**
 * Seeds brand_patterns table from .md files in the pattern-seeds directory if the table is empty.
 * @param patternSeedsDir — absolute path to the pattern-seeds/ directory
 * @returns number of rows that exist after seeding (inserted or pre-existing)
 */
export async function seedBrandPatternsIfEmpty(patternSeedsDir: string): Promise<number> {
  const db = getDb();
  const htmlPatternCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM brand_patterns WHERE category != 'visual-style'")
      .get() as { c: number }
  ).c;
  if (htmlPatternCount > 0) return htmlPatternCount;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  let order = 0;
  let inserted = 0;
  for (const source of PATTERN_SOURCES) {
    try {
      const content = await fs.readFile(path.join(patternSeedsDir, source.file), 'utf-8');
      insert.run(
        nanoid(),
        source.slug,
        source.label,
        source.category,
        content,
        source.weight,
        source.isCore ? 1 : 0,
        order++,
        Date.now(),
      );
      inserted++;
    } catch {
      order++;
    }
  }
  return inserted;
}

/**
 * Migrate existing HTML-based pattern content to clean markdown from seed files.
 * Overwrites content for all patterns that have a matching seed file.
 * Safe to call multiple times — idempotent based on file content.
 */
export async function migratePatternsToMarkdown(patternSeedsDir: string): Promise<number> {
  const db = getDb();
  const update = db.prepare('UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?');
  let migrated = 0;
  const now = Date.now();
  for (const source of PATTERN_SOURCES) {
    try {
      const content = await fs.readFile(path.join(patternSeedsDir, source.file), 'utf-8');
      const result = update.run(content, now, source.slug);
      if (result.changes > 0) migrated++;
    } catch {
      // Skip missing files
    }
  }
  return migrated;
}

/**
 * Split large pattern entries into separate rules for existing databases.
 * Creates new rows from sections extracted from color-palette and typography.
 * Idempotent: checks if target slugs already exist before splitting.
 */
export async function splitPatternEntries(patternSeedsDir: string): Promise<number> {
  const db = getDb();
  let created = 0;
  const now = Date.now();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
  );

  // Only split if the new slugs don't exist yet
  const newSlugs = ['rgba-overlay-patterns', 'social-typography-scale', 'uppercase-patterns'];
  const existing = db
    .prepare(`SELECT slug FROM brand_patterns WHERE slug IN (${newSlugs.map(() => '?').join(',')})`)
    .all(...newSlugs) as Array<{ slug: string }>;

  if (existing.length >= newSlugs.length) return 0; // already split

  const maxOrder =
    (db.prepare('SELECT MAX(sort_order) as m FROM brand_patterns').get() as { m: number })?.m ?? 20;
  let order = maxOrder + 1;

  for (const source of PATTERN_SOURCES) {
    if (!newSlugs.includes(source.slug)) continue;
    if (existing.some((e) => e.slug === source.slug)) continue;
    try {
      const content = await fs.readFile(path.join(patternSeedsDir, source.file), 'utf-8');
      insert.run(
        nanoid(),
        source.slug,
        source.label,
        source.category,
        content,
        source.weight,
        order++,
        now,
      );
      created++;
    } catch {
      // Seed file not found — skip
    }
  }

  // Update the core entries to trimmed versions from seed files
  if (created > 0) {
    const update = db.prepare(
      'UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?',
    );
    for (const slug of ['color-palette', 'typography']) {
      const source = PATTERN_SOURCES.find((s) => s.slug === slug);
      if (!source) continue;
      try {
        const content = await fs.readFile(path.join(patternSeedsDir, source.file), 'utf-8');
        update.run(content, now, slug);
      } catch {
        // pattern seed file missing or unreadable — skip
      }
    }
  }

  return created;
}

// ─── Global Visual Style ─────────────────────────────────────────────────────

const VISUAL_COMPOSITOR_CONTRACT = `# Visual Compositor Contract — Fluid Social Posts

These rules define what makes a Fluid social post look "designed" rather than a web page.

## Canvas
- Fixed canvas with \`overflow: hidden\` — this is a poster, not a web page
- No scrolling. Content must fit within the fixed dimensions.

## Required Visual Layers (back to front)
1. **Background** — solid color or gradient, extends to all edges
2. **Texture/Brushstroke** — at least one decorative element with \`mix-blend-mode: screen\` and \`opacity: 0.10–0.25\`, positioned partially off-canvas (edge-bleed)
3. **Content** — headline, subtext, positioned via \`position: absolute\` (not flexbox/grid)
4. **Footer** — Fluid logo + We-Commerce wordmark left, Fluid dots right

## Typography Scale
- Headline must be 5–8x larger than body text (e.g., headline 72–120px, body 14–18px)
- Use only \`flfontbold\` for brand taglines and \`NeueHaas\` (Inter) for all other text
- Maximum 2 font families per post

## Positioning
- All major elements positioned with \`position: absolute\` and pixel values
- Content intentionally inset from edges (40–80px padding from canvas border)
- Background extends to edges; content does not

## Required Elements
- Logo (Fluid logo from brand assets)
- At least one tagline in flfontbold
- At least one decorative element (brushstroke or circle sketch)
- At least one \`mix-blend-mode\` or CSS \`filter\` effect

## Color
- Limited palette: one accent color + black (#000) + white (#fff) + opacity variants
- Accent colors: orange (#FF6B35) for pain, blue (#4A90D9) for trust, green (#7BC67E) for proof, purple (#9B59B6) for premium
- Use \`rgba()\` for opacity variants, not separate color definitions

## Anti-Patterns (reframed as positive constraints)
- Use \`position: absolute\` for layout, not CSS Grid or Flexbox
- Use pixel dimensions matching the target canvas (1080x1080 for Instagram)
- All @font-face declarations must use URLs from list_brand_assets, never base64
- All image/texture references must use URLs from list_brand_assets, never base64
`;

/**
 * Seeds the Visual Compositor Contract into brand_patterns (category: visual-style) if not present.
 * Idempotent: uses INSERT OR IGNORE, slug uniqueness guard.
 */
export async function seedGlobalVisualStyleIfEmpty(): Promise<void> {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    nanoid(),
    'visual-compositor-contract',
    'Visual Compositor Contract',
    'visual-style',
    VISUAL_COMPOSITOR_CONTRACT,
    0,
    Date.now(),
  );
}

// ─── Font Enforcement ────────────────────────────────────────────────────────

const FONT_ENFORCEMENT_PATTERN = `# Font Enforcement (weight: 90)

Only fonts registered in the brand's asset library may be used. Any font-family declaration referencing a font NOT in brand_assets is a violation.

For this brand: NeueHaas (NeueHaasDisplay) and flfontbold (FLFont) are the ONLY allowed fonts.
- NeueHaas / NeueHaasDisplay — all body text, headlines, subtext
- flfontbold / FLFont — brand taglines only
- sans-serif — allowed ONLY as a generic fallback

Prohibited fonts include but are not limited to: Syne, DM Sans, Inter, Georgia, Times New Roman, Arial, Helvetica, any Google Fonts.

(weight: 90)
`;

/**
 * Seeds the Font Enforcement pattern into brand_patterns (category: pattern) if not present.
 * Idempotent: uses INSERT OR IGNORE, slug uniqueness guard.
 */
export async function seedFontEnforcementIfEmpty(): Promise<void> {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    nanoid(),
    'font-enforcement',
    'Font Enforcement',
    'pattern',
    FONT_ENFORCEMENT_PATTERN,
    100,
    Date.now(),
  );
}

// ─── Design Rules ─────────────────────────────────────────────────────────────

interface DesignRuleInput {
  scope: string;
  platform: string | null;
  archetypeSlug: string | null;
  label: string;
  content: string;
  sortOrder: number;
}

const DESIGN_RULES_SEED: DesignRuleInput[] = [
  {
    scope: 'global-social',
    platform: null,
    archetypeSlug: null,
    label: 'Social Media — General Rules',
    content:
      'General rules about social media posts — canvas dimensions, the compositor layer model, footer requirements, typography scale ratio. Cross-reference the Visual Compositor Contract for full details. These rules apply to ALL social media posts regardless of platform.',
    sortOrder: 0,
  },
  {
    scope: 'platform',
    platform: 'instagram',
    archetypeSlug: null,
    label: 'Instagram Brand Guidelines',
    content:
      'Instagram-specific rules — 1080x1080px square canvas, high-contrast text for mobile viewing, bold headline-forward compositions, touch-friendly CTA placement (bottom third).',
    sortOrder: 10,
  },
  {
    scope: 'platform',
    platform: 'linkedin',
    archetypeSlug: null,
    label: 'LinkedIn Brand Guidelines',
    content:
      'LinkedIn-specific rules — 1200x627px landscape canvas, professional but bold tone, slightly more restrained brushstroke usage, text-heavy compositions acceptable (professional audience reads more).',
    sortOrder: 11,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'problem-first',
    label: 'Problem-First Design Notes',
    content:
      'Problem-First — headline dominates canvas (60%+ of visual weight). Pain-point text in large flfontbold. Accent: orange (#FF6B35). Dark background with brushstroke texture bleeding off top-right edge. Subtext small and secondary.',
    sortOrder: 20,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'quote',
    label: 'Quote/Testimonial Design Notes',
    content:
      'Quote/Testimonial — centered quote in large flfontbold with circle sketch accent behind key word. Attribution smaller below. Brushstroke texture subtle, background usually dark.',
    sortOrder: 21,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'stat-proof',
    label: 'Stat Proof Design Notes',
    content:
      "Stat Proof — giant number (120px+) as focal point. Supporting text frames the stat's meaning. Green (#7BC67E) accent for proof/evidence. Minimal decoration — the number IS the decoration.",
    sortOrder: 22,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'app-highlight',
    label: 'App Highlight Design Notes',
    content:
      'App Highlight — product feature showcase. Blue (#4A90D9) accent for trust. Screenshot or UI element as visual anchor. Text describes the feature benefit, not the feature itself.',
    sortOrder: 23,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'manifesto',
    label: 'Manifesto Design Notes',
    content:
      'Manifesto — brand philosophy statement. Large flfontbold text fills most of canvas. Minimal decoration — text IS the design. Purple (#9B59B6) accent for premium/aspirational.',
    sortOrder: 24,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'partner-alert',
    label: 'Partner Alert Design Notes',
    content:
      'Partner Alert — partnership announcement. Dual-brand friendly layout. Blue (#4A90D9) accent. Logo placement prominent. Announcement-style headline.',
    sortOrder: 25,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'feature-spotlight',
    label: 'Feature Spotlight Design Notes',
    content:
      'Feature Spotlight — product capability deep-dive. Blue (#4A90D9) accent for trust/technology. More technical copy acceptable. Visual balance between text and illustrative element.',
    sortOrder: 26,
  },
];

/**
 * Seeds the template_design_rules table with 10 design rule rows if the table is empty.
 * Idempotent: skips if COUNT(*) > 0.
 */
// ─── Templates ────────────────────────────────────────────────────────────────

interface TemplateSeed {
  id: string;
  type: string;
  num: string;
  name: string;
  file: string;
  layout: string;
  dims: string | null;
  description: string;
  contentSlots: Array<{ slot: string; spec: string; color: string | null }>;
  extraTables: Array<{ label: string; headers: string[] | null; rows: string[][] }> | null;
  previewPath: string;
  sortOrder: number;
}

const TEMPLATE_SEEDS: TemplateSeed[] = [
  // ── Social Templates ──────────────────────────────────────────────────────
  {
    id: 'social-t1-quote',
    type: 'social',
    num: '01',
    name: 'Client Testimonial / Quote',
    file: 't1-quote',
    layout: 'square',
    dims: '236:447',
    description:
      'Portrait photo top-left. Large white name overlapping right. flfontbold title + handle in accent blue. Full-width quote in the lower half. Rotated label on far right edge.',
    contentSlots: [
      {
        slot: '{{PHOTO}}',
        spec: 'Portrait \u00b7 353\u00d7439px \u00b7 left:35 top:46',
        color: null,
      },
      { slot: '{{NAME}}', spec: 'NeueHaas 900 \u00b7 109px \u00b7 lh 80%', color: 'white' },
      { slot: '{{TITLE}}', spec: 'flfontbold \u00b7 68px \u00b7 lh 100%', color: 'blue' },
      { slot: '{{HANDLE}}', spec: 'flfontbold \u00b7 36px', color: 'blue' },
      {
        slot: '{{CATEGORY}}',
        spec: 'NeueHaas 700 \u00b7 24px \u00b7 rotate 90\u00b0',
        color: 'white',
      },
      {
        slot: '{{QUOTE}}',
        spec: 'NeueHaas 900 \u00b7 56px \u00b7 width 921px \u00b7 hanging quotes',
        color: 'white',
      },
    ],
    extraTables: null,
    previewPath: 'social/t1-quote.html',
    sortOrder: 0,
  },
  {
    id: 'social-t2-app-highlight',
    type: 'social',
    num: '02',
    name: 'App Feature / Product Highlight',
    file: 't2-app-highlight',
    layout: 'square',
    dims: '236:528',
    description:
      'Massive bold headline top half. Product/app mockup bleeds into lower half. flfontbold accent label overlaps at \u221229\u00b0. Brand logos bottom bar. Slide counter + rotated label on right edge.',
    contentSlots: [
      {
        slot: '{{HEADLINE}}',
        spec: 'NeueHaas 900 \u00b7 169px \u00b7 lh 75% \u00b7 centered \u00b7 uppercase',
        color: 'white',
      },
      {
        slot: '{{MOCKUP}}',
        spec: 'Product image \u00b7 left:-1 top:450 \u00b7 bleeds full width',
        color: null,
      },
      {
        slot: '{{ACCENT_LABEL}}',
        spec: 'flfontbold \u00b7 72px \u00b7 rotate \u221229\u00b0 \u00b7 overlaps mockup',
        color: 'blue',
      },
      {
        slot: '{{SLIDE_NUM}}',
        spec: 'NeueHaas 700 \u00b7 24px \u00b7 top-right e.g. "01/12"',
        color: 'white',
      },
      {
        slot: '{{CATEGORY}}',
        spec: 'NeueHaas 700 \u00b7 24px \u00b7 rotate 90\u00b0 \u00b7 right edge',
        color: 'white',
      },
      {
        slot: '{{BRAND_LOGO}}',
        spec: 'Partner logo \u00b7 bottom-left \u00b7 ~303\u00d754px',
        color: 'white',
      },
    ],
    extraTables: null,
    previewPath: 'social/t2-app-highlight.html',
    sortOrder: 1,
  },
  {
    id: 'social-t3-partner-alert',
    type: 'social',
    num: '03',
    name: 'Partner Alert / App Highlight (Landscape)',
    file: 't3-partner-alert',
    layout: 'landscape',
    dims: '236:544',
    description:
      'Landscape 1340\u00d7630 banner. Massive headline bleeds off both sides. Phone mockup fills the canvas height on the left. Blue circle brush stroke and flfontbold accent on the right. Three brand logos along the bottom.',
    contentSlots: [
      {
        slot: '{{HEADLINE}}',
        spec: 'NeueHaas 900 \u00b7 175px \u00b7 lh 80% \u00b7 centered \u00b7 bleeds',
        color: 'white',
      },
      {
        slot: '{{PHONE_MOCKUP}}',
        spec: 'App screenshot \u00b7 left:127 top:0 \u00b7 945\u00d7630px \u00b7 full height',
        color: null,
      },
      {
        slot: '{{CIRCLE_BRUSH}}',
        spec: 'Decorative brush stroke \u00b7 right side \u00b7 rotate \u221259\u00b0',
        color: 'blue',
      },
      {
        slot: '{{ACCENT_LABEL}}',
        spec: 'flfontbold \u00b7 68px \u00b7 rotate \u221229\u00b0 \u00b7 lower-right area',
        color: 'blue',
      },
      {
        slot: '{{BG_TEXTURE}}',
        spec: 'Paint brush stroke \u00b7 top-left area \u00b7 rotate 90\u00b0',
        color: 'white',
      },
    ],
    extraTables: null,
    previewPath: 'social/t3-partner-alert.html',
    sortOrder: 2,
  },
  {
    id: 'ad-t1-fluid-instagram',
    type: 'paid-ad',
    num: '01',
    name: 'Fluid Capabilities \u2014 Instagram Ad',
    file: 't4-fluid-ad',
    layout: 'square',
    dims: '1080\u00d71080',
    description:
      'Instagram feed ad (1080\u00d71080). Oversized headline left. Blue circle brush stroke + phone mockup right. flfontbold feature list with sub-labels. Fluid logo + handle bottom bar. Rotated label on right edge.',
    contentSlots: [
      {
        slot: '{{HEADLINE}}',
        spec: 'NeueHaas 900 \u00b7 196px \u00b7 lh 82% \u00b7 3 lines',
        color: 'white',
      },
      { slot: '{{TAGLINE}}', spec: 'flfontbold \u00b7 28px \u00b7 below divider', color: 'blue' },
      { slot: '{{FEATURE_NAME}}', spec: 'NeueHaas 900 \u00b7 42px \u00b7 4 items', color: 'white' },
      {
        slot: '{{FEATURE_LABEL}}',
        spec: 'flfontbold \u00b7 18px \u00b7 inline sub-label',
        color: 'blue',
      },
      {
        slot: '{{PHONE_MOCKUP}}',
        spec: 'App screenshot \u00b7 right:\u221260 top:260 \u00b7 520\u00d7700px',
        color: null,
      },
    ],
    extraTables: [
      {
        label: 'Ad Copy \u2014 Instagram',
        headers: ['Element', 'Copy', 'Chars'],
        rows: [
          [
            'Primary Text',
            'One app. Every tool your rep business needs. Share referral links, track analytics, manage commissions \u2014 all in Fluid.',
            '119',
          ],
          ['Headline', 'Built for Reps. Made to Win.', '28'],
          ['Description', 'Download the Fluid app', '22'],
        ],
      },
    ],
    previewPath: 'social/t4-fluid-ad.html',
    sortOrder: 200,
  },
  {
    id: 'social-t5-partner-announcement',
    type: 'social',
    num: '04',
    name: 'Partner Announcement (Landscape)',
    file: 't5-partner-announcement',
    layout: 'landscape',
    dims: '236:554',
    description:
      'Landscape 1340\u00d7630 announcement banner. Bold headline fills the left half. Portrait photo + person name & title on the right. Partnership logo row below the headline. Flag, WeCommerce, and Fluid logos along the bottom.',
    contentSlots: [
      {
        slot: '{{HEADLINE}}',
        spec: 'NeueHaas 900 \u00b7 70px \u00b7 lh 85% \u00b7 left:115 top:102 \u00b7 width:729px',
        color: 'white',
      },
      {
        slot: '{{PARTNER_LOGO}}',
        spec: 'Brand logo \u00b7 87\u00d730px \u00b7 partner row left',
        color: null,
      },
      {
        slot: '{{PARTNER_NAME}}',
        spec: 'NeueHaas 500 \u00b7 27px \u00b7 partner row right of \u00d7',
        color: 'white',
      },
      {
        slot: '{{PERSON_PHOTO}}',
        spec: 'Portrait \u00b7 left:876 top:102 \u00b7 263\u00d7327px \u00b7 overflow clipped',
        color: null,
      },
      {
        slot: '{{PERSON_NAME}}',
        spec: 'NeueHaas 900 \u00b7 45px \u00b7 lh 80% \u00b7 centered right half',
        color: 'white',
      },
      {
        slot: '{{PERSON_TITLE}}',
        spec: 'flfontbold \u00b7 34px \u00b7 blue \u00b7 below name',
        color: 'blue',
      },
    ],
    extraTables: null,
    previewPath: 'social/t5-partner-announcement.html',
    sortOrder: 4,
  },
  {
    id: 'social-t6-employee-spotlight',
    type: 'social',
    num: '05',
    name: 'Employee Spotlight',
    file: 't6-employee-spotlight',
    layout: 'square',
    dims: '236:462',
    description:
      'Square 1080\u00d71080 employee / new hire spotlight. Giant bold headline fills the top. Centered portrait photo in the middle. Employee name and title below the photo. Logos at the bottom.',
    contentSlots: [
      {
        slot: '{{HEADLINE}}',
        spec: 'NeueHaas 900 \u00b7 168px \u00b7 lh 75% \u00b7 centered \u00b7 width 936px',
        color: 'white',
      },
      {
        slot: '{{EMPLOYEE_PHOTO}}',
        spec: 'Portrait \u00b7 left:408 top:494 \u00b7 263\u00d7327px \u00b7 overflow clipped',
        color: null,
      },
      {
        slot: '{{EMPLOYEE_NAME}}',
        spec: 'NeueHaas 900 \u00b7 89px \u00b7 lh 80% \u00b7 centered',
        color: 'white',
      },
      {
        slot: '{{EMPLOYEE_TITLE}}',
        spec: 'flfontbold \u00b7 68px \u00b7 centered \u00b7 orange',
        color: 'orange',
      },
    ],
    extraTables: null,
    previewPath: 'social/t6-employee-spotlight.html',
    sortOrder: 5,
  },
  {
    id: 'social-t7-carousel',
    type: 'social',
    num: '06',
    name: 'Carousel \u2014 Insights',
    file: 't7-carousel',
    layout: 'square',
    dims: '261:935\u2013967',
    description:
      '4-slide Instagram/LinkedIn carousel. Each slide is 1080\u00d71080. Slide counter (01/04) top-right + rotated category label on every slide. Arrow keys navigate in full-size view.',
    contentSlots: [
      {
        slot: '{{SLIDE_COUNTER}}',
        spec: 'NeueHaas 700 \u00b7 24px \u00b7 top-right \u00b7 e.g. "01/04"',
        color: 'white',
      },
      {
        slot: '{{CATEGORY_LABEL}}',
        spec: 'NeueHaas 700 \u00b7 24px \u00b7 rotate 90\u00b0 \u00b7 right edge',
        color: 'white',
      },
    ],
    extraTables: [
      {
        label: 'Slide 01 \u2014 Cover',
        headers: ['Slot', 'Spec', 'Color'],
        rows: [
          [
            '{{HEADLINE}}',
            'NeueHaas 900 \u00b7 169px \u00b7 lh 75% \u00b7 centered \u00b7 width 936px',
            'White',
          ],
          [
            '{{PHOTO}}',
            'Portrait \u00b7 left:408 top:494 \u00b7 263\u00d7327px \u00b7 overflow clipped',
            '\u2014',
          ],
          ['{{NAME}}', 'NeueHaas 900 \u00b7 89px \u00b7 lh 80% \u00b7 centered', 'White'],
          ['{{TITLE}}', 'flfontbold \u00b7 68px \u00b7 centered', 'Orange'],
          [
            '{{LOGOS}}',
            'Flag + divider + WeCommerce left \u00b7 Fluid logo right \u00b7 bottom bar',
            '\u2014',
          ],
        ],
      },
      {
        label: 'Slide 02 \u2014 Intro',
        headers: ['Slot', 'Spec', 'Color'],
        rows: [
          [
            '{{BODY}}',
            'NeueHaas 400 \u00b7 75px \u00b7 lh 100% \u00b7 left:45 top:74 \u00b7 width 936px',
            'White',
          ],
          [
            '{{ARROW}}',
            'Blue arrow decoration \u00b7 left:436 top:640 \u00b7 497\u00d794px \u00b7 rotate 7.76\u00b0',
            'Blue',
          ],
        ],
      },
      {
        label: 'Slide 03 \u2014 Tool',
        headers: ['Slot', 'Spec', 'Color'],
        rows: [
          [
            '{{TOOL_NAME}}',
            'NeueHaas 700 \u00b7 124px \u00b7 lh 75% \u00b7 left:45 top:132',
            'White',
          ],
          [
            '{{BODY}}',
            'NeueHaas 400 \u00b7 47px \u00b7 lh 116% \u00b7 left:45 top:237 \u00b7 width 780px',
            'White',
          ],
          [
            '{{SCREENSHOT}}',
            'App screenshot \u00b7 left:119 top:681 \u00b7 852\u00d7399px \u00b7 clipped',
            '\u2014',
          ],
          [
            '{{DIFFICULTY}}',
            'Label: NeueHaas 700 24px \u00b7 Value: flfontbold 68px \u00b7 right:259 top:627',
            'Orange',
          ],
        ],
      },
      {
        label: 'Slide 04 \u2014 Feature',
        headers: ['Slot', 'Spec', 'Color'],
        rows: [
          [
            '{{FEATURE_NAME}}',
            'NeueHaas 700 \u00b7 124px \u00b7 lh 75% \u00b7 left:45 top:132',
            'White',
          ],
          [
            '{{BODY_1}}',
            'NeueHaas 400 \u00b7 47px \u00b7 lh 116% \u00b7 width 936px \u00b7 first paragraph',
            'White',
          ],
          [
            '{{BODY_2}}',
            'NeueHaas 400 \u00b7 47px \u00b7 lh 116% \u00b7 margin-top 109px \u00b7 second paragraph',
            'White',
          ],
        ],
      },
    ],
    previewPath: 'social/t7-carousel.html',
    sortOrder: 6,
  },

  // ── One-Pager Templates ─────────────────────────────────────────────────
  {
    id: 'onepager-product-feature',
    type: 'one-pager',
    num: '01',
    name: 'Product Feature',
    file: 'product-feature',
    layout: 'letter',
    dims: null,
    description:
      'Two-column hero with product image placeholder + 2\u00d72 feature grid. Best for product launch sheets, feature overviews, and capability summaries. Default accent: blue.',
    contentSlots: [
      { slot: 'HEADER', spec: 'Fixed \u2014 Logo area + product name tag', color: null },
      { slot: 'HERO_EYEBROW', spec: 'Flexible \u2014 FLFont tagline above headline', color: null },
      {
        slot: 'HERO_HEADLINE',
        spec: 'Flexible \u2014 Main product headline (uppercase)',
        color: null,
      },
      { slot: 'HERO_SUB', spec: 'Flexible \u2014 Supporting description paragraph', color: null },
      {
        slot: 'HERO_IMAGE',
        spec: 'Flexible \u2014 Product screenshot or illustration',
        color: null,
      },
      {
        slot: 'FEATURE_1-4',
        spec: 'Flexible \u2014 Feature title + description per card',
        color: null,
      },
      { slot: 'CTA_LABEL', spec: 'Flexible \u2014 CTA supporting text', color: null },
      { slot: 'CTA_BUTTON', spec: 'Flexible \u2014 CTA button text', color: null },
    ],
    extraTables: null,
    previewPath: 'one-pagers/product-feature.html',
    sortOrder: 100,
  },
  {
    id: 'onepager-partner-integration',
    type: 'one-pager',
    num: '02',
    name: 'Partner Integration',
    file: 'partner-integration',
    layout: 'letter',
    dims: null,
    description:
      'Headline + two-column body (feature bullets left, stat callouts right) + benefits strip. Best for partner announcements, integration showcases, and ecosystem pages. Default accent: green.',
    contentSlots: [
      { slot: 'PARTNER_LOGO', spec: 'Optional \u2014 Partner company logo or text', color: null },
      { slot: 'HEADLINE_TEXT', spec: 'Flexible \u2014 Main headline (uppercase)', color: null },
      { slot: 'HEADLINE_SUB', spec: 'Flexible \u2014 Supporting paragraph', color: null },
      {
        slot: 'FEATURE_BULLETS',
        spec: 'Flexible \u2014 4-5 feature items with icon + title + desc',
        color: null,
      },
      { slot: 'STAT_CALLOUTS', spec: 'Flexible \u2014 2-4 large stat blocks', color: null },
      { slot: 'BENEFITS_STRIP', spec: 'Optional \u2014 3 integration benefit cards', color: null },
      { slot: 'CTA_BUTTON', spec: 'Flexible \u2014 CTA button text', color: null },
    ],
    extraTables: null,
    previewPath: 'one-pagers/partner-integration.html',
    sortOrder: 101,
  },
  {
    id: 'onepager-company-overview',
    type: 'one-pager',
    num: '03',
    name: 'Company Overview',
    file: 'company-overview',
    layout: 'letter',
    dims: null,
    description:
      'Giant stats + editorial text layout. Overview/vision/mission text left, large stat numbers stacked right. Best for company fact sheets, investor summaries, and partnership overviews. Default accent: purple.',
    contentSlots: [
      { slot: 'HEADLINE_TEXT', spec: 'Flexible \u2014 Hero headline (uppercase)', color: null },
      { slot: 'OVERVIEW_TEXT', spec: 'Flexible \u2014 Company overview paragraph', color: null },
      { slot: 'VISION_TEXT', spec: 'Flexible \u2014 Vision statement', color: null },
      { slot: 'MISSION_TEXT', spec: 'Flexible \u2014 Mission statement', color: null },
      { slot: 'GIANT_STATS', spec: 'Flexible \u2014 2-4 large stat callouts', color: null },
      {
        slot: 'VALUES_STRIP',
        spec: 'Optional \u2014 4 company value/differentiator cards',
        color: null,
      },
      { slot: 'CTA_BUTTON', spec: 'Flexible \u2014 CTA button text', color: null },
    ],
    extraTables: null,
    previewPath: 'one-pagers/company-overview.html',
    sortOrder: 102,
  },
  {
    id: 'onepager-case-study',
    type: 'one-pager',
    num: '04',
    name: 'Case Study',
    file: 'case-study',
    layout: 'letter',
    dims: null,
    description:
      'Live editor pattern: header, hero, stat strip, challenge/solution body grid, results strip. Best for customer success stories, implementation case studies, and ROI showcases. Default accent: blue.',
    contentSlots: [
      {
        slot: 'CLIENT_TAG',
        spec: 'Flexible \u2014 Client name or "Case Study" label',
        color: null,
      },
      {
        slot: 'HERO_HEADLINE',
        spec: 'Flexible \u2014 Case study headline (uppercase)',
        color: null,
      },
      { slot: 'HERO_SUB', spec: 'Flexible \u2014 Client context paragraph', color: null },
      { slot: 'STAT_1-3', spec: 'Flexible \u2014 Key metric value + label', color: null },
      { slot: 'CHALLENGE_ITEMS', spec: 'Flexible \u2014 3-4 pain point items', color: null },
      { slot: 'SOLUTION_ITEMS', spec: 'Flexible \u2014 3-4 solution features', color: null },
      { slot: 'RESULTS_STRIP', spec: 'Flexible \u2014 2-4 outcome metrics', color: null },
      { slot: 'CTA_BUTTON', spec: 'Flexible \u2014 CTA button text', color: null },
    ],
    extraTables: null,
    previewPath: 'one-pagers/case-study.html',
    sortOrder: 103,
  },
  {
    id: 'onepager-comparison-sheet',
    type: 'one-pager',
    num: '05',
    name: 'Comparison Sheet',
    file: 'comparison-sheet',
    layout: 'letter',
    dims: null,
    description:
      'Display headline + feature comparison table + key differentiator cards. Best for competitive positioning, vendor evaluation sheets, and sales battle cards. Default accent: orange.',
    contentSlots: [
      { slot: 'HEADLINE_TEXT', spec: 'Flexible \u2014 Display headline (uppercase)', color: null },
      { slot: 'HEADLINE_SUB', spec: 'Flexible \u2014 Supporting paragraph', color: null },
      {
        slot: 'COMPETITOR_NAMES',
        spec: 'Flexible \u2014 1-3 competitor column headers',
        color: null,
      },
      {
        slot: 'COMPARISON_ROWS',
        spec: 'Optional \u2014 6-10 feature rows (expandable)',
        color: null,
      },
      { slot: 'DIFF_1-3', spec: 'Optional \u2014 Key differentiator cards', color: null },
      { slot: 'CTA_BUTTON', spec: 'Flexible \u2014 CTA button text', color: null },
    ],
    extraTables: null,
    previewPath: 'one-pagers/comparison-sheet.html',
    sortOrder: 104,
  },
];

/**
 * Seeds the templates table with 12 template rows if the table is empty.
 * Idempotent: skips if COUNT(*) > 0.
 */
export async function seedTemplatesIfEmpty(): Promise<void> {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c;
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO templates
      (id, type, num, name, file, layout, dims, description, content_slots, creation_steps, extra_tables, preview_path, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const t of TEMPLATE_SEEDS) {
    insert.run(
      t.id,
      t.type,
      t.num,
      t.name,
      t.file,
      t.layout,
      t.dims,
      t.description,
      JSON.stringify(t.contentSlots),
      t.extraTables ? JSON.stringify(t.extraTables) : null,
      t.previewPath,
      t.sortOrder,
      now,
    );
  }
}

// ─── Context Map ─────────────────────────────────────────────────────────────

/**
 * Seeds the context_map table with default brand context mappings for 9 type/stage combos.
 * Idempotent: skips if COUNT(*) > 0.
 * @returns number of rows that exist after seeding
 */
export function seedContextMapIfEmpty(): number {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM context_map').get() as { c: number }).c;
  if (count > 0) return count;

  const now = Date.now();
  const insert = db.prepare(
    'INSERT INTO context_map (id, creation_type, stage, page, sections, priority, max_tokens, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );

  const defaults = [
    {
      creationType: 'instagram',
      stage: 'copy',
      page: 'voice-guide',
      sections: ['voice-guide:*'],
      priority: 80,
      maxTokens: 8000,
      sortOrder: 1,
    },
    {
      creationType: 'linkedin',
      stage: 'copy',
      page: 'voice-guide',
      sections: ['voice-guide:*'],
      priority: 80,
      maxTokens: 8000,
      sortOrder: 2,
    },
    {
      creationType: 'one-pager',
      stage: 'copy',
      page: 'voice-guide',
      sections: ['voice-guide:*'],
      priority: 80,
      maxTokens: 8000,
      sortOrder: 3,
    },
    {
      creationType: 'instagram',
      stage: 'layout',
      page: 'patterns',
      sections: ['design-tokens:*', 'layout-archetype:*'],
      priority: 70,
      maxTokens: 6000,
      sortOrder: 4,
    },
    {
      creationType: 'linkedin',
      stage: 'layout',
      page: 'patterns',
      sections: ['design-tokens:*', 'layout-archetype:*'],
      priority: 70,
      maxTokens: 6000,
      sortOrder: 5,
    },
    {
      creationType: 'one-pager',
      stage: 'layout',
      page: 'patterns',
      sections: ['design-tokens:*', 'layout-archetype:*'],
      priority: 70,
      maxTokens: 6000,
      sortOrder: 6,
    },
    {
      creationType: 'instagram',
      stage: 'styling',
      page: 'patterns',
      sections: ['design-tokens:*', 'pattern:*'],
      priority: 60,
      maxTokens: 10000,
      sortOrder: 7,
    },
    {
      creationType: 'linkedin',
      stage: 'styling',
      page: 'patterns',
      sections: ['design-tokens:*', 'pattern:*'],
      priority: 60,
      maxTokens: 10000,
      sortOrder: 8,
    },
    {
      creationType: 'one-pager',
      stage: 'styling',
      page: 'patterns',
      sections: ['design-tokens:*'],
      priority: 60,
      maxTokens: 8000,
      sortOrder: 9,
    },
  ];

  const insertMany = db.transaction(() => {
    for (const d of defaults) {
      insert.run(
        nanoid(),
        d.creationType,
        d.stage,
        d.page,
        JSON.stringify(d.sections),
        d.priority,
        d.maxTokens,
        d.sortOrder,
        now,
      );
    }
  });
  insertMany();

  return defaults.length;
}

export async function seedDesignRulesIfEmpty(): Promise<void> {
  const db = getDb();
  const count = (
    db.prepare('SELECT COUNT(*) as c FROM template_design_rules').get() as { c: number }
  ).c;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT INTO template_design_rules (id, scope, platform, archetype_slug, label, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const now = Date.now();
  for (const rule of DESIGN_RULES_SEED) {
    insert.run(
      nanoid(),
      rule.scope,
      rule.platform,
      rule.archetypeSlug,
      rule.label,
      rule.content,
      rule.sortOrder,
      now,
    );
  }
}

// ─── JSON Seed Import (from seed-data.json) ──────────────────────────────────

/**
 * Brand configuration tables to import from seed-data.json.
 * Only includes brand data — NOT user data (campaigns, creations, slides, iterations).
 * User data has FK chains that break when imported into existing DBs.
 */
const SEED_TABLES_ORDERED = [
  'voice_guide_docs',
  'brand_patterns',
  'brand_styles',
  'template_design_rules',
  'templates',
  'context_map',
] as const;

/**
 * Merge from canvas/seed-data.json on every startup.
 * Uses INSERT OR IGNORE so only rows with new IDs are added —
 * existing local data is never overwritten.
 *
 * @param projectRoot — absolute path to the project root (parent of canvas/)
 * @returns number of new rows imported (0 if seed file missing or nothing new)
 */
export function importSeedDataIfFresh(projectRoot: string): boolean {
  const seedPath = path.resolve(projectRoot, 'canvas/seed-data.json');
  if (!fsSync.existsSync(seedPath)) return false;

  const db = getDb();

  let data: Record<string, Array<Record<string, unknown>>>;
  try {
    data = JSON.parse(fsSync.readFileSync(seedPath, 'utf-8'));
  } catch {
    console.warn('[seed-import] Failed to parse seed-data.json');
    return false;
  }

  let totalImported = 0;

  const importAll = db.transaction(() => {
    for (const table of SEED_TABLES_ORDERED) {
      const rows = data[table];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      // INSERT OR IGNORE: skips rows whose primary key already exists locally
      const insert = db.prepare(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      );

      for (const row of rows) {
        try {
          const result = insert.run(...columns.map((col) => row[col] ?? null));
          if (result.changes > 0) totalImported++;
        } catch {
          // Skip rows with FK violations, etc.
        }
      }
    }
  });

  importAll();

  if (totalImported > 0) {
    console.log(`[seed-import] Merged ${totalImported} new rows from seed-data.json`);
  }
  return totalImported > 0;
}
