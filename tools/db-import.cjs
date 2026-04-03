#!/usr/bin/env node
/**
 * Import DB state from canvas/seed-data.json into the SQLite database.
 * Run: node tools/db-import.cjs [--merge] [--force]
 *
 * Modes:
 *   (default)  --merge   Adds new rows (by ID) without touching existing data.
 *   --force              Clears all tables and re-imports everything.
 *
 * The app's startup seeder also auto-imports (merge mode) from seed-data.json
 * on startup — this script is for manual use.
 */

const path = require('path');
const fs = require('fs');
const Database = require(require.resolve('better-sqlite3', { paths: [path.resolve(__dirname, '../canvas')] }));

const DB_PATH = process.env.FLUID_DB_PATH || path.resolve(__dirname, '../canvas/fluid.db');
const SEED_PATH = path.resolve(__dirname, '../canvas/seed-data.json');

// Tables in dependency order (parents before children due to FKs)
const TABLES_ORDERED = [
  'voice_guide_docs',
  'brand_patterns',
  'brand_styles',
  'template_design_rules',
  'templates',
  'context_map',
  'campaigns',
  'creations',
  'slides',
  'iterations',
  'annotations',
];

function main() {
  const force = process.argv.includes('--force');

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found at ${SEED_PATH}`);
    console.error('Run "npm run db:export" first to create it.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  console.log(`Seed file from: ${data._meta?.exported_at || 'unknown'}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    console.error('Run the app once first to initialize the database schema.');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  let totalImported = 0;
  let totalSkipped = 0;

  const importAll = db.transaction(() => {
    for (const table of TABLES_ORDERED) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        console.log(`  ${table}: no data in seed file`);
        continue;
      }

      // Check table exists
      let existingCount;
      try {
        existingCount = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
      } catch {
        console.warn(`  ${table}: table doesn't exist, skipping`);
        continue;
      }

      if (force && existingCount > 0) {
        db.prepare(`DELETE FROM ${table}`).run();
        console.log(`  ${table}: cleared ${existingCount} existing rows`);
      }

      // Build INSERT OR IGNORE — skips rows whose ID already exists
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      );

      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        try {
          const result = insert.run(...columns.map(col => row[col] ?? null));
          if (result.changes > 0) {
            imported++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.warn(`    ${table}: failed to insert row ${row.id || '?'}: ${err.message}`);
        }
      }

      totalImported += imported;
      totalSkipped += skipped;

      if (skipped > 0) {
        console.log(`  ${table}: imported ${imported} new, skipped ${skipped} existing (${rows.length} in seed)`);
      } else {
        console.log(`  ${table}: imported ${imported}/${rows.length} rows`);
      }
    }
  });

  if (force) {
    db.pragma('foreign_keys = OFF');
  }

  importAll();

  if (force) {
    db.pragma('foreign_keys = ON');
  }

  db.close();

  const mode = force ? 'force' : 'merge';
  console.log(`\nDone (${mode}): ${totalImported} imported, ${totalSkipped} already existed`);
}

main();
