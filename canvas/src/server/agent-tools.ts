import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { renderPreview } from './render-engine';
import { runValidation, mergeCssLayersForHtml, formatValidationMessage } from './validation-hooks';
import { auditBrandWrite, logChatEvent } from './observability';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ARCHETYPES_DIR = path.join(PROJECT_ROOT, 'archetypes');

// Known creation types — must match the platform names referenced in the system
// prompt, validation-hooks.runValidation, and dimension-check.cjs targets.
// Used to reject malformed agent inputs early rather than letting them propagate
// into the brand compliance / dimension-check subprocesses.
const KNOWN_PLATFORMS = new Set([
  'instagram',
  'instagram-square',
  'instagram-story',
  'linkedin',
  'facebook',
  'twitter',
  'one-pager',
]);

function normalizePlatform(platform: string): string {
  const p = platform.toLowerCase().trim();
  if (!KNOWN_PLATFORMS.has(p)) {
    logChatEvent('platform_rejected', { platform, known: [...KNOWN_PLATFORMS] });
    throw new Error(
      `Unknown platform '${platform}'. Must be one of: ${[...KNOWN_PLATFORMS].join(', ')}`
    );
  }
  return p;
}

// ─── Brand Discovery (READ) ───

export function listVoiceGuide(): { slug: string; title: string; description: string }[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT slug, label, SUBSTR(content, 1, 200) as description FROM voice_guide_docs ORDER BY label`
  ).all() as any[];
  return rows.map(r => ({
    slug: r.slug,
    title: r.label,
    description: r.description?.split('\n')[0] ?? '',
  }));
}

export function readVoiceGuide(slug: string): { slug: string; title: string; content: string } | null {
  const db = getDb();
  const row = db.prepare(`SELECT slug, label, content FROM voice_guide_docs WHERE slug = ?`).get(slug) as any;
  if (!row) return null;
  return { slug: row.slug, title: row.label, content: row.content };
}

export function listPatterns(category?: string): { slug: string; name: string; category: string; weight: number; description: string }[] {
  const db = getDb();
  const sql = category
    ? `SELECT slug, label, category, weight, SUBSTR(content, 1, 200) as description FROM brand_patterns WHERE category = ? ORDER BY weight DESC, label`
    : `SELECT slug, label, category, weight, SUBSTR(content, 1, 200) as description FROM brand_patterns ORDER BY category, weight DESC, label`;
  const rows = (category ? db.prepare(sql).all(category) : db.prepare(sql).all()) as any[];
  return rows.map(r => ({
    slug: r.slug,
    name: r.label,
    category: r.category,
    weight: r.weight ?? 50,
    description: r.description?.split('\n')[0] ?? '',
  }));
}

export function readPattern(slug: string): { slug: string; name: string; category: string; weight: number; content: string } | null {
  const db = getDb();
  const row = db.prepare(`SELECT slug, label, category, weight, content FROM brand_patterns WHERE slug = ?`).get(slug) as any;
  if (!row) return null;
  return { slug: row.slug, name: row.label, category: row.category, weight: row.weight ?? 50, content: row.content };
}

export function listAssets(category?: string): { name: string; category: string; filePath: string | null; description: string | null }[] {
  const db = getDb();
  const sql = category
    ? `SELECT name, category, file_path as filePath, description FROM brand_assets WHERE category = ? ORDER BY name`
    : `SELECT name, category, file_path as filePath, description FROM brand_assets ORDER BY category, name`;
  return (category ? db.prepare(sql).all(category) : db.prepare(sql).all()) as any[];
}

export function listTemplates(): { id: number; name: string; type: string | null; description: string | null }[] {
  const db = getDb();
  return db.prepare(`SELECT id, name, type, description FROM templates ORDER BY name`).all() as any[];
}

export function readTemplate(id: number): any | null {
  const db = getDb();
  const tmpl = db.prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as any;
  if (!tmpl) return null;
  const rules = db.prepare(`SELECT * FROM template_design_rules WHERE scope = 'template' OR scope = 'global' ORDER BY sort_order`).all() as any[];
  return { ...tmpl, designRules: rules };
}

export function listArchetypes(): { slug: string; name: string; slots: string[] }[] {
  if (!fs.existsSync(ARCHETYPES_DIR)) return [];
  const dirs = fs.readdirSync(ARCHETYPES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'components');

  return dirs.map(d => {
    const schemaPath = path.join(ARCHETYPES_DIR, d.name, 'schema.json');
    let slots: string[] = [];
    if (fs.existsSync(schemaPath)) {
      try {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        slots = (schema.slots ?? []).map((s: any) => s.label ?? s.selector);
      } catch {}
    }
    return {
      slug: d.name,
      name: d.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      slots,
    };
  });
}

// Archetype slugs are directory names under archetypes/. Agent input is
// untrusted — restrict the slug to a safe identifier shape so a prompt-injection
// can't traverse out with "../../.env" and leak arbitrary files via readFileSync.
const SAFE_SLUG = /^[a-z0-9][a-z0-9-_]*$/i;

export function readArchetype(slug: string): { slug: string; html: string; schema: any; notes: string | null } | null {
  if (!SAFE_SLUG.test(slug)) {
    logChatEvent('path_traversal_blocked', { tool: 'read_archetype', slug, reason: 'unsafe_chars' });
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
  if (!fs.existsSync(resolved)) return null;

  const htmlPath = path.join(resolved, 'index.html');
  const schemaPath = path.join(resolved, 'schema.json');
  const notesPath = path.join(resolved, 'notes.md');

  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf-8') : '';
  const schema = fs.existsSync(schemaPath) ? JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) : null;
  const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf-8') : null;

  return { slug, html, schema, notes };
}

// ─── Brand Editing (WRITE) ───
//
// Destructive brand-data writes are logged via observability.auditBrandWrite
// which persists to the brand_audit_log table (and echoes to stdout).


export function updatePattern(slug: string, content: string): { success: boolean; error?: string } {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug);
  if (!exists) return { success: false, error: `Pattern '${slug}' not found` };
  const result = db.prepare(
    `UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?`
  ).run(content, Date.now(), slug);
  auditBrandWrite('update_pattern', { slug, bytes: content.length });
  return { success: result.changes > 0 };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function createPattern(
  category: string,
  name: string,
  content: string
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
  while (
    db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug) &&
    attempt < 100
  ) {
    slug = `${baseSlug}-${attempt++}`;
  }
  if (db.prepare('SELECT 1 FROM brand_patterns WHERE slug = ?').get(slug)) {
    return { error: `Too many patterns with base slug '${baseSlug}'` };
  }

  const id = nanoid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, 50, 0, 0, ?)`
  ).run(id, slug, name, category, content, now);
  auditBrandWrite('create_pattern', { slug, category, name });
  return { slug, name, category, weight: 50 };
}

