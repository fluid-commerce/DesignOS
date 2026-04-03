import { getDb } from '../lib/db';
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
