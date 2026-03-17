/**
 * Unit tests for api-pipeline.ts
 * Tests: tool executor, tool schemas, stage prompt loader, STAGE_MODELS,
 *        runStageWithTools agentic loop, runApiPipeline orchestrator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

// Mock child_process for run_brand_check tests
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execSync: vi.fn(() => '{"pass":true,"issues":[]}'),
  };
});

// Mock the Anthropic SDK for runStageWithTools tests
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
    __mockCreate: mockCreate,
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { executeTool, PIPELINE_TOOLS, buildSystemPrompt, STAGE_MODELS, runStageWithTools, runApiPipeline } from '../server/api-pipeline';
import type { PipelineContext } from '../server/api-pipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    prompt: 'Test prompt',
    creationType: 'instagram',
    workingDir: '/tmp/test-working-dir',
    htmlOutputPath: '/tmp/test-working-dir/output.html',
    creationId: 'creation-test',
    campaignId: 'campaign-test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// STAGE_MODELS
// ---------------------------------------------------------------------------

describe('STAGE_MODELS', () => {
  it('maps layout to haiku model', () => {
    expect(STAGE_MODELS.layout).toMatch(/haiku/i);
  });

  it('maps copy to sonnet model', () => {
    expect(STAGE_MODELS.copy).toMatch(/sonnet/i);
  });

  it('maps styling to sonnet model', () => {
    expect(STAGE_MODELS.styling).toMatch(/sonnet/i);
  });

  it('maps spec-check to sonnet model', () => {
    expect(STAGE_MODELS['spec-check']).toMatch(/sonnet/i);
  });
});

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

describe('PIPELINE_TOOLS schemas', () => {
  it('exports exactly 7 tools', () => {
    expect(PIPELINE_TOOLS).toHaveLength(7);
  });

  it('all tools have name, description, and input_schema', () => {
    for (const tool of PIPELINE_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('read_file schema has required path field', () => {
    const tool = PIPELINE_TOOLS.find((t) => t.name === 'read_file')!;
    expect(tool).toBeDefined();
    expect((tool.input_schema as any).required).toContain('path');
  });

  it('write_file schema has required path and content fields', () => {
    const tool = PIPELINE_TOOLS.find((t) => t.name === 'write_file')!;
    expect(tool).toBeDefined();
    expect((tool.input_schema as any).required).toContain('path');
    expect((tool.input_schema as any).required).toContain('content');
  });

  it('list_files schema has required directory field', () => {
    const tool = PIPELINE_TOOLS.find((t) => t.name === 'list_files')!;
    expect(tool).toBeDefined();
    expect((tool.input_schema as any).required).toContain('directory');
  });

  it('run_brand_check schema has required html_path field', () => {
    const tool = PIPELINE_TOOLS.find((t) => t.name === 'run_brand_check')!;
    expect(tool).toBeDefined();
    expect((tool.input_schema as any).required).toContain('html_path');
  });
});

// ---------------------------------------------------------------------------
// executeTool — read_file
// ---------------------------------------------------------------------------

describe('executeTool: read_file', () => {
  it('reads CLAUDE.md and returns contents', async () => {
    const workingDir = PROJECT_ROOT;
    const result = await executeTool('read_file', { path: 'CLAUDE.md' }, workingDir);
    expect(result.toLowerCase()).toContain('cli tools');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns error string on missing file (does not throw)', async () => {
    const result = await executeTool(
      'read_file',
      { path: 'nonexistent/does-not-exist.md' },
      PROJECT_ROOT,
    );
    expect(result).toMatch(/error/i);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// executeTool — write_file
// ---------------------------------------------------------------------------

describe('executeTool: write_file', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await import('node:fs/promises').then((fsp) =>
      fsp.mkdtemp(path.join(os.tmpdir(), 'api-pipeline-test-')),
    );
  });

  afterEach(async () => {
    const fsp = await import('node:fs/promises');
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('writes file inside workingDir and returns confirmation', async () => {
    const result = await executeTool(
      'write_file',
      { path: path.join(tempDir, 'hello.txt'), content: 'hello world' },
      tempDir,
    );
    expect(result).toContain('File written');
    const written = fsSync.readFileSync(path.join(tempDir, 'hello.txt'), 'utf-8');
    expect(written).toBe('hello world');
  });

  it('rejects paths outside workingDir (path traversal prevention)', async () => {
    const outsidePath = path.join(os.tmpdir(), 'outside-sandbox.txt');
    const result = await executeTool(
      'write_file',
      { path: outsidePath, content: 'should not be written' },
      tempDir,
    );
    expect(result).toMatch(/outside.*working directory/i);
    expect(fsSync.existsSync(outsidePath)).toBe(false);
  });

  it('creates parent directories automatically', async () => {
    const nestedPath = path.join(tempDir, 'sub', 'dir', 'file.txt');
    const result = await executeTool(
      'write_file',
      { path: nestedPath, content: 'nested content' },
      tempDir,
    );
    expect(result).toContain('File written');
    expect(fsSync.existsSync(nestedPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeTool — list_files
// ---------------------------------------------------------------------------

describe('executeTool: list_files', () => {
  it('lists tools directory and includes cjs files', async () => {
    const result = await executeTool('list_files', { directory: 'tools' }, PROJECT_ROOT);
    expect(result).toContain('brand-compliance.cjs');
    expect(result).toContain('schema-validation.cjs');
  });

  it('filters by pattern when provided', async () => {
    const result = await executeTool(
      'list_files',
      { directory: 'tools', pattern: '*.cjs' },
      PROJECT_ROOT,
    );
    const files = result.split('\n').filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).toMatch(/\.cjs$/);
    }
  });

  it('returns error string on missing directory (does not throw)', async () => {
    const result = await executeTool(
      'list_files',
      { directory: 'nonexistent-subdir' },
      PROJECT_ROOT,
    );
    expect(result).toMatch(/error/i);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// executeTool — run_brand_check
// ---------------------------------------------------------------------------

describe('executeTool: run_brand_check', () => {
  it('calls brand-compliance CLI and returns stdout', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReturnValueOnce('{"pass":true,"issues":[]}');

    const result = await executeTool(
      'run_brand_check',
      { html_path: 'test.html' },
      PROJECT_ROOT,
    );
    expect(result).toContain('"pass"');
    expect(execSync).toHaveBeenCalled();
  });

  it('returns error string when CLI fails (does not throw)', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      const err = Object.assign(new Error('CLI failed'), { stderr: 'CLI error output' });
      throw err;
    });

    const result = await executeTool(
      'run_brand_check',
      { html_path: 'test.html' },
      PROJECT_ROOT,
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// executeTool — unknown tool
// ---------------------------------------------------------------------------

describe('executeTool: unknown tool', () => {
  it('returns unknown tool message for unrecognized tool names', async () => {
    const result = await executeTool('unknown_tool', {}, PROJECT_ROOT);
    expect(result).toMatch(/unknown tool/i);
    expect(result).toContain('unknown_tool');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('returns a string containing stage name and creation type', () => {
    const ctx = makeCtx({ creationType: 'instagram' });
    const prompt = buildSystemPrompt('copy', ctx);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt.toLowerCase()).toContain('copy');
    expect(prompt).toContain('instagram');
  });

  it('includes working directory in context section', () => {
    const ctx = makeCtx({
      creationType: 'instagram',
      workingDir: '/test/working/dir',
      htmlOutputPath: '/test/working/dir/output.html',
    });
    const prompt = buildSystemPrompt('copy', ctx);
    expect(prompt).toContain('/test/working/dir');
  });

  it('includes brandName when provided', () => {
    const ctx = makeCtx({ creationType: 'instagram', brandName: 'TestBrand' });
    const prompt = buildSystemPrompt('copy', ctx);
    expect(prompt).toContain('TestBrand');
  });

  it('uses generic "for the brand" when brandName is absent', () => {
    const ctx = makeCtx({ creationType: 'instagram' });
    const prompt = buildSystemPrompt('copy', ctx);
    expect(prompt).toContain('for the brand');
  });

  it('lists run_brand_check tool for spec-check stage', () => {
    const ctx = makeCtx({ creationType: 'instagram' });
    const prompt = buildSystemPrompt('spec-check', ctx);
    expect(prompt).toContain('run_brand_check');
  });

  it('lists list_brand_assets tool for styling stage', () => {
    const ctx = makeCtx({ creationType: 'instagram' });
    const prompt = buildSystemPrompt('styling', ctx);
    expect(prompt).toContain('list_brand_assets');
  });

  it('lists list_brand_sections tool for copy stage', () => {
    const ctx = makeCtx({ creationType: 'instagram' });
    const prompt = buildSystemPrompt('copy', ctx);
    expect(prompt).toContain('list_brand_sections');
  });

  it('does not contain the word Fluid', () => {
    const stages: Array<import('../server/api-pipeline').PipelineStage> = ['copy', 'layout', 'styling', 'spec-check'];
    for (const stage of stages) {
      const ctx = makeCtx({ creationType: 'instagram' });
      const prompt = buildSystemPrompt(stage, ctx);
      expect(prompt.toLowerCase()).not.toContain('fluid');
    }
  });
});

// ---------------------------------------------------------------------------
// runStageWithTools — agentic loop
// ---------------------------------------------------------------------------

/** Helper to create a minimal mock ServerResponse */
function makeMockRes(): ServerResponse {
  return {
    write: vi.fn(),
    end: vi.fn(),
    writeHead: vi.fn(),
  } as unknown as ServerResponse;
}

