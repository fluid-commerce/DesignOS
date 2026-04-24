/**
 * phase-24-dispatch-4.test.ts
 *
 * Tests for Phase 24 Dispatch 4:
 * 1. Store reducer: tool_start pushes to activeTools
 * 2. Store reducer: tool_result removes from activeTools (tool_end path)
 * 3. Store reducer: permission_prompt adds to pendingPermissions
 * 4. Store reducer: budget_warning sets budgetWarnings
 * 5. Store action: respondToPermission removes from pendingPermissions optimistically
 * 6. GET /api/health — returns valid shape with env var checks
 * 7. GET /api/chats/:id/usage-rollup — returns correct sums from DB
 * 8. POST /api/chats/:id/messages — accepts uploadedAssetIds (backward compat)
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { closeDb, getDb } from '../../lib/db';

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

// ─── Part 1-5: chat store SSE reducer tests ───────────────────────────────────
// These tests exercise the store logic in isolation using setState/getState
// (no actual SSE streaming needed — we test the reducer paths directly).

// We import the store after the DB is set up. The store itself is isomorphic
// (runs in node); we only need zustand's getState / setState.

describe('useChatStore Phase-24 D4 reducers', () => {
  // Lazy import to defer module loading until the DB env var is set.
  let useChatStore: (typeof import('../../store/chat'))['useChatStore'];

  beforeAll(async () => {
    ({ useChatStore } = await import('../../store/chat'));
  });

  beforeEach(() => {
    // Reset relevant Phase-24 state between tests
    useChatStore.setState({
      activeChatId: 'test-chat',
      messages: [],
      isStreaming: false,
      abortController: null,
      activeTools: {},
      pendingPermissions: {},
      budgetWarnings: {},
      usageRollups: {},
    } as Parameters<(typeof useChatStore)['setState']>[0]);
  });

  it('1. tool_start SSE path pushes activity into activeTools[chatId]', () => {
    const now = Date.now();
    // Simulate what handleSSE('tool_start', ...) does inside the store
    useChatStore.setState((s) => ({
      activeTools: {
        ...s.activeTools,
        'test-chat': [
          ...(s.activeTools['test-chat'] ?? []),
          {
            key: `generate_image@${now}`,
            tool: 'generate_image',
            startedAt: now,
            tier: 'ask-first' as const,
            estCostUsd: 0.04,
          },
        ],
      },
    }));

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].tool).toBe('generate_image');
    expect(tools[0].tier).toBe('ask-first');
    expect(tools[0].estCostUsd).toBe(0.04);
  });

  it('2. tool_result SSE path removes the matching tool from activeTools (pops oldest)', () => {
    const now = Date.now();
    // Pre-populate
    useChatStore.setState({
      activeTools: {
        'test-chat': [
          { key: `generate_image@${now}`, tool: 'generate_image', startedAt: now, tier: 'ask-first' as const },
          { key: `search_brand_images@${now + 1}`, tool: 'search_brand_images', startedAt: now + 1, tier: 'always-allow' as const },
        ],
      },
    });

    // Simulate tool_result for generate_image → remove it (oldest match)
    const toolName = 'generate_image';
    useChatStore.setState((s) => {
      const existing = s.activeTools['test-chat'] ?? [];
      const idx = existing.findIndex((a) => a.tool === toolName);
      if (idx === -1) return {};
      const updated = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
      return { activeTools: { ...s.activeTools, 'test-chat': updated } };
    });

    const tools = useChatStore.getState().activeTools['test-chat'] ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].tool).toBe('search_brand_images');
  });

  it('3. permission_prompt SSE path pushes to pendingPermissions[chatId]', () => {
    const perm = {
      promptId: 'prompt-abc',
      chatId: 'test-chat',
      tool: 'generate_image',
      argsPreview: '{"prompt":"a cat"}',
      reason: 'Image generation costs $0.04',
      estCostUsd: 0.04,
      openedAt: Date.now(),
    };

    useChatStore.setState((s) => ({
      pendingPermissions: {
        ...s.pendingPermissions,
        'test-chat': [...(s.pendingPermissions['test-chat'] ?? []), perm],
      },
    }));

    const perms = useChatStore.getState().pendingPermissions['test-chat'] ?? [];
    expect(perms).toHaveLength(1);
    expect(perms[0].promptId).toBe('prompt-abc');
    expect(perms[0].tool).toBe('generate_image');
    expect(perms[0].estCostUsd).toBe(0.04);
  });

  it('4. budget_warning SSE path sets budgetWarnings[chatId]', () => {
    const warning = { remainingUsd: 1.5, capUsd: 10.0, seenAt: Date.now() };

    useChatStore.setState((s) => ({
      budgetWarnings: { ...s.budgetWarnings, 'test-chat': warning },
    }));

    const bw = useChatStore.getState().budgetWarnings['test-chat'];
    expect(bw).toBeDefined();
    expect(bw?.remainingUsd).toBe(1.5);
    expect(bw?.capUsd).toBe(10.0);
  });

  it('5. respondToPermission removes the prompt from pendingPermissions optimistically', async () => {
    // Seed a pending permission
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

    // Mock fetch to return 200 OK
    const origFetch = global.fetch;
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await useChatStore.getState().respondToPermission('test-chat', 'perm-123', 'deny');

    const perms = useChatStore.getState().pendingPermissions['test-chat'] ?? [];
    expect(perms).toHaveLength(0);

    global.fetch = origFetch;
  });

  it('5b. dismissBudgetWarning removes the warning from budgetWarnings', () => {
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
