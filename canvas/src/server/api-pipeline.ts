/**
 * api-pipeline.ts
 * Foundation for the Anthropic API generation pipeline.
 * Provides: SDK client, tool schemas, tool executor, stage prompt loader, SSE helpers.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';
import { getVoiceGuideDocs, getVoiceGuideDoc, getBrandPatterns, getBrandPatternBySlug, getBrandAssets, getDesignDnaForPipeline, getTemplates, getTemplate, getDesignRulesByArchetype, loadContextMap, insertContextLog, updateIterationSlotSchema } from './db-api';

// ESM-safe __dirname (works in both Vite middleware and tsx/node ESM)
const __dirname = typeof globalThis.__dirname !== 'undefined'
  ? globalThis.__dirname
  : path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Campaign copy accumulator — prevents tagline/headline repetition across creations
// ---------------------------------------------------------------------------
const campaignCopyAccumulator = new Map<string, Array<{ headline: string; tagline: string; creationType: string }>>();

// Load .env file — try multiple paths since __dirname is unreliable in Vite middleware
const envPaths = [
  path.resolve(process.cwd(), '../.env'),  // canvas/ -> repo root
  path.resolve(process.cwd(), '.env'),     // if cwd is repo root
  path.resolve(process.cwd(), '../../.env'), // deeper nesting fallback
];
for (const envPath of envPaths) {
  try {
    // @ts-ignore — process.loadEnvFile is Node 22.9+ / 24+
    (process as any).loadEnvFile(envPath);
    break;
  } catch {
    // try next path
  }
}

// ---------------------------------------------------------------------------
// Anthropic client singleton — SDK auto-reads ANTHROPIC_API_KEY from process.env
// ---------------------------------------------------------------------------
export const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------
export type PipelineStage = 'copy' | 'layout' | 'styling' | 'spec-check';
export type FixTarget = 'copy' | 'layout' | 'styling';

export interface StageResult {
  stage: PipelineStage;
  output: string; // text output from the stage
  toolCalls: number; // how many tool loops ran
}

export interface PipelineContext {
  prompt: string;
  creationType: string; // 'instagram' | 'linkedin' | 'one-pager'
  workingDir: string; // absolute path to working directory for this creation
  htmlOutputPath: string; // absolute path where final HTML goes
  creationId: string;
  campaignId: string;
  iterationId: string; // DB iteration ID — needed for SlotSchema attachment
  brandName?: string;  // Loaded from DB at pipeline entry; prompts use "the brand" if absent
}

export interface ArchetypeMeta {
  slug: string;
  description: string;   // first non-heading, non-metadata paragraph line from README.md
  htmlPath: string;      // absolute path to archetypes/{slug}/index.html
  schemaPath: string;    // absolute path to archetypes/{slug}/schema.json
}

// ---------------------------------------------------------------------------
// Brand context is accessed via tools (list_brand_sections / read_brand_section)
// so agents selectively load only what they need per stage.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stage model mapping (haiku for layout, sonnet for creative stages)
// ---------------------------------------------------------------------------
export const STAGE_MODELS: Record<PipelineStage, string> = {
  copy: 'claude-sonnet-4-20250514',
  layout: 'claude-haiku-4-5-20251001',
  styling: 'claude-sonnet-4-20250514',
  'spec-check': 'claude-sonnet-4-20250514',
};

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------
const readFileTool: Anthropic.Tool = {
  name: 'read_file',
  description:
    'Read a file from disk. Use to load brand docs, patterns, templates, or generated files.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file to read. Use the absolute paths provided in your instructions.',
      },
    },
    required: ['path'],
  },
};

const writeFileTool: Anthropic.Tool = {
  name: 'write_file',
  description: 'Write content to a file on disk.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Path to write. Must be within the working directory.',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file.',
      },
    },
    required: ['path', 'content'],
  },
};

const listFilesTool: Anthropic.Tool = {
  name: 'list_files',
  description: 'List files in a directory.',
  input_schema: {
    type: 'object' as const,
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to list.',
      },
      pattern: {
        type: 'string',
        description: 'Optional glob pattern to filter files (e.g. "*.md").',
      },
    },
    required: ['directory'],
  },
};

const runBrandCheckTool: Anthropic.Tool = {
  name: 'run_brand_check',
  description:
    'Run brand-compliance validation on an HTML file. Returns JSON result with pass/fail and issues.',
  input_schema: {
    type: 'object' as const,
    properties: {
      html_path: {
        type: 'string',
        description: 'Path to the HTML file to validate.',
      },
    },
    required: ['html_path'],
  },
};

const listBrandSectionsTool: Anthropic.Tool = {
  name: 'list_brand_sections',
  description:
    'List available brand sections from the DB. Returns slug, label, and category for each section. ' +
    'Categories: "voice-guide" (brand voice docs), "colors" (palette, overlays), "typography" (fonts, scales), ' +
    '"logos" (logo usage rules), "images" (photo/mockup rules), "decorations" (textures, brushstrokes), "archetypes" (layout templates). ' +
    'Use this to discover what brand content is available, then read_brand_section to load specific ones.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Optional filter: "voice-guide", "colors", "typography", "logos", "images", "decorations", or "archetypes".',
      },
    },
    required: [],
  },
};

const readBrandSectionTool: Anthropic.Tool = {
  name: 'read_brand_section',
  description:
    'Read full content of a brand section by slug. Use list_brand_sections first to discover available slugs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      slug: {
        type: 'string',
        description: 'The slug of the brand section to read (e.g. "voice-and-style", "color-palette", "brushstroke-textures").',
      },
    },
    required: ['slug'],
  },
};

const listBrandAssetsTool: Anthropic.Tool = {
  name: 'list_brand_assets',
  description:
    'List available brand assets (fonts, brushstrokes, textures, logos, etc.) from the asset library. ' +
    'Returns name, category, url, and ready-to-use CSS values for each asset. ' +
    'Fonts include a `fontSrc` field — use it directly in @font-face src. ' +
    'Images include `cssUrl` for background-image and `imgSrc` for img tags. ' +
    'ALWAYS use these values verbatim. NEVER embed base64.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Optional filter: "fonts", "brushstrokes", "textures", "logos", etc.',
      },
    },
    required: [],
  },
};

const listBrandPatternsTool: Anthropic.Tool = {
  name: 'list_brand_patterns',
  description:
    'List available brand patterns from the DB. ' +
    'Returns slug, label, category, and weight for each pattern. ' +
    'Categories: "colors", "typography", "logos", "images", "decorations", "archetypes". ' +
    'Use read_brand_pattern to load full content by slug.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Optional filter: "colors", "typography", "logos", "images", "decorations", or "archetypes".',
      },
    },
    required: [],
  },
};

const readBrandPatternTool: Anthropic.Tool = {
  name: 'read_brand_pattern',
  description:
    'Read full content of a brand pattern by slug. Returns label, category, and complete HTML/content. ' +
    'Use list_brand_patterns first to discover available slugs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      slug: {
        type: 'string',
        description: 'The slug of the brand pattern to read.',
      },
    },
    required: ['slug'],
  },
};

const listVoiceGuideTool: Anthropic.Tool = {
  name: 'list_voice_guide',
  description:
    'List available voice guide documents from the DB. Returns slug, title, and a short description for each doc. ' +
    'Use read_voice_guide to load full content by slug.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

const readVoiceGuideTool: Anthropic.Tool = {
  name: 'read_voice_guide',
  description:
    'Read full content of a voice guide document by slug. Returns title and complete content. ' +
    'Use list_voice_guide first to discover available slugs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      slug: {
        type: 'string',
        description: 'The slug of the voice guide doc to read.',
      },
    },
    required: ['slug'],
  },
};

const listTemplatesTool: Anthropic.Tool = {
  name: 'list_templates',
  description:
    'List available design templates. Returns id, type (social/one-pager), name, layout, and a short description for each. Use read_template for full specs and design rules.',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        description: 'Filter by type: "social" or "one-pager". Omit for all.',
      },
    },
    required: [],
  },
};

const readTemplateTool: Anthropic.Tool = {
  name: 'read_template',
  description:
    'Read full details of a template by ID. Returns name, description, content slots with specs, creation steps, and associated design rules. Use list_templates first to discover available template IDs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'Template ID from list_templates',
      },
    },
    required: ['id'],
  },
};

/** All pipeline tools */
export const PIPELINE_TOOLS: Anthropic.Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runBrandCheckTool,
  listBrandSectionsTool,
  readBrandSectionTool,
  listBrandAssetsTool,
  listBrandPatternsTool,
  readBrandPatternTool,
  listVoiceGuideTool,
  readVoiceGuideTool,
  listTemplatesTool,
  readTemplateTool,
];

