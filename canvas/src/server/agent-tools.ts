import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { slugify } from '../lib/slugify';
import { renderPreview } from './render-engine';
import { runValidation, mergeCssLayersForHtml, formatValidationMessage } from './validation-hooks';
import { auditBrandWrite, logChatEvent } from './observability';
import {
  searchBrandAssets,
  findAssetByIdempotencyKey,
  promoteAssetToLibrary,
  getOrCreateStandaloneCampaignId,
} from './db-api';
import { generateGeminiImage, computeIdempotencyKey } from './gemini-image';
import type { GeminiAspectRatio } from './gemini-image';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
// FLUID_ARCHETYPES_DIR lets tests point at a temp fixtures directory.
// Matches the pattern in tools/validate-archetypes.cjs.
const ARCHETYPES_DIR = process.env.FLUID_ARCHETYPES_DIR
  ? path.resolve(process.env.FLUID_ARCHETYPES_DIR)
  : path.join(PROJECT_ROOT, 'archetypes');

// Known creation types — must match the platform names referenced in the system
// prompt, validation-hooks.runValidation, and dimension-check.cjs targets.
// Used to reject malformed agent inputs early rather than letting them propagate
// into the brand compliance / dimension-check subprocesses.
// Keep in sync with:
//   - canvas/src/server/validation-hooks.ts (runValidation switch on platform)
//   - tools/dimension-check.cjs KNOWN_DIMENSIONS map
//   - canvas/src/server/agent-system-prompt.ts Platform Dimensions section
const KNOWN_PLATFORMS = new Set([
  'instagram',
  'instagram-portrait',
  'instagram-square',
  'instagram-story',
  'linkedin',
  'facebook',
  'twitter',
  'one-pager',
]);

// Exported for testability. Also invoked internally by saveCreation.
export function normalizePlatform(platform: string): string {
  const p = platform.toLowerCase().trim();
  if (!KNOWN_PLATFORMS.has(p)) {
    logChatEvent('platform_rejected', { platform, known: [...KNOWN_PLATFORMS] });
    throw new Error(
      `Unknown platform '${platform}'. Must be one of: ${[...KNOWN_PLATFORMS].join(', ')}`,
    );
  }
  return p;
}

// ─── Brand Discovery (READ) ───

export function listVoiceGuide(): { slug: string; title: string; description: string }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT slug, label, SUBSTR(content, 1, 200) as description FROM voice_guide_docs ORDER BY label`,
    )
    .all() as any[];
  return rows.map((r) => ({
    slug: r.slug,
    title: r.label,
    description: r.description?.split('\n')[0] ?? '',
  }));
}

export function readVoiceGuide(
  slug: string,
): { slug: string; title: string; content: string } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT slug, label, content FROM voice_guide_docs WHERE slug = ?`)
    .get(slug) as any;
  if (!row) return null;
  return { slug: row.slug, title: row.label, content: row.content };
}

export function listPatterns(
  category?: string,
): { slug: string; name: string; category: string; weight: number; description: string }[] {
  const db = getDb();
  const sql = category
    ? `SELECT slug, label, category, weight, SUBSTR(content, 1, 200) as description FROM brand_patterns WHERE category = ? ORDER BY weight DESC, label`
    : `SELECT slug, label, category, weight, SUBSTR(content, 1, 200) as description FROM brand_patterns ORDER BY category, weight DESC, label`;
  const rows = (category ? db.prepare(sql).all(category) : db.prepare(sql).all()) as any[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.label,
    category: r.category,
    weight: r.weight ?? 50,
    description: r.description?.split('\n')[0] ?? '',
  }));
}

