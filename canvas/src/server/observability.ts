/**
 * observability.ts
 * Persistent audit + event logging for the creative agent harness.
 *
 * Two tables:
 *   - brand_audit_log: destructive brand-data writes (create/update/delete
 *     of patterns and voice guide docs)
 *   - chat_events: silent harness events (retries, budget trips, context
 *     guards, tool validation rejections, render metrics, cancellations)
 *
 * Both tables are append-only and survive chat deletion.
 *
 * Thread context via AsyncLocalStorage so deeply-nested tool helpers can
 * attribute writes to the current chat without threading a chatId parameter
 * through every function signature.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';

interface AgentContext {
  chatId: string | null;
}

const agentContext = new AsyncLocalStorage<AgentContext>();

/**
 * Run a callback with a chat context. Any call to auditBrandWrite or
 * logChatEvent inside the callback (including inside nested awaits) will
 * attribute the record to `chatId` automatically.
 */
export function withAgentContext<T>(chatId: string | null, fn: () => Promise<T>): Promise<T> {
  return agentContext.run({ chatId }, fn);
}

function currentChatId(): string | null {
  return agentContext.getStore()?.chatId ?? null;
}

// ─── Event types ─────────────────────────────────────────────────────────
//
// Enumerated as constants so typos show up as TypeScript errors rather than
// silent log-type drift. Add new types here before emitting them.

export type ChatEventType =
  | 'api_retry' // 429/5xx retry attempt
  | 'api_error_nonretriable' // 4xx other than 429 — surfaced to user
  | 'budget_trip_token' // CHAT_TOKEN_BUDGET exceeded
  | 'budget_trip_context' // CONTEXT_WINDOW_GUARD hit
  | 'budget_trip_render' // MAX_RENDERS_PER_PASS exceeded
  | 'loop_ceiling' // maxLoops hit without end_turn
  | 'cancelled' // user clicked Stop
  | 'tool_input_rejected' // requireString/requireNumber failed
  | 'tool_error' // executeTool threw something else
  | 'tool_exec_metric' // successful tool call with timing
  | 'render_metric' // render_preview timing + success
  | 'path_traversal_blocked' // readArchetype rejected an unsafe slug
  | 'platform_rejected' // save_creation unknown platform
  | 'css_merge_failed' // mergeCssLayersForHtml returned input unchanged
  | 'agent_run_failed' // outer catch in runAgentImpl — unexpected throw
  | 'creation_edited' // edit_creation tool completed
  | 'agent_run_complete' // end-of-turn summary with usage totals
  // ─── Phase 24 additions ───────────────────────────────────────────────────
  | 'tool_start' // ask-first/long-running tool begun (dispatch-wrapper)
  | 'tool_end' // tool complete with duration + outcome
  | 'permission_prompt' // ask-first tool paused for approval
  | 'permission_response' // user approved/denied
  | 'cost_cap_reached' // daily spend cap hit
  | 'image_generated' // gemini returned an image (future dispatch)
  | 'image_gen_blocked_safety' // gemini SAFETY/IMAGE_SAFETY response
  | 'image_gen_idempotent_hit' // cached asset returned without new spend
  | 'dam_search' // search_brand_images invoked
  | 'asset_promoted' // promote_generated_image promoted an asset to library
  | 'archetype_schema_parse_failed'; // SlotSchema JSON parse failed

// ─── Brand audit log ─────────────────────────────────────────────────────

export type BrandAuditOp =
  | 'create_pattern'
  | 'update_pattern'
  | 'delete_pattern'
  | 'create_voice_guide'
  | 'update_voice_guide';

export function auditBrandWrite(op: BrandAuditOp, detail: Record<string, unknown>): void {
  const db = getDb();
  const chatId = currentChatId();
  try {
    db.prepare(
      `INSERT INTO brand_audit_log (id, ts, chat_id, op, detail_json) VALUES (?, ?, ?, ?, ?)`,
    ).run(nanoid(), Date.now(), chatId, op, safeStringify(detail));
  } catch (err) {
    // Never let observability failures break the main flow.
    console.error('[observability] brand_audit_log insert failed:', err);
  }
  // Also echo to stdout for live tailing during dev.
  try {
    console.log(
      `[brand-audit] ${new Date().toISOString()} ${op} ${safeStringify({ chat_id: chatId, ...detail })}`,
    );
  } catch {
    console.log(`[brand-audit] ${new Date().toISOString()} ${op}`);
  }
}

// ─── Chat event log ──────────────────────────────────────────────────────

export function logChatEvent(eventType: ChatEventType, detail: Record<string, unknown> = {}): void {
  const db = getDb();
  const chatId = currentChatId();
  try {
    db.prepare(
      `INSERT INTO chat_events (id, ts, chat_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?)`,
    ).run(nanoid(), Date.now(), chatId, eventType, safeStringify(detail));
  } catch (err) {
    console.error('[observability] chat_events insert failed:', err);
  }
  // Echo to stdout at the same level as brand audit so a single `grep` picks
  // up both streams in dev logs.
  try {
    console.log(
      `[chat-event] ${new Date().toISOString()} ${eventType} ${safeStringify({ chat_id: chatId, ...detail })}`,
    );
  } catch {
    console.log(`[chat-event] ${new Date().toISOString()} ${eventType}`);
  }
}

// ─── Query helpers (for dashboards and post-mortem inspection) ───────────

export interface BrandAuditRow {
  id: string;
  ts: number;
  chat_id: string | null;
  op: string;
  detail_json: string | null;
}

export interface ChatEventRow {
  id: string;
  ts: number;
  chat_id: string | null;
  event_type: string;
  detail_json: string | null;
}

export function listBrandAudit(sinceTs?: number, limit = 200): BrandAuditRow[] {
  const db = getDb();
  const since = sinceTs ?? 0;
  return db
    .prepare(
      `SELECT id, ts, chat_id, op, detail_json FROM brand_audit_log
       WHERE ts >= ? ORDER BY ts DESC LIMIT ?`,
    )
    .all(since, limit) as BrandAuditRow[];
}

export function listChatEvents(
  filter: { sinceTs?: number; chatId?: string; eventType?: ChatEventType; limit?: number } = {},
): ChatEventRow[] {
  const db = getDb();
  const clauses: string[] = ['ts >= ?'];
  const params: unknown[] = [filter.sinceTs ?? 0];
  if (filter.chatId) {
    clauses.push('chat_id = ?');
    params.push(filter.chatId);
  }
  if (filter.eventType) {
    clauses.push('event_type = ?');
    params.push(filter.eventType);
  }
  const where = clauses.join(' AND ');
  params.push(filter.limit ?? 200);
  return db
    .prepare(
      `SELECT id, ts, chat_id, event_type, detail_json FROM chat_events
       WHERE ${where} ORDER BY ts DESC LIMIT ?`,
    )
    .all(...params) as ChatEventRow[];
}

// ─── Internal ────────────────────────────────────────────────────────────

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}
