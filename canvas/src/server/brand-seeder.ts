/**
 * Seed functions for populating voice_guide_docs and brand_patterns tables
 * from existing source files (voice-guide/*.md and patterns/index.html).
 *
 * Both functions are idempotent: they check if data already exists before inserting.
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