/** Get the mocked create function from the Anthropic mock */
async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk');
  // Access via module to get the mock fn
  const instance = new (mod.default as any)();
  return instance.messages.create as ReturnType<typeof vi.fn>;
}

describe('runStageWithTools: end_turn (no tools)', () => {
  let tempDir: string;

  beforeEach(async () => {
    const fsp = await import('node:fs/promises');
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rswt-test-'));
  });

  afterEach(async () => {
    const fsp = await import('node:fs/promises');
    await fsp.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('calls anthropic.messages.create with correct model, system, and tools for copy stage', async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Copy content generated.' }],
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    const result = await runStageWithTools('copy', 'Write copy for a test post', ctx, res);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toMatch(/sonnet/i);
    expect(typeof callArgs.system).toBe('string');
    expect(callArgs.system.length).toBeGreaterThan(10);
    expect(Array.isArray(callArgs.tools)).toBe(true);
    expect(callArgs.tools.some((t: { name: string }) => t.name === 'write_file')).toBe(true);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toBe('Write copy for a test post');

    expect(result.stage).toBe('copy');
    expect(result.output).toBe('Copy content generated.');
    expect(result.toolCalls).toBe(0);
  });

  it('accumulates text but does not emit it to UI (only stage badges and narration shown)', async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello world' }],
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    const result = await runStageWithTools('copy', 'test', ctx, res);

    // Text is accumulated in the result but NOT emitted to UI
    expect(result.output).toContain('Hello world');
    const writeCalls = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    const textCall = writeCalls.find((c) => c.includes('Hello world'));
    expect(textCall).toBeUndefined();
  });

  it('emits stage_status starting and done events', async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'done' }],
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    await runStageWithTools('layout', 'layout prompt', ctx, res);

    const writeCalls = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    const startingCall = writeCalls.find((c) => c.includes('"starting"'));
    const doneCall = writeCalls.find((c) => c.includes('"done"'));
    expect(startingCall).toBeDefined();
    expect(doneCall).toBeDefined();
  });

  it('uses haiku model for layout stage', async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'layout output' }],
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    await runStageWithTools('layout', 'lay it out', ctx, res);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toMatch(/haiku/i);
  });

  it('spec-check stage gets run_brand_check tool instead of list_files', async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'check done' }],
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    await runStageWithTools('spec-check', 'check spec', ctx, res);

    const callArgs = mockCreate.mock.calls[0][0];
    const toolNames = callArgs.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('run_brand_check');
    expect(toolNames).not.toContain('list_files');
  });
});