export function readPattern(
  slug: string,
): { slug: string; name: string; category: string; weight: number; content: string } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT slug, label, category, weight, content FROM brand_patterns WHERE slug = ?`)
    .get(slug) as any;
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.label,
    category: row.category,
    weight: row.weight ?? 50,
    content: row.content,
  };
}

export function listAssets(
  category?: string,
): { name: string; category: string; filePath: string | null; description: string | null }[] {
  const db = getDb();
  const sql = category
    ? `SELECT name, category, file_path as filePath, description FROM brand_assets WHERE category = ? ORDER BY name`
    : `SELECT name, category, file_path as filePath, description FROM brand_assets ORDER BY category, name`;
  return (category ? db.prepare(sql).all(category) : db.prepare(sql).all()) as any[];
}

export function listTemplates(): {
  id: number;
  name: string;
  type: string | null;
  description: string | null;
}[] {
  const db = getDb();
  return db
    .prepare(`SELECT id, name, type, description FROM templates ORDER BY name`)
    .all() as any[];
}

export function readTemplate(id: number): any | null {
  const db = getDb();
  const tmpl = db.prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as any;
  if (!tmpl) return null;
  const rules = db
    .prepare(
      `SELECT * FROM template_design_rules WHERE scope = 'template' OR scope = 'global' ORDER BY sort_order`,
    )
    .all() as any[];
  return { ...tmpl, designRules: rules };
}

// ─── Archetype types ──────────────────────────────────────────────────────────
// Co-located with listArchetypes/readArchetype; no shared location exists for
// filesystem-derived archetype shapes yet.

export type ImageRole = 'none' | 'accent' | 'background' | 'hero' | 'grid';
export type ContentDensity = 'sparse' | 'moderate' | 'dense';

export interface ArchetypeMeta {
  category: string;
  imageRole: ImageRole;
  useCases: string[];
  slotCount: number;
  mood?: string[];
  contentDensity?: ContentDensity;
  imageHints?: {
    suggestedAspect?: string;
    suggestedSubject?: string;
    treatment?: string;
    damPreference?: string[];
  };
  avoidCases?: string[];
}

/** Minimal shape of a parsed schema.json — only the fields listArchetypes reads. */
export interface ArchetypeSchemaShape {
  archetypeId?: string;
  platform?: string;
  width?: number;
  height?: number;
  fields?: unknown[];
  meta?: ArchetypeMeta;
}

export interface ArchetypeListItem {
  slug: string;
  name: string;
  platform: string;
  category: string | null;
  mood: string[];
  imageRole: string | null;
  slotCount: number | null;
  useCases: string[];
}

/**
 * List archetypes with optional filters and rich meta projection.
 *
 * Results are ordered alphabetically by slug (deterministic across platforms —
 * readdirSync order is filesystem-dependent, so we sort before filtering so
 * pageSize truncation produces the same results on macOS, Linux, and Windows).
 *
 * A malformed schema.json is skipped (logged as archetype_schema_parse_failed)
 * rather than silently appearing with falsy platform/category/meta that would
 * bypass every filter.
 *
 * @param opts.category  Filter by meta.category (e.g. "hero-photo", "stat-data")
 * @param opts.platform  Filter by platform (e.g. "instagram-portrait", "instagram-square")
 * @param opts.imageRole Filter by meta.imageRole (e.g. "background", "hero", "none")
 * @param opts.pageSize  Max results (default 25, hard max 50)
 */
export function listArchetypes(opts: {
  category?: string;
  platform?: string;
  imageRole?: string;
  pageSize?: number;
} = {}): ArchetypeListItem[] {
  const pageSize = Math.min(opts.pageSize ?? 25, 50);

  let dirs: fs.Dirent[];
  try {
    dirs = fs
      .readdirSync(ARCHETYPES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'components');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  // Sort for deterministic ordering — readdirSync order is FS-dependent.
  // Without this, pageSize truncation could drop different archetypes on
  // different platforms when count > pageSize.
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  const results: ArchetypeListItem[] = [];

  for (const d of dirs) {
    if (results.length >= pageSize) break;

    const schemaPath = path.join(ARCHETYPES_DIR, d.name, 'schema.json');
    const raw = tryReadFile(schemaPath);
    let schema: ArchetypeSchemaShape | null = null;
    if (raw != null) {
      try {
        schema = JSON.parse(raw) as ArchetypeSchemaShape;
      } catch (err) {
        // A corrupted schema.json must not leak into results with falsy
        // fields that bypass every filter. Log and skip.
        logChatEvent('archetype_schema_parse_failed', {
          slug: d.name,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    // Derive platform from schema.platform or slug suffix convention
    const derivedPlatform: string = schema?.platform
      ? schema.platform
      : (d.name.endsWith('-li') ? 'linkedin-landscape'
         : d.name.endsWith('-op') ? 'one-pager'
         : 'instagram-square');

    const meta: ArchetypeMeta | null = schema?.meta ?? null;
    const category: string | null = meta?.category ?? null;
    const imageRole: string | null = meta?.imageRole ?? null;
    const mood: string[] = Array.isArray(meta?.mood) ? meta!.mood! : [];
    const slotCount: number | null = meta?.slotCount ?? null;
    const useCases: string[] = Array.isArray(meta?.useCases) ? meta!.useCases : [];

    // Apply filters
    if (opts.category && category !== opts.category) continue;
    if (opts.platform && derivedPlatform !== opts.platform) continue;
    if (opts.imageRole && imageRole !== opts.imageRole) continue;

    results.push({
      slug: d.name,
      name: d.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      platform: derivedPlatform,
      category,
      mood,
      imageRole,
      slotCount,
      useCases,
    });
  }

  return results;
}

// Archetype slugs are directory names under archetypes/. Agent input is
// untrusted — restrict the slug to a safe identifier shape so a prompt-injection
// can't traverse out with "../../.env" and leak arbitrary files via readFileSync.
const SAFE_SLUG = /^[a-z0-9][a-z0-9-_]*$/i;

export function readArchetype(
  slug: string,
): { slug: string; html: string; schema: any; notes: string | null } | null {
  if (!SAFE_SLUG.test(slug)) {
    logChatEvent('path_traversal_blocked', {
      tool: 'read_archetype',
      slug,
      reason: 'unsafe_chars',
    });
    return null;
  }

  const dir = path.join(ARCHETYPES_DIR, slug);
  // Belt-and-braces: even with the regex, make sure the resolved path is still
  // inside ARCHETYPES_DIR before touching the filesystem.
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(ARCHETYPES_DIR) + path.sep)) {
    logChatEvent('path_traversal_blocked', { tool: 'read_archetype', slug, reason: 'path_escape' });
    return null;
  }
  const htmlPath = path.join(resolved, 'index.html');
  const schemaPath = path.join(resolved, 'schema.json');
  const notesPath = path.join(resolved, 'notes.md');

  const html = tryReadFile(htmlPath) ?? '';
  if (html === '' && !fs.existsSync(resolved)) return null;
  const schemaRaw = tryReadFile(schemaPath);
  const schema = schemaRaw != null ? JSON.parse(schemaRaw) : null;
  const notes = tryReadFile(notesPath);

  return { slug, html, schema, notes };
}

function tryReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

// ─── Brand Editing (WRITE) ───
//
// Destructive brand-data writes are logged via observability.auditBrandWrite
// which persists to the brand_audit_log table (and echoes to stdout).

export function updatePattern(slug: string, content: string): { success: boolean; error?: string } {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug);
  if (!exists) return { success: false, error: `Pattern '${slug}' not found` };
  const result = db
    .prepare(`UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?`)
    .run(content, Date.now(), slug);
  auditBrandWrite('update_pattern', { slug, bytes: content.length });
  return { success: result.changes > 0 };
}

export function createPattern(
  category: string,
  name: string,
  content: string,
): { slug: string; name: string; category: string; weight: number } | { error: string } {
  const db = getDb();
  const baseSlug = slugify(name);
  if (!baseSlug) {
    return { error: `Cannot derive a slug from name '${name}' — use alphanumeric characters.` };
  }

  // brand_patterns.slug is UNIQUE. If the base slug is taken, suffix -2, -3, ...
  // so the agent can retry without a hard failure. Bounded to avoid a runaway loop.
  let slug = baseSlug;
  let attempt = 2;
  while (db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug) && attempt < 100) {
    slug = `${baseSlug}-${attempt++}`;
  }
  if (db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug)) {
    return { error: `Too many patterns with base slug '${baseSlug}'` };
  }

  const id = nanoid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, 50, 0, 0, ?)`,
  ).run(id, slug, name, category, content, now);
  auditBrandWrite('create_pattern', { slug, category, name });
  return { slug, name, category, weight: 50 };
}

