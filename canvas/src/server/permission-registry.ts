/**
 * permission-registry.ts — in-memory registry of pending tool-permission prompts.
 *
 * Extracted from tool-dispatch.ts in Phase 26. Permission gating now happens at
 * the SDK level via the Claude Agent SDK's `canUseTool` callback (configured in
 * agent.ts). That callback calls `waitForPermissionResponse` here, which:
 *   1. Emits a `permission_prompt` SSE event with a nanoid promptId
 *   2. Stores a resolver in `pendingPermissions` keyed by (chatId, promptId)
 *   3. Resolves when the client POSTs to /api/chats/:id/permission-response
 *      (which calls `resolvePermissionResponse`) — or on timeout / abort.
 *
 * We keep a lightweight shape — this file has no dependency on tool dispatch,
 * cost caps, or audit logs. Those remain in tool-dispatch.ts.
 */

import type { ServerResponse } from 'node:http';
import { nanoid } from 'nanoid';
import { sendSSE } from './agent';
import { logChatEvent } from './observability';

// ─── Public types ─────────────────────────────────────────────────────────────

export type PermissionDecision = 'approve_once' | 'approve_session' | 'deny';

/**
 * Minimal context needed to prompt the user for permission. Matches the
 * relevant subset of DispatchContext so callers can pass either.
 */
export interface PermissionContext {
  chatId: string;
  res: ServerResponse;
  signal: AbortSignal;
  /** Tools the user has approved "for this session" (in-memory, per-chat). */
  autoApproved: Set<string>;
  /** Solo-dev bypass: when true, ask-first prompts are skipped entirely. */
  trusted: boolean;
}

export interface PendingPermission {
  toolName: string;
  resolve: (decision: PermissionDecision) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Outer key = chatId, inner key = promptId (nanoid).
 * Each pending permission prompt has exactly one waiter.
 */
export const pendingPermissions = new Map<string, Map<string, PendingPermission>>();

/**
 * Wait for the user to approve or deny a permission prompt.
 * Emits permission_prompt SSE with the promptId so the client knows what to
 * respond to. Resolves 'deny' after timeoutMs (default 5 min).
 *
 * Abort-aware: if ctx.signal fires while waiting, resolves as 'deny' and
 * cleans up the pending entry.
 */
export function waitForPermissionResponse(
  ctx: PermissionContext,
  toolName: string,
  argsPreview: string,
  estCostUsd: number | undefined,
  timeoutMs = 300_000,
): Promise<PermissionDecision> {
  return new Promise<PermissionDecision>((resolve) => {
    const promptId = nanoid();

    const cleanup = (decision: PermissionDecision) => {
      const chatMap = pendingPermissions.get(ctx.chatId);
      if (chatMap) {
        const entry = chatMap.get(promptId);
        if (entry) {
          clearTimeout(entry.timer);
          chatMap.delete(promptId);
          if (chatMap.size === 0) pendingPermissions.delete(ctx.chatId);
        }
      }
      resolve(decision);
    };

    // Timeout — resolve as denied
    const timer = setTimeout(() => {
      logChatEvent('permission_response', {
        tool: toolName,
        promptId,
        decision: 'deny',
        reason: 'timeout',
      });
      cleanup('deny');
    }, timeoutMs);

    // Abort — resolve as denied immediately
    const onAbort = () => {
      logChatEvent('permission_response', {
        tool: toolName,
        promptId,
        decision: 'deny',
        reason: 'abort',
      });
      cleanup('deny');
    };

    if (ctx.signal.aborted) {
      clearTimeout(timer);
      resolve('deny');
      return;
    }

    ctx.signal.addEventListener('abort', onAbort, { once: true });

    // Override cleanup to also remove abort listener
    const fullCleanup = (decision: PermissionDecision) => {
      ctx.signal.removeEventListener('abort', onAbort);
      cleanup(decision);
    };

    // Store resolver
    let chatMap = pendingPermissions.get(ctx.chatId);
    if (!chatMap) {
      chatMap = new Map();
      pendingPermissions.set(ctx.chatId, chatMap);
    }
    chatMap.set(promptId, { toolName, resolve: fullCleanup, timer });

    // Emit SSE prompt to client
    sendSSE(ctx.res, 'permission_prompt', {
      promptId,
      tool: toolName,
      args_preview: argsPreview,
      est_cost_usd: estCostUsd,
      reason: `Tool '${toolName}' requires user approval before running.`,
    });

    logChatEvent('permission_prompt', { tool: toolName, promptId });
  });
}

/**
 * Resolve a pending permission prompt by chatId + promptId.
 * Returns true if the prompt was found and resolved, false if stale/missing.
 */
export function resolvePermissionResponse(
  chatId: string,
  promptId: string,
  decision: PermissionDecision,
): boolean {
  const chatMap = pendingPermissions.get(chatId);
  if (!chatMap) return false;
  const entry = chatMap.get(promptId);
  if (!entry) return false;
  entry.resolve(decision);
  return true;
}
