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

// Load .env file (Node 24 native, no dotenv dependency)
try {
  // @ts-ignore — process.loadEnvFile is Node 22.9+ / 24+
  (process as any).loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  // .env may not exist in production or CI — SDK reads ANTHROPIC_API_KEY from env
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
// Stage model mapping (haiku for layout, sonnet for creative stages)
// ---------------------------------------------------------------------------
export const STAGE_MODELS: Record<PipelineStage, string> = {
  copy: 'claude-sonnet-4-5-20250514',
  layout: 'claude-haiku-4-5-20250514',
  styling: 'claude-sonnet-4-5-20250514',
  'spec-check': 'claude-sonnet-4-5-20250514',
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
// Project root (two levels up from canvas/src/server/)
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '../..');

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
      return `You are a Fluid styling agent. Apply brand styling. Use read_file to load brand/design-tokens.md, brand/asset-usage.md, patterns/index.html. Read ${ctx.workingDir}/copy.md and ${ctx.workingDir}/layout.html. Write styled HTML to ${ctx.htmlOutputPath}.`;
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