export function deletePattern(slug: string): { success: boolean; error?: string } {
  const db = getDb();
  // Core patterns (is_core=1) are part of the brand's permanent structure and
  // cannot be deleted by the agent. They can still have their content updated.
  const row = db.prepare(`SELECT is_core FROM brand_patterns WHERE slug = ?`).get(slug) as
    | { is_core: number }
    | undefined;
  if (!row) return { success: false, error: `Pattern '${slug}' not found` };
  if (row.is_core === 1) {
    return {
      success: false,
      error: `Pattern '${slug}' is a core pattern and cannot be deleted. Use update_pattern to change its content.`,
    };
  }
  const result = db.prepare(`DELETE FROM brand_patterns WHERE slug = ?`).run(slug);
  auditBrandWrite('delete_pattern', { slug, rows: result.changes });
  return { success: result.changes > 0 };
}

export function updateVoiceGuide(
  slug: string,
  content: string,
): { success: boolean; error?: string } {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug);
  if (!exists) return { success: false, error: `Voice guide '${slug}' not found` };
  const result = db
    .prepare(`UPDATE voice_guide_docs SET content = ?, updated_at = ? WHERE slug = ?`)
    .run(content, Date.now(), slug);
  auditBrandWrite('update_voice_guide', { slug, bytes: content.length });
  return { success: result.changes > 0 };
}