export function deletePattern(slug: string): { success: boolean; error?: string } {
  const db = getDb();
  // Core patterns (is_core=1) are part of the brand's permanent structure and
  // cannot be deleted by the agent. They can still have their content updated.
  const row = db.prepare(`SELECT is_core FROM brand_patterns WHERE slug = ?`).get(slug) as { is_core: number } | undefined;
  if (!row) return { success: false, error: `Pattern '${slug}' not found` };
  if (row.is_core === 1) {
    return { success: false, error: `Pattern '${slug}' is a core pattern and cannot be deleted. Use update_pattern to change its content.` };
  }
  const result = db.prepare(`DELETE FROM brand_patterns WHERE slug = ?`).run(slug);
  auditBrandWrite('delete_pattern', { slug, rows: result.changes });
  return { success: result.changes > 0 };
}

export function updateVoiceGuide(slug: string, content: string): { success: boolean; error?: string } {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug);
  if (!exists) return { success: false, error: `Voice guide '${slug}' not found` };
  const result = db.prepare(
    `UPDATE voice_guide_docs SET content = ?, updated_at = ? WHERE slug = ?`
  ).run(content, Date.now(), slug);
  auditBrandWrite('update_voice_guide', { slug, bytes: content.length });
  return { success: result.changes > 0 };
}

