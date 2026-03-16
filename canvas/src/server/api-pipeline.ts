/**
 * api-pipeline.ts
 * Foundation for the Anthropic API generation pipeline.
 * Provides: SDK client, tool schemas, tool executor, stage prompt loader, SSE helpers.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { ServerResponse } from 'node:http';
import { getVoiceGuideDocs, getBrandPatterns } from './db-api';

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
}

// ---------------------------------------------------------------------------
// Brand context — loaded from DB once per pipeline run
// ---------------------------------------------------------------------------

export interface BrandContext {
  voiceRules: string;
  designTokens: string;
  layoutArchetypes: string;
  patternSnippets: string;
}

/**
 * Load brand context from DB for injection into stage prompts.
 * Called once per pipeline run; all stages share the same snapshot.
 */
export function loadBrandContextFromDb(): BrandContext {
  const voiceDocs = getVoiceGuideDocs();
  const voiceRules = voiceDocs.map(d => `## ${d.label}\n${d.content}`).join('\n\n');

  const tokenRows = getBrandPatterns('design-tokens');
  const designTokens = tokenRows.map(r => `## ${r.label}\n${r.content}`).join('\n\n');

  const archetypeRows = getBrandPatterns('layout-archetype');
  const layoutArchetypes = archetypeRows.map(r => `## ${r.label}\n${r.content}`).join('\n\n');

  const patternRows = getBrandPatterns('pattern');
  // Truncate each pattern snippet to 2000 chars max to avoid blowing context
  const patternSnippets = patternRows.map(r => {
    const truncated = r.content.length > 2000 ? r.content.slice(0, 2000) + '\n<!-- truncated -->' : r.content;
    return `## ${r.label}\n${truncated}`;
  }).join('\n\n');

  return { voiceRules, designTokens, layoutArchetypes, patternSnippets };
}

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
        description: 'Path to the file to read. Relative paths are resolved from project root.',
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

/** All 4 pipeline tools */
export const PIPELINE_TOOLS: Anthropic.Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runBrandCheckTool,
];

/** Tools available per stage */
export const STAGE_TOOLS: Record<PipelineStage, Anthropic.Tool[]> = {
  copy: [readFileTool, writeFileTool, listFilesTool],
  layout: [readFileTool, writeFileTool, listFilesTool],
  styling: [readFileTool, writeFileTool, listFilesTool],
  'spec-check': [readFileTool, writeFileTool, runBrandCheckTool],
};

