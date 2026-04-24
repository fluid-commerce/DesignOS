/**
 * phase-24-dispatch-2.test.ts
 *
 * Tests for tool-dispatch wrapper + permission-registry.
 *
 * NOTE (Phase 26): permission gating moved out of dispatchTool into the SDK's
 * canUseTool callback (see agent.ts). The registry (waitForPermissionResponse
 * / resolvePermissionResponse) now lives in permission-registry.ts and is
 * tested here directly. dispatchTool itself no longer emits permission_prompt
 * — every call that reaches it is already approved (or is always-allow).
 *
 *  1. Always-allow flow: outcome='ok', audit row decision='allowed', no permission_prompt
 *  2. Ask-first calls reach dispatchTool approved — executor always runs
 *  3. waitForPermissionResponse emits permission_prompt + resolves on approve_once
 *  4. waitForPermissionResponse returns 'deny' on deny
 *  5. Permission timeout: resolves as 'deny' after timeoutMs
 *  6. Cost cap hard block at cap
 *  7. Cost cap soft warn at 80%
 *  8. Unknown tool policy: treated as always-allow, warning logged
 *  9. resolvePermissionResponse returns false for stale promptId
 * 10. HTTP endpoint: POST /api/chats/:id/permission-response
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import { closeDb, getDb } from '../../lib/db';
import { writeToolAuditLog } from '../../server/db-api';
import {
  dispatchTool,
  emitToolProgress,
} from '../../server/tool-dispatch';
import {
  resolvePermissionResponse,
  waitForPermissionResponse,
} from '../../server/permission-registry';
import type { DispatchContext } from '../../server/tool-dispatch';
import { handleChatRoutes } from '../../server/chat-routes';
import type { IncomingMessage } from 'node:http';
import { nanoid } from 'nanoid';

// ─── Test DB setup ─────────────────────────────────────────────────────────────

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase24-d2-test-'));

beforeAll(() => {
  closeDb();
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  getDb();
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  delete process.env.FLUID_DAILY_COST_CAP_USD;
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── SSE collector mock ────────────────────────────────────────────────────────

interface CollectedEvent {
  event: string;
  data: unknown;
}

function makeMockRes(): { res: ServerResponse; events: CollectedEvent[] } {
  const events: CollectedEvent[] = [];
  const res = {
    write(chunk: string | Buffer) {
      const str = typeof chunk === 'string' ? chunk : chunk.toString();
      // Parse SSE format: "event: X\ndata: Y\n\n"
      const eventMatch = str.match(/^event: ([^\n]+)\ndata: ([^\n]+)/);
      if (eventMatch) {
        try {
          events.push({ event: eventMatch[1], data: JSON.parse(eventMatch[2]) });
        } catch {
          events.push({ event: eventMatch[1], data: eventMatch[2] });
        }
      }
      return true;
    },
    writableEnded: false,
    end() {},
    writeHead() {},
  } as unknown as ServerResponse;
  return { res, events };
}

function makeCtx(
  overrides: Partial<DispatchContext> & { res: ServerResponse },
): DispatchContext {
  return {
    chatId: `chat_${nanoid(8)}`,
    signal: new AbortController().signal,
    autoApproved: new Set<string>(),
    trusted: false,
    ...overrides,
  };
}

// ─── 1. Always-allow flow ──────────────────────────────────────────────────────

describe('always-allow flow', () => {
  it('runs executor, outcome=ok, audit row has decision=allowed, no permission_prompt', async () => {
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res });
    let executed = false;

    const result = await dispatchTool(
      'list_voice_guide',
      {},
      ctx,
      async () => {
        executed = true;
        return 'ok-result';
      },
    );

    expect(result.outcome).toBe('ok');
    expect(result.result).toBe('ok-result');
    expect(executed).toBe(true);

    // No permission_prompt should have been emitted
    const promptEvents = events.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents).toHaveLength(0);

    // tool_start and tool_end should be present
    const startEvents = events.filter((e) => e.event === 'tool_start');
    expect(startEvents).toHaveLength(1);
    const endEvents = events.filter((e) => e.event === 'tool_end');
    expect(endEvents).toHaveLength(1);
    expect((endEvents[0].data as any).outcome).toBe('ok');

    // Audit row should exist
    const db = getDb();
    const row = db
      .prepare(
        'SELECT decision, outcome FROM tool_audit_log WHERE session_id = ? AND tool = ? ORDER BY timestamp DESC LIMIT 1',
      )
      .get(ctx.chatId, 'list_voice_guide') as
      | { decision: string; outcome: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.decision).toBe('allowed');
    expect(row!.outcome).toBe('ok');
  });
});

// ─── 2. Ask-first reaches dispatchTool approved ───────────────────────────────

describe('ask-first tool reaches dispatchTool', () => {
  it('runs executor without emitting permission_prompt — gating is upstream now', async () => {
    // In the post-Phase-26 flow, ask-first permission is resolved upstream by
    // the SDK's canUseTool callback. By the time dispatchTool sees the call,
    // it's already approved. dispatchTool must NOT emit a prompt here.
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });
    let executed = false;

    const result = await dispatchTool(
      'save_creation',
      { html: '<p>test</p>', platform: 'instagram' },
      ctx,
      async () => {
        executed = true;
        return 'saved';
      },
    );

    expect(result.outcome).toBe('ok');
    expect(executed).toBe(true);
    const promptEvents = events.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents).toHaveLength(0);

    // Audit row decision=approved (ask-first tier)
    const db = getDb();
    const row = db
      .prepare(
        'SELECT decision FROM tool_audit_log WHERE session_id = ? AND tool = ? ORDER BY timestamp DESC LIMIT 1',
      )
      .get(ctx.chatId, 'save_creation') as { decision: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.decision).toBe('approved');
  });
});

// ─── 3. waitForPermissionResponse — approve_once ──────────────────────────────

describe('waitForPermissionResponse approve_once', () => {
  it('emits permission_prompt and resolves when registry is resolved', async () => {
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });

    const waitPromise = waitForPermissionResponse(
      ctx,
      'save_creation',
      '{"html":"<p>test</p>"}',
      undefined,
    );

    // Give the emit a tick
    await new Promise((r) => setTimeout(r, 10));

    const promptEvents = events.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents.length).toBeGreaterThanOrEqual(1);
    const promptId = (promptEvents[0].data as any).promptId as string;
    expect(typeof promptId).toBe('string');

    const resolved = resolvePermissionResponse(ctx.chatId, promptId, 'approve_once');
    expect(resolved).toBe(true);

    const decision = await waitPromise;
    expect(decision).toBe('approve_once');
  });
});

// ─── 4. waitForPermissionResponse — deny ──────────────────────────────────────

describe('waitForPermissionResponse deny', () => {
  it('resolves as deny when registry is told deny', async () => {
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });

    const waitPromise = waitForPermissionResponse(
      ctx,
      'save_creation',
      '{}',
      undefined,
    );

    await new Promise((r) => setTimeout(r, 10));

    const promptEvents = events.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents.length).toBeGreaterThanOrEqual(1);
    const promptId = (promptEvents[0].data as any).promptId as string;

    resolvePermissionResponse(ctx.chatId, promptId, 'deny');
    const decision = await waitPromise;
    expect(decision).toBe('deny');
  });
});

// ─── 5. Permission timeout ────────────────────────────────────────────────────

describe('permission timeout', () => {
  it('resolves as denied after timeoutMs without any response', async () => {
    const { res } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });

    const start = Date.now();
    const decision = await waitForPermissionResponse(ctx, 'save_creation', '{}', undefined, 80);
    const elapsed = Date.now() - start;

    expect(decision).toBe('deny');
    expect(elapsed).toBeGreaterThanOrEqual(50);
    expect(elapsed).toBeLessThan(500);
  }, 2000);
});

// ─── 6. Cost cap hard block ───────────────────────────────────────────────────

describe('cost cap hard block', () => {
  it('blocks execution when daily spend + est would exceed cap', async () => {
    const chatId = `chat_cap_${nanoid(6)}`;
    const { res, events } = makeMockRes();
    const ctrl = new AbortController();
    const ctx: DispatchContext = {
      chatId,
      res,
      signal: ctrl.signal,
      autoApproved: new Set(),
      trusted: true,
    };

    // Seed spend: 9.99 USD today
    const startTs = Date.now();
    writeToolAuditLog({
      sessionId: chatId,
      tool: 'generate_image',
      argsHash: 'cap-test-seed',
      tier: 'ask-first',
      decision: 'approved',
      costUsdEst: 9.99,
      outcome: 'ok',
    });

    // Set cap to 10.00
    process.env.FLUID_DAILY_COST_CAP_USD = '10.00';

    let executed = false;
    const result = await dispatchTool(
      'generate_image',
      { prompt: 'test' },
      ctx,
      async () => {
        executed = true;
        return 'should-not-reach';
      },
      { estCostUsd: 0.04 },
    );

    expect(result.outcome).toBe('capped');
    expect(executed).toBe(false);

    // budget_warning with blocked=true should have been emitted
    const warnEvents = events.filter((e) => e.event === 'budget_warning');
    expect(warnEvents.length).toBeGreaterThanOrEqual(1);
    const blockWarn = warnEvents.find((e) => (e.data as any).blocked === true);
    expect(blockWarn).toBeDefined();
  });
});

// ─── 7. Cost cap soft warn at 80% ────────────────────────────────────────────

describe('cost cap soft warn at 80%', () => {
  it('emits budget_warning but still runs executor', async () => {
    const chatId = `chat_soft_${nanoid(6)}`;
    const { res, events } = makeMockRes();
    const ctrl = new AbortController();
    const ctx: DispatchContext = {
      chatId,
      res,
      signal: ctrl.signal,
      autoApproved: new Set(),
      trusted: true,
    };

    // Use a large, unique cap so prior test seeds don't interfere.
    // Seed spend at exactly 80% of the cap.
    const cap = 10_000.00; // $10,000 so prior test data is negligible
    const targetSpend = cap * 0.80;
    process.env.FLUID_DAILY_COST_CAP_USD = String(cap);

    // Record current daily spend before seeding so we can compute delta needed.
    const { dailySpendUsd } = await import('../../server/db-api');
    const existingSpend = dailySpendUsd();
    const needed = targetSpend - existingSpend;

    if (needed > 0) {
      writeToolAuditLog({
        sessionId: chatId,
        tool: 'generate_image',
        argsHash: 'soft-warn-seed',
        tier: 'ask-first',
        decision: 'approved',
        costUsdEst: needed,
        outcome: 'ok',
      });
    }

    let executed = false;
    const result = await dispatchTool(
      'generate_image',
      { prompt: 'soft warn test' },
      ctx,
      async () => {
        executed = true;
        return 'generated';
      },
      { estCostUsd: 0.04 },
    );

    // Should still run (spend is at 80% exactly, not over cap)
    expect(result.outcome).toBe('ok');
    expect(executed).toBe(true);

    // budget_warning with blocked=false should have been emitted
    const warnEvents = events.filter((e) => e.event === 'budget_warning');
    expect(warnEvents.length).toBeGreaterThanOrEqual(1);
    const softWarn = warnEvents.find((e) => (e.data as any).blocked === false);
    expect(softWarn).toBeDefined();
  });
});

// ─── 8. autoApproved session state (moved to canUseTool — phase-26 test) ─────
//
// Phase 26: `approve_session` side-effect (adding toolName to
// ctx.autoApproved) now lives in the canUseTool callback in agent.ts, not in
// dispatchTool. See phase-26-canusetool.test.ts for coverage.

// ─── 9. Unknown tool policy ───────────────────────────────────────────────────

describe('unknown tool policy', () => {
  it('treats unknown tool as always-allow and still runs executor', async () => {
    const { res } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });
    let executed = false;

    const result = await dispatchTool(
      'tool_that_does_not_exist_xyz',
      { foo: 'bar' },
      ctx,
      async () => {
        executed = true;
        return 'fallback-result';
      },
    );

    expect(result.outcome).toBe('ok');
    expect(executed).toBe(true);
  });
});

// ─── 10. resolvePermissionResponse returns false for stale promptId ───────────

describe('resolvePermissionResponse stale promptId', () => {
  it('returns false when promptId is unknown', () => {
    const result = resolvePermissionResponse('chat_nonexistent', 'stale_prompt_id_xyz', 'deny');
    expect(result).toBe(false);
  });

  it('returns false after prompt has already been resolved', async () => {
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res, trusted: false });

    const waitPromise = waitForPermissionResponse(
      ctx,
      'save_creation',
      '{}',
      undefined,
    );
    await new Promise((r) => setTimeout(r, 10));

    const promptEvents = events.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents.length).toBeGreaterThan(0);
    const promptId = (promptEvents[0].data as any).promptId as string;

    // Resolve once — should succeed
    const first = resolvePermissionResponse(ctx.chatId, promptId, 'deny');
    expect(first).toBe(true);

    // Resolve again — should be stale (already cleaned up from the map)
    const second = resolvePermissionResponse(ctx.chatId, promptId, 'deny');
    expect(second).toBe(false);

    await waitPromise;
  });
});

// ─── 11. HTTP endpoint tests ──────────────────────────────────────────────────

describe('POST /api/chats/:id/permission-response endpoint', () => {
  let testChatId: string;

  beforeAll(() => {
    // Create a chat row for the endpoint tests
    const db = getDb();
    testChatId = `chat_perm_${nanoid(6)}`;
    const now = Date.now();
    db.prepare(
      'INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(testChatId, 'Perm test chat', now, now);
  });

  function makeReq(
    method: string,
    pathname: string,
    body: unknown,
  ): IncomingMessage {
    const bodyStr = body != null ? JSON.stringify(body) : '';
    const req = {
      method,
      url: pathname,
      on(event: string, cb: (...args: unknown[]) => void) {
        if (event === 'data') cb(bodyStr);
        if (event === 'end') cb();
        return req;
      },
    } as unknown as IncomingMessage;
    return req;
  }

  function makeResponseCapture(): { res: ServerResponse; status: number; body: unknown } {
    const capture = { status: 200, body: {} as unknown };
    const res = {
      writeHead(s: number) {
        capture.status = s;
      },
      end(data?: string) {
        if (data) {
          try {
            capture.body = JSON.parse(data);
          } catch {
            capture.body = data;
          }
        }
      },
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;
    return { res, status: capture.status, body: capture.body };
  }

  it('returns 404 when chat does not exist', async () => {
    const { res, ...capture } = makeResponseCapture();
    const captureRef = capture;
    // Override end to capture final status
    let finalStatus = 200;
    let finalBody: unknown = {};
    const mockRes = {
      writeHead(s: number) {
        finalStatus = s;
      },
      end(data?: string) {
        if (data) {
          try {
            finalBody = JSON.parse(data);
          } catch {
            finalBody = data;
          }
        }
      },
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;

    const req = makeReq('POST', '/api/chats/nonexistent_chat/permission-response', {
      promptId: 'test',
      decision: 'deny',
    });
    const url = new URL('http://localhost/api/chats/nonexistent_chat/permission-response');
    const handled = await handleChatRoutes(req, mockRes, url);
    expect(handled).toBe(true);
    expect(finalStatus).toBe(404);
  });

  it('returns 400 for missing promptId', async () => {
    let finalStatus = 200;
    let finalBody: unknown = {};
    const mockRes = {
      writeHead(s: number) {
        finalStatus = s;
      },
      end(data?: string) {
        if (data) {
          try {
            finalBody = JSON.parse(data);
          } catch {
            finalBody = data;
          }
        }
      },
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;

    const req = makeReq('POST', `/api/chats/${testChatId}/permission-response`, {
      decision: 'deny',
    });
    const url = new URL(`http://localhost/api/chats/${testChatId}/permission-response`);
    const handled = await handleChatRoutes(req, mockRes, url);
    expect(handled).toBe(true);
    expect(finalStatus).toBe(400);
  });

  it('returns 400 for invalid decision', async () => {
    let finalStatus = 200;
    const mockRes = {
      writeHead(s: number) {
        finalStatus = s;
      },
      end() {},
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;

    const req = makeReq('POST', `/api/chats/${testChatId}/permission-response`, {
      promptId: 'some-prompt',
      decision: 'maybe',
    });
    const url = new URL(`http://localhost/api/chats/${testChatId}/permission-response`);
    const handled = await handleChatRoutes(req, mockRes, url);
    expect(handled).toBe(true);
    expect(finalStatus).toBe(400);
  });

  it('returns 404 for stale promptId', async () => {
    let finalStatus = 200;
    const mockRes = {
      writeHead(s: number) {
        finalStatus = s;
      },
      end() {},
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;

    const req = makeReq('POST', `/api/chats/${testChatId}/permission-response`, {
      promptId: 'stale-prompt-id-xyz-999',
      decision: 'deny',
    });
    const url = new URL(`http://localhost/api/chats/${testChatId}/permission-response`);
    const handled = await handleChatRoutes(req, mockRes, url);
    expect(handled).toBe(true);
    expect(finalStatus).toBe(404);
  });

  it('returns 200 success when promptId resolves a live pending permission', async () => {
    // Set up a live pending permission directly via the registry — post-Phase-26
    // dispatchTool no longer creates pending permissions.
    const { res: sseRes, events: sseEvents } = makeMockRes();
    const ctrl = new AbortController();

    const waitPromise = waitForPermissionResponse(
      {
        chatId: testChatId,
        res: sseRes,
        signal: ctrl.signal,
        autoApproved: new Set(),
        trusted: false,
      },
      'save_creation',
      '{"html":"<p>endpoint test</p>"}',
      undefined,
    );

    await new Promise((r) => setTimeout(r, 20));

    const promptEvents = sseEvents.filter((e) => e.event === 'permission_prompt');
    expect(promptEvents.length).toBeGreaterThan(0);
    const promptId = (promptEvents[0].data as any).promptId as string;

    // Approve via HTTP
    let finalStatus = 200;
    let finalBody: unknown = {};
    const mockRes = {
      writeHead(s: number) {
        finalStatus = s;
      },
      end(data?: string) {
        if (data) {
          try {
            finalBody = JSON.parse(data);
          } catch {
            finalBody = data;
          }
        }
      },
      write() {
        return true;
      },
      writableEnded: false,
    } as unknown as ServerResponse;

    const req = makeReq('POST', `/api/chats/${testChatId}/permission-response`, {
      promptId,
      decision: 'approve_once',
    });
    const url = new URL(`http://localhost/api/chats/${testChatId}/permission-response`);
    const handled = await handleChatRoutes(req, mockRes, url);
    expect(handled).toBe(true);
    expect(finalStatus).toBe(200);
    expect((finalBody as any).success).toBe(true);

    const decision = await waitPromise;
    expect(decision).toBe('approve_once');
  });
});

// ─── 12. emitToolProgress helper ──────────────────────────────────────────────

describe('emitToolProgress helper', () => {
  it('emits tool_progress event with tool name and pct', () => {
    const { res, events } = makeMockRes();
    const ctx = makeCtx({ res });
    emitToolProgress(ctx, 'generate_image', 50);
    const progressEvents = events.filter((e) => e.event === 'tool_progress');
    expect(progressEvents).toHaveLength(1);
    expect((progressEvents[0].data as any).tool).toBe('generate_image');
    expect((progressEvents[0].data as any).pct).toBe(50);
  });
});