export function createVoiceGuide(
  title: string,
  content: string,
): { slug: string; title: string } | { error: string } {
  const db = getDb();
  const baseSlug = slugify(title);
  if (!baseSlug) {
    return { error: `Cannot derive a slug from title '${title}' — use alphanumeric characters.` };
  }

  let slug = baseSlug;
  let attempt = 2;
  while (db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug) && attempt < 100) {
    slug = `${baseSlug}-${attempt++}`;
  }
  if (db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug)) {
    return { error: `Too many voice guide docs with base slug '${baseSlug}'` };
  }

  const id = nanoid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO voice_guide_docs (id, slug, label, content, sort_order, updated_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).run(id, slug, title, content, now);
  auditBrandWrite('create_voice_guide', { slug, title });
  return { slug, title };
}

// ─── Visual (CREATE & PREVIEW) ───

export async function renderPreviewTool(
  html: string,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<{ base64: string }> {
  const base64 = await renderPreview(html, width, height, signal);
  return { base64 };
}

export function saveCreation(
  html: string,
  slotSchema: Record<string, any> | null,
  platform: string,
  campaignId?: string,
): {
  campaignId: string;
  creationId: string;
  slideId: string;
  iterationId: string;
  htmlPath: string;
  validation: string;
} {
  const db = getDb();
  const now = Date.now();
  const normalizedPlatform = normalizePlatform(platform);

  // Resolve the target campaign up front. When no campaignId is supplied we
  // route the creation to the singleton "__standalone__" sentinel campaign
  // (creating it on first save) instead of spawning a fresh "Agent Campaign
  // {date}" row per save. This keeps the campaigns list clean and lets the
  // Creations tab (which filters on the sentinel) find the result.
  const cId = campaignId ?? getOrCreateStandaloneCampaignId();
  const creationId = nanoid();
  const slideId = nanoid();
  const iterationId = nanoid();
  const htmlRelPath = `.fluid/campaigns/${cId}/${creationId}/${slideId}/${iterationId}.html`;
  const htmlAbsPath = path.resolve(PROJECT_ROOT, htmlRelPath);

  // Merge brand CSS layers in-memory first, then write once — before touching the
  // DB. If the write fails, the DB transaction is never attempted.
  const mergedHtml = mergeCssLayersForHtml(html, normalizedPlatform);
  fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
  fs.writeFileSync(htmlAbsPath, mergedHtml, 'utf-8');

  // Post-write sanity check. If the write silently produced a 0-byte file
  // (disk full, truncated stream, permission quirk), throw BEFORE starting
  // the DB transaction so no orphan iteration row gets written. The catch
  // below the transaction also unlinks the file on DB failure; for this
  // path we unlink here since the transaction hasn't started yet.
  const written = fs.statSync(htmlAbsPath);
  if (written.size === 0) {
    try {
      fs.unlinkSync(htmlAbsPath);
    } catch {}
    throw new Error(`HTML file write produced 0 bytes: ${htmlAbsPath}`);
  }

  const aiBaseline = slotSchema
    ? JSON.stringify(Object.fromEntries(Object.keys(slotSchema).map((k) => [k, null])))
    : null;

  // All three INSERTs run in a single transaction so a mid-way failure can't
  // leave an orphaned creation/slide without an iteration row. The campaign
  // row is resolved above (either the caller-supplied one or the sentinel),
  // so no campaign INSERT happens here.
  // Note: the HTML file is written above the transaction. If the transaction
  // throws, we clean up the orphaned file in the catch below — otherwise
  // failed saves would litter .fluid/campaigns/ with dead files.
  const insertAll = db.transaction(() => {
    db.prepare(
      `INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(creationId, cId, `${normalizedPlatform} creation`, normalizedPlatform, now);

    db.prepare(
      `INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, 0, ?)`,
    ).run(slideId, creationId, now);

    db.prepare(
      `INSERT INTO iterations
        (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, generation_status, created_at)
       VALUES (?, ?, 0, ?, ?, ?, NULL, 'unmarked', 'ai', 'complete', ?)`,
    ).run(
      iterationId,
      slideId,
      htmlRelPath,
      slotSchema ? JSON.stringify(slotSchema) : null,
      aiBaseline,
      now,
    );
  });
  try {
    insertAll();
  } catch (err) {
    // DB rollback already happened (better-sqlite3 transactions are atomic).
    // Remove the orphaned HTML file we wrote above the transaction so the
    // on-disk state stays consistent with the DB.
    try {
      fs.unlinkSync(htmlAbsPath);
    } catch {}
    throw err;
  }

  // Harness validation hooks (automatic) — CSS merge already happened above.
  const validation = runValidation(htmlAbsPath, normalizedPlatform);
  const validationMessage = formatValidationMessage(validation);

  return {
    campaignId: cId,
    creationId,
    slideId,
    iterationId,
    htmlPath: htmlRelPath,
    validation: validationMessage,
  };
}

export function editCreation(
  iterationId: string,
  html: string,
  slotSchema?: Record<string, any>,
): { success: boolean; validation?: string } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT html_path, s.creation_id FROM iterations i JOIN slides s ON s.id = i.slide_id WHERE i.id = ?`,
    )
    .get(iterationId) as { html_path: string; creation_id: string } | undefined;
  if (!row) return { success: false };

  const htmlAbsPath = path.resolve(PROJECT_ROOT, row.html_path);

  // Determine platform from creation type
  const creation = db
    .prepare(`SELECT creation_type FROM creations WHERE id = ?`)
    .get(row.creation_id) as { creation_type: string } | undefined;
  const platform = creation?.creation_type || 'instagram';

  // Merge brand CSS layers in-memory, then write once.
  const mergedHtml = mergeCssLayersForHtml(html, platform);
  fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
  fs.writeFileSync(htmlAbsPath, mergedHtml, 'utf-8');

  if (slotSchema !== undefined) {
    db.prepare(`UPDATE iterations SET slot_schema = ? WHERE id = ?`).run(
      JSON.stringify(slotSchema),
      iterationId,
    );
  }

  // Re-run validation
  const validation = runValidation(htmlAbsPath, platform);

  // Log creation edits so iteration churn is visible in chat_events alongside
  // brand writes. Creations aren't in brand_audit_log because they're
  // versioned per-iteration, not destructive, but they still deserve a trail.
  logChatEvent('creation_edited', {
    iterationId,
    creationId: row.creation_id,
    platform,
    bytes: mergedHtml.length,
  });

  return { success: true, validation: formatValidationMessage(validation) };
}

export function saveAsTemplate(
  iterationId: string,
  name: string,
  category: string,
): { templateId: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.html_path, c.creation_type
     FROM iterations i
     JOIN slides s ON s.id = i.slide_id
     JOIN creations c ON c.id = s.creation_id
     WHERE i.id = ?`,
    )
    .get(iterationId) as { html_path: string; creation_type: string } | undefined;
  if (!row) return null;

  const htmlAbsPath = path.resolve(PROJECT_ROOT, row.html_path);
  if (!fs.existsSync(htmlAbsPath)) return null;

  const templateId = nanoid();
  const now = Date.now();
  const templateFile = `agent-template-${templateId}.html`;
  const templateDir = path.join(PROJECT_ROOT, 'templates', 'social');
  fs.mkdirSync(templateDir, { recursive: true });

  const destPath = path.join(templateDir, templateFile);
  fs.copyFileSync(htmlAbsPath, destPath);

  // num is a legacy free-form string column (no UNIQUE constraint) — '0' is
  // the convention for agent-saved templates to distinguish them from
  // numbered curated templates.
  db.prepare(
    `INSERT INTO templates (id, type, num, name, file, layout, dims, description, content_slots, creation_steps, preview_path, sort_order, updated_at)
     VALUES (?, ?, '0', ?, ?, 'single', NULL, ?, '[]', '[]', '', 0, ?)`,
  ).run(
    templateId,
    category,
    name,
    `templates/social/${templateFile}`,
    `Agent-saved template from ${row.creation_type}`,
    now,
  );

  return { templateId };
}

// ─── Context (UI AWARENESS) ───

export function getCreation(iterationId: string): {
  iterationId: string;
  slideId: string;
  creationId: string;
  campaignId: string;
  creationType: string;
  htmlPath: string;
  slotSchema: Record<string, any> | null;
  mergedSlotState: Record<string, any> | null;
  status: string;
  generationStatus: string;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT
      i.id AS iteration_id,
      i.slide_id,
      s.creation_id,
      c.campaign_id,
      c.creation_type,
      i.html_path,
      i.slot_schema,
      i.ai_baseline,
      i.user_state,
      i.status,
      i.generation_status
    FROM iterations i
    JOIN slides s ON s.id = i.slide_id
    JOIN creations c ON c.id = s.creation_id
    WHERE i.id = ?
  `,
    )
    .get(iterationId) as any;

  if (!row) return null;

  const slotSchema = row.slot_schema ? JSON.parse(row.slot_schema) : null;
  const aiBaseline = row.ai_baseline ? JSON.parse(row.ai_baseline) : null;
  const userState = row.user_state ? JSON.parse(row.user_state) : null;

  // Merge: user_state overrides ai_baseline
  let mergedSlotState: Record<string, any> | null = null;
  if (aiBaseline || userState) {
    mergedSlotState = { ...(aiBaseline ?? {}), ...(userState ?? {}) };
  }

  return {
    iterationId: row.iteration_id,
    slideId: row.slide_id,
    creationId: row.creation_id,
    campaignId: row.campaign_id,
    creationType: row.creation_type,
    htmlPath: row.html_path,
    slotSchema,
    mergedSlotState,
    status: row.status,
    generationStatus: row.generation_status,
  };
}

export function getCampaign(campaignId: string): {
  id: string;
  title: string;
  channels: string[];
  creations: { id: string; title: string; creationType: string; iterationCount: number }[];
} | null {
  const db = getDb();
  const campaign = db
    .prepare(`SELECT id, title, channels FROM campaigns WHERE id = ?`)
    .get(campaignId) as { id: string; title: string; channels: string } | undefined;
  if (!campaign) return null;

  const creations = db
    .prepare(
      `
    SELECT
      c.id,
      c.title,
      c.creation_type,
      (SELECT COUNT(*) FROM iterations i
       JOIN slides s ON s.id = i.slide_id
       WHERE s.creation_id = c.id) AS iteration_count
    FROM creations c
    WHERE c.campaign_id = ?
    ORDER BY c.created_at ASC
  `,
    )
    .all(campaignId) as any[];

  // Channels is stored as JSON text. Legacy / malformed rows shouldn't throw
  // and tank the entire get_campaign tool call — fall back to empty array.
  let channels: string[] = [];
  try {
    channels = campaign.channels ? JSON.parse(campaign.channels) : [];
    if (!Array.isArray(channels)) channels = [];
  } catch {
    channels = [];
  }

  return {
    id: campaign.id,
    title: campaign.title,
    channels,
    creations: creations.map((c) => ({
      id: c.id,
      title: c.title,
      creationType: c.creation_type,
      iterationCount: c.iteration_count,
    })),
  };
}

// ─── Phase 24: DAM-first image search ────────────────────────────────────────

export interface BrandImageSearchResult {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  description: string | null;
  score: number;
}

/**
 * Search the brand's image library (DAM) before requesting image generation.
 * Returns existing brand images ranked by query match. This is the first step
 * of the DAM-first workflow: always call this before generate_image to check
 * whether a suitable asset already exists.
 *
 * Read-only — no side effects except logging the search event.
 */
export function searchBrandImages(opts: {
  query: string;
  category?: 'images' | 'decorations' | 'logos';
  limit?: number;
}): BrandImageSearchResult[] {
  if (!opts.query || typeof opts.query !== 'string') return [];
  const results = searchBrandAssets(
    opts.query,
    opts.category,
    Math.min(opts.limit ?? 10, 25),
  );
  logChatEvent('dam_search', {
    query: opts.query,
    category: opts.category ?? null,
    results_count: results.length,
    top_score: results[0]?.score ?? 0,
  });
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    mimeType: r.mimeType,
    description: r.description,
    score: r.score,
  }));
}

