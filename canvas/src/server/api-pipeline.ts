/**
 * api-pipeline.ts
 * Foundation for the Anthropic API generation pipeline.
 * Provides: SDK client, tool schemas, tool executor, stage prompt loader, SSE helpers.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { ServerResponse } from 'node:http';
import { getVoiceGuideDocs, getVoiceGuideDoc, getBrandPatterns, getBrandPatternBySlug, getBrandAssets, getDesignDnaForPipeline } from './db-api';

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
  brandName?: string;  // Loaded from DB at pipeline entry; prompts use "the brand" if absent
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
    'Categories: "voice-guide" (brand voice docs), "design-tokens" (colors, typography, opacity), ' +
    '"layout-archetype" (layout types), "pattern" (brushstrokes, circles, textures, footer, etc.). ' +
    'Use this to discover what brand content is available, then read_brand_section to load specific ones.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Optional filter: "voice-guide", "design-tokens", "layout-archetype", or "pattern".',
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

/** All pipeline tools */
export const PIPELINE_TOOLS: Anthropic.Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runBrandCheckTool,
  listBrandSectionsTool,
  readBrandSectionTool,
  listBrandAssetsTool,
];

/** Tools available per stage */
export const STAGE_TOOLS: Record<PipelineStage, Anthropic.Tool[]> = {
  copy: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool],
  layout: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool],
  styling: [readFileTool, writeFileTool, listFilesTool, listBrandSectionsTool, readBrandSectionTool, listBrandAssetsTool],
  'spec-check': [readFileTool, writeFileTool, runBrandCheckTool],
};

// ---------------------------------------------------------------------------
// Project root (three levels up from canvas/src/server/ = Fluid-DesignOS root)
// tools/, patterns/ all live at this level
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/** Maps archetype slug to template HTML file for exemplar injection */
const ARCHETYPE_TEMPLATE_FILES: Record<string, string> = {
  'problem-first': path.join(PROJECT_ROOT, 'templates/social/problem-first.html'),
  'quote': path.join(PROJECT_ROOT, 'templates/social/quote.html'),
  'stat-proof': path.join(PROJECT_ROOT, 'templates/social/stat-proof.html'),
  'app-highlight': path.join(PROJECT_ROOT, 'templates/social/app-highlight.html'),
  'manifesto': path.join(PROJECT_ROOT, 'templates/social/manifesto.html'),
  'partner-alert': path.join(PROJECT_ROOT, 'templates/social/partner-alert.html'),
  'feature-spotlight': path.join(PROJECT_ROOT, 'templates/social/feature-spotlight.html'),
};

