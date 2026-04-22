/**
 * brand-brief.ts
 * Assembles the Tier 2 Brand Brief from DB tables for injection into the agent system prompt.
 *
 * Sources: voice_guide_docs, brand_patterns, brand_assets, brand_styles, context_map.
 * The brief is rebuilt on each chat message (cheap — all reads are local SQLite).
 */

import { getDb } from '../lib/db';

// 4-chars-per-token heuristic for budget enforcement
const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 6000;

/**
 * Build the Brand Brief markdown string from DB tables.
 *
 * Currently composes Voice, Hard Rules, Colors, Typography, Asset Manifest,
 * Active CSS Layers, and Decoration Rules from the DB. The old `creationType`
 * parameter was never wired through to any filtering logic — removed.
 */
export function buildBrandBrief(): string {
  const db = getDb();

  const parts: string[] = ['## Brand Brief'];

  // All ORDER BY clauses in this file include a stable secondary sort key
  // (slug) so the output is byte-identical across runs. The system prompt is
  // cached by exact-string match — any reshuffling silently busts the cache
  // and doubles input-token costs.
  // --- Voice Guide (top entries) ---
  const voiceDocs = db
    .prepare('SELECT slug, label, content FROM voice_guide_docs ORDER BY sort_order ASC, slug ASC')
    .all() as Array<{ slug: string; label: string; content: string }>;

  if (voiceDocs.length > 0) {
    parts.push('### Voice');
    // Include first 3 docs (condensed) — adjust via context_map in future
    for (const doc of voiceDocs.slice(0, 3)) {
      const truncated =
        doc.content.length > 800 ? doc.content.slice(0, 800) + '\n[truncated]' : doc.content;
      parts.push(`**${doc.label}**\n${truncated}`);
    }
  }

  // --- Hard Rules (weight >= 81) ---
  const hardRules = db
    .prepare(
      'SELECT slug, label, content FROM brand_patterns WHERE weight >= 81 ORDER BY weight DESC, sort_order ASC, slug ASC',
    )
    .all() as Array<{ slug: string; label: string; content: string }>;

  if (hardRules.length > 0) {
    parts.push('### Hard Rules (non-negotiable)');
    for (const rule of hardRules) {
      parts.push(`**${rule.label}** (mandatory)\n${rule.content}`);
    }
  }

  // --- Color System ---
  const colorPatterns = db
    .prepare(
      "SELECT slug, label, content FROM brand_patterns WHERE category = 'colors' ORDER BY weight DESC, sort_order ASC, slug ASC",
    )
    .all() as Array<{ slug: string; label: string; content: string }>;

  if (colorPatterns.length > 0) {
    parts.push('### Color System');
    for (const p of colorPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Typography ---
  const typoPatterns = db
    .prepare(
      "SELECT slug, label, content FROM brand_patterns WHERE category = 'typography' ORDER BY weight DESC, sort_order ASC, slug ASC",
    )
    .all() as Array<{ slug: string; label: string; content: string }>;

  if (typoPatterns.length > 0) {
    parts.push('### Typography');
    for (const p of typoPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Asset Manifest ---
  const assets = db
    .prepare(
      'SELECT name, category, file_path, mime_type FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY category, name',
    )
    .all() as Array<{ name: string; category: string; file_path: string; mime_type: string }>;

  if (assets.length > 0) {
    parts.push('### Asset Manifest');
    parts.push('Use these URLs verbatim. Do NOT modify paths or add extensions.\n');

    const byCategory = new Map<string, typeof assets>();
    for (const a of assets) {
      if (!byCategory.has(a.category)) byCategory.set(a.category, []);
      byCategory.get(a.category)!.push(a);
    }

    for (const [category, catAssets] of byCategory) {
      parts.push(`**${category}**`);
      for (const a of catAssets) {
        const serveUrl = `/api/brand-assets/serve/${encodeURIComponent(a.name)}`;
        if (a.mime_type.startsWith('font/') || a.name.toLowerCase().includes('font')) {
          parts.push(`- ${a.name}: \`url('${serveUrl}') format('truetype')\``);
        } else {
          parts.push(`- ${a.name}: \`url('${serveUrl}')\``);
        }
      }
    }
  }

  // --- Active CSS Layers ---
  const styles = db
    .prepare(
      "SELECT scope, css_content FROM brand_styles WHERE css_content != '' ORDER BY scope ASC, id ASC",
    )
    .all() as Array<{ scope: string; css_content: string }>;

  if (styles.length > 0) {
    parts.push('### Active CSS Layers');
    parts.push(
      'These CSS layers are automatically merged into creations on save. You do not need to duplicate them.\n',
    );
    for (const s of styles) {
      const preview =
        s.css_content.length > 300
          ? s.css_content.slice(0, 300) + '\n/* ... truncated ... */'
          : s.css_content;
      parts.push(`**${s.scope}**\n\`\`\`css\n${preview}\n\`\`\``);
    }
  }

  // --- Decoration Rules ---
  const decoPatterns = db
    .prepare(
      "SELECT slug, label, content FROM brand_patterns WHERE category = 'decorations' ORDER BY weight DESC, sort_order ASC, slug ASC",
    )
    .all() as Array<{ slug: string; label: string; content: string }>;

  if (decoPatterns.length > 0) {
    parts.push('### Decoration Rules');
    for (const p of decoPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Token budget enforcement ---
  // Drop whole trailing sections (parts are joined by '\n\n') until we fit. This
  // is safer than a raw char slice, which can cut mid-code-fence or mid-URL and
  // break the system prompt or the prompt-caching key.
  const fits = (chunks: string[]) =>
    Math.ceil(chunks.join('\n\n').length / CHARS_PER_TOKEN) <= DEFAULT_MAX_TOKENS;

  if (!fits(parts)) {
    const trimmed = [...parts];
    while (trimmed.length > 1 && !fits(trimmed)) {
      trimmed.pop();
    }
    trimmed.push('[Brand Brief truncated to fit token budget]');
    return trimmed.join('\n\n');
  }

  return parts.join('\n\n');
}