// ─── Phase 24 Dispatch 3: Image generation + skill reading ───────────────────

/**
 * Thrown when Gemini blocks a generation request due to safety filters.
 * The dispatcher checks for this error type and returns outcome='blocked_safety'
 * so the model receives a structured signal rather than a generic tool error.
 *
 * Design choice: We use a typed error class (rather than a union return type)
 * so the dispatcher can inspect the error without every caller needing to
 * check for a blocked branch. The dispatchTool catch block in tool-dispatch.ts
 * already handles outcome='error' for all errors; we add a specific check for
 * ImageGenerationBlockedError to emit outcome='blocked_safety' instead.
 */
export class ImageGenerationBlockedError extends Error {
  public readonly reason: 'safety' | 'image_safety' | 'other' | 'no_inline_data';
  constructor(reason: 'safety' | 'image_safety' | 'other' | 'no_inline_data') {
    super(`Image generation blocked by safety filter: ${reason}`);
    this.name = 'ImageGenerationBlockedError';
    this.reason = reason;
  }
}

export interface GenerateImageToolResult {
  id: string;
  name: string;
  url: string;
  promptUsed: string;
  watermark: 'synthid';
  costUsd: number;
  cached?: boolean;
}

/**
 * Generate a brand image via Gemini 2.5 Flash Image.
 *
 * Idempotency: if an asset with the same computed key already exists in
 * brand_assets, the existing record is returned with costUsd=0 and cached=true.
 *
 * Safety blocks throw ImageGenerationBlockedError so the dispatcher can emit
 * outcome='blocked_safety' (handled in agent.ts already) instead of 'error'.
 */
