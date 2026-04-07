import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { renderPreview } from './render-engine';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ARCHETYPES_DIR = path.join(PROJECT_ROOT, 'archetypes');

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

export function readArchetype(slug: string): { slug: string; html: string; schema: any; notes: string | null } | null {
  const dir = path.join(ARCHETYPES_DIR, slug);
  if (!fs.existsSync(dir)) return null;

  const htmlPath = path.join(dir, 'index.html');
  const schemaPath = path.join(dir, 'schema.json');
  const notesPath = path.join(dir, 'notes.md');

  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf-8') : '';
  const schema = fs.existsSync(schemaPath) ? JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) : null;
  const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf-8') : null;

  return { slug, html, schema, notes };
}

// ─── Brand Editing (WRITE) ───

export function updatePattern(slug: string, content: string): boolean {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(
    `UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?`
  ).run(content, now, slug);
  return result.changes > 0;
}

export function createPattern(
  category: string,
  name: string,
  content: string
): { slug: string; name: string; category: string; weight: number } {
  const db = getDb();
  const id = nanoid();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const now = Date.now();
  db.prepare(
    `INSERT INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, 50, 0, 0, ?)`
  ).run(id, slug, name, category, content, now);
  return { slug, name, category, weight: 50 };
}

export function deletePattern(slug: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM brand_patterns WHERE slug = ?`).run(slug);
  return result.changes > 0;
}

export function updateVoiceGuide(slug: string, content: string): boolean {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(
    `UPDATE voice_guide_docs SET content = ?, updated_at = ? WHERE slug = ?`
  ).run(content, now, slug);
  return result.changes > 0;
}

export function createVoiceGuide(
  title: string,
  content: string
): { slug: string; title: string } {
  const db = getDb();
  const id = nanoid();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const now = Date.now();
  db.prepare(
    `INSERT INTO voice_guide_docs (id, slug, label, content, sort_order, updated_at)
     VALUES (?, ?, ?, ?, 0, ?)`
  ).run(id, slug, title, content, now);
  return { slug, title };
}

// ─── Visual (CREATE & PREVIEW) ───

export async function renderPreviewTool(
  html: string,
  width: number,
  height: number
): Promise<{ base64: string }> {
  const base64 = await renderPreview(html, width, height);
  return { base64 };
}

export function saveCreation(
  html: string,
  slotSchema: Record<string, any> | null,
  platform: string,
  campaignId?: string
): { campaignId: string; creationId: string; slideId: string; iterationId: string; htmlPath: string } {
  const db = getDb();
  const now = Date.now();

  // Create or reuse campaign
  let cId = campaignId;
  if (!cId) {
    cId = nanoid();
    db.prepare(
      `INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    ).run(cId, `Agent Campaign ${new Date(now).toISOString().slice(0, 10)}`, JSON.stringify([platform]), now, now);
  }

  const creationId = nanoid();
  db.prepare(
    `INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, 1, ?)`
  ).run(creationId, cId, `${platform} creation`, platform, now);

  const slideId = nanoid();
  db.prepare(
    `INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, 0, ?)`
  ).run(slideId, creationId, now);

  const iterationId = nanoid();
  const htmlRelPath = `.fluid/campaigns/${cId}/${creationId}/${slideId}/${iterationId}.html`;
  const htmlAbsPath = path.resolve(PROJECT_ROOT, htmlRelPath);

  fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
  fs.writeFileSync(htmlAbsPath, html, 'utf-8');

  const aiBaseline = slotSchema ? JSON.stringify(
    Object.fromEntries(Object.keys(slotSchema).map(k => [k, null]))
  ) : null;

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

  return { campaignId: cId, creationId, slideId, iterationId, htmlPath: htmlRelPath };
}

export function editCreation(
  iterationId: string,
  html: string,
  slotSchema?: Record<string, any>
): boolean {
  const db = getDb();
  const row = db.prepare(
    `SELECT html_path FROM iterations WHERE id = ?`
  ).get(iterationId) as { html_path: string } | undefined;
  if (!row) return false;

  const htmlAbsPath = path.resolve(PROJECT_ROOT, row.html_path);
  fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
  fs.writeFileSync(htmlAbsPath, html, 'utf-8');

  if (slotSchema !== undefined) {
    db.prepare(
      `UPDATE iterations SET slot_schema = ? WHERE id = ?`
    ).run(JSON.stringify(slotSchema), iterationId);
  }

  return true;
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

  return {
    id: campaign.id,
    title: campaign.title,
    channels: JSON.parse(campaign.channels),
    creations: creations.map(c => ({
      id: c.id,
      title: c.title,
      creationType: c.creation_type,
      iterationCount: c.iteration_count,
    })),
  };
}