export function createVoiceGuide(
  title: string,
  content: string
): { slug: string; title: string } | { error: string } {
  const db = getDb();
  const baseSlug = slugify(title);
  if (!baseSlug) {
    return { error: `Cannot derive a slug from title '${title}' — use alphanumeric characters.` };
  }

  let slug = baseSlug;
  let attempt = 2;
  while (
    db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug) &&
    attempt < 100
  ) {
    slug = `${baseSlug}-${attempt++}`;
  }
  if (db.prepare('SELECT 1 FROM voice_guide_docs WHERE slug = ?').get(slug)) {
    return { error: `Too many voice guide docs with base slug '${baseSlug}'` };
  }

  const id = nanoid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO voice_guide_docs (id, slug, label, content, sort_order, updated_at)
     VALUES (?, ?, ?, ?, 0, ?)`
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
  campaignId?: string
): { campaignId: string; creationId: string; slideId: string; iterationId: string; htmlPath: string; validation: string } {
  const db = getDb();
  const now = Date.now();
  const normalizedPlatform = normalizePlatform(platform);

  // Decide IDs up front so we can build the on-disk path before the transaction.
  const cId = campaignId ?? nanoid();
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

  const aiBaseline = slotSchema ? JSON.stringify(
    Object.fromEntries(Object.keys(slotSchema).map(k => [k, null]))
  ) : null;

  // All four INSERTs run in a single transaction so a mid-way failure can't
  // leave an orphaned campaign/creation/slide without an iteration row.
  // Note: the HTML file is written above the transaction. If the transaction
  // throws, we clean up the orphaned file in the catch below — otherwise
  // failed saves would litter .fluid/campaigns/ with dead files.
  const insertAll = db.transaction(() => {
    if (!campaignId) {
      db.prepare(
        `INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      ).run(cId, `Agent Campaign ${new Date(now).toISOString().slice(0, 10)}`, JSON.stringify([normalizedPlatform]), now, now);
    }

    db.prepare(
      `INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, 1, ?)`
    ).run(creationId, cId, `${normalizedPlatform} creation`, normalizedPlatform, now);

    db.prepare(
      `INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, 0, ?)`
    ).run(slideId, creationId, now);

    db.prepare(
      `INSERT INTO iterations
        (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, generation_status, created_at)
       VALUES (?, ?, 0, ?, ?, ?, NULL, 'unmarked', 'ai', 'complete', ?)`
    ).run(
      iterationId,
      slideId,
      htmlRelPath,
      slotSchema ? JSON.stringify(slotSchema) : null,
      aiBaseline,
      now
    );
  });
  try {
    insertAll();
  } catch (err) {
    // DB rollback already happened (better-sqlite3 transactions are atomic).
    // Remove the orphaned HTML file we wrote above the transaction so the
    // on-disk state stays consistent with the DB.
    try { fs.unlinkSync(htmlAbsPath); } catch {}
    throw err;
  }

  // Harness validation hooks (automatic) — CSS merge already happened above.
  const validation = runValidation(htmlAbsPath, normalizedPlatform);
  const validationMessage = formatValidationMessage(validation);

  return { campaignId: cId, creationId, slideId, iterationId, htmlPath: htmlRelPath, validation: validationMessage };
}

export function editCreation(
  iterationId: string,
  html: string,
  slotSchema?: Record<string, any>
): { success: boolean; validation?: string } {
  const db = getDb();
  const row = db.prepare(
    `SELECT html_path, s.creation_id FROM iterations i JOIN slides s ON s.id = i.slide_id WHERE i.id = ?`
  ).get(iterationId) as { html_path: string; creation_id: string } | undefined;
  if (!row) return { success: false };

  const htmlAbsPath = path.resolve(PROJECT_ROOT, row.html_path);

  // Determine platform from creation type
  const creation = db.prepare(
    `SELECT creation_type FROM creations WHERE id = ?`
  ).get(row.creation_id) as { creation_type: string } | undefined;
  const platform = creation?.creation_type || 'instagram';

  // Merge brand CSS layers in-memory, then write once.
  const mergedHtml = mergeCssLayersForHtml(html, platform);
  fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
  fs.writeFileSync(htmlAbsPath, mergedHtml, 'utf-8');

  if (slotSchema !== undefined) {
    db.prepare(
      `UPDATE iterations SET slot_schema = ? WHERE id = ?`
    ).run(JSON.stringify(slotSchema), iterationId);
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
  category: string
): { templateId: string } | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT i.html_path, c.creation_type
     FROM iterations i
     JOIN slides s ON s.id = i.slide_id
     JOIN creations c ON c.id = s.creation_id
     WHERE i.id = ?`
  ).get(iterationId) as { html_path: string; creation_type: string } | undefined;
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
     VALUES (?, ?, '0', ?, ?, 'single', NULL, ?, '[]', '[]', '', 0, ?)`
  ).run(templateId, category, name, `templates/social/${templateFile}`, `Agent-saved template from ${row.creation_type}`, now);

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
  const row = db.prepare(`
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
  `).get(iterationId) as any;

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
  const campaign = db.prepare(
    `SELECT id, title, channels FROM campaigns WHERE id = ?`
  ).get(campaignId) as { id: string; title: string; channels: string } | undefined;
  if (!campaign) return null;

  const creations = db.prepare(`
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
  `).all(campaignId) as any[];

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
    creations: creations.map(c => ({
      id: c.id,
      title: c.title,
      creationType: c.creation_type,
      iterationCount: c.iteration_count,
    })),
  };
}