// ---------------------------------------------------------------------------
// Project root (three levels up from canvas/src/server/ = Fluid-DesignOS root)
// brand/, tools/, patterns/ all live at this level
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

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
): Promise<string> {
  switch (name) {
    case 'read_file': {
      const filePath = input.path as string;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(PROJECT_ROOT, filePath);
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

      // Security check: prevent writes outside workingDir
      const resolvedWorking = path.resolve(workingDir);
      if (!resolvedPath.startsWith(resolvedWorking + path.sep) && resolvedPath !== resolvedWorking) {
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
        : path.resolve(PROJECT_ROOT, directory);
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
// Stage prompt loader
// ---------------------------------------------------------------------------

/** Mapping from creationType to skill file path */
const SKILL_FILES: Record<string, string> = {
  instagram: path.join(os.homedir(), '.agents/skills/fluid-social/SKILL.md'),
  linkedin: path.join(os.homedir(), '.agents/skills/fluid-social/SKILL.md'),
  'one-pager': path.join(os.homedir(), '.agents/skills/fluid-one-pager/SKILL.md'),
  'theme-section': path.join(os.homedir(), '.agents/skills/fluid-theme-section/SKILL.md'),
};

/** Fallback prompts when skill file cannot be loaded */
function getFallbackPrompt(stage: PipelineStage, ctx: PipelineContext): string {
  switch (stage) {
    case 'copy':
      return `You are a Fluid brand copywriter. Generate marketing copy for a ${ctx.creationType} post. Use read_file to load brand/voice-rules.md and brand/social-post-specs.md. Write copy to ${ctx.workingDir}/copy.md.`;
    case 'layout':
      return `You are a Fluid layout agent. Create HTML layout for a ${ctx.creationType} post. Use read_file to load brand/layout-archetypes.md. Read copy from ${ctx.workingDir}/copy.md. Write layout to ${ctx.workingDir}/layout.html.`;
    case 'styling':
      return `You are a Fluid styling agent. Apply brand styling. Use read_file to load brand/design-tokens.md, brand/asset-usage.md, patterns/index.html. Read ${ctx.workingDir}/copy.md and ${ctx.workingDir}/layout.html. IMPORTANT: First call GET /api/brand-assets to discover available fonts, brushstrokes, and other assets. Reference all assets via /fluid-assets/ absolute URLs using the filenames returned by the API -- use @font-face with url('/fluid-assets/fonts/{discovered-filename}'), images with src='/fluid-assets/{category}/{discovered-filename}'. NEVER embed base64 data URIs. NEVER hardcode specific asset filenames. Write styled HTML to ${ctx.htmlOutputPath}.`;
    case 'spec-check':
      return `You are a Fluid spec-check agent. Validate ${ctx.htmlOutputPath}. Use run_brand_check tool. Write report to ${ctx.workingDir}/spec-report.json.`;
  }
}

/** Map stage names to the section heading patterns in skill files */
const STAGE_HEADING_PATTERNS: Record<PipelineStage, RegExp> = {
  copy: /copy\s*agent/i,
  layout: /layout\s*agent/i,
  styling: /styling\s*agent/i,
  'spec-check': /spec.?check\s*agent/i,
};

/**
 * Extract the section for a given stage from skill file content.
 * Skill files use headings like "## Step 3a: Copy Agent".
 */
function extractStageSection(content: string, stage: PipelineStage): string | null {
  const lines = content.split('\n');
  const headingPattern = STAGE_HEADING_PATTERNS[stage];

  let sectionStart = -1;
  let sectionLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch && headingPattern.test(headingMatch[2])) {
      sectionStart = i;
      sectionLevel = headingMatch[1].length;
      continue;
    }

    // If we found the section start, look for the next heading at same or higher level
    if (sectionStart !== -1 && i > sectionStart) {
      const nextHeading = line.match(/^(#{1,6})\s+/);
      if (nextHeading && nextHeading[1].length <= sectionLevel) {
        // Found end of section
        return lines.slice(sectionStart, i).join('\n').trim();
      }
    }
  }

  if (sectionStart !== -1) {
    // Section goes to end of file
    return lines.slice(sectionStart).join('\n').trim();
  }

  return null;
}

/**
 * Load the system prompt for a pipeline stage.
 * Primary: reads skill .md file from disk and extracts stage-specific section.
 * Fallback: hardcoded minimal prompt if file read or parse fails.
 */
export async function loadStagePrompt(stage: PipelineStage, ctx: PipelineContext): Promise<string> {
  const skillPath = SKILL_FILES[ctx.creationType];

  if (!skillPath) {
    console.warn(`[api-pipeline] No skill file mapping for creationType "${ctx.creationType}", using fallback`);
    return getFallbackPrompt(stage, ctx);
  }

  let skillContent: string;
  try {
    skillContent = await fs.readFile(skillPath, 'utf-8');
  } catch (err) {
    console.warn(`[api-pipeline] Failed to read skill file "${skillPath}": ${err}. Using fallback.`);
    return getFallbackPrompt(stage, ctx);
  }

  const stageSection = extractStageSection(skillContent, stage);
  if (!stageSection) {
    console.warn(`[api-pipeline] Could not extract "${stage}" section from "${skillPath}". Using fallback.`);
    return getFallbackPrompt(stage, ctx);
  }

  // Compose the final system prompt
  const availableTools =
    stage === 'spec-check'
      ? 'read_file, write_file, run_brand_check'
      : 'read_file, write_file, list_files';

  return [
    `You are a Fluid ${stage} agent working on a ${ctx.creationType} creation.`,
    '',
    '## Stage Instructions',
    stageSection,
    '',
    '## Context',
    `- Working directory: ${ctx.workingDir}`,
    `- HTML output path: ${ctx.htmlOutputPath}`,
    `- Creation type: ${ctx.creationType}`,
    '',
    '## Available Tools',
    availableTools,
  ].join('\n');
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
// Stage user prompt builders (private helpers)
// ---------------------------------------------------------------------------

function buildCopyPrompt(ctx: PipelineContext): string {
  return [
    `Generate Fluid brand copy for a ${ctx.creationType} marketing creation.`,
    `Topic: ${ctx.prompt}`,
    ``,
    `Use read_file to load brand docs (brand/voice-rules.md, brand/social-post-specs.md).`,
    `Write structured copy (headline, subtext, accent color, archetype selection) to ${ctx.workingDir}/copy.md.`,
  ].join('\n');
}

function buildLayoutPrompt(ctx: PipelineContext): string {
  return [
    `Create structural HTML layout for a Fluid ${ctx.creationType} post.`,
    `Read copy from ${ctx.workingDir}/copy.md.`,
    `Use read_file to load brand/layout-archetypes.md for archetype guidance.`,
    `Write layout HTML to ${ctx.workingDir}/layout.html.`,
  ].join('\n');
}

function buildStylingPrompt(ctx: PipelineContext): string {
  return [
    `Apply Fluid brand styling to create a complete HTML output.`,
    `Read copy from ${ctx.workingDir}/copy.md and layout from ${ctx.workingDir}/layout.html.`,
    `Use read_file to load brand/design-tokens.md, brand/asset-usage.md, patterns/index.html.`,
    `Write complete self-contained HTML (all CSS inline) to ${ctx.htmlOutputPath}.`,
  ].join('\n');
}

function buildSpecCheckPrompt(ctx: PipelineContext): string {
  return [
    `Validate the HTML at ${ctx.htmlOutputPath} against Fluid brand specs.`,
    `Use run_brand_check tool on that file.`,
    `Write a JSON report to ${ctx.workingDir}/spec-report.json with format:`,
    `{ "overall": "pass" | "fail", "blocking_issues": [{ "description": "...", "severity": "...", "fix_target": "copy" | "layout" | "styling" }] }`,
    `Use empty blocking_issues array when overall is "pass".`,
  ].join('\n');
}

function buildFixPrompt(target: FixTarget, issues: Array<{ description: string; severity: string; fix_target: string }>, ctx: PipelineContext): string {
  return [
    `FIX: You are the Fluid ${target} agent. Re-read and fix the following issues in your domain.`,
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
  const systemPrompt = await loadStagePrompt(stage, ctx);
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

    // Process content blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        accumulatedText += block.text;
        emitText(res, ctx.creationId, block.text);
      } else if (block.type === 'tool_use') {
        emitToolStart(res, ctx.creationId, block.name);
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
          const result = await executeTool(block.name, block.input as Record<string, unknown>, ctx.workingDir);
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
 * Run the full 4-stage Fluid generation pipeline for one creation.
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

  // ── Stage 2: Layout ────────────────────────────────────────────────────────
  const layoutResult = await runStageWithTools('layout', buildLayoutPrompt(ctx), ctx, res);
  await generateStageNarrative('layout', layoutResult.output, ctx, res);

  // ── Stage 3: Styling ───────────────────────────────────────────────────────
  const stylingResult = await runStageWithTools('styling', buildStylingPrompt(ctx), ctx, res);
  await generateStageNarrative('styling', stylingResult.output, ctx, res);

  // ── Stage 4: Spec-check ────────────────────────────────────────────────────
  await runStageWithTools('spec-check', buildSpecCheckPrompt(ctx), ctx, res);
  await generateStageNarrative('spec-check', '', ctx, res);

  // Read spec report
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
        await runStageWithTools('layout', buildLayoutPrompt(ctx), ctx, res);
      }
      if (!issuesByTarget.has('styling')) {
        await runStageWithTools('styling', buildStylingPrompt(ctx), ctx, res);
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
}

