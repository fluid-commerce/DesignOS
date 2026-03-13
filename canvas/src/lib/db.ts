/**
 * better-sqlite3 database singleton with WAL mode, FK constraints, and schema init.
 * Server-only module — NEVER import from React components or client code.
 *
 * Singleton pattern prevents multiple connections on Vite HMR hot reload.
 * Set FLUID_DB_PATH env variable to override the default path (used in tests).
 */

import Database from 'better-sqlite3';
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
  `);

  // Migration: add generation_status to existing databases that predate this column.
  // ALTER TABLE is idempotent-guarded by try-catch; SQLite throws if column already exists.
  try {
    db.exec(`ALTER TABLE iterations ADD COLUMN generation_status TEXT NOT NULL DEFAULT 'complete'`);
  } catch {
    // Column already exists — ignore
  }
}
