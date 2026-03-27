#!/usr/bin/env node
/**
 * pipeline-tools.cjs — CLI wrapper around executeTool() for simulation parity.
 *
 * Reimplements the api-pipeline.ts executeTool() switch cases using the same
 * SQLite queries (better-sqlite3, same DB path). Returns identical output format.
 *
 * Usage:
 *   node tools/pipeline-tools.cjs <tool_name> [--arg value] --working-dir <dir> [--allowed-paths <path>]
 *
 * Examples:
 *   node tools/pipeline-tools.cjs read_file --path /some/file --working-dir /some/dir
 *   node tools/pipeline-tools.cjs list_brand_sections --category colors --working-dir /some/dir
 *   node tools/pipeline-tools.cjs read_brand_section --slug color-palette --working-dir /some/dir
 *   node tools/pipeline-tools.cjs list_brand_assets --category fonts --working-dir /some/dir
 *   node tools/pipeline-tools.cjs write_file --path /some/file --content "..." --working-dir /some/dir
 *   node tools/pipeline-tools.cjs run_brand_check --html_path /some/file.html --working-dir /some/dir
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const TOOLS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(TOOLS_DIR, '..');
const CANVAS_DIR = path.join(PROJECT_ROOT, 'canvas');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node tools/pipeline-tools.cjs <tool_name> [--arg value] --working-dir <dir>');
  process.exit(1);
}

const toolName = args[0];
const flags = {};
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
    flags[args[i].slice(2)] = args[++i];
  } else if (args[i].startsWith('--') && args[i + 1] && args[i + 1].startsWith('--')) {
    flags[args[i].slice(2)] = '';
  }
}

const workingDir = flags['working-dir'] || process.cwd();
const allowedPaths = flags['allowed-paths'] ? flags['allowed-paths'].split(',') : [];

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
const DB_PATH = process.env.FLUID_DB_PATH || path.join(CANVAS_DIR, 'fluid.db');

let Database;
try { Database = require(path.join(CANVAS_DIR, 'node_modules/better-sqlite3')); }
catch { console.error('Error: Run "cd canvas && npm install" first.'); process.exit(1); }

const db = new Database(DB_PATH, { readonly: true });

// ---------------------------------------------------------------------------
// Simple glob matcher (mirrors api-pipeline.ts matchSimpleGlob)
// ---------------------------------------------------------------------------
function matchSimpleGlob(filename, pattern) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(filename);
}

// ---------------------------------------------------------------------------
// Tool implementations — mirror api-pipeline.ts executeTool() lines 486-735
// ---------------------------------------------------------------------------

function run() {
  switch (toolName) {
    case 'read_file': {
      const filePath = flags.path;
      if (!filePath) return 'Error: --path required';
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath);
      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        const MAX_FILE_CHARS = 60000;
        if (content.length > MAX_FILE_CHARS) {
          return content.slice(0, MAX_FILE_CHARS) + `\n\n[TRUNCATED — file is ${content.length} chars, showing first ${MAX_FILE_CHARS}. Request specific sections if you need more.]`;
        }
        return content;
      } catch (err) {
        return `Error reading file: ${err.message}`;
      }
    }

    case 'write_file': {
      const filePath = flags.path;
      const content = flags.content;
      if (!filePath) return 'Error: --path required';
      if (content === undefined) return 'Error: --content required';
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath);
      const resolvedWorking = path.resolve(workingDir);
      const isInWorkingDir = resolvedPath.startsWith(resolvedWorking + path.sep) || resolvedPath === resolvedWorking;
      const isAllowedPath = allowedPaths.some(ap => path.resolve(ap) === resolvedPath);
      if (!isInWorkingDir && !isAllowedPath) {
        return `Error: write_file path "${resolvedPath}" is outside the allowed working directory "${resolvedWorking}"`;
      }
      try {
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, content, 'utf-8');
        return `File written: ${resolvedPath}`;
      } catch (err) {
        return `Error writing file: ${err.message}`;
      }
    }

    case 'list_files': {
      const directory = flags.directory || workingDir;
      const pattern = flags.pattern;
      const resolvedDir = path.isAbsolute(directory) ? directory : path.resolve(workingDir, directory);
      try {
        const entries = fs.readdirSync(resolvedDir);
        const filtered = pattern ? entries.filter(e => matchSimpleGlob(e, pattern)) : entries;
        return filtered.join('\n');
      } catch (err) {
        return `Error listing files: ${err.message}`;
      }
    }

    case 'run_brand_check': {
      const htmlPath = flags.html_path;
      if (!htmlPath) return 'Error: --html_path required';
      const resolvedPath = path.isAbsolute(htmlPath) ? htmlPath : path.resolve(PROJECT_ROOT, htmlPath);
      try {
        const toolPath = path.resolve(PROJECT_ROOT, 'tools/brand-compliance.cjs');
        const stdout = execSync(`node "${toolPath}" "${resolvedPath}"`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });
        return stdout;
      } catch (err) {
        return err.stderr || err.message || `Error running brand check: ${String(err)}`;
      }
    }

    case 'list_brand_sections': {
      const category = flags.category;
      const sections = [];
      if (!category || category === 'voice-guide') {
        const docs = db.prepare("SELECT slug, label FROM voice_guide_docs ORDER BY slug ASC").all();
        sections.push(...docs.map(d => ({ slug: d.slug, label: d.label, category: 'voice-guide' })));
      }
      if (!category || category !== 'voice-guide') {
        const q = category && category !== 'voice-guide'
          ? db.prepare("SELECT slug, label, category FROM brand_patterns WHERE category = ? ORDER BY slug ASC").all(category)
          : db.prepare("SELECT slug, label, category FROM brand_patterns ORDER BY slug ASC").all();
        sections.push(...q.map(p => ({ slug: p.slug, label: p.label, category: p.category })));
      }
      return JSON.stringify(sections, null, 2);
    }

    case 'read_brand_section': {
      const slug = flags.slug;
      if (!slug) return 'Error: --slug required';
      const MAX_SECTION_CHARS = 30000;
      const truncate = (text) =>
        text.length > MAX_SECTION_CHARS
          ? text.slice(0, MAX_SECTION_CHARS) + `\n\n[TRUNCATED — section is ${text.length} chars. This section contains embedded HTML/SVG examples. Use the high-level descriptions to guide your layout choices.]`
          : text;
      // Try voice guide first, then brand patterns
      const doc = db.prepare("SELECT label, content FROM voice_guide_docs WHERE slug = ?").get(slug);
      if (doc) return `# ${doc.label}\n\n${truncate(doc.content)}`;
      const pattern = db.prepare("SELECT label, category, content FROM brand_patterns WHERE slug = ?").get(slug);
      if (pattern) return `# ${pattern.label} [${pattern.category}]\n\n${truncate(pattern.content)}`;
      return `No brand section found with slug: ${slug}`;
    }

    case 'list_brand_patterns': {
      const category = flags.category;
      const q = category
        ? db.prepare("SELECT slug, label, category, content FROM brand_patterns WHERE category = ? ORDER BY slug ASC").all(category)
        : db.prepare("SELECT slug, label, category, content FROM brand_patterns ORDER BY slug ASC").all();
      return JSON.stringify(q.map(p => ({
        slug: p.slug,
        label: p.label,
        category: p.category,
        description: p.content.length > 80 ? p.content.slice(0, 80) + '...' : p.content,
      })), null, 2);
    }

    case 'read_brand_pattern': {
      const slug = flags.slug;
      if (!slug) return 'Error: --slug required';
      const pattern = db.prepare("SELECT label, category, content FROM brand_patterns WHERE slug = ?").get(slug);
      if (!pattern) return `No brand pattern found with slug: ${slug}`;
      const MAX_PATTERN_CHARS = 30000;
      const content = pattern.content.length > MAX_PATTERN_CHARS
        ? pattern.content.slice(0, MAX_PATTERN_CHARS) + `\n\n[TRUNCATED — pattern is ${pattern.content.length} chars]`
        : pattern.content;
      return `# ${pattern.label} [${pattern.category}]\n\n${content}`;
    }

    case 'list_voice_guide': {
      const docs = db.prepare("SELECT slug, label, content FROM voice_guide_docs ORDER BY slug ASC").all();
      return JSON.stringify(docs.map(d => ({
        slug: d.slug,
        title: d.label,
        description: d.content.length > 80 ? d.content.slice(0, 80) + '...' : d.content,
      })), null, 2);
    }

    case 'read_voice_guide': {
      const slug = flags.slug;
      if (!slug) return 'Error: --slug required';
      const doc = db.prepare("SELECT label, content FROM voice_guide_docs WHERE slug = ?").get(slug);
      if (!doc) return `No voice guide doc found with slug: ${slug}`;
      return `# ${doc.label}\n\n${doc.content}`;
    }

    case 'list_brand_assets': {
      const category = flags.category;
      const q = category
        ? db.prepare("SELECT * FROM brand_assets WHERE category = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY name ASC").all(category)
        : db.prepare("SELECT * FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY category ASC, name ASC").all();
      return JSON.stringify(q.map(a => {
        const serveUrl = `/api/brand-assets/serve/${encodeURIComponent(a.name)}`;
        const base = {
          name: a.name,
          category: a.category,
          url: serveUrl,
          mimeType: a.mime_type,
          description: a.description || null,
        };
        if (a.mime_type && (a.mime_type.startsWith('font/') || a.name.endsWith('.ttf') || a.name.endsWith('.woff2') || a.name.endsWith('.woff') || a.name.endsWith('.otf'))) {
          const format = a.name.endsWith('.ttf') ? 'truetype'
            : a.name.endsWith('.woff2') ? 'woff2'
            : a.name.endsWith('.woff') ? 'woff'
            : a.name.endsWith('.otf') ? 'opentype'
            : 'truetype';
          base.fontSrc = `url('${serveUrl}') format('${format}')`;
        }
        if (a.mime_type && a.mime_type.startsWith('image/')) {
          base.cssUrl = `url('${serveUrl}')`;
          base.imgSrc = serveUrl;
        }
        return base;
      }), null, 2);
    }

    case 'list_templates': {
      const type = flags.type;
      const q = type
        ? db.prepare("SELECT id, type, name, layout, description FROM templates WHERE type = ? ORDER BY id ASC").all(type)
        : db.prepare("SELECT id, type, name, layout, description FROM templates ORDER BY id ASC").all();
      return JSON.stringify(q.map(t => ({
        id: t.id,
        type: t.type,
        name: t.name,
        layout: t.layout,
        description: t.description && t.description.length > 100 ? t.description.slice(0, 100) + '...' : t.description,
      })), null, 2);
    }

    case 'read_template': {
      const id = flags.id;
      if (!id) return 'Error: --id required';
      const t = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
      if (!t) return `No template found with id: ${id}`;

      // Get design rules
      let designRules = [];
      try {
        designRules = db.prepare("SELECT label, content FROM design_rules WHERE archetype_slug = ?").all(t.file || id);
      } catch { /* design_rules table may not exist */ }

      const dims = t.dims || (t.layout === 'square' ? '1080x1080' : t.layout === 'landscape' ? '1340x630' : '816x1056');
      const parts = [
        `# Template: ${t.name}`,
        `Type: ${t.type} | Layout: ${t.layout} (${dims}) | File: ${t.file}`,
        '',
        '## Description',
        t.description,
      ];

      // Content slots
      let contentSlots = [];
      try { contentSlots = JSON.parse(t.content_slots || '[]'); } catch { /* ok */ }
      if (contentSlots.length > 0) {
        parts.push('', '## Content Slots', '| Slot | Spec | Color |', '|------|------|-------|');
        for (const s of contentSlots) {
          parts.push(`| ${s.slot} | ${s.spec} | ${s.color || '\u2014'} |`);
        }
      }

      if (designRules.length > 0) {
        parts.push('', '## Design Rules');
        for (const rule of designRules) {
          parts.push(`### ${rule.label}`, rule.content, '');
        }
      }

      return parts.join('\n');
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ---------------------------------------------------------------------------
// Execute and output
// ---------------------------------------------------------------------------
try {
  const result = run();
  process.stdout.write(result);
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
} finally {
  try { db.close(); } catch { /* ok */ }
}
