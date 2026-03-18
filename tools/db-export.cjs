#!/usr/bin/env node
/**
 * Export user-editable DB tables to a portable JSON seed file.
 * Run: node tools/db-export.cjs
 *
 * Outputs canvas/seed-data.json — commit this file to share DB state via git.
 * Skips brand_assets (scanned from disk), context_log (audit trail),
 * saved_assets (external refs), and campaign_assets (file refs).
 */

const path = require('path');
const fs = require('fs');
const Database = require(require.resolve('better-sqlite3', { paths: [path.resolve(__dirname, '../canvas')] }));

const DB_PATH = process.env.FLUID_DB_PATH || path.resolve(__dirname, '../canvas/fluid.db');
const OUT_PATH = path.resolve(__dirname, '../canvas/seed-data.json');

const TABLES = [
  'voice_guide_docs',
  'brand_patterns',
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
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    console.error('Run the app at least once to create the database.');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const data = {};
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows;
      totalRows += rows.length;
      console.log(`  ${table}: ${rows.length} rows`);
    } catch (err) {
      console.warn(`  ${table}: skipped (${err.message})`);
      data[table] = [];
    }
  }

  data._meta = {
    exported_at: new Date().toISOString(),
    db_path: DB_PATH,
    version: 1,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
  db.close();

  console.log(`\nExported ${totalRows} rows to ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();
