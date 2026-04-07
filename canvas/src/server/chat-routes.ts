import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';
import { runAgent, cancelChat } from './agent';
import type { IncomingMessage, ServerResponse } from 'http';

function json(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export async function handleChatRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  // GET /api/chats — list all chats
  if (method === 'GET' && pathname === '/api/chats') {
    const db = getDb();
    const chats = db.prepare(
      `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM chats ORDER BY updated_at DESC`
    ).all();
    json(res, chats);
    return true;
  }

  // POST /api/chats — create new chat
  if (method === 'POST' && pathname === '/api/chats') {
    const db = getDb();
    const id = `chat_${nanoid(10)}`;
    const now = Date.now();
    db.prepare(`INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, NULL, ?, ?)`).run(id, now, now);
    json(res, { id, title: null, createdAt: now, updatedAt: now }, 201);
    return true;
  }

  // GET /api/chats/:id — get chat with messages
  const chatGetMatch = pathname.match(/^\/api\/chats\/([^/]+)$/);
  if (method === 'GET' && chatGetMatch) {
    const db = getDb();
    const chatId = chatGetMatch[1];
    const chat = db.prepare(`SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM chats WHERE id = ?`).get(chatId);
    if (!chat) { json(res, { error: 'Chat not found' }, 404); return true; }

    const messages = db.prepare(
      `SELECT id, role, content, tool_calls as toolCalls, tool_results as toolResults, ui_context as uiContext, created_at as createdAt
       FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`
    ).all(chatId);

    json(res, { ...(chat as any), messages });
    return true;
  }

  // DELETE /api/chats/:id — delete a chat
  const chatDeleteMatch = pathname.match(/^\/api\/chats\/([^/]+)$/);
  if (method === 'DELETE' && chatDeleteMatch) {
    const db = getDb();
    const chatId = chatDeleteMatch[1];
    db.prepare(`DELETE FROM chat_messages WHERE chat_id = ?`).run(chatId);
    db.prepare(`DELETE FROM chats WHERE id = ?`).run(chatId);
    json(res, { success: true });
    return true;
  }

  // POST /api/chats/:id/messages — send message (SSE streaming)
  const msgMatch = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (method === 'POST' && msgMatch) {
    const chatId = msgMatch[1];
    const db = getDb();

    const chat = db.prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
    if (!chat) { json(res, { error: 'Chat not found' }, 404); return true; }

    const body = await readBody(req);
    const { content, uiContext } = body;
    if (!content || typeof content !== 'string') {
      json(res, { error: 'content is required' }, 400);
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    try {
      await runAgent(chatId, content, uiContext ?? null, res);
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }

    res.end();
    return true;
  }

  // POST /api/chats/:id/cancel — cancel in-progress agent
  const cancelMatch = pathname.match(/^\/api\/chats\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    cancelChat(cancelMatch[1]);
    json(res, { success: true });
    return true;
  }

  return false;
}
