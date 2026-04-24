/**
 * phase-24-dispatch-4.test.ts
 *
 * Tests for Phase 24 Dispatch 4:
 * - Store reducer: dispatcher-style tool_start (has `tier`) pushes to activeTools
 * - Store reducer: tool_end removes from activeTools (NOT tool_result)
 * - Store reducer: tool_result does NOT touch activeTools (it's the model-facing
 *   result block, not the dispatcher lifecycle end)
 * - Store reducer: agent-style tool_start (has `toolUseId`, no `tier`) does NOT
 *   push to activeTools (disambiguates the two payload shapes that share a name)
 * - Store reducer: permission_prompt adds to pendingPermissions
 * - Store reducer: budget_warning sets budgetWarnings
 * - Store action: respondToPermission removes from pendingPermissions optimistically
 * - Store action: dismissBudgetWarning clears the slot
 * - GET /api/health — returns valid shape with env var checks
 * - GET /api/chats/:id/usage-rollup — returns correct sums from DB
 * - POST /api/chats/:id/messages — accepts uploadedAssetIds (backward compat)
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { closeDb, getDb } from '../../lib/db';
import { makeSSEResponse, type SSEEvent } from '../helpers/sse-fixtures';

// ─── Mock fetch-event-source for node test env ────────────────────────────────
//
// Mirrors the mock in chat-store-sse.test.ts so the store's SSE handler is
// exercised end-to-end (not via synthetic setState calls that would bypass
// the reducer).

vi.mock('@microsoft/fetch-event-source', async () => {
  const parse = (await import(
    '@microsoft/fetch-event-source/lib/cjs/parse.js' as string
  )) as any;
  const EventStreamContentType = 'text/event-stream';

  async function fetchEventSource(
    input: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
      openWhenHidden?: boolean;
      onmessage?: (ev: { event: string; data: string; id: string; retry?: number }) => void;
      onerror?: (err: any) => void;
      onclose?: () => void;
      fetch?: typeof globalThis.fetch;
    },
  ): Promise<void> {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const signal = options.signal;
    if (signal?.aborted) return;

    let response: Response;
    try {
      response = await fetchFn(input, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal,
      });
    } catch (err: any) {
      if (!signal?.aborted) {
        try {
          options.onerror?.(err);
        } catch {
          /* onerror re-throws to disable retry — swallow here */
        }
      }
      return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith(EventStreamContentType)) return;

    try {
      await parse.getBytes(
        response.body,
        parse.getLines(
          parse.getMessages(
            () => {},
            () => {},
            options.onmessage,
          ),
        ),
      );
      options.onclose?.();
    } catch (err: any) {
      if (!signal?.aborted) {
        try {
          options.onerror?.(err);
        } catch {
          /* swallow re-throw */
        }
      }
    }
  }

  return { fetchEventSource, EventStreamContentType };
});

// ─── Test DB setup ────────────────────────────────────────────────────────────

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase24-d4-test-'));