/** Tools available per stage */
export const STAGE_TOOLS: Record<PipelineStage, Anthropic.Tool[]> = {
  copy: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool, listVoiceGuideTool, readVoiceGuideTool, listTemplatesTool, readTemplateTool],
  layout: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool, listBrandPatternsTool, readBrandPatternTool],
  styling: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool, listBrandAssetsTool, listBrandPatternsTool, readBrandPatternTool, listVoiceGuideTool, readVoiceGuideTool, listTemplatesTool, readTemplateTool],
  'spec-check': [readFileTool, writeFileTool, runBrandCheckTool],
};

// ---------------------------------------------------------------------------
// Project root (three levels up from canvas/src/server/ = Fluid-DesignOS root)
// tools/, patterns/ all live at this level
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Archetype filesystem directory
// ---------------------------------------------------------------------------
const ARCHETYPES_DIR = path.join(PROJECT_ROOT, 'archetypes');

// ---------------------------------------------------------------------------
// Archetype scanning + slug resolution
// ---------------------------------------------------------------------------

/**
 * Scan the archetypes/ directory and return a Map of slug -> ArchetypeMeta.
 * Skips "components", dot-prefixed directories, and directories missing index.html or schema.json.
 * Returns empty Map when archetypes/ directory does not exist.
 */
export async function scanArchetypes(): Promise<Map<string, ArchetypeMeta>> {
  const map = new Map<string, ArchetypeMeta>();
  let dirents;
  try {
    dirents = await fs.readdir(ARCHETYPES_DIR, { withFileTypes: true });
  } catch {
    return map;
  }
  const entries = dirents
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'components')
    .map(d => d.name);

  for (const slug of entries) {
    const htmlPath = path.join(ARCHETYPES_DIR, slug, 'index.html');
    const schemaPath = path.join(ARCHETYPES_DIR, slug, 'schema.json');
    const readmePath = path.join(ARCHETYPES_DIR, slug, 'README.md');
    try {
      await fs.access(htmlPath);
      await fs.access(schemaPath);
      const readmeContent = await fs.readFile(readmePath, 'utf-8').catch(() => '');
      const description = readmeContent
        .split('\n')
        .find(l => l.trim() && !l.startsWith('#') && !l.startsWith('**'))
        ?.trim() ?? slug;
      map.set(slug, { slug, description, htmlPath, schemaPath });
    } catch {
      // Skip incomplete archetypes
    }
  }
  return map;
}

/**
 * Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Resolve a raw archetype slug against the available archetypes map.
 * - Exact match: returns { slug, matched: true }
 * - Fuzzy match (edit distance ≤ 2): returns { slug: bestMatch, matched: false }
 * - No match: returns { slug: alphabetical first, matched: false }
 */
export function resolveArchetypeSlug(
  raw: string,
  available: Map<string, ArchetypeMeta>
): { slug: string; matched: boolean } {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (available.has(normalized)) return { slug: normalized, matched: true };

  let best = { slug: '', dist: Infinity };
  for (const slug of available.keys()) {
    const dist = levenshtein(normalized, slug);
    if (dist < best.dist) best = { slug, dist };
  }
  if (best.dist <= 2 && best.slug) {
    console.warn(`[api-pipeline] Fuzzy matched archetype "${raw}" -> "${best.slug}"`);
    return { slug: best.slug, matched: false };
  }

  const fallback = [...available.keys()].sort()[0] ?? '';
  console.warn(`[api-pipeline] Unknown archetype "${raw}", falling back to "${fallback}"`);
  return { slug: fallback, matched: false };
}

/**
 * Check if an archetype has image slots by reading its schema.json.
 * Returns the image field labels (e.g., ["Portrait Photo", "Background Photo"]).
 */
function getArchetypeImageSlotLabels(schemaPath: string): string[] {
  try {
    const raw = fsSync.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(raw);
    return (schema.fields ?? [])
      .filter((f: { type: string }) => f.type === 'image')
      .map((f: { label: string }) => f.label);
  } catch {
    return [];
  }
}

/**
 * Filter archetypes by platform using slug suffix convention.
 * - No suffix = Instagram (1080x1080)
 * - `-li` suffix = LinkedIn (1200x627)
 * - `-op` suffix = One-pager (612x792)
 */
