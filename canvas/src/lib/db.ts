/**
 * better-sqlite3 database singleton with WAL mode, FK constraints, and schema init.
 * Server-only module — NEVER import from React components or client code.
 *
 * Singleton pattern prevents multiple connections on Vite HMR hot reload.
 * Set FLUID_DB_PATH env variable to override the default path (used in tests).
 */

import Database from 'better-sqlite3';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default DB path: canvas/fluid.db (two levels up from canvas/src/lib/)
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../fluid.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    // Read FLUID_DB_PATH lazily so tests can set it before calling getDb()
    // after a closeDb() reset.
    const dbPath = process.env.FLUID_DB_PATH || DEFAULT_DB_PATH;
    // Ensure parent directory exists so better-sqlite3 can create the file
    const dir = path.dirname(dbPath);
    try {
      fsSync.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore if dir already exists or mkdir fails (e.g. read-only)
    }
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');      // concurrent reads from MCP + Vite simultaneously
    _db.pragma('foreign_keys = ON');       // enforce referential integrity
    _db.pragma('synchronous = NORMAL');    // safe + faster than FULL
    initSchema(_db);
  }
  return _db;
}

/**
 * Close the database connection and reset the singleton.
 * Used in tests to get a clean DB for each test suite.
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channels TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS creations (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      title TEXT NOT NULL,
      creation_type TEXT NOT NULL,
      slide_count INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS slides (
      id TEXT PRIMARY KEY,
      creation_id TEXT NOT NULL,
      slide_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (creation_id) REFERENCES creations(id)
    );

    CREATE TABLE IF NOT EXISTS iterations (
      id TEXT PRIMARY KEY,
      slide_id TEXT NOT NULL,
      iteration_index INTEGER NOT NULL,
      html_path TEXT NOT NULL,
      slot_schema TEXT,
      ai_baseline TEXT,
      user_state TEXT,
      status TEXT NOT NULL DEFAULT 'unmarked',
      source TEXT NOT NULL DEFAULT 'ai',
      template_id TEXT,
      generation_status TEXT NOT NULL DEFAULT 'complete',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (slide_id) REFERENCES slides(id)
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      iteration_id TEXT NOT NULL,
      type TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'human',
      text TEXT NOT NULL,
      x REAL,
      y REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (iteration_id) REFERENCES iterations(id)
    );

    CREATE TABLE IF NOT EXISTS saved_assets (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      name TEXT,
      mime_type TEXT,
      source TEXT NOT NULL DEFAULT 'dam',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_assets (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      url_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS voice_guide_docs (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_patterns (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_design_rules (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      platform TEXT,
      archetype_slug TEXT,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      num TEXT NOT NULL,
      name TEXT NOT NULL,
      file TEXT NOT NULL,
      layout TEXT NOT NULL,
      dims TEXT,
      description TEXT NOT NULL,
      content_slots TEXT NOT NULL,
      creation_steps TEXT NOT NULL,
      extra_tables TEXT,
      preview_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_map (
      id          TEXT PRIMARY KEY,
      creation_type TEXT NOT NULL,
      stage       TEXT NOT NULL,
      page        TEXT NOT NULL DEFAULT 'patterns',
      sections    TEXT NOT NULL,
      priority    INTEGER NOT NULL DEFAULT 50,
      max_tokens  INTEGER,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      updated_at  INTEGER NOT NULL,
      UNIQUE(creation_type, stage, page)
    );

    CREATE TABLE IF NOT EXISTS context_log (
      id              TEXT PRIMARY KEY,
      generation_id   TEXT NOT NULL,
      creation_type   TEXT NOT NULL,
      stage           TEXT NOT NULL,
      injected_sections TEXT NOT NULL,
      token_estimate  INTEGER NOT NULL,
      gap_tool_calls  TEXT NOT NULL DEFAULT '[]',
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_styles (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL UNIQUE,
      css_content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
  `);

  // Migration: add generation_status to existing databases that predate this column.
  // ALTER TABLE is idempotent-guarded by try-catch; SQLite throws if column already exists.
  try {
    db.exec(`ALTER TABLE iterations ADD COLUMN generation_status TEXT NOT NULL DEFAULT 'complete'`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: rename iterations columns from camelCase to snake_case (legacy DBs).
  // Also migrate frame_id → slide_id (older schema used "frame" for the parent of an iteration).
  // SQLite 3.25+ supports RENAME COLUMN.
  try {
    const info = db.prepare('PRAGMA table_info(iterations)').all() as Array<{ name: string }>;
    const names = info.map((r) => r.name);
    if (names.includes('frame_id') && !names.includes('slide_id')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN frame_id TO slide_id');
    }
    if (names.includes('slideId') && !names.includes('slide_id')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN slideId TO slide_id');
    }
    if (names.includes('iterationIndex') && !names.includes('iteration_index')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN iterationIndex TO iteration_index');
    }
    if (names.includes('htmlPath') && !names.includes('html_path')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN htmlPath TO html_path');
    }
    if (names.includes('slotSchema') && !names.includes('slot_schema')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN slotSchema TO slot_schema');
    }
    if (names.includes('aiBaseline') && !names.includes('ai_baseline')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN aiBaseline TO ai_baseline');
    }
    if (names.includes('userState') && !names.includes('user_state')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN userState TO user_state');
    }
    if (names.includes('templateId') && !names.includes('template_id')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN templateId TO template_id');
    }
    if (names.includes('generationStatus') && !names.includes('generation_status')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN generationStatus TO generation_status');
    }
    if (names.includes('createdAt') && !names.includes('created_at')) {
      db.exec('ALTER TABLE iterations RENAME COLUMN createdAt TO created_at');
    }
  } catch {
    // RENAME COLUMN not supported (old SQLite) or table missing — ignore
  }

  // Migration: add DAM sync columns to brand_assets
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN source TEXT NOT NULL DEFAULT 'local'"); } catch {}
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN dam_asset_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN dam_asset_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN last_synced_at INTEGER"); } catch {}
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN dam_modified_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN dam_deleted INTEGER NOT NULL DEFAULT 0"); } catch {}

  // Index for efficient DAM sync lookup
  try { db.exec("CREATE UNIQUE INDEX idx_brand_assets_dam_id ON brand_assets(dam_asset_id) WHERE dam_asset_id IS NOT NULL"); } catch {}

  // Migration: add page column to context_map
  try { db.exec("ALTER TABLE context_map ADD COLUMN page TEXT NOT NULL DEFAULT 'patterns'"); } catch {}

  // Migration: add description column to brand_assets
  try { db.exec("ALTER TABLE brand_assets ADD COLUMN description TEXT"); } catch {}

  // Migration: recategorize brand_assets from granular to semantic categories
  // Idempotent: only updates rows with old category values
  db.exec("UPDATE brand_assets SET category = 'images' WHERE category = 'photos'");
  db.exec("UPDATE brand_assets SET category = 'brand-elements' WHERE category = 'logos'");
  db.exec("UPDATE brand_assets SET category = 'decorations' WHERE category IN ('brushstrokes','circles','lines','scribbles','underlines','xs')");

  // Migration: add weight and is_core columns to brand_patterns
  try { db.exec("ALTER TABLE brand_patterns ADD COLUMN weight INTEGER NOT NULL DEFAULT 50"); } catch {}
  try { db.exec("ALTER TABLE brand_patterns ADD COLUMN is_core INTEGER NOT NULL DEFAULT 0"); } catch {}

  // Migration: recategorize brand_patterns from old taxonomy to 6-category system
  // Idempotent: WHERE clauses match only old category values
  db.exec("UPDATE brand_patterns SET category = 'colors' WHERE category = 'design-tokens' AND slug IN ('color-palette','opacity-patterns')");
  db.exec("UPDATE brand_patterns SET category = 'colors', is_core = 1 WHERE slug = 'color-palette' AND is_core = 0");
  db.exec("UPDATE brand_patterns SET category = 'typography' WHERE category = 'design-tokens' AND slug = 'typography'");
  db.exec("UPDATE brand_patterns SET category = 'typography', is_core = 1 WHERE slug = 'typography' AND is_core = 0");
  db.exec("UPDATE brand_patterns SET category = 'typography' WHERE category = 'pattern' AND slug = 'flfont-tagline-patterns'");
  db.exec("UPDATE brand_patterns SET category = 'decorations' WHERE category = 'pattern' AND slug IN ('brushstroke-textures','circles-underlines','line-textures','scribble-textures','x-mark-textures')");
  db.exec("UPDATE brand_patterns SET category = 'images' WHERE category = 'pattern' AND slug = 'photos-mockups'");
  db.exec("UPDATE brand_patterns SET category = 'logos' WHERE category = 'pattern' AND slug = 'footer-structure'");
  db.exec("UPDATE brand_patterns SET category = 'archetypes' WHERE category = 'layout-archetype'");
  db.exec("UPDATE brand_patterns SET category = 'archetypes', is_core = 1 WHERE slug = 'layout-archetypes' AND is_core = 0");

  // Set initial weights for existing patterns
  db.exec("UPDATE brand_patterns SET weight = 90 WHERE slug IN ('color-palette','typography','layout-archetypes') AND weight = 50");
  db.exec("UPDATE brand_patterns SET weight = 85 WHERE slug IN ('footer-structure','brushstroke-textures','circles-underlines') AND weight = 50");
  db.exec("UPDATE brand_patterns SET weight = 80 WHERE slug IN ('flfont-tagline-patterns','opacity-patterns') AND weight = 50");
  db.exec("UPDATE brand_patterns SET weight = 70 WHERE slug IN ('line-textures','scribble-textures','x-mark-textures','photos-mockups') AND weight = 50");

  // Migration: update context_map wildcards to match new pattern categories
  db.exec(`UPDATE context_map SET sections = '["colors:*","typography:*","archetypes:*"]' WHERE stage = 'layout' AND sections LIKE '%design-tokens%' AND sections LIKE '%layout-archetype%'`);
  db.exec(`UPDATE context_map SET sections = '["colors:*","typography:*","decorations:*","images:*","logos:*"]' WHERE stage = 'styling' AND sections LIKE '%design-tokens%' AND sections LIKE '%pattern:%'`);
  db.exec(`UPDATE context_map SET sections = '["colors:*","typography:*"]' WHERE stage = 'styling' AND creation_type = 'one-pager' AND sections = '["design-tokens:*"]'`);

  // Migration: add routing metadata to templates for pipeline routing
  try { db.exec("ALTER TABLE templates ADD COLUMN content_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE templates ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}

  // Seed brand_styles with Fluid defaults if table is empty
  const styleCount = (db.prepare('SELECT COUNT(*) as c FROM brand_styles').get() as any)?.c ?? 0;
  if (styleCount === 0) {
    const now = Date.now();
    const seedStmt = db.prepare('INSERT INTO brand_styles (id, scope, css_content, updated_at) VALUES (?, ?, ?, ?)');
    seedStmt.run('bs_global', 'global', `@font-face {
  font-family: 'NeueHaas';
  src: url('/api/brand-assets/serve/Inter-VariableFont') format('truetype');
  font-weight: 100 900;
}
@font-face {
  font-family: 'FLFont';
  src: url('/api/brand-assets/serve/flfontbold') format('truetype');
  font-weight: 700;
}

:root {
  --font-headline: 'NeueHaas', sans-serif;
  --font-body: 'NeueHaas', sans-serif;
  --font-accent: 'FLFont', sans-serif;
  --brand-accent: #42b1ff;
  --brand-accent-warm: #FF8B58;
  --brand-accent-green: #44b574;
  --brand-accent-purple: #c985e5;
}`, now);
    seedStmt.run('bs_instagram', 'instagram', '', now);
    seedStmt.run('bs_linkedin', 'linkedin', '', now);
    seedStmt.run('bs_one-pager', 'one-pager', '', now);
  }

  // FK integrity check: clean up orphaned records that break FK chains
  const fkViolations = db.pragma('foreign_key_check') as Array<{ table: string; rowid: number; parent: string; fkid: number }>;
  if (fkViolations.length > 0) {
    console.warn(`[db] Found ${fkViolations.length} FK violations — cleaning up orphaned records`);
    // Group by table and delete orphaned rows
    const tables = [...new Set(fkViolations.map(v => v.table))];
    for (const table of tables) {
      const rowids = fkViolations.filter(v => v.table === table).map(v => v.rowid);
      for (const rowid of rowids) {
        try {
          db.prepare(`DELETE FROM ${table} WHERE rowid = ?`).run(rowid);
        } catch { /* row may already be deleted by cascade */ }
      }
    }
    console.warn(`[db] Cleaned up orphaned records in: ${tables.join(', ')}`);
  }
}