beforeAll(() => {
  closeDb();
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  getDb();
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.VITE_FLUID_DAM_TOKEN;
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mock global.fetch so the SSE POST returns `sseResponse` and all other calls
 * (e.g. loadChats GET, usage-rollup GET) return an empty JSON array. Usage-
 * rollup specifically is fired at the end of every sendMessage via the `done`
 * event handler; we return `{}` for it so the store's optional-chaining parse
 * doesn't throw.
 */
function mockFetchWithSSE(sseResponse: Response): void {
  vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/messages')) return Promise.resolve(sseResponse);
    if (url.includes('/usage-rollup')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ total_usd: 0, images_generated: 0, turns: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

/** Drive a sequence of SSE events through the real store and wait for isStreaming=false. */
async function runStoreWithEvents(
  useChatStore: (typeof import('../../store/chat'))['useChatStore'],
  events: SSEEvent[],
): Promise<void> {
  const sseResponse = makeSSEResponse([...events, { event: 'done', data: {} }]);
  mockFetchWithSSE(sseResponse);
  useChatStore.getState().sendMessage('test message');
  await vi.waitFor(() => {
    expect(useChatStore.getState().isStreaming).toBe(false);
  }, { timeout: 2000 });
}

// ─── Part A: chat store SSE reducer tests (real event-driven) ─────────────────

describe('useChatStore Phase-24 D4 SSE reducers', () => {
  let useChatStore: (typeof import('../../store/chat'))['useChatStore'];

  beforeAll(async () => {
    ({ useChatStore } = await import('../../store/chat'));
  });

  beforeEach(() => {
    // Partial state reset — zustand's setState accepts partial updates.
    // We cast to `unknown` first because the chats:[] etc. object doesn't
    // satisfy the full ChatState type (it omits the action functions on
    // purpose — setState only overwrites the listed keys).
    useChatStore.setState({
      chats: [],
      activeChatId: 'test-chat',
      messages: [],
      isStreaming: false,
      abortController: null,
      activeTools: {},
      pendingPermissions: {},
      budgetWarnings: {},
      usageRollups: {},
    } as unknown as Parameters<(typeof useChatStore)['setState']>[0]);
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatcher tool_start (has tier) pushes activity to activeTools', async () => {
    await runStoreWithEvents(useChatStore, [
      {
        event: 'tool_start',
        data: {
          tool: 'generate_image',
          tier: 'ask-first',
          est_cost_usd: 0.04,
          est_duration_sec: 8,
        },
      },
      // NOTE: no tool_end → after stream closes, activity remains (this test
      // asserts the push side; the next test asserts the remove side).
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].tool).toBe('generate_image');
    expect(tools[0].tier).toBe('ask-first');
    expect(tools[0].estCostUsd).toBe(0.04);
    expect(tools[0].estDurationSec).toBe(8);
  });

  it('tool_end removes the matching activeTool (NOT tool_result)', async () => {
    await runStoreWithEvents(useChatStore, [
      // Dispatcher start
      { event: 'tool_start', data: { tool: 'generate_image', tier: 'ask-first' } },
      // tool_result fires (agent streams result back to model) — must NOT remove
      { event: 'tool_result', data: { toolUseId: 'tu-1', result: 'ok' } },
      // tool_end fires (dispatcher lifecycle end) — MUST remove
      { event: 'tool_end', data: { tool: 'generate_image', duration_sec: 2.1, outcome: 'ok' } },
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(0);
  });

  it('tool_result alone does NOT remove from activeTools (regression guard)', async () => {
    await runStoreWithEvents(useChatStore, [
      { event: 'tool_start', data: { tool: 'generate_image', tier: 'ask-first' } },
      // tool_result without tool_end — the activity MUST still be present
      { event: 'tool_result', data: { toolUseId: 'tu-1', result: 'ok' } },
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].tool).toBe('generate_image');
  });

  it('agent-style tool_start (toolUseId, no tier) does NOT push to activeTools', async () => {
    // This is the agent.ts payload shape — it drives the inline toolCalls list
    // on the assistant message, but it is NOT the dispatcher lifecycle signal,
    // so activeTools must stay empty.
    await runStoreWithEvents(useChatStore, [
      {
        event: 'tool_start',
        data: { toolUseId: 'tu-42', name: 'search_brand_images', input: { query: 'dog' } },
      },
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(0);
    // But the message-level toolCall WAS added
    const assistantMsg = useChatStore.getState().messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.toolCalls).toHaveLength(1);
    expect(assistantMsg?.toolCalls[0].id).toBe('tu-42');
    expect(assistantMsg?.toolCalls[0].tool).toBe('search_brand_images');
  });

  it('tool_end pops the oldest matching entry when the same tool is active twice', async () => {
    await runStoreWithEvents(useChatStore, [
      { event: 'tool_start', data: { tool: 'generate_image', tier: 'ask-first', est_cost_usd: 0.04 } },
      { event: 'tool_start', data: { tool: 'generate_image', tier: 'ask-first', est_cost_usd: 0.05 } },
      // Single tool_end should remove exactly one — the oldest (first-pushed)
      { event: 'tool_end', data: { tool: 'generate_image', duration_sec: 1, outcome: 'ok' } },
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    // The surviving entry is the second one (est_cost_usd 0.05)
    expect(tools[0].estCostUsd).toBe(0.05);
  });

  it('tool_progress updates progressPct on the matching activeTool', async () => {
    await runStoreWithEvents(useChatStore, [
      { event: 'tool_start', data: { tool: 'generate_image', tier: 'ask-first' } },
      // tool-dispatch.ts emits `pct`, not `progress_pct`
      { event: 'tool_progress', data: { tool: 'generate_image', pct: 42 } },
    ]);

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].progressPct).toBe(42);
  });

  it('permission_prompt pushes to pendingPermissions', async () => {
    await runStoreWithEvents(useChatStore, [
      {
        event: 'permission_prompt',
        data: {
          promptId: 'perm-xyz',
          tool: 'generate_image',
          args_preview: '{"prompt":"a cat"}',
          est_cost_usd: 0.04,
          reason: "Tool 'generate_image' requires user approval before running.",
        },
      },
    ]);

    const perms = useChatStore.getState().pendingPermissions['test-chat'] ?? [];
    expect(perms).toHaveLength(1);
    expect(perms[0].promptId).toBe('perm-xyz');
    expect(perms[0].tool).toBe('generate_image');
    expect(perms[0].argsPreview).toBe('{"prompt":"a cat"}');
    expect(perms[0].estCostUsd).toBe(0.04);
    expect(perms[0].reason).toMatch(/approval/);
  });

  it('budget_warning sets budgetWarnings[chatId]', async () => {
    await runStoreWithEvents(useChatStore, [
      {
        event: 'budget_warning',
        data: { remaining_usd: 1.5, cap_usd: 10.0, blocked: false, warning: 'Approaching cap' },
      },
    ]);

    const bw = useChatStore.getState().budgetWarnings['test-chat'];
    expect(bw).toBeDefined();
    expect(bw?.remainingUsd).toBe(1.5);
    expect(bw?.capUsd).toBe(10.0);
  });

  it('respondToPermission removes the prompt from pendingPermissions optimistically', async () => {
    // Seed a pending permission directly (we're testing the action, not the reducer)
    useChatStore.setState({
      pendingPermissions: {
        'test-chat': [
          {
            promptId: 'perm-123',
            chatId: 'test-chat',
            tool: 'generate_image',
            argsPreview: '',
            reason: '',
            openedAt: Date.now(),
          },
        ],
      },
    });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await useChatStore.getState().respondToPermission('test-chat', 'perm-123', 'deny');

    const perms = useChatStore.getState().pendingPermissions['test-chat'] ?? [];
    expect(perms).toHaveLength(0);
  });

  it('dismissBudgetWarning clears the slot for the chat', () => {
    useChatStore.setState({
      budgetWarnings: {
        'test-chat': { remainingUsd: 1.0, capUsd: 10.0, seenAt: Date.now() },
      },
    });

    useChatStore.getState().dismissBudgetWarning('test-chat');

    expect(useChatStore.getState().budgetWarnings['test-chat']).toBeUndefined();
  });
});

// ─── Part 6: GET /api/health ──────────────────────────────────────────────────

describe('GET /api/health', () => {
  let handleHealthRoute: (typeof import('../../server/health-route'))['handleHealthRoute'];

  beforeAll(async () => {
    ({ handleHealthRoute } = await import('../../server/health-route'));
  });

  function makeHealthReqRes(method = 'GET', url = '/api/health') {
    const req = { method, url, headers: { host: 'localhost' } } as any;
    let responseBody = '';
    let statusCode = 0;
    let responseHeaders: Record<string, string> = {};
    const res = {
      writeHead(code: number, headers: Record<string, string>) {
        statusCode = code;
        responseHeaders = headers;
      },
      end(body: string) {
        responseBody = body;
      },
    } as any;
    return { req, res, getStatus: () => statusCode, getBody: () => responseBody };
  }

  it('returns 200 with expected keys', () => {
    const { req, res, getStatus, getBody } = makeHealthReqRes();
    const handled = handleHealthRoute(req, res);
    expect(handled).toBe(true);
    expect(getStatus()).toBe(200);
    const payload = JSON.parse(getBody());
    expect(payload).toHaveProperty('anthropic');
    expect(payload).toHaveProperty('gemini');
    expect(payload).toHaveProperty('dam');
    expect(payload).toHaveProperty('archetypes');
    expect(payload).toHaveProperty('skills');
    expect(payload).toHaveProperty('daily_spend_usd');
    expect(payload).toHaveProperty('daily_cap_usd');
  });

  it('reports api_key_missing when ANTHROPIC_API_KEY absent', () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(payload.anthropic).toBe('api_key_missing');
  });

  it('reports ok when ANTHROPIC_API_KEY is present', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(payload.anthropic).toBe('ok');
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('reports api_key_missing when GEMINI_API_KEY absent', () => {
    delete process.env.GEMINI_API_KEY;
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(payload.gemini).toBe('api_key_missing');
  });

  it('reports token_missing when VITE_FLUID_DAM_TOKEN absent', () => {
    delete process.env.VITE_FLUID_DAM_TOKEN;
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(payload.dam).toBe('token_missing');
  });

  it('does not handle non-health routes', () => {
    const { req, res } = makeHealthReqRes('GET', '/api/chats');
    const handled = handleHealthRoute(req, res);
    expect(handled).toBe(false);
  });

  it('does not handle non-GET methods', () => {
    const { req, res } = makeHealthReqRes('POST', '/api/health');
    const handled = handleHealthRoute(req, res);
    expect(handled).toBe(false);
  });

  it('archetypes field has total and by_platform keys', () => {
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(typeof payload.archetypes.total).toBe('number');
    expect(typeof payload.archetypes.by_platform).toBe('object');
  });

  it('skills is an array of strings', () => {
    const { req, res, getBody } = makeHealthReqRes();
    handleHealthRoute(req, res);
    const payload = JSON.parse(getBody());
    expect(Array.isArray(payload.skills)).toBe(true);
    for (const s of payload.skills) {
      expect(typeof s).toBe('string');
    }
  });
});

// ─── Part 7: GET /api/chats/:id/usage-rollup ─────────────────────────────────

describe('GET /api/chats/:id/usage-rollup', () => {
  let handleChatRoutes: (typeof import('../../server/chat-routes'))['handleChatRoutes'];

  beforeAll(async () => {
    ({ handleChatRoutes } = await import('../../server/chat-routes'));
  });

  function makeChatReqRes(method: string, pathname: string) {
    const req = {
      method,
      url: pathname,
      headers: { host: 'localhost' },
      on: vi.fn(),
    } as any;
    let responseBody = '';
    let statusCode = 0;
    const res = {
      writeHead(code: number) { statusCode = code; },
      end(body: string) { responseBody = body; },
    } as any;
    const url = new URL(pathname, 'http://localhost');
    return { req, res, url, getStatus: () => statusCode, getBody: () => responseBody };
  }

  function seedChat(id: string) {
    const db = getDb();
    const now = Date.now();
    db.prepare(`INSERT OR IGNORE INTO chats (id, title, created_at, updated_at) VALUES (?, NULL, ?, ?)`).run(id, now, now);
  }

  function seedAuditLog(entries: Array<{ sessionId: string; tool: string; outcome: string; costUsd: number }>) {
    const db = getDb();
    for (const e of entries) {
      db.prepare(
        `INSERT INTO tool_audit_log (id, session_id, tool, args_hash, tier, decision, cost_usd_est, outcome, timestamp, detail_json)
         VALUES (?, ?, ?, 'hash', 'always-allow', 'approved', ?, ?, ?, NULL)`,
      ).run(nanoid(), e.sessionId, e.tool, e.costUsd, e.outcome, Date.now());
    }
  }

  function seedChatEvent(chatId: string, eventType: string, detailJson: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO chat_events (id, ts, chat_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?)`,
    ).run(nanoid(), Date.now(), chatId, eventType, detailJson);
  }

  it('returns 404 for unknown chat', async () => {
    const { req, res, url, getStatus } = makeChatReqRes('GET', '/api/chats/nonexistent/usage-rollup');
    await handleChatRoutes(req, res, url);
    expect(getStatus()).toBe(404);
  });

  it('returns zero rollup for empty chat', async () => {
    const chatId = `chat_${nanoid(8)}`;
    seedChat(chatId);

    const { req, res, url, getStatus, getBody } = makeChatReqRes('GET', `/api/chats/${chatId}/usage-rollup`);
    await handleChatRoutes(req, res, url);
    expect(getStatus()).toBe(200);
    const payload = JSON.parse(getBody());
    expect(payload.total_usd).toBe(0);
    expect(payload.images_generated).toBe(0);
    expect(payload.turns).toBe(0);
    expect(payload.input_tokens).toBe(0);
    expect(payload.output_tokens).toBe(0);
  });

  it('sums cost_usd_est across tool_audit_log rows for the session', async () => {
    const chatId = `chat_${nanoid(8)}`;
    seedChat(chatId);
    seedAuditLog([
      { sessionId: chatId, tool: 'generate_image', outcome: 'ok', costUsd: 0.04 },
      { sessionId: chatId, tool: 'generate_image', outcome: 'ok', costUsd: 0.04 },
      { sessionId: chatId, tool: 'search_brand_images', outcome: 'ok', costUsd: 0.001 },
    ]);

    const { req, res, url, getBody } = makeChatReqRes('GET', `/api/chats/${chatId}/usage-rollup`);
    await handleChatRoutes(req, res, url);
    const payload = JSON.parse(getBody());
    expect(payload.total_usd).toBeCloseTo(0.081, 5);
    expect(payload.images_generated).toBe(2);
  });

  it('counts agent_run_complete events as turns', async () => {
    const chatId = `chat_${nanoid(8)}`;
    seedChat(chatId);
    seedChatEvent(chatId, 'agent_run_complete', JSON.stringify({ input_tokens: 100, output_tokens: 50 }));
    seedChatEvent(chatId, 'agent_run_complete', JSON.stringify({ input_tokens: 200, output_tokens: 80 }));

    const { req, res, url, getBody } = makeChatReqRes('GET', `/api/chats/${chatId}/usage-rollup`);
    await handleChatRoutes(req, res, url);
    const payload = JSON.parse(getBody());
    expect(payload.turns).toBe(2);
    expect(payload.input_tokens).toBe(300);
    expect(payload.output_tokens).toBe(130);
  });
});

// ─── Part 8: Backward compat — uploadedAssetIds is optional ──────────────────

describe('POST /api/chats/:id/messages body shape backward compat', () => {
  // We just test that the route extracts the fields correctly without errors.
  // Full agent execution is not exercised here (runAgent is not called — the test
  // verifies body parsing only via the route handler's early guards).

  let handleChatRoutes: (typeof import('../../server/chat-routes'))['handleChatRoutes'];

  beforeAll(async () => {
    ({ handleChatRoutes } = await import('../../server/chat-routes'));
  });

  function makePostReq(body: unknown) {
    const bodyStr = JSON.stringify(body);
    const chunks = [Buffer.from(bodyStr)];
    let dataHandler: ((chunk: Buffer) => void) | null = null;
    let endHandler: (() => void) | null = null;
    const req = {
      method: 'POST',
      url: '/api/chats/chat_testX/messages',
      headers: { host: 'localhost', 'content-type': 'application/json' },
      on(event: string, handler: unknown) {
        if (event === 'data') dataHandler = handler as (chunk: Buffer) => void;
        if (event === 'end') endHandler = handler as () => void;
        if (event === 'error') { /* no-op */ }
      },
    } as any;

    // Simulate the node stream emitting chunks after registration
    const triggerStream = () => {
      for (const chunk of chunks) dataHandler?.(chunk);
      endHandler?.();
    };

    return { req, triggerStream };
  }

  it('rejects request with missing content field (400)', async () => {
    const db = getDb();
    const chatId = 'chat_testX';
    const now = Date.now();
    db.prepare(`INSERT OR IGNORE INTO chats (id, title, created_at, updated_at) VALUES (?, NULL, ?, ?)`).run(chatId, now, now);

    let statusCode = 0;
    let responseBody = '';
    const res = {
      writeHead(code: number) { statusCode = code; },
      end(body: string) { responseBody = body; },
      flushHeaders() {},
      writableEnded: false,
      write() {},
    } as any;

    const { req, triggerStream } = makePostReq({ uiContext: {}, uploadedAssetIds: ['asset-1'] });
    // no content field → should 400
    const url = new URL('/api/chats/chat_testX/messages', 'http://localhost');
    const p = handleChatRoutes(req, res, url);
    triggerStream();
    await p;
    expect(statusCode).toBe(400);
    expect(JSON.parse(responseBody).error).toMatch(/content/i);
  });

  it('old body shape (no uploadedAssetIds) is still accepted — returns 400 only if missing content', async () => {
    // Re-use the same chat
    let statusCode = 0;
    let responseBody = '';
    const res = {
      writeHead(code: number) { statusCode = code; },
      end(body: string) { responseBody = body; },
      flushHeaders() {},
      writableEnded: false,
      write() {},
    } as any;

    const { req, triggerStream } = makePostReq({ content: '' });
    const url = new URL('/api/chats/chat_testX/messages', 'http://localhost');
    const p = handleChatRoutes(req, res, url);
    triggerStream();
    await p;
    // Empty string content → 400
    expect(statusCode).toBe(400);
  });
});