export async function generateImageTool(opts: {
  prompt: string;
  aspectRatio: GeminiAspectRatio;
  referenceImages?: string[];
  idempotencyKey?: string;
  reason: 'no_dam_match' | 'user_explicit_request' | 'style_override';
  sessionId?: string | null;
  iterationId?: string | null;
  searchedQueries?: string[];
}): Promise<GenerateImageToolResult> {
  // 1. Compute or accept idempotency key
  const key =
    opts.idempotencyKey ??
    computeIdempotencyKey({
      prompt: opts.prompt,
      aspectRatio: opts.aspectRatio,
      referenceImages: opts.referenceImages,
    });

  // 2. Check for existing asset with same idempotency key
  const existing = findAssetByIdempotencyKey(key);
  if (existing) {
    logChatEvent('image_gen_idempotent_hit', {
      idempotency_key: key,
      asset_id: existing.id,
    });
    return {
      id: existing.id,
      name: existing.name,
      url: existing.url,
      promptUsed: opts.prompt,
      watermark: 'synthid',
      costUsd: 0,
      cached: true,
    };
  }

  // 3. Generate via Gemini
  const result = await generateGeminiImage({
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    referenceImages: opts.referenceImages,
    idempotencyKey: key,
    reason: opts.reason,
    sessionId: opts.sessionId,
    iterationId: opts.iterationId,
    searchedQueries: opts.searchedQueries,
  });

  // 4. Handle safety block — throw typed error so dispatcher can classify
  if ('blocked' in result) {
    logChatEvent('image_gen_blocked_safety', {
      reason: result.reason,
      finishReason: result.finishReason,
    });
    throw new ImageGenerationBlockedError(result.reason);
  }

  logChatEvent('image_generated', {
    asset_id: result.id,
    cost_usd: result.costUsd,
  });

  return {
    id: result.id,
    name: result.name,
    url: `/api/brand-assets/serve/${encodeURIComponent(result.name)}`,
    promptUsed: opts.prompt,
    watermark: 'synthid',
    costUsd: result.costUsd,
  };
}

