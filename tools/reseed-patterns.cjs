#!/usr/bin/env node
/**
 * reseed-patterns.cjs — Re-seed brand_patterns DB table from pattern-seeds/*.md.
 *
 * After editing pattern-seeds/*.md during overnight run cycles, this script
 * syncs the changes back to SQLite so the pipeline picks them up.
 *
 * Usage: node tools/reseed-patterns.cjs
 *
 * Reads all .md files in pattern-seeds/, derives slug from filename,
 * and upserts into brand_patterns table.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CANVAS_DIR = path.join(PROJECT_ROOT, 'canvas');
const SEEDS_DIR = path.join(PROJECT_ROOT, 'pattern-seeds');

// Load .env
for (const envPath of [path.resolve(PROJECT_ROOT, '.env'), path.resolve(CANVAS_DIR, '.env')]) {
  try {
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* skip */ }
}

const DB_PATH = process.env.FLUID_DB_PATH || path.join(CANVAS_DIR, 'fluid.db');

let Database;
try { Database = require(path.join(CANVAS_DIR, 'node_modules/better-sqlite3')); }
catch { console.error('Error: Run "cd canvas && npm install" first.'); process.exit(1); }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Check if pattern-seeds directory exists
if (!fs.existsSync(SEEDS_DIR)) {
  console.error(`No pattern-seeds directory found at ${SEEDS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.log('No .md files found in pattern-seeds/');
  db.close();
  process.exit(0);
}

// Upsert each pattern seed
let nanoid;
try {
  const mod = require(path.join(CANVAS_DIR, 'node_modules/nanoid'));
  nanoid = mod.nanoid || mod.default?.nanoid;
} catch {
  nanoid = () => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return Array.from({ length: 21 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  };
}

const upsert = db.prepare(`
  INSERT INTO brand_patterns (id, slug, label, category, content, weight, sort_order, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  ON CONFLICT(slug) DO UPDATE SET
    label = excluded.label,
    content = excluded.content,
    weight = excluded.weight,
    updated_at = excluded.updated_at
`);

let updated = 0;
const transaction = db.transaction(() => {
  for (const file of files) {
    const slug = path.basename(file, '.md');
    const content = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');

    // Derive label from first heading or filename
    const headingMatch = content.match(/^#\s+(.+)/m);
    const label = headingMatch ? headingMatch[1].trim() : slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Derive category from filename convention or default to 'design-tokens'
    const categoryMap = {
      'color-palette': 'colors',
      'typography': 'typography',
      'footer-structure': 'logos',
      'photos-mockups': 'images',
      'brushstroke-textures': 'decorations',
      'circles-underlines': 'decorations',
      'scribble-textures': 'decorations',
      'line-textures': 'decorations',
      'x-mark-textures': 'decorations',
      'opacity-patterns': 'colors',
      'flfont-tagline-patterns': 'typography',
      'layout-archetypes': 'archetypes',
    };
    const category = categoryMap[slug] || 'design-tokens';

    // Extract max weight from content
    let maxWeight = 50; // default
    const weightMatches = content.matchAll(/\((?:weight|Weight):\s*(\d+)\)/g);
    for (const m of weightMatches) {
      const w = parseInt(m[1]);
      if (w > maxWeight) maxWeight = w;
    }

    upsert.run(nanoid(), slug, label, category, content, maxWeight, Date.now());
    updated++;
  }
});

transaction();
console.log(`Reseeded ${updated} pattern(s) from ${SEEDS_DIR}`);
db.close();
