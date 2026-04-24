import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { runAgent, cancelChat } from './agent';
import { resolvePermissionResponse } from './tool-dispatch';
import type { IncomingMessage, ServerResponse } from 'http';

// ─── Usage rollup types ──────────────────────────────────────────────────────

export interface UsageRollup {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  turns: number;
  images_generated: number;
  total_usd: number;
}

function json(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 1MB cap on chat message bodies. Chat messages are short text — anything larger
// is almost certainly abuse or a client bug, and we don't want to OOM the dev
// server by buffering unbounded chunks.
const MAX_BODY_BYTES = 1_000_000;

const INVALID_JSON = Symbol('invalid_json');

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (body.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        // Return a sentinel instead of masking invalid JSON as an empty body —
        // the handler can then distinguish "client sent nothing" from "client
        // sent garbage" and return the appropriate status.
        resolve(INVALID_JSON);
      }
    });
    req.on('error', reject);
  });
}

export async function handleChatRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  // GET /api/chats — list all chats
  if (method === 'GET' && pathname === '/api/chats') {
    const db = getDb();
    const chats = db
      .prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM chats ORDER BY updated_at DESC`,
      )
      .all();
    json(res, chats);
    return true;
  }

  // POST /api/chats — create new chat
  if (method === 'POST' && pathname === '/api/chats') {
    const db = getDb();
    const id = `chat_${nanoid(10)}`;
    const now = Date.now();
    db.prepare(`INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, NULL, ?, ?)`).run(
      id,
      now,
      now,
    );
    json(res, { id, title: null, createdAt: now, updatedAt: now }, 201);
    return true;
  }

  // GET|DELETE /api/chats/:id
  const chatIdMatch = pathname.match(/^\/api\/chats\/([^/]+)$/);
  if (chatIdMatch && (method === 'GET' || method === 'DELETE')) {
    const db = getDb();
    const chatId = chatIdMatch[1];

    if (method === 'GET') {
      const chat = db
        .prepare(
          `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM chats WHERE id = ?`,
        )
        .get(chatId);
      if (!chat) {
        json(res, { error: 'Chat not found' }, 404);
        return true;
      }

      const messages = db
        .prepare(
          `SELECT id, role, content, tool_calls as toolCalls, tool_results as toolResults, ui_context as uiContext, created_at as createdAt
         FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC`,
        )
        .all(chatId);

      json(res, { ...(chat as any), messages });
      return true;
    }

    // DELETE — FK ON DELETE CASCADE handles chat_messages child rows. Cancel
    // any in-flight agent sessions first and give them a short grace period to
    // unwind before we drop the parent row, otherwise mid-loop persistMessage
    // calls hit a FK error as the chat vanishes underneath them.
    cancelChat(chatId);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const result = db.prepare(`DELETE FROM chats WHERE id = ?`).run(chatId);
    if (result.changes === 0) {
      json(res, { error: 'Chat not found' }, 404);
      return true;
    }
    json(res, { success: true });
    return true;
  }

  // POST /api/chats/:id/messages — send message (SSE streaming)
  const msgMatch = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (method === 'POST' && msgMatch) {
    const chatId = msgMatch[1];
    const db = getDb();

    const chat = db.prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
    if (!chat) {
      json(res, { error: 'Chat not found' }, 404);
      return true;
    }

    let body: any;
    try {
      body = await readBody(req);
    } catch (err: any) {
      json(res, { error: err?.message ?? 'Failed to read body' }, 413);
      return true;
    }
    if (body === INVALID_JSON) {
      json(res, { error: 'Invalid JSON body' }, 400);
      return true;
    }
    const { content, uiContext: rawUiContext, uploadedAssetIds } = body;
    if (!content || typeof content !== 'string') {
      json(res, { error: 'content is required' }, 400);
      return true;
    }

    // Thread uploadedAssetIds into uiContext so the agent can reference them.
    const uiContext =
      Array.isArray(uploadedAssetIds) && uploadedAssetIds.length > 0
        ? { ...(rawUiContext ?? {}), uploadedAssetIds }
        : (rawUiContext ?? null);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // runAgent owns all error handling + SSE emission. It only ever throws in
    // truly unexpected situations (e.g., synchronous bugs), so treat that as
    // last-resort fallback and guard against writing to an already-closed socket.
    try {
      await runAgent(chatId, content, uiContext, res);
    } catch (err: any) {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    }

    if (!res.writableEnded) res.end();
    return true;
  }

  // POST /api/chats/:id/cancel — cancel in-progress agent
  const cancelMatch = pathname.match(/^\/api\/chats\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const chatId = cancelMatch[1];
    const db = getDb();
    const chat = db.prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
    if (!chat) {
      json(res, { error: 'Chat not found' }, 404);
      return true;
    }
    cancelChat(chatId);
    json(res, { success: true });
    return true;
  }

  // POST /api/chats/:id/permission-response — resolve a pending permission prompt
  const permMatch = pathname.match(/^\/api\/chats\/([^/]+)\/permission-response$/);
  if (method === 'POST' && permMatch) {
    const chatId = permMatch[1];
    const db = getDb();
    const chat = db.prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
    if (!chat) {
      json(res, { error: 'Chat not found' }, 404);
      return true;
    }

    let body: any;
    try {
      body = await readBody(req);
    } catch (err: any) {
      json(res, { error: err?.message ?? 'Failed to read body' }, 413);
      return true;
    }
    if (body === INVALID_JSON) {
      json(res, { error: 'Invalid JSON body' }, 400);
      return true;
    }

    const { promptId, decision } = body ?? {};
    if (typeof promptId !== 'string' || promptId.length === 0) {
      json(res, { error: 'promptId is required and must be a non-empty string' }, 400);
      return true;
    }
    const validDecisions = new Set(['approve_once', 'approve_session', 'deny']);
    if (typeof decision !== 'string' || !validDecisions.has(decision)) {
      json(
        res,
        { error: 'decision must be one of: approve_once, approve_session, deny' },
        400,
      );
      return true;
    }

    const resolved = resolvePermissionResponse(
      chatId,
      promptId,
      decision as 'approve_once' | 'approve_session' | 'deny',
    );
    if (!resolved) {
      json(res, { error: 'Prompt not found or already resolved' }, 404);
      return true;
    }

    json(res, { success: true });
    return true;
  }

  // GET /api/chats/:id/usage-rollup — per-session cost + token summary
  const rollupMatch = pathname.match(/^\/api\/chats\/([^/]+)\/usage-rollup$/);
  if (method === 'GET' && rollupMatch) {
    const chatId = rollupMatch[1];
    const db = getDb();

    const chat = db.prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
    if (!chat) {
      json(res, { error: 'Chat not found' }, 404);
      return true;
    }

    // Sum cost and count images from tool_audit_log
    const costRow = db
      .prepare(
        `SELECT COALESCE(SUM(cost_usd_est), 0) as total_usd FROM tool_audit_log WHERE session_id = ?`,
      )
      .get(chatId) as { total_usd: number };

    const imagesRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM tool_audit_log
         WHERE session_id = ? AND tool = 'generate_image' AND outcome = 'ok'`,
      )
      .get(chatId) as { cnt: number };

    // Count distinct turn batches: each agent_run_complete event represents one turn
    const turnsRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM chat_events
         WHERE chat_id = ? AND event_type = 'agent_run_complete'`,
      )
      .get(chatId) as { cnt: number };

    // Try to extract token counts from the latest agent_run_complete event detail_json.
    // The event stores usage in detail_json. We sum across all turns.
    const tokenEvents = db
      .prepare(
        `SELECT detail_json FROM chat_events
         WHERE chat_id = ? AND event_type = 'agent_run_complete'`,
      )
      .all(chatId) as Array<{ detail_json: string | null }>;

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    for (const row of tokenEvents) {
      if (!row.detail_json) continue;
      try {
        const detail = JSON.parse(row.detail_json) as Record<string, unknown>;
        inputTokens += (detail.input_tokens as number | undefined) ?? 0;
        outputTokens += (detail.output_tokens as number | undefined) ?? 0;
        cacheReadTokens += (detail.cache_read_input_tokens as number | undefined) ?? 0;
        cacheWriteTokens += (detail.cache_creation_input_tokens as number | undefined) ?? 0;
      } catch {
        // Malformed detail — skip.
      }
    }

    const rollup: UsageRollup = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      turns: turnsRow.cnt,
      images_generated: imagesRow.cnt,
      total_usd: costRow.total_usd,
    };

    json(res, rollup);
    return true;
  }

  return false;
}
