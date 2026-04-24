/**
 * phase-26-canusetool.test.ts — Permission prompts flow through the Claude
 * Agent SDK's native `canUseTool` callback, not our in-MCP dispatchTool
 * wrapper.
 *
 * We mock @anthropic-ai/claude-agent-sdk so that query() captures the
 * canUseTool callback passed in options, invokes it with a known tool name
 * and input, and yields a result message. Then we exercise:
 *
 *  1. Ask-first without trust or prior approval → permission_prompt SSE
 *     emitted, callback awaits, returns { behavior: 'allow' } after
 *     approve_once.
 *  2. approve_session → autoApproved.add(toolName).
 *  3. deny → { behavior: 'deny', message: ... }.
 *  4. trusted=true → allow without prompt.
 *  5. Abort signal → callback resolves with { behavior: 'deny' }.
 *  6. Always-allow tool → allow without prompt.
 *  7. never-allow-by-default tool → deny.
 *
 * These exercise the real canUseTool wired up inside runAgentImpl, the real
 * permission-registry, and the real resolvePermissionResponse HTTP entry
 * point behavior — the only thing mocked is the SDK itself.
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import { nanoid } from 'nanoid';

// ─── Mock the Claude Agent SDK ─────────────────────────────────────────────────
//
// The mock query() captures the options object (including canUseTool), invokes
// the callback from a test-supplied script, and yields one assistant message
// + one result message so runAgentImpl completes cleanly.

type CapturedInvocation = {
  options: any;
  results: Array<{ toolName: string; input: any; result: unknown }>;
};

const capturedRef: { current: CapturedInvocation | null } = { current: null };
const scriptRef: {
  current: Array<{ toolName: string; input: any; beforeInvoke?: () => void | Promise<void> }>;
} = { current: [] };

vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  const actual = await vi.importActual<typeof import('@anthropic-ai/claude-agent-sdk')>(
    '@anthropic-ai/claude-agent-sdk',
  );

  function mockedQuery(args: any) {
    // autoTitle and similar single-turn calls don't pass canUseTool — skip them
    // (yield nothing) so we only exercise the main runAgentImpl query.
    if (!args.options || typeof args.options.canUseTool !== 'function') {
      async function* empty() {
        return;
      }
      return empty();
    }

    const captured: CapturedInvocation = { options: args.options, results: [] };
    capturedRef.current = captured;

    async function* gen() {
      for (const step of scriptRef.current) {
        if (step.beforeInvoke) await step.beforeInvoke();
        const result = await args.options.canUseTool(step.toolName, step.input, {
          signal: new AbortController().signal,
          toolUseID: `tu_${nanoid(6)}`,
        });
        captured.results.push({ toolName: step.toolName, input: step.input, result });
      }
      // Emit a minimal SDKResultMessage so runAgentImpl's loop terminates.
      yield {
        type: 'result',
        subtype: 'success',
        session_id: `sdk_${nanoid(8)}`,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        result: 'ok',
      };
    }

    return gen();
  }

  return {
    ...actual,
    query: mockedQuery,
  };
});

// ─── Test DB setup ─────────────────────────────────────────────────────────────

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase26-test-'));

beforeAll(async () => {
  const { closeDb, getDb } = await import('../lib/db');
  closeDb();
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  process.env.FLUID_ARCHETYPES_DIR = path.resolve(__dirname, '../../../archetypes');
  getDb();
});

afterAll(async () => {
  const { closeDb } = await import('../lib/db');
  closeDb();
  delete process.env.FLUID_DB_PATH;
  delete process.env.FLUID_ARCHETYPES_DIR;
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface CollectedEvent {
  event: string;
  data: any;
}

function makeMockRes(): { res: ServerResponse; events: CollectedEvent[] } {
  const events: CollectedEvent[] = [];
  const res = {
    write(chunk: string | Buffer) {
      const str = typeof chunk === 'string' ? chunk : chunk.toString();
      for (const part of str.split('\n\n').filter(Boolean)) {
        const lines = part.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event: '));
        const dataLine = lines.find((l) => l.startsWith('data: '));
        if (eventLine && dataLine) {
          try {
            events.push({
              event: eventLine.replace('event: ', ''),
              data: JSON.parse(dataLine.replace('data: ', '')),
            });
          } catch {
            // ignore
          }
        }
      }
      return true;
    },
    writeHead() {},
    end() {},
    writableEnded: false,
  } as unknown as ServerResponse;
  return { res, events };
}

async function createChat(): Promise<string> {
  const { getDb } = await import('../lib/db');
  const db = getDb();
  const chatId = `chat_${nanoid(8)}`;
  const now = Date.now();
  db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    chatId,
    'phase26 test',
    now,
    now,
  );
  return chatId;
}

async function runWithScript(
  chatId: string,
  script: typeof scriptRef.current,
  { trusted }: { trusted?: boolean } = {},
): Promise<{ events: CollectedEvent[]; results: CapturedInvocation['results']; captured: CapturedInvocation }> {
  scriptRef.current = script;
  capturedRef.current = null;

  if (trusted) {
    process.env.FLUID_DISPATCH_TRUSTED = 'true';
  } else {
    delete process.env.FLUID_DISPATCH_TRUSTED;
  }

  const { runAgent } = await import('../server/agent');
  const { res, events } = makeMockRes();

  await runAgent(chatId, 'hello', null, res);

  if (!capturedRef.current) throw new Error('query() was not invoked');
  const captured = capturedRef.current as CapturedInvocation;
  return { events, results: captured.results, captured };
}

// Poll the permission registry until a prompt is registered for chatId, then
// resolve it. Avoids races where setTimeout fires before canUseTool has had a
// chance to emit the prompt SSE and add itself to the registry.
function scheduleResolve(
  chatId: string,
  decision: 'approve_once' | 'approve_session' | 'deny',
  timeoutMs = 1000,
): void {
  const startTs = Date.now();
  const tick = async () => {
    const { pendingPermissions, resolvePermissionResponse } = await import(
      '../server/permission-registry'
    );
    const chatMap = pendingPermissions.get(chatId);
    if (chatMap && chatMap.size > 0) {
      const promptId = Array.from(chatMap.keys())[0] as string;
      resolvePermissionResponse(chatId, promptId, decision);
      return;
    }
    if (Date.now() - startTs > timeoutMs) return;
    setTimeout(tick, 10);
  };
  setTimeout(tick, 10);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('canUseTool — ask-first approve_once', () => {
  it('emits permission_prompt SSE and returns allow after client approves', async () => {
    const chatId = await createChat();

    const { events, results } = await runWithScript(chatId, [
      {
        toolName: 'mcp__visual__save_creation',
        input: { html: '<p>x</p>', platform: 'instagram' },
        // While canUseTool is awaiting permission, resolve it on the next tick.
        beforeInvoke: () => {
          scheduleResolve(chatId, 'approve_once');
        },
      },
    ]);

    const prompts = events.filter((e) => e.event === 'permission_prompt');
    expect(prompts.length).toBe(1);
    expect(prompts[0].data.tool).toBe('save_creation');

    expect(results).toHaveLength(1);
    expect(results[0].result).toEqual({
      behavior: 'allow',
      updatedInput: { html: '<p>x</p>', platform: 'instagram' },
    });
  });
});

describe('canUseTool — approve_session', () => {
  it('adds tool to autoApproved so the next call skips the prompt', async () => {
    const chatId = await createChat();

    const script = [
      {
        toolName: 'mcp__visual__save_creation',
        input: { html: '<p>a</p>', platform: 'instagram' },
        beforeInvoke: () => {
          scheduleResolve(chatId, 'approve_session');
        },
      },
      // Second call in the same session — should NOT prompt.
      {
        toolName: 'mcp__visual__save_creation',
        input: { html: '<p>b</p>', platform: 'instagram' },
      },
    ];

    const { events, results } = await runWithScript(chatId, script);

    const prompts = events.filter((e) => e.event === 'permission_prompt');
    expect(prompts.length).toBe(1); // only the first call prompted

    expect(results).toHaveLength(2);
    expect(results[0].result).toMatchObject({ behavior: 'allow' });
    expect(results[1].result).toMatchObject({ behavior: 'allow' });
  });
});

describe('canUseTool — deny', () => {
  it('returns behavior=deny with an instructive message', async () => {
    const chatId = await createChat();

    const { results } = await runWithScript(chatId, [
      {
        toolName: 'mcp__visual__save_creation',
        input: { html: '<p>x</p>', platform: 'instagram' },
        beforeInvoke: () => {
          scheduleResolve(chatId, 'deny');
        },
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].result).toMatchObject({
      behavior: 'deny',
    });
    expect((results[0].result as any).message).toMatch(/declined/i);
    expect((results[0].result as any).message).toContain('save_creation');
  });
});

describe('canUseTool — trusted mode', () => {
  it('allows ask-first tools without emitting a prompt', async () => {
    const chatId = await createChat();

    const { events, results } = await runWithScript(
      chatId,
      [
        {
          toolName: 'mcp__visual__save_creation',
          input: { html: '<p>x</p>', platform: 'instagram' },
        },
      ],
      { trusted: true },
    );

    const prompts = events.filter((e) => e.event === 'permission_prompt');
    expect(prompts.length).toBe(0);

    expect(results[0].result).toMatchObject({ behavior: 'allow' });
  });
});

describe('canUseTool — always-allow', () => {
  it('allows list_voice_guide without prompting', async () => {
    const chatId = await createChat();

    const { events, results } = await runWithScript(chatId, [
      {
        toolName: 'mcp__brandDiscovery__list_voice_guide',
        input: {},
      },
    ]);

    const prompts = events.filter((e) => e.event === 'permission_prompt');
    expect(prompts.length).toBe(0);
    expect(results[0].result).toMatchObject({ behavior: 'allow' });
  });
});

describe('canUseTool — never-allow-by-default', () => {
  it('denies tools tiered never-allow-by-default', async () => {
    // Stub getToolPolicy to return a never-allow entry for 'blocked_tool'.
    // vi.spyOn works on ESM live bindings when the consumer imports the named
    // export directly (as agent.ts does).
    const capabilities = await import('../server/capabilities');
    const originalGetToolPolicy = capabilities.getToolPolicy;
    const spy = vi
      .spyOn(capabilities, 'getToolPolicy')
      .mockImplementation((name: string) => {
        if (name === 'blocked_tool') {
          return {
            name: 'blocked_tool',
            tier: 'never-allow-by-default',
            costProfile: 'free',
            responsibility: 'test',
            sideEffect: 'read',
          };
        }
        return originalGetToolPolicy(name);
      });

    try {
      const chatId = await createChat();
      const { results } = await runWithScript(chatId, [
        {
          toolName: 'mcp__whatever__blocked_tool',
          input: {},
        },
      ]);
      expect(results[0].result).toMatchObject({ behavior: 'deny' });
      expect((results[0].result as any).message).toMatch(/blocked/i);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('canUseTool — abort during wait', () => {
  it('resolves as deny when the chat signal aborts before the user responds', async () => {
    const chatId = await createChat();

    // We need to cancel the chat while canUseTool is waiting. Use the
    // cancelChat helper from agent.ts — it aborts all controllers for that
    // chat, which is the same signal canUseTool forwards into
    // waitForPermissionResponse.
    const agent = await import('../server/agent');
    const { results } = await runWithScript(chatId, [
      {
        toolName: 'mcp__visual__save_creation',
        input: { html: '<p>x</p>', platform: 'instagram' },
        beforeInvoke: () => {
          setTimeout(() => agent.cancelChat(chatId), 30);
        },
      },
    ]);

    // After abort, the wait resolves 'deny' → canUseTool returns
    // { behavior: 'deny' }
    expect(results[0].result).toMatchObject({ behavior: 'deny' });
  });
});