export function filterArchetypesByPlatform(
  archetypes: Map<string, ArchetypeMeta>,
  creationType: string
): Map<string, ArchetypeMeta> {
  return new Map(
    [...archetypes.entries()].filter(([slug]) => {
      if (creationType === 'linkedin') return slug.endsWith('-li');
      if (creationType === 'one-pager') return slug.endsWith('-op');
      // instagram (default): exclude -li and -op suffixed archetypes
      return !slug.endsWith('-li') && !slug.endsWith('-op');
    })
  );
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

/**
 * Execute a tool call from the Anthropic API.
 * Returns a string result (never throws — errors are returned as strings).
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workingDir: string,
  allowedPaths: string[] = [],
): Promise<string> {
  switch (name) {
    case 'read_file': {
      const filePath = input.path as string;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workingDir, filePath);
      try {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        // Truncate large files to avoid blowing the 200k token context limit.
        // ~4 chars per token, so 60k chars ≈ 15k tokens — safe headroom.
        const MAX_FILE_CHARS = 60_000;
        if (content.length > MAX_FILE_CHARS) {
          return content.slice(0, MAX_FILE_CHARS) + `\n\n[TRUNCATED — file is ${content.length} chars, showing first ${MAX_FILE_CHARS}. Request specific sections if you need more.]`;
        }
        return content;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error reading file: ${msg}`;
      }
    }

    case 'write_file': {
      const filePath = input.path as string;
      const content = input.content as string;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workingDir, filePath);

      // Security check: prevent writes outside workingDir (unless path is explicitly allowed, e.g. htmlOutputPath)
      const resolvedWorking = path.resolve(workingDir);
      const isInWorkingDir = resolvedPath.startsWith(resolvedWorking + path.sep) || resolvedPath === resolvedWorking;
      const isAllowedPath = allowedPaths.some(ap => path.resolve(ap) === resolvedPath);
      if (!isInWorkingDir && !isAllowedPath) {
        return `Error: write_file path "${resolvedPath}" is outside the allowed working directory "${resolvedWorking}"`;
      }

      try {
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
        return `File written: ${resolvedPath}`;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error writing file: ${msg}`;
      }
    }

    case 'list_files': {
      const directory = input.directory as string;
      const pattern = input.pattern as string | undefined;
      const resolvedDir = path.isAbsolute(directory)
        ? directory
        : path.resolve(workingDir, directory);
      try {
        const entries = await fs.readdir(resolvedDir);
        const filtered = pattern
          ? entries.filter((e) => matchSimpleGlob(e, pattern))
          : entries;
        return filtered.join('\n');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error listing files: ${msg}`;
      }
    }

    case 'run_brand_check': {
      const htmlPath = input.html_path as string;
      const resolvedPath = path.isAbsolute(htmlPath)
        ? htmlPath
        : path.resolve(PROJECT_ROOT, htmlPath);
      try {
        const toolPath = path.resolve(PROJECT_ROOT, 'tools/brand-compliance.cjs');
        const stdout = execSync(`node "${toolPath}" "${resolvedPath}"`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });
        return stdout;
      } catch (err: unknown) {
        if (err instanceof Error && 'stderr' in err) {
          return (err as NodeJS.ErrnoException & { stderr: string }).stderr || err.message;
        }
        return `Error running brand check: ${String(err)}`;
      }
    }

    case 'list_brand_sections': {
      const category = input.category as string | undefined;
      const sections: Array<{ slug: string; label: string; category: string }> = [];

      if (!category || category === 'voice-guide') {
        const docs = getVoiceGuideDocs();
        sections.push(...docs.map(d => ({ slug: d.slug, label: d.label, category: 'voice-guide' })));
      }
      if (!category || category !== 'voice-guide') {
        const patterns = getBrandPatterns(category !== 'voice-guide' ? category : undefined);
        sections.push(...patterns.map(p => ({ slug: p.slug, label: p.label, category: p.category })));
      }

      return JSON.stringify(sections, null, 2);
    }

    case 'read_brand_section': {
      const slug = input.slug as string;
      const MAX_SECTION_CHARS = 30_000; // ~7.5k tokens — safe for any single section
      const truncate = (text: string) =>
        text.length > MAX_SECTION_CHARS
          ? text.slice(0, MAX_SECTION_CHARS) + `\n\n[TRUNCATED — section is ${text.length} chars. This section contains embedded HTML/SVG examples. Use the high-level descriptions to guide your layout choices.]`
          : text;
      // Try voice guide first, then brand patterns
      const doc = getVoiceGuideDoc(slug);
      if (doc) return `# ${doc.label}\n\n${truncate(doc.content)}`;
      const pattern = getBrandPatternBySlug(slug);
      if (pattern) return `# ${pattern.label} [${pattern.category}]\n\n${truncate(pattern.content)}`;
      return `No brand section found with slug: ${slug}`;
    }

    case 'list_brand_patterns': {
      const category = input.category as string | undefined;
      const patterns = getBrandPatterns(category);
      return JSON.stringify(patterns.map(p => ({
        slug: p.slug,
        label: p.label,
        category: p.category,
        description: p.content.length > 80 ? p.content.slice(0, 80) + '...' : p.content,
      })), null, 2);
    }

    case 'read_brand_pattern': {
      const slug = input.slug as string;
      const pattern = getBrandPatternBySlug(slug);
      if (!pattern) return `No brand pattern found with slug: ${slug}`;
      const MAX_PATTERN_CHARS = 30_000;
      const content = pattern.content.length > MAX_PATTERN_CHARS
        ? pattern.content.slice(0, MAX_PATTERN_CHARS) + `\n\n[TRUNCATED — pattern is ${pattern.content.length} chars]`
        : pattern.content;
      return `# ${pattern.label} [${pattern.category}]\n\n${content}`;
    }

    case 'list_voice_guide': {
      const docs = getVoiceGuideDocs();
      return JSON.stringify(docs.map(d => ({
        slug: d.slug,
        title: d.label,
        description: d.content.length > 80 ? d.content.slice(0, 80) + '...' : d.content,
      })), null, 2);
    }

    case 'read_voice_guide': {
      const slug = input.slug as string;
      const doc = getVoiceGuideDoc(slug);
      if (!doc) return `No voice guide doc found with slug: ${slug}`;
      return `# ${doc.label}\n\n${doc.content}`;
    }

    case 'list_brand_assets': {
      const category = input.category as string | undefined;
      const assets = getBrandAssets(category);
      return JSON.stringify(assets.map(a => {
        // Use DB-backed serving URL: /api/brand-assets/serve/{name}
        const serveUrl = `/api/brand-assets/serve/${encodeURIComponent(a.name)}`;
        const base: Record<string, string | null> = {
          name: a.name,
          category: a.category,
          url: serveUrl,
          mimeType: a.mimeType,
          description: a.description,
        };
        // Add ready-to-use CSS values so agents use them verbatim
        if (a.mimeType.startsWith('font/') || a.url.endsWith('.ttf') || a.url.endsWith('.woff2') || a.url.endsWith('.woff') || a.url.endsWith('.otf')) {
          const format = a.url.endsWith('.ttf') ? 'truetype'
            : a.url.endsWith('.woff2') ? 'woff2'
            : a.url.endsWith('.woff') ? 'woff'
            : a.url.endsWith('.otf') ? 'opentype'
            : 'truetype';
          base.fontSrc = `url('${serveUrl}') format('${format}')`;
        }
        if (a.mimeType.startsWith('image/')) {
          base.cssUrl = `url('${serveUrl}')`;
          base.imgSrc = serveUrl;
        }
        return base;
      }), null, 2);
    }

    case 'list_templates': {
      const type = input.type as string | undefined;
      const templates = getTemplates(type);
      return JSON.stringify(templates.map(t => ({
        id: t.id,
        type: t.type,
        name: t.name,
        layout: t.layout,
        description: t.description.length > 100 ? t.description.slice(0, 100) + '...' : t.description,
      })), null, 2);
    }

    case 'read_template': {
      const id = input.id as string;
      const template = getTemplate(id);
      if (!template) return `No template found with id: ${id}`;

      const designRules = getDesignRulesByArchetype(template.file);
      const dims = template.dims || (template.layout === 'square' ? '1080x1080' : template.layout === 'landscape' ? '1340x630' : '816x1056');

      const parts: string[] = [
        `# Template: ${template.name}`,
        `Type: ${template.type} | Layout: ${template.layout} (${dims}) | File: ${template.file}`,
        '',
        '## Description',
        template.description,
      ];

      if (template.contentSlots.length > 0) {
        parts.push('', '## Content Slots', '| Slot | Spec | Color |', '|------|------|-------|');
        for (const s of template.contentSlots) {
          parts.push(`| ${s.slot} | ${s.spec} | ${s.color || '\u2014'} |`);
        }
      }

      if (template.extraTables) {
        for (const et of template.extraTables) {
          parts.push('', `## ${et.label}`);
          if (et.headers) {
            parts.push('| ' + et.headers.join(' | ') + ' |');
            parts.push('|' + et.headers.map(() => '------').join('|') + '|');
          }
          for (const row of et.rows) {
            parts.push('| ' + row.join(' | ') + ' |');
          }
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
      return `Unknown tool: ${name}`;
  }
}

/** Simple glob match supporting * and ? wildcards */
function matchSimpleGlob(filename: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(filename);
}

// ---------------------------------------------------------------------------
// Design DNA loader — assembles DB-backed visual intelligence for prompt injection
// ---------------------------------------------------------------------------

/**
 * Load Design DNA context for injection into agent system prompts.
 * Assembles: global visual style + social general + platform rules + archetype notes.
 * No HTML exemplar injection — archetypes provide structure directly via slot-fill.
 * Returns a formatted string block ready to prepend to system prompts.
 */
async function loadDesignDna(ctx: PipelineContext, archetypeSlug: string): Promise<string> {
  // Only inject for social media types (instagram, linkedin) — not one-pagers or theme-sections
  if (ctx.creationType !== 'instagram' && ctx.creationType !== 'linkedin') {
    return '';
  }

  const dna = getDesignDnaForPipeline(ctx.creationType, archetypeSlug);

  const parts: string[] = [
    '## Design DNA — Visual Style Intelligence',
    '',
    '### Global Visual Style Rules',
    dna.globalStyle,
    '',
    '### Social Media General Rules',
    dna.socialGeneral,
    '',
    '### Platform-Specific Rules',
    dna.platformRules,
  ];

  if (dna.archetypeNotes) {
    parts.push('', '### Archetype Design Notes', dna.archetypeNotes);
  }

  // No more HTML exemplar injection — archetypes provide structure directly
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Context injection helpers
// ---------------------------------------------------------------------------

/**
 * Expand wildcard entries like "design-tokens:*" to all matching slugs.
 * voice-guide:* → all voice_guide_docs slugs
 * Other categories → brand_patterns WHERE category = prefix
 */
function expandWildcards(slugsOrWildcards: string[]): string[] {
  const expanded: string[] = [];
  for (const entry of slugsOrWildcards) {
    if (entry.endsWith(':*')) {
      const category = entry.slice(0, -2); // strip ':*'
      if (category === 'voice-guide') {
        expanded.push(...getVoiceGuideDocs().map(d => d.slug));
      } else {
        expanded.push(...getBrandPatterns(category).map(p => p.slug));
      }
    } else {
      expanded.push(entry);
    }
  }
  return [...new Set(expanded)]; // deduplicate
}

/**
 * Assemble the pre-injected brand context string for a given stage.
 * Expands wildcards, loads section content, enforces token budget, returns formatted string.
 */
function loadContextForStage(
  contextMap: Map<string, Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>>,
  creationType: string,
  stage: PipelineStage,
): { injectedContext: string; sectionSlugs: string[]; tokenEstimate: number } {
  const key = `${creationType}:${stage}`;
  const entries = contextMap.get(key);
  if (!entries || entries.length === 0) {
    return { injectedContext: '', sectionSlugs: [], tokenEstimate: 0 };
  }

  // Merge sections from all page entries for this (creationType, stage) combo
  const allSections: string[] = [];
  let combinedMaxTokens: number | null = null;
  for (const entry of entries) {
    allSections.push(...entry.sections);
    // Use the largest token budget across entries, or null if any is unlimited
    if (entry.maxTokens === null) {
      combinedMaxTokens = null;
    } else if (combinedMaxTokens !== null) {
      combinedMaxTokens = Math.max(combinedMaxTokens, entry.maxTokens);
    }
  }

  const expandedSlugs = expandWildcards([...new Set(allSections)]);

  // Load content for each slug — check voice_guide_docs first, then brand_patterns
  const sectionContents: Array<{ slug: string; content: string; tokens: number }> = [];
  for (const slug of expandedSlugs) {
    let content: string | undefined;
    const vgDoc = getVoiceGuideDoc(slug);
    if (vgDoc) {
      content = vgDoc.content;
    } else {
      const bp = getBrandPatternBySlug(slug);
      if (bp) content = bp.content;
    }
    if (content) {
      const tokens = Math.ceil(content.length / 4); // 4-chars-per-token heuristic
      sectionContents.push({ slug, content, tokens });
    }
  }

  // Per-section cap: no single section should monopolize the budget (max 60% of total)
  if (combinedMaxTokens) {
    const perSectionCap = Math.ceil(combinedMaxTokens * 0.6);
    for (const section of sectionContents) {
      if (section.tokens > perSectionCap) {
        const maxChars = perSectionCap * 4;
        section.content = section.content.slice(0, maxChars) + `\n\n[TRUNCATED — exceeds per-section cap of ${perSectionCap} tokens]`;
        section.tokens = perSectionCap;
      }
    }
  }

  // Enforce token budget — drop largest sections first when over budget
  let totalTokens = sectionContents.reduce((sum, s) => sum + s.tokens, 0);
  if (combinedMaxTokens && totalTokens > combinedMaxTokens) {
    sectionContents.sort((a, b) => b.tokens - a.tokens);
    while (totalTokens > combinedMaxTokens && sectionContents.length > 1) {
      const dropped = sectionContents.pop()!;
      totalTokens -= dropped.tokens;
    }
    sectionContents.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  // Truncate any single section that still exceeds budget
  if (combinedMaxTokens) {
    for (const section of sectionContents) {
      if (section.tokens > combinedMaxTokens) {
        const maxChars = combinedMaxTokens * 4;
        section.content = section.content.slice(0, maxChars) + `\n\n[TRUNCATED — section "${section.slug}" exceeds ${combinedMaxTokens} token budget]`;
        section.tokens = combinedMaxTokens;
        totalTokens = sectionContents.reduce((sum, s) => sum + s.tokens, 0);
      }
    }
  }

  if (sectionContents.length === 0) {
    return { injectedContext: '', sectionSlugs: [], tokenEstimate: 0 };
  }

  const slugList = sectionContents.map(s => s.slug);
  const manifest = `## Injected Brand Context\nSections: ${slugList.join(', ')}\nEstimated tokens: ~${totalTokens}\n`;
  const body = sectionContents.map(s => `### ${s.slug}\n${s.content}`).join('\n\n');
  const injectedContext = `${manifest}\n${body}`;

  return { injectedContext, sectionSlugs: slugList, tokenEstimate: totalTokens };
}

// ---------------------------------------------------------------------------
// Stage prompt builder
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hard rules extraction — promote weight >= 81 brand rules to system directives
// ---------------------------------------------------------------------------

let _cachedHardRules: string | null = null;

/**
 * Extract brand rules with weight >= 81 from pattern content and format as
 * system prompt directives. Cached since patterns rarely change at runtime.
 */
function extractHardRules(): string {
  if (_cachedHardRules !== null) return _cachedHardRules;

  const patterns = getBrandPatterns();
  const rules: Array<{ weight: number; text: string }> = [];

  for (const pattern of patterns) {
    // Match weight badges in various formats: (weight: 95), (Weight: 85), etc.
    const weightRegex = /\((?:weight|Weight):\s*(\d+)\)/g;
    const lines = pattern.content.split('\n');

    for (const line of lines) {
      const match = weightRegex.exec(line);
      if (match) {
        const weight = parseInt(match[1]);
        if (weight >= 81) {
          // Clean the line: remove the weight badge, HTML tags, and trim
          const cleaned = line
            .replace(/\((?:weight|Weight):\s*\d+\)/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/^[#*\-\s]+/, '')
            .trim();
          if (cleaned.length > 10) {
            rules.push({ weight, text: cleaned });
          }
        }
      }
      weightRegex.lastIndex = 0; // reset regex state
    }
  }

  if (rules.length === 0) {
    _cachedHardRules = '';
    return '';
  }

  // Sort by weight descending, deduplicate similar rules
  rules.sort((a, b) => b.weight - a.weight);
  const seen = new Set<string>();
  const uniqueRules = rules.filter(r => {
    const key = r.text.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const formatted = uniqueRules
    .slice(0, 15) // cap at 15 rules to avoid prompt bloat
    .map(r => `- [W${r.weight}] ${r.text}`)
    .join('\n');

  _cachedHardRules = `## Hard Rules (NON-NEGOTIABLE — weight ≥ 81)\nThese brand rules MUST be followed. Violations will fail brand compliance.\n\n${formatted}`;
  return _cachedHardRules;
}

/**
 * Build the system prompt for a pipeline stage.
 * Generic process instructions — no brand-specific content.
 * Agents load brand context at runtime via DB tools.
 */
export function buildSystemPrompt(stage: PipelineStage, ctx: PipelineContext, injectedContext?: string): string {
  const brandRef = ctx.brandName ? `for ${ctx.brandName}` : 'for the brand';
  const base = [
    `You are a ${stage} agent working on a ${ctx.creationType} creation ${brandRef}.`,
    '',
    '## Context',
    `- Working directory: ${ctx.workingDir}`,
    `- HTML output path: ${ctx.htmlOutputPath}`,
    `- Creation type: ${ctx.creationType}`,
  ];

  const toolSection = stage === 'spec-check'
    ? '## Available Tools\nread_file, write_file, run_brand_check'
    : stage === 'styling'
      ? '## Available Tools\nread_file, write_file, list_files, list_brand_sections, read_brand_section, list_brand_assets, list_brand_patterns, read_brand_pattern, list_voice_guide, read_voice_guide, list_templates, read_template'
      : stage === 'copy'
        ? '## Available Tools\nread_file, write_file, list_files, list_brand_sections, read_brand_section, list_voice_guide, read_voice_guide, list_templates, read_template'
        : '## Available Tools\nread_file, write_file, list_files, list_brand_sections, read_brand_section, list_brand_patterns, read_brand_pattern';

  const parts = [...base];

  // Inject hard rules (weight >= 81) BEFORE brand context — model sees these as constraints
  const hardRules = extractHardRules();
  if (hardRules && (stage === 'styling' || stage === 'layout')) {
    parts.push('', hardRules);
  }

  if (injectedContext) {
    parts.push('', injectedContext);
  }
  parts.push('', toolSection);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Asset manifest builder — pre-inject asset URLs into styling prompts
// ---------------------------------------------------------------------------

/**
 * Build a compact markdown asset manifest from the brand_assets DB table.
 * Includes ready-to-use CSS values so the styling agent doesn't need to call list_brand_assets.
 */
function buildAssetManifest(): string {
  const assets = getBrandAssets();
  if (assets.length === 0) return '';

  const lines: string[] = ['## Pre-loaded Asset URLs', 'Use these URLs verbatim. Do NOT modify paths or add extensions.', ''];

  // Group by category
  const byCategory = new Map<string, typeof assets>();
  for (const a of assets) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  }

  for (const [category, catAssets] of byCategory) {
    lines.push(`### ${category}`);
    for (const a of catAssets) {
      const serveUrl = `/api/brand-assets/serve/${encodeURIComponent(a.name)}`;
      if (a.mimeType.startsWith('font/') || a.name.includes('Font') || a.name.includes('font')) {
        const format = a.mimeType.includes('ttf') || a.name.endsWith('.ttf') ? 'truetype' : 'truetype';
        lines.push(`- **${a.name}**: fontSrc=\`url('${serveUrl}') format('${format}')\``);
      } else {
        lines.push(`- **${a.name}**: imgSrc=\`${serveUrl}\` | cssUrl=\`url('${serveUrl}')\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SSE emission helpers (match NDJSON format stream-parser.ts handles)
// ---------------------------------------------------------------------------

function writeNDJSON(res: ServerResponse, data: object): void {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Connection may have closed — ignore write errors
  }
}

export function emitText(res: ServerResponse, creationId: string, text: string): void {
  writeNDJSON(res, {
    type: 'stream_event',
    creationId,
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    },
  });
}

export function emitToolStart(res: ServerResponse, creationId: string, toolName: string): void {
  writeNDJSON(res, {
    type: 'stream_event',
    creationId,
    event: {
      type: 'content_block_start',
      content_block: { type: 'tool_use', name: toolName },
    },
  });
}

export function emitToolDone(res: ServerResponse, creationId: string, toolName: string): void {
  writeNDJSON(res, {
    type: 'tool_result',
    creationId,
    tool_name: toolName,
  });
}

export function emitStageStatus(
  res: ServerResponse,
  creationId: string,
  stage: string,
  status: string,
): void {
  writeNDJSON(res, {
    type: 'stage_status',
    creationId,
    stage,
    status,
  });
}

export function emitStageNarrative(
  res: ServerResponse,
  creationId: string,
  stage: string,
  text: string,
): void {
  writeNDJSON(res, { type: 'stage_narrative', creationId, stage, text });
}

export function emitContextInjected(
  res: ServerResponse,
  creationId: string,
  stage: string,
  sections: string[],
  tokenEstimate: number,
): void {
  writeNDJSON(res, {
    type: 'context_injected',
    creationId,
    stage,
    sections,
    tokenEstimate,
  });
}

// ---------------------------------------------------------------------------
// Stage user prompt builders — exported for testing
// ---------------------------------------------------------------------------

/**
 * Read accumulated copy context for a campaign (headlines + taglines from prior creations).
 * Returns empty string if no prior creations exist for this campaign.
 */
function getCampaignCopyContext(campaignId: string): string {
  const entries = campaignCopyAccumulator.get(campaignId);
  if (!entries || entries.length === 0) return '';

  const lines = entries.map((e, i) =>
    `  ${i + 1}. [${e.creationType}] Headline: "${e.headline}" | Tagline: "${e.tagline}"`
  );

  return [
    `\nPrevious creations in this campaign (DO NOT reuse these headlines or taglines):`,
    ...lines,
    `Write something DISTINCT from the above.`,
  ].join('\n');
}

/**
 * Record a creation's headline and tagline after the copy stage completes.
 */
function recordCampaignCopy(campaignId: string, creationType: string, copyContent: string): void {
  const headlineMatch = copyContent.match(/###\s*HEADLINE\s*\n(.+)/i);
  const taglineMatch = copyContent.match(/###\s*TAGLINE\s*\n(.+)/i);

  if (headlineMatch || taglineMatch) {
    if (!campaignCopyAccumulator.has(campaignId)) {
      campaignCopyAccumulator.set(campaignId, []);
    }
    campaignCopyAccumulator.get(campaignId)!.push({
      headline: headlineMatch?.[1]?.trim() ?? '',
      tagline: taglineMatch?.[1]?.trim() ?? '',
      creationType,
    });
  }
}

export function buildCopyPrompt(ctx: PipelineContext, campaignContext?: string, archetypeList?: string): string {
  return [
    `Generate marketing copy for a ${ctx.creationType} creation.`,
    `Topic: ${ctx.prompt}`,
    ``,
    `Use list_voice_guide to see available voice guide docs.`,
    `Then read_voice_guide to load the ones relevant to this topic (always include "voice-and-style", plus the product-specific doc if applicable).`,
    ``,
    `Write structured copy (headline, subtext, accent color, archetype selection) to ${ctx.workingDir}/copy.md.`,
    `Include an "Archetype:" line in your output specifying which layout archetype to use.`,
    ``,
    `## Available Archetypes`,
    archetypeList ?? '(no archetypes discovered)',
    ``,
    `Pick the archetype whose structural pattern best fits the content.`,
    ``,
    `RULES:`,
    `- For Instagram: body copy MUST be 1-2 sentences maximum. Do NOT exceed this.`,
    `- For LinkedIn: body copy may be 2-3 sentences.`,
    `- WORD LIMITS (total visible copy = headline + body + tagline combined, footer/brand elements excluded):`,
    `  Instagram: 20 words maximum total`,
    `  LinkedIn: 30 words maximum total`,
    `- For stat-proof archetype: the HEADLINE must be a giant number or short stat phrase (e.g., "6X", "4 DAYS", "82%", "$75,000"). NOT a full sentence.`,
    `- Accent color options: orange=#FF8B58 (urgency/pain), blue=#42b1ff (trust/tech), green=#44b574 (success/proof), purple=#c985e5 (premium/analytical). Pick ONE.`,
    `- If this is part of a campaign with multiple creations, ensure your tagline is DISTINCT from other posts -- do not reuse similar phrasing.`,
    ...(campaignContext ? [campaignContext] : []),
  ].join('\n');
}

export function buildLayoutPrompt(ctx: PipelineContext, archetypeHtml?: string, archetypeSlug?: string): string {
  if (archetypeHtml && archetypeSlug) {
    return [
      `You are the layout agent. Your job is to fill the content slots in the archetype HTML skeleton with the copy from copy.md.`,
      ``,
      `## Your Task`,
      `1. Read the copy from ${ctx.workingDir}/copy.md using the read_file tool.`,
      `2. The archetype skeleton is provided below. Fill every text element with the corresponding copy content.`,
      `3. Do NOT change any CSS, positioning, or structural HTML.`,
      `4. Do NOT add or remove HTML elements -- only change text content inside existing slot elements.`,
      `5. Write the filled HTML to ${ctx.workingDir}/layout.html using write_file.`,
      ``,
      `## Archetype: ${archetypeSlug}`,
      ``,
      `<archetype-skeleton>`,
      archetypeHtml,
      `</archetype-skeleton>`,
      ``,
      `Fill only the text inside content elements. Preserve all class names, positioning, and structure exactly.`,
    ].join('\n');
  }
  // Fallback: no archetype available — use old freestyle mode
  return [
    `Create structural HTML layout for a ${ctx.creationType} creation.`,
    `Read copy from ${ctx.workingDir}/copy.md using the read_file tool.`,
    ``,
    `Use list_brand_sections(category="archetypes") to discover layout types, then read_brand_section to load details.`,
    ``,
    `Write layout HTML to ${ctx.workingDir}/layout.html.`,
  ].join('\n');
}

export function buildStylingPrompt(
  ctx: PipelineContext,
  designDna?: string,
  isArchetypeBased?: boolean,
  imageSlotLabels?: string[],
  userImageUrl?: string,
): string {
  return [
    ...(isArchetypeBased ? [
      `Apply brand styling and polish to the archetype-based layout.`,
      `Read layout from ${ctx.workingDir}/layout.html using the read_file tool.`,
      `The layout already has structural CSS from the archetype. Your job is to ENHANCE it with:`,
      `- Brand fonts (discover via list_brand_assets(category="fonts") and inject @font-face + font-family)`,
      `- Decorative brand assets (brushstrokes, textures — discover via list_brand_assets)`,
      `- Brand color enforcement (background MUST be #000000, accent colors per copy.md)`,
      `- Visual polish (opacity, letter-spacing, subtle animations if appropriate)`,
      `Do NOT remove or restructure existing HTML elements or CSS positioning. ADD brand layers on top.`,
    ] : [
      `Apply brand styling to create a complete HTML output.`,
      `Read copy from ${ctx.workingDir}/copy.md and layout from ${ctx.workingDir}/layout.html using the read_file tool.`,
    ]),
    ``,
    ...(imageSlotLabels && imageSlotLabels.length > 0 ? [
      `## Image Slots to Fill`,
      `This archetype has ${imageSlotLabels.length} image slot(s): ${imageSlotLabels.join(', ')}`,
      ...(userImageUrl ? [
        `The user provided an image. Use this URL for the primary image slot: ${userImageUrl}`,
        `Set the img src attribute to this URL exactly. User-provided images take priority.`,
      ] : [
        `Use list_brand_assets(category='images') to discover available photos in the brand library.`,
        `Select the most contextually appropriate photo for each slot based on the slot label:`,
        ...imageSlotLabels.map(label => `  - "${label}" — pick a photo whose name/description suggests ${label.toLowerCase()} content`),
        `Use the imgSrc field from the asset for img src attributes.`,
        ``,
        `If no suitable photo exists for a slot, generate a branded placeholder:`,
        `  <div style="width:100%;height:100%;background:linear-gradient(135deg, {accent-color}22, #000000);display:flex;align-items:center;justify-content:center;">`,
        `    <span style="color:{accent-color};opacity:0.3;font-size:14px;">Photo</span>`,
        `  </div>`,
        `Replace {accent-color} with the accent color from copy.md. The placeholder MUST be visible and use brand colors.`,
      ]),
      ``,
    ] : []),
    `Use list_brand_patterns to discover available visual patterns, then read_brand_pattern to load what you need:`,
    `- Design tokens: color palette, typography, opacity patterns`,
    `- Visual patterns: brushstrokes, circles, textures, footer structure — load only the ones relevant to this creation`,
    ``,
    `Use list_voice_guide / read_voice_guide if you need brand voice context for copy refinement.`,
    ``,
    `Asset URLs are pre-injected in your system context. Use them verbatim.`,
    `If you need additional assets not in the pre-loaded manifest, use list_brand_assets to discover them.`,
    `Use @font-face with the fontSrc field from list_brand_assets(category="fonts") — it is already formatted as url('...') format('...'), use it verbatim.`,
    `For images, use cssUrl for background-image and imgSrc for img src attributes — both returned by list_brand_assets.`,
    `NEVER embed base64 data URIs. NEVER hardcode specific asset filenames — always discover them via the tool.`,
    ``,
    `NON-NEGOTIABLE STYLING RULES:`,
    `- BACKGROUND: Social posts (instagram, linkedin) MUST use pure #000000 black. NOT #111, NOT #1a1a1a, NOT any dark gray. One-pagers use #050505.`,
    `- ASSET URLS: Always use /api/brand-assets/serve/{name} with NO subdirectories and NO file extensions.`,
    `  Correct: /api/brand-assets/serve/brush-texture-01, /api/brand-assets/serve/flfontbold, /api/brand-assets/serve/wecommerce-flags`,
    `  WRONG: /api/brand-assets/serve/brushstrokes/brush-texture-01.png, /api/brand-assets/serve/fonts/flfontbold.ttf`,
    `- CSS FONT FALLBACKS: Always use "sans-serif" as the fallback. NEVER use Georgia, Times New Roman, serif, or cursive.`,
    `- POSITIONING: Social posts use position:absolute for ALL major layout elements (not flexbox/grid for the main composition).`,
    `- CSS CLASSES: ALL styling MUST be in <style> blocks using CSS class selectors. Inline style="" attributes are PROHIBITED. No exceptions.`,
    `- DECORATIVE ELEMENTS: Decorative/background image assets (brushstrokes, textures, circles) MUST use <div> elements with background-image + background-size: contain + background-repeat: no-repeat. NEVER use <img> tags for decorative elements.`,
    `- CIRCLE EMPHASIS: The ::before pseudo-element on circle-target elements must use percentage sizing relative to the target text. Use width: 110%; height: 130%; left: -5%; top: -15% instead of fixed pixel values. This prevents mask bounding box clipping on varying text widths.`,
    `- FONT FALLBACKS: Never use Georgia, Times New Roman, Times, serif, or cursive as font-family values or fallbacks. Always use sans-serif as the generic fallback.`,
    ...(designDna ? [
      '',
      designDna,
      '',
    ] : []),
    ``,
    `DECORATION DECLARATION: At the very end of your HTML (before </html>), write a machine-readable comment declaring what decorative elements you placed:`,
    `<!-- DECORATIONS: brush=".your-brush-selector" brushAdditional=[".selector1",".selector2"] -->`,
    `If you placed no brush element, write: <!-- DECORATIONS: brush="" brushAdditional=[] -->`,
    `This comment is parsed by the pipeline for editor sidebar integration.`,
    ``,
    `CRITICAL: Write the final complete self-contained HTML (all CSS inline) using write_file to EXACTLY this path:`,
    `${ctx.htmlOutputPath}`,
    `Do NOT write to styled.html or any other filename. The output MUST go to the exact path above.`,
  ].join('\n');
}

/**
 * After the styling stage completes, merge the archetype's schema.json with decoration
 * selectors extracted from the DECORATIONS comment in the generated HTML, then persist
 * to the iterations table via updateIterationSlotSchema.
 */
export async function attachSlotSchema(
  ctx: PipelineContext,
  archetypeSlug: string,
  schemaPath: string,
): Promise<void> {
  // 1. Load archetype schema (trusted — Phase 19 validated)
  const rawSchema = await fs.readFile(schemaPath, 'utf-8');
  const archetypeSchema = JSON.parse(rawSchema);

  // 2. Read final HTML to detect decoration comment
  const html = await fs.readFile(ctx.htmlOutputPath, 'utf-8').catch(() => '');

  // 3. Parse DECORATIONS comment (Strategy A — agent-explicit)
  const decoMatch = html.match(/<!-- DECORATIONS:\s*brush="([^"]*)"\s*brushAdditional=\[([^\]]*)\]\s*-->/);
  let brushSel: string | null = null;
  let brushAdditional: Array<{ sel: string; label: string }> | undefined;

  if (decoMatch) {
    brushSel = decoMatch[1] || null;
    const additionalRaw = decoMatch[2]?.trim();
    if (additionalRaw) {
      brushAdditional = additionalRaw
        .split(',')
        .map(s => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
        .map(sel => ({ sel, label: 'Decorative element' }));
    }
  }

  // 4. Merge: archetype schema + decoration fields
  const mergedSchema = {
    ...archetypeSchema,
    brush: brushSel,
    brushLabel: brushSel ? 'Decorative element' : undefined,
    brushAdditional: brushAdditional && brushAdditional.length > 0 ? brushAdditional : undefined,
  };

  // 5. Persist to DB
  updateIterationSlotSchema(ctx.iterationId, mergedSchema);
}

function buildSpecCheckPrompt(ctx: PipelineContext): string {
  return [
    `Validate the HTML at ${ctx.htmlOutputPath} against the brand's design specs.`,
    `Use run_brand_check tool on that file.`,
    `Write a JSON report to ${ctx.workingDir}/spec-report.json with format:`,
    `{ "overall": "pass" | "fail", "blocking_issues": [{ "description": "...", "severity": "...", "fix_target": "copy" | "layout" | "styling" }] }`,
    `Use empty blocking_issues array when overall is "pass".`,
  ].join('\n');
}

function buildFixPrompt(target: FixTarget, issues: Array<{ description: string; severity: string; fix_target: string }>, ctx: PipelineContext): string {
  return [
    `FIX: You are the ${target} agent. Re-read and fix the following issues in your domain.`,
    `Issues: ${JSON.stringify(issues, null, 2)}`,
    ``,
    `Read the relevant files in ${ctx.workingDir}/ and fix only the issues listed above.`,
    `Rewrite the relevant file with the fixes applied.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Haiku narrator: generates a 1-sentence conversational summary after each stage
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  copy: 'Writing copy',
  layout: 'Building layout',
  styling: 'Applying styling',
  'spec-check': 'Running spec-check',
};

async function generateStageNarrative(
  stage: PipelineStage,
  stageOutput: string,
  ctx: PipelineContext,
  res: ServerResponse,
): Promise<void> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Summarize in 1 short sentence what happened in the "${STAGE_LABELS[stage] ?? stage}" stage for a ${ctx.creationType} creation. Stage output (first 500 chars): ${stageOutput.slice(0, 500)}\n\nBe conversational and specific. Examples: "Copy ready — headline focuses on checkout friction." or "Layout done — using full-bleed headline archetype." or "Styled with blue accent (trust/authority)."`,
      }],
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text : `${STAGE_LABELS[stage] ?? stage} complete.`;
    emitStageNarrative(res, ctx.creationId, stage, text);
  } catch {
    // Fallback if Haiku call fails — emit a generic narration
    emitStageNarrative(res, ctx.creationId, stage, `${STAGE_LABELS[stage] ?? stage} complete.`);
  }
}

// ---------------------------------------------------------------------------
// Core agentic loop: runStageWithTools
// ---------------------------------------------------------------------------

/**
 * Run a single pipeline stage via the Anthropic API with full agentic tool loop.
 * Emits SSE events for text and tool use as they occur.
 */
export async function runStageWithTools(
  stage: PipelineStage,
  userPrompt: string,
  ctx: PipelineContext,
  res: ServerResponse,
  injectedContext?: string,
): Promise<StageResult> {
  const systemPrompt = buildSystemPrompt(stage, ctx, injectedContext);
  const model = STAGE_MODELS[stage];
  const tools = STAGE_TOOLS[stage];

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  emitStageStatus(res, ctx.creationId, stage, 'starting');

  let accumulatedText = '';
  let toolCallCount = 0;
  const MAX_ITERATIONS = 10;
  const gapToolCalls: Array<{ tool: string; input: Record<string, unknown>; timestamp: number }> = [];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model,
      system: systemPrompt,
      max_tokens: 8192,
      tools,
      messages,
    });

    // Process content blocks — accumulate text for narrator but don't emit agent reasoning to UI
    for (const block of response.content) {
      if (block.type === 'text') {
        accumulatedText += block.text;
        // Agent reasoning text is NOT emitted to UI — only stage badges and narrator summaries are shown
      }
    }

    if (response.stop_reason === 'end_turn') {
      break;
    }

    if (response.stop_reason === 'max_tokens') {
      emitStageStatus(res, ctx.creationId, stage, 'max-tokens-reached');
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCallCount++;
          const result = await executeTool(block.name, block.input as Record<string, unknown>, ctx.workingDir, [ctx.htmlOutputPath]);
          emitToolDone(res, ctx.creationId, block.name);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
          // Gap signal: log if discovery tools called during a pre-injected stage
          if (injectedContext && (block.name === 'list_brand_sections' || block.name === 'read_brand_section')) {
            try {
              gapToolCalls.push({ tool: block.name, input: block.input as Record<string, unknown>, timestamp: Date.now() });
            } catch { /* best-effort */ }
          }
        }
      }

      // Append assistant turn and tool results to conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      // Continue loop
      continue;
    }

    // Unexpected stop_reason — break to avoid infinite loop
    break;
  }

  emitStageStatus(res, ctx.creationId, stage, 'done');

  // Log context injection results
  if (injectedContext) {
    try {
      // Derive section slugs from injected context manifest header
      const sectionMatch = injectedContext.match(/Sections: (.+)\n/);
      const logSlugs = sectionMatch ? sectionMatch[1].split(', ') : [];
      const tokenMatch = injectedContext.match(/Estimated tokens: ~(\d+)/);
      const logTokens = tokenMatch ? parseInt(tokenMatch[1]) : 0;
      insertContextLog({
        generationId: ctx.creationId,
        creationType: ctx.creationType,
        stage,
        injectedSections: logSlugs,
        tokenEstimate: logTokens,
        gapToolCalls,
      });
    } catch { /* best-effort logging */ }
  }

  return { stage, output: accumulatedText, toolCalls: toolCallCount };
}

// ---------------------------------------------------------------------------
// Micro-fix: regex-based fixes for simple brand violations (saves API calls)
// ---------------------------------------------------------------------------

interface SpecViolation {
  rule: string;
  found?: string;
  severity: string;
  description?: string;
  fix_target?: string;
}

const MICRO_FIXABLE_RULES = new Set([
  'color-bg-pure-black',
]);

/**
 * Attempt regex-based fixes for simple brand violations.
 * Returns true if all violations were fixable and the file was updated.
 */
async function tryMicroFix(htmlPath: string, violations: SpecViolation[]): Promise<boolean> {
  // Only attempt if ALL violations are micro-fixable
  if (!violations.every(v => MICRO_FIXABLE_RULES.has(v.rule))) {
    return false;
  }

  try {
    let html = await fs.readFile(htmlPath, 'utf-8');
    let modified = false;

    for (const v of violations) {
      if (v.rule === 'color-bg-pure-black' && v.found) {
        // Replace dark gray backgrounds with pure black
        const darkGray = v.found.replace('#', '').toLowerCase();
        const pattern = new RegExp(`#${darkGray}`, 'gi');
        const newHtml = html.replace(pattern, '#000000');
        if (newHtml !== html) {
          html = newHtml;
          modified = true;
        }
      }

    }

    if (modified) {
      await fs.writeFile(htmlPath, html, 'utf-8');
      return true;
    }
  } catch {
    // File read/write error — fall back to full fix loop
  }

  return false;
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator: runApiPipeline
// ---------------------------------------------------------------------------

/**
 * Run the full 4-stage generation pipeline for one creation.
 * Stages: copy -> layout -> styling -> spec-check -> (fix loop up to 3x)
 */
export async function runApiPipeline(
  ctx: PipelineContext,
  res: ServerResponse,
): Promise<void> {
  // Ensure working directory exists
  await fs.mkdir(ctx.workingDir, { recursive: true });

  // ── Load context map once for entire pipeline run ─────────────────────────
  let contextMap: Map<string, Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>>;
  try {
    contextMap = loadContextMap();
  } catch {
    contextMap = new Map(); // Graceful fallback — agents self-discover via tools
  }

  // ── Scan available archetypes ───────────────────────────────────────────────
  const archetypes = await scanArchetypes();
  let archetypeList = '';
  if (archetypes.size > 0) {
    archetypeList = [...archetypes.values()]
      .map(a => `- ${a.slug}: ${a.description}`)
      .join('\n');
  } else {
    console.warn('[api-pipeline] No archetypes found in archetypes/ directory');
  }

  // ── Stage 1: Copy ──────────────────────────────────────────────────────────
  const copyCtx = loadContextForStage(contextMap, ctx.creationType, 'copy');
  if (copyCtx.sectionSlugs.length > 0) {
    emitContextInjected(res, ctx.creationId, 'copy', copyCtx.sectionSlugs, copyCtx.tokenEstimate);
  }
  const campaignContext = getCampaignCopyContext(ctx.campaignId);
  const copyResult = await runStageWithTools('copy', buildCopyPrompt(ctx, campaignContext, archetypeList), ctx, res, copyCtx.injectedContext);
  await generateStageNarrative('copy', copyResult.output, ctx, res);

  // Record this creation's copy for campaign-level dedup
  try {
    const copyContent = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8');
    recordCampaignCopy(ctx.campaignId, ctx.creationType, copyContent);
  } catch { /* best-effort */ }

  // ── Detect archetype from copy output and resolve ───────────────────────────
  let resolvedArchetypeSlug = '';
  let archetypeMeta: ArchetypeMeta | undefined;
  try {
    const copyMd = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8');
    const archetypeMatch = copyMd.match(/archetype[:\s]+(\S+)/i);
    if (archetypeMatch) {
      const result = resolveArchetypeSlug(archetypeMatch[1], archetypes);
      resolvedArchetypeSlug = result.slug;
      archetypeMeta = archetypes.get(resolvedArchetypeSlug);
    }
  } catch { /* copy.md not found */ }

  // Fallback: use first available archetype if none detected
  if (!archetypeMeta && archetypes.size > 0) {
    resolvedArchetypeSlug = [...archetypes.keys()].sort()[0];
    archetypeMeta = archetypes.get(resolvedArchetypeSlug);
    console.warn(`[api-pipeline] No archetype in copy.md, falling back to "${resolvedArchetypeSlug}"`);
  }

  const designDna = await loadDesignDna(ctx, resolvedArchetypeSlug);

  // ── Stage 2: Layout ────────────────────────────────────────────────────────
  let archetypeHtml: string | undefined;
  if (archetypeMeta) {
    try {
      archetypeHtml = await fs.readFile(archetypeMeta.htmlPath, 'utf-8');
    } catch {
      console.warn(`[api-pipeline] Failed to read archetype HTML: ${archetypeMeta.htmlPath}`);
    }
  }

  const layoutCtx = loadContextForStage(contextMap, ctx.creationType, 'layout');
  const layoutInjected = designDna ? `${designDna}\n\n${layoutCtx.injectedContext}` : layoutCtx.injectedContext;
  if (layoutCtx.sectionSlugs.length > 0) {
    emitContextInjected(res, ctx.creationId, 'layout', layoutCtx.sectionSlugs, layoutCtx.tokenEstimate);
  }
  const layoutResult = await runStageWithTools('layout', buildLayoutPrompt(ctx, archetypeHtml, resolvedArchetypeSlug || undefined), ctx, res, layoutInjected);
  await generateStageNarrative('layout', layoutResult.output, ctx, res);

  // ── Stage 3: Styling ───────────────────────────────────────────────────────
  const imageSlotLabels = archetypeMeta
    ? getArchetypeImageSlotLabels(archetypeMeta.schemaPath)
    : [];

  // TODO: Phase 22 Plan 03 will wire userImageUrl from generate request body
  const userImageUrl: string | undefined = undefined; // Placeholder for now

  const stylingCtx = loadContextForStage(contextMap, ctx.creationType, 'styling');
  const assetManifest = buildAssetManifest();
  const stylingParts = [designDna, assetManifest, stylingCtx.injectedContext].filter(Boolean);
  const stylingInjected = stylingParts.join('\n\n');
  if (stylingCtx.sectionSlugs.length > 0) {
    emitContextInjected(res, ctx.creationId, 'styling', stylingCtx.sectionSlugs, stylingCtx.tokenEstimate);
  }
  const stylingResult = await runStageWithTools('styling', buildStylingPrompt(ctx, undefined, !!archetypeMeta, imageSlotLabels, userImageUrl), ctx, res, stylingInjected);
  await generateStageNarrative('styling', stylingResult.output, ctx, res);

  // Fallback: if agent wrote to styled.html in workingDir instead of htmlOutputPath, copy it
  try {
    await fs.access(ctx.htmlOutputPath);
  } catch {
    // htmlOutputPath doesn't exist — check for common agent mistakes
    const fallbackPaths = [
      path.join(ctx.workingDir, 'styled.html'),
      path.join(ctx.workingDir, 'output.html'),
      path.join(ctx.workingDir, 'index.html'),
    ];
    for (const fallback of fallbackPaths) {
      try {
        await fs.access(fallback);
        await fs.mkdir(path.dirname(ctx.htmlOutputPath), { recursive: true });
        await fs.copyFile(fallback, ctx.htmlOutputPath);
        console.log(`[api-pipeline] Fallback: copied ${path.basename(fallback)} to htmlOutputPath`);
        break;
      } catch { /* try next */ }
    }
  }

  // ── Attach SlotSchema post-styling ──────────────────────────────────────────
  if (archetypeMeta) {
    try {
      await attachSlotSchema(ctx, resolvedArchetypeSlug, archetypeMeta.schemaPath);
      console.log(`[api-pipeline] Attached SlotSchema for archetype "${resolvedArchetypeSlug}" to iteration ${ctx.iterationId}`);
    } catch (err) {
      console.error(`[api-pipeline] Failed to attach SlotSchema:`, err);
      // Non-fatal — HTML is already generated, editor sidebar just won't have custom fields
    }
  }

  // ── Stage 4: Spec-check (best-effort — don't let failures kill the pipeline) ──
  try {
    await runStageWithTools('spec-check', buildSpecCheckPrompt(ctx), ctx, res);
    await generateStageNarrative('spec-check', '', ctx, res);
  } catch (specErr) {
    console.error(`[api-pipeline] Spec-check failed (non-fatal):`, specErr);
    emitStageStatus(res, ctx.creationId, 'spec-check', 'error');
    // Continue — the HTML file is already written, spec-check is a quality gate, not blocking
  }

  // Read spec report and run fix loop (best-effort — HTML is already saved)
  try {
    const specReportPath = path.join(ctx.workingDir, 'spec-report.json');
    let specReport: { overall: string; blocking_issues?: Array<{ description: string; severity: string; fix_target: string }> } = { overall: 'pass' };
    try {
      const raw = await fs.readFile(specReportPath, 'utf-8');
      specReport = JSON.parse(raw);
    } catch {
      // No spec report or parse error — treat as pass (best-effort)
    }

    if (specReport.overall === 'pass') {
      return;
    }

    // ── Fix loop: up to 3 iterations ──────────────────────────────────────────
    const MAX_FIX_ITERATIONS = 3;
    for (let fixIter = 1; fixIter <= MAX_FIX_ITERATIONS; fixIter++) {
      const blockingIssues = specReport.blocking_issues ?? [];
      if (blockingIssues.length === 0) break;

      // Try micro-fix first for simple violations (regex-based, no API call needed)
      const microFixed = await tryMicroFix(ctx.htmlOutputPath, blockingIssues as SpecViolation[]);
      if (microFixed) {
        console.log(`[api-pipeline] Micro-fix applied for ${blockingIssues.length} violations`);
        // Re-run spec-check to verify the micro-fix worked
        try {
          await runStageWithTools('spec-check', buildSpecCheckPrompt(ctx), ctx, res);
          const raw = await fs.readFile(specReportPath, 'utf-8');
          specReport = JSON.parse(raw);
          if (specReport.overall === 'pass') {
            emitStageStatus(res, ctx.creationId, `fix-${fixIter}`, 'micro-fixed');
            break;
          }
        } catch { /* fall through to full fix */ }
      }

      emitStageStatus(res, ctx.creationId, `fix-${fixIter}`, 'starting');

      // Group issues by fix_target
      const issuesByTarget = new Map<FixTarget, typeof blockingIssues>();
      for (const issue of blockingIssues) {
        const target = issue.fix_target as FixTarget;
        if (!issuesByTarget.has(target)) issuesByTarget.set(target, []);
        issuesByTarget.get(target)!.push(issue);
      }

      const fixTargets = Array.from(issuesByTarget.keys());
      const hasCopyFix = fixTargets.includes('copy');

      // Run fix agents for each affected target
      for (const [target, issues] of issuesByTarget) {
        await runStageWithTools(target, buildFixPrompt(target, issues, ctx), ctx, res);
      }

      // Cascade rule: if copy was fixed, re-run layout and styling too
      if (hasCopyFix) {
        if (!issuesByTarget.has('layout')) {
          await runStageWithTools('layout', buildLayoutPrompt(ctx, archetypeHtml, resolvedArchetypeSlug || undefined), ctx, res);
        }
        if (!issuesByTarget.has('styling')) {
          await runStageWithTools('styling', buildStylingPrompt(ctx, designDna, !!archetypeMeta, imageSlotLabels, userImageUrl), ctx, res, stylingInjected);
        }
      }

      // Re-run spec-check
      await runStageWithTools('spec-check', buildSpecCheckPrompt(ctx), ctx, res);

      // Re-read spec report
      try {
        const raw = await fs.readFile(specReportPath, 'utf-8');
        specReport = JSON.parse(raw);
      } catch {
        specReport = { overall: 'pass' };
      }

      emitStageStatus(res, ctx.creationId, `fix-${fixIter}`, 'done');

      if (specReport.overall === 'pass') break;

      if (fixIter === MAX_FIX_ITERATIONS) {
        emitStageStatus(res, ctx.creationId, 'fix-loop', 'max-iterations-reached');
      }
    }
  } catch (fixLoopErr) {
    console.error(`[api-pipeline] Fix loop failed (non-fatal):`, fixLoopErr);
    // HTML file is already written — fix loop failure doesn't block the pipeline
  }
}

