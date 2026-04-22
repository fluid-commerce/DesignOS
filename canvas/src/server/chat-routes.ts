import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { runAgent, cancelChat } from './agent';
import type { IncomingMessage, ServerResponse } from 'http';

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
    const { content, uiContext } = body;
    if (!content || typeof content !== 'string') {
      json(res, { error: 'content is required' }, 400);
      return true;
    }

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
      await runAgent(chatId, content, uiContext ?? null, res);
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

  return false;
}