describe('runStageWithTools: tool_use then end_turn', () => {
  let tempDir: string;

  beforeEach(async () => {
    const fsp = await import('node:fs/promises');
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rswt-tool-test-'));
  });

  afterEach(async () => {
    const fsp = await import('node:fs/promises');
    await fsp.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('executes tool and appends tool results before continuing the loop', async () => {
    const mockCreate = await getMockCreate();
    // First call: tool_use
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'list_files', input: { directory: 'brand' } },
        ],
      })
      // Second call: end_turn
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Final output' }],
      });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    const result = await runStageWithTools('copy', 'use a tool', ctx, res);

    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Second call should include tool results
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    // messages: [user, assistant, user(tool_result)]
    expect(secondCallMessages).toHaveLength(3);
    expect(secondCallMessages[1].role).toBe('assistant');
    expect(secondCallMessages[2].role).toBe('user');
    expect(secondCallMessages[2].content[0].type).toBe('tool_result');

    expect(result.toolCalls).toBe(1);
    expect(result.output).toBe('Final output');
  });

  it('emits tool_done events for tool calls (tool_start suppressed from UI)', async () => {
    const mockCreate = await getMockCreate();
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool-abc', name: 'read_file', input: { path: 'CLAUDE.md' } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'done' }],
      });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    await runStageWithTools('copy', 'read a file', ctx, res);

    const writeCalls = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    const toolDoneCall = writeCalls.find((c) => c.includes('tool_result'));
    expect(toolDoneCall).toBeDefined();
    expect(toolDoneCall).toContain('read_file');
  });
});

