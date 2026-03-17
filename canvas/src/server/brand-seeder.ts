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
    'INSERT OR IGNORE INTO voice_guide_docs (id, slug, label, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
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

/**
 * Maps pattern slugs to category names.
 * Slugs not in this map default to 'pattern'.
 */
const CATEGORY_MAP: Record<string, string> = {
  'color-palette': 'design-tokens',
  'typography': 'design-tokens',
  'opacity-patterns': 'design-tokens',
  'layout-archetypes': 'layout-archetype',
};

/**
 * Converts a heading label to a URL-safe slug.
 * e.g. "Color Palette" -> "color-palette", "Circles & Underlines" -> "circles-underlines"
 */
function toSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PatternSection {
  slug: string;
  label: string;
  category: string;
  content: string;
}

/**
 * Parses patterns/index.html into sections by splitting on <h2 class="section-title"> headings.
 * Each section's content is the HTML between this h2 and the next h2.
 */
function parsePatternsHtml(html: string): PatternSection[] {
  const sections: PatternSection[] = [];

  // Match all h2.section-title elements and their positions
  const headingRegex = /<h2 class="section-title">(.*?)<\/h2>/g;
  const matches: Array<{ label: string; index: number; endIndex: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    matches.push({
      label: match[1],
      index: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const { label, endIndex } = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const content = html.slice(endIndex, nextIndex).trim();
    const slug = toSlug(label);
    const category = CATEGORY_MAP[slug] ?? 'pattern';
    sections.push({ slug, label, category, content });
  }

  return sections;
}

/**
 * Seeds brand_patterns table from patterns/index.html if the table is empty.
 * @param patternsHtmlPath — absolute path to patterns/index.html
 * @returns number of rows that exist after seeding (inserted or pre-existing)
 */
export async function seedBrandPatternsIfEmpty(patternsHtmlPath: string): Promise<number> {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM brand_patterns').get() as { c: number }).c;
  if (count > 0) return count;

  let html: string;
  try {
    html = await fs.readFile(patternsHtmlPath, 'utf-8');
  } catch {
    return 0;
  }

  const sections = parsePatternsHtml(html);
  if (sections.length === 0) return 0;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let order = 0;
  let inserted = 0;
  for (const section of sections) {
    insert.run(nanoid(), section.slug, section.label, section.category, section.content, order++, Date.now());
    inserted++;
  }
  return inserted;
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
    'INSERT OR IGNORE INTO brand_patterns (id, slug, label, category, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    nanoid(),
    'visual-compositor-contract',
    'Visual Compositor Contract',
    'visual-style',
    VISUAL_COMPOSITOR_CONTRACT,
    0,
    Date.now()
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
    content: 'General rules about social media posts — canvas dimensions, the compositor layer model, footer requirements, typography scale ratio. Cross-reference the Visual Compositor Contract for full details. These rules apply to ALL social media posts regardless of platform.',
    sortOrder: 0,
  },
  {
    scope: 'platform',
    platform: 'instagram',
    archetypeSlug: null,
    label: 'Instagram Brand Guidelines',
    content: 'Instagram-specific rules — 1080x1080px square canvas, high-contrast text for mobile viewing, bold headline-forward compositions, touch-friendly CTA placement (bottom third).',
    sortOrder: 10,
  },
  {
    scope: 'platform',
    platform: 'linkedin',
    archetypeSlug: null,
    label: 'LinkedIn Brand Guidelines',
    content: 'LinkedIn-specific rules — 1200x627px landscape canvas, professional but bold tone, slightly more restrained brushstroke usage, text-heavy compositions acceptable (professional audience reads more).',
    sortOrder: 11,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'problem-first',
    label: 'Problem-First Design Notes',
    content: 'Problem-First — headline dominates canvas (60%+ of visual weight). Pain-point text in large flfontbold. Accent: orange (#FF6B35). Dark background with brushstroke texture bleeding off top-right edge. Subtext small and secondary.',
    sortOrder: 20,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'quote',
    label: 'Quote/Testimonial Design Notes',
    content: 'Quote/Testimonial — centered quote in large flfontbold with circle sketch accent behind key word. Attribution smaller below. Brushstroke texture subtle, background usually dark.',
    sortOrder: 21,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'stat-proof',
    label: 'Stat Proof Design Notes',
    content: 'Stat Proof — giant number (120px+) as focal point. Supporting text frames the stat\'s meaning. Green (#7BC67E) accent for proof/evidence. Minimal decoration — the number IS the decoration.',
    sortOrder: 22,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'app-highlight',
    label: 'App Highlight Design Notes',
    content: 'App Highlight — product feature showcase. Blue (#4A90D9) accent for trust. Screenshot or UI element as visual anchor. Text describes the feature benefit, not the feature itself.',
    sortOrder: 23,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'manifesto',
    label: 'Manifesto Design Notes',
    content: 'Manifesto — brand philosophy statement. Large flfontbold text fills most of canvas. Minimal decoration — text IS the design. Purple (#9B59B6) accent for premium/aspirational.',
    sortOrder: 24,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'partner-alert',
    label: 'Partner Alert Design Notes',
    content: 'Partner Alert — partnership announcement. Dual-brand friendly layout. Blue (#4A90D9) accent. Logo placement prominent. Announcement-style headline.',
    sortOrder: 25,
  },
  {
    scope: 'archetype',
    platform: 'instagram',
    archetypeSlug: 'feature-spotlight',
    label: 'Feature Spotlight Design Notes',
    content: 'Feature Spotlight — product capability deep-dive. Blue (#4A90D9) accent for trust/technology. More technical copy acceptable. Visual balance between text and illustrative element.',
    sortOrder: 26,
  },
];

/**
 * Seeds the template_design_rules table with 10 design rule rows if the table is empty.
 * Idempotent: skips if COUNT(*) > 0.
 */
export async function seedDesignRulesIfEmpty(): Promise<void> {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM template_design_rules').get() as { c: number }).c;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT INTO template_design_rules (id, scope, platform, archetype_slug, label, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
      now
    );
  }
}