/** Default archetype when copy stage doesn't specify one */
const DEFAULT_ARCHETYPE = 'problem-first';

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

    case 'list_brand_assets': {
      const category = input.category as string | undefined;
      const assets = getBrandAssets(category);
      return JSON.stringify(assets.map(a => {
        const base: Record<string, string> = {
          name: a.name,
          category: a.category,
          url: a.url,
          mimeType: a.mimeType,
        };
        // Add ready-to-use CSS values so agents use them verbatim
        if (a.mimeType.startsWith('font/') || a.url.endsWith('.ttf') || a.url.endsWith('.woff2') || a.url.endsWith('.woff') || a.url.endsWith('.otf')) {
          const format = a.url.endsWith('.ttf') ? 'truetype'
            : a.url.endsWith('.woff2') ? 'woff2'
            : a.url.endsWith('.woff') ? 'woff'
            : a.url.endsWith('.otf') ? 'opentype'
            : 'truetype';
          base.fontSrc = `url('${a.url}') format('${format}')`;
        }
        if (a.mimeType.startsWith('image/')) {
          base.cssUrl = `url('${a.url}')`;
          base.imgSrc = a.url;
        }
        return base;
      }), null, 2);
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
 * Assembles: global visual style + social general + platform rules + archetype notes + HTML exemplar.
 * Returns a formatted string block ready to prepend to system prompts.
 */
async function loadDesignDna(ctx: PipelineContext, archetypeSlug?: string): Promise<string> {
  // Only inject for social media types (instagram, linkedin) — not one-pagers or theme-sections
  if (ctx.creationType !== 'instagram' && ctx.creationType !== 'linkedin') {
    return '';
  }

  const slug = archetypeSlug || DEFAULT_ARCHETYPE;
  const dna = getDesignDnaForPipeline(ctx.creationType, slug);

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

  // Load HTML exemplar
  const templatePath = ARCHETYPE_TEMPLATE_FILES[slug];
  if (templatePath) {
    try {
      const html = await fs.readFile(templatePath, 'utf-8');
      parts.push(
        '',
        '### Reference Exemplar',
        `This is a hand-designed ${slug} template. Study its structure, positioning, typography scale, and layer composition. Your output should match this quality level.`,
        '',
        '<example>',
        html,
        '</example>',
      );
    } catch {
      // Template file missing — skip exemplar
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Stage prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for a pipeline stage.
 * Generic process instructions — no brand-specific content.
 * Agents load brand context at runtime via DB tools.
 */
export function buildSystemPrompt(stage: PipelineStage, ctx: PipelineContext): string {
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
      ? '## Available Tools\nread_file, write_file, list_files, list_brand_sections, read_brand_section, list_brand_assets'
      : '## Available Tools\nread_file, write_file, list_files, list_brand_sections, read_brand_section';

  return [...base, '', toolSection].join('\n');
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

// ---------------------------------------------------------------------------
// Stage user prompt builders — exported for testing
// ---------------------------------------------------------------------------

export function buildCopyPrompt(ctx: PipelineContext): string {
  return [
    `Generate marketing copy for a ${ctx.creationType} creation.`,
    `Topic: ${ctx.prompt}`,
    ``,
    `Use list_brand_sections(category="voice-guide") to see available voice guide docs.`,
    `Then read_brand_section to load the ones relevant to this topic (always include "voice-and-style", plus the product-specific doc if applicable).`,
    ``,
    `Write structured copy (headline, subtext, accent color, archetype selection) to ${ctx.workingDir}/copy.md.`,
    `Include an "Archetype:" line in your output specifying which visual archetype to use. Options: problem-first, quote, stat-proof, app-highlight, manifesto, partner-alert, feature-spotlight.`,
  ].join('\n');
}

export function buildLayoutPrompt(ctx: PipelineContext, designDna?: string): string {
  return [
    `Create structural HTML layout for a ${ctx.creationType} creation.`,
    `Read copy from ${ctx.workingDir}/copy.md using the read_file tool.`,
    ``,
    `Use list_brand_sections(category="layout-archetype") to discover layout types, then read_brand_section to load details.`,
    ...(designDna ? [
      '',
      designDna,
      '',
    ] : []),
    ``,
    `Write layout HTML to ${ctx.workingDir}/layout.html.`,
  ].join('\n');
}

export function buildStylingPrompt(ctx: PipelineContext, designDna?: string): string {
  return [
    `Apply brand styling to create a complete HTML output.`,
    `Read copy from ${ctx.workingDir}/copy.md and layout from ${ctx.workingDir}/layout.html using the read_file tool.`,
    ``,
    `Use list_brand_sections to discover available brand specs, then read_brand_section to load what you need:`,
    `- From "design-tokens" category: color palette, typography, opacity patterns`,
    `- From "pattern" category: brushstrokes, circles, textures, footer structure — load only the ones relevant to this creation`,
    ``,
    `Use the list_brand_assets tool to discover available fonts, brushstrokes, and other assets.`,
    `Reference all assets via the URLs returned by list_brand_assets (they start with /fluid-assets/).`,
    `Use @font-face with the fontSrc field from list_brand_assets(category="fonts") — it is already formatted as url('...') format('...'), use it verbatim.`,
    `For images, use cssUrl for background-image and imgSrc for img src attributes — both returned by list_brand_assets.`,
    `NEVER embed base64 data URIs. NEVER hardcode specific asset filenames — always discover them via the tool.`,
    ...(designDna ? [
      '',
      designDna,
      '',
    ] : []),
    ``,
    `CRITICAL: Write the final complete self-contained HTML (all CSS inline) using write_file to EXACTLY this path:`,
    `${ctx.htmlOutputPath}`,
    `Do NOT write to styled.html or any other filename. The output MUST go to the exact path above.`,
  ].join('\n');
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
): Promise<StageResult> {
  const systemPrompt = buildSystemPrompt(stage, ctx);
  const model = STAGE_MODELS[stage];
  const tools = STAGE_TOOLS[stage];

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  emitStageStatus(res, ctx.creationId, stage, 'starting');

  let accumulatedText = '';
  let toolCallCount = 0;
  const MAX_ITERATIONS = 10;

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
  return { stage, output: accumulatedText, toolCalls: toolCallCount };
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

  // ── Stage 1: Copy ──────────────────────────────────────────────────────────
  const copyResult = await runStageWithTools('copy', buildCopyPrompt(ctx), ctx, res);
  await generateStageNarrative('copy', copyResult.output, ctx, res);

  // ── Detect archetype from copy output and load Design DNA ──────────────────
  let detectedArchetype: string | undefined;
  try {
    const copyMd = await fs.readFile(path.join(ctx.workingDir, 'copy.md'), 'utf-8');
    const archetypeMatch = copyMd.match(/archetype[:\s]+(\S+)/i);
    if (archetypeMatch) {
      const slug = archetypeMatch[1].toLowerCase().replace(/[^a-z-]/g, '');
      if (ARCHETYPE_TEMPLATE_FILES[slug]) {
        detectedArchetype = slug;
      }
    }
  } catch { /* copy.md not found — use default */ }

  const designDna = await loadDesignDna(ctx, detectedArchetype);

  // ── Stage 2: Layout ────────────────────────────────────────────────────────
  const layoutResult = await runStageWithTools('layout', buildLayoutPrompt(ctx, designDna), ctx, res);
  await generateStageNarrative('layout', layoutResult.output, ctx, res);

  // ── Stage 3: Styling ───────────────────────────────────────────────────────
  const stylingResult = await runStageWithTools('styling', buildStylingPrompt(ctx, designDna), ctx, res);
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
          await runStageWithTools('layout', buildLayoutPrompt(ctx, designDna), ctx, res);
        }
        if (!issuesByTarget.has('styling')) {
          await runStageWithTools('styling', buildStylingPrompt(ctx, designDna), ctx, res);
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