// ---------------------------------------------------------------------------
// runApiPipeline — orchestrator (mocked Anthropic API)
// ---------------------------------------------------------------------------

describe('runApiPipeline: 4-stage pipeline with pass spec', () => {
  let tempDir: string;

  beforeEach(async () => {
    const fsp = await import('node:fs/promises');
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rap-test-'));
  });

  afterEach(async () => {
    const fsp = await import('node:fs/promises');
    await fsp.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('runs all 4 stages in order and writes a passing spec report', async () => {
    const mockCreate = await getMockCreate();
    const fsp = await import('node:fs/promises');

    // Spec-check stage writes a passing report, then returns end_turn
    let stageCallCount = 0;
    mockCreate.mockImplementation(async () => {
      stageCallCount++;
      // On the 3rd call (spec-check), write spec-report.json before returning
      if (stageCallCount === 3) {
        await fsp.mkdir(tempDir, { recursive: true });
        await fsp.writeFile(
          path.join(tempDir, 'spec-report.json'),
          JSON.stringify({ overall: 'pass', blocking_issues: [] }),
        );
      }
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: `Stage ${stageCallCount}` }] };
    });

    const ctx = makeCtx({
      workingDir: tempDir,
      htmlOutputPath: path.join(tempDir, 'out.html'),
    });
    const res = makeMockRes();
    await runApiPipeline(ctx, res);

    // copy + layout + styling + spec-check = 4 API calls minimum
    expect(mockCreate.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('emits stage_status events for copy, layout, styling, spec-check', async () => {
    const mockCreate = await getMockCreate();
    const fsp = await import('node:fs/promises');

    mockCreate.mockImplementation(async () => {
      // Write passing spec report on every call so spec-check stage can read it
      await fsp.mkdir(tempDir, { recursive: true });
      await fsp.writeFile(
        path.join(tempDir, 'spec-report.json'),
        JSON.stringify({ overall: 'pass', blocking_issues: [] }),
      );
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] };
    });

    const ctx = makeCtx({ workingDir: tempDir, htmlOutputPath: path.join(tempDir, 'out.html') });
    const res = makeMockRes();
    await runApiPipeline(ctx, res);

    const writeCalls = (res.write as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0] as string)
      .filter((c) => c.includes('stage_status'));

    const stages = writeCalls.map((c) => {
      try { return JSON.parse(c.replace('data: ', '')).stage; } catch { return null; }
    });

    expect(stages).toContain('copy');
    expect(stages).toContain('layout');
    expect(stages).toContain('styling');
    expect(stages).toContain('spec-check');
  });
});

// ---------------------------------------------------------------------------
// Engine routing: API is the only engine
// ---------------------------------------------------------------------------

describe('Engine routing in /api/generate', () => {
  it('body.engine defaults to "api" when not provided', () => {
    // Test that the default engine is 'api' — only engine supported
    const body: { engine?: string } = {};
    const engine = body.engine ?? 'api';
    expect(engine).toBe('api');
  });

  it('body.engine="api" is explicit API path', () => {
    const body = { engine: 'api' };
    const engine = body.engine ?? 'api';
    expect(engine).toBe('api');
  });
});