/**
 * Promote a generated (or uploaded) asset to the curated brand library.
 * Thin wrapper over promoteAssetToLibrary in db-api.ts.
 */
export function promoteGeneratedImageTool(assetId: string): { success: boolean } {
  if (!assetId || typeof assetId !== 'string') {
    throw new Error("promoteGeneratedImageTool: 'assetId' must be a non-empty string");
  }
  promoteAssetToLibrary(assetId);
  logChatEvent('asset_promoted', { asset_id: assetId });
  return { success: true };
}

// ─── Skill whitelist ──────────────────────────────────────────────────────────

const SKILL_WHITELIST: Record<string, string> = {
  'social-media-taste': 'social-media-taste-skill.md',
  'gemini-social-image': 'gemini-social-image-skill.md',
};

const SKILLS_DIR = path.resolve(import.meta.dirname, 'skills');

/**
 * Read a skill markdown file by whitelisted name.
 * Returns name, content, and linesCount.
 * Throws if the name is not in the whitelist.
 */
export function readSkillTool(name: string): {
  name: string;
  content: string;
  linesCount: number;
} {
  const fileName = SKILL_WHITELIST[name];
  if (!fileName) {
    throw new Error(
      `readSkillTool: unknown skill '${name}'. Allowed: ${Object.keys(SKILL_WHITELIST).join(', ')}`,
    );
  }
  const skillPath = path.join(SKILLS_DIR, fileName);
  const content = fs.readFileSync(skillPath, 'utf-8');
  const linesCount = content.split('\n').length;
  return { name, content, linesCount };
}
