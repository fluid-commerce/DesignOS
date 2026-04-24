/**
 * tool-dispatch.ts — cost-cap + audit-log wrapper around executeTool.
 *
 * Every agent tool call routes through dispatchTool(), which:
 *   1. Looks up the tool's policy in capabilities.ts
 *   2. Emits tool_start SSE (with est_duration for known-slow tools)
 *   3. Checks tier: never-allow-by-default → denied; everything else proceeds.
 *      (Ask-first permission gating now happens upstream in the SDK's
 *      `canUseTool` callback — see agent.ts. By the time dispatchTool runs,
 *      the user has already approved.)
 *   4. Pre-spend cost-cap check for costProfile='image-api'
 *   5. Runs the inner tool executor
 *   6. Writes tool_audit_log row with decision + outcome + cost
 *   7. Emits tool_end SSE
 *
 * Permission registry (pendingPermissions, waitForPermissionResponse,
 * resolvePermissionResponse) lives in ./permission-registry and is invoked
 * by the canUseTool callback in agent.ts.
 *
 * Concurrency note: the pre-spend cap check + executor run are not atomic.
 * In a high-concurrency scenario two image-api tools could both pass the cap
 * check before either commits a cost row. This is acceptable for Phase 24
 * (solo-dev, low concurrency); a proper solution would use a DB-level
 * serialized transaction or a mutex.
 */

import type { ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { getToolPolicy } from './capabilities';
import type { ToolTier } from './capabilities';
import { sendSSE } from './agent';
import { writeToolAuditLog, dailySpendUsd } from './db-api';
import { logChatEvent } from './observability';
// ImageGenerationBlockedError import is intentionally lazy (via instanceof check below)
// to avoid a circular dep chain: tool-dispatch → agent-tools → gemini-image.
// We check the error's constructor name instead.
type BlockedSafetyError = { name: string; reason: string };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DispatchContext {
  chatId: string;
  res: ServerResponse;
  signal: AbortSignal;
  /**
   * Tools the user has approved "for this session" (in-memory, per-chat).
   * Consumed by the canUseTool callback in agent.ts. Kept here so MCP server
   * modules can continue to pass a single ctx object down to dispatchTool.
   */
  autoApproved: Set<string>;
  /**
   * Solo-dev bypass: when true, ask-first prompts are skipped entirely in
   * the canUseTool callback. Not read by dispatchTool itself.
   */
  trusted: boolean;
}

export interface DispatchResult<T> {
  outcome: 'ok' | 'denied' | 'capped' | 'blocked_safety' | 'error';
  result?: T;
  error?: Error;
}

export type ToolExecutor<T> = () => Promise<T>;

// Re-exports for backward compatibility — permission logic moved to
// ./permission-registry in Phase 26.
export type { PermissionDecision } from './permission-registry';
export {
  waitForPermissionResponse,
  resolvePermissionResponse,
} from './permission-registry';

// ─── Progress helper ──────────────────────────────────────────────────────────

/**
 * Emit a tool_progress SSE event. Callers use this for long-running tools
 * (e.g. generate_image) to send mid-run updates to the client.
 */
export function emitToolProgress(
  ctx: DispatchContext,
  toolName: string,
  pct?: number,
  detail?: Record<string, unknown>,
): void {
  sendSSE(ctx.res, 'tool_progress', { tool: toolName, pct, ...detail });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function dispatchTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  ctx: DispatchContext,
  executor: ToolExecutor<T>,
  opts?: { estCostUsd?: number; estDurationSec?: number },
): Promise<DispatchResult<T>> {
  // 1. Policy lookup
  let policy = getToolPolicy(toolName);
  if (!policy) {
    logChatEvent('tool_input_rejected', {
      tool: toolName,
      reason: 'No TOOL_POLICY entry — treating as always-allow. Add to capabilities.ts.',
    });
    policy = {
      name: toolName,
      tier: 'always-allow' as ToolTier,
      costProfile: 'free',
      responsibility: 'Unknown tool (no policy entry)',
      sideEffect: 'read',
    };
  }

  // 2. Arg hash (16 hex chars)
  const argsHash = createHash('sha256')
    .update(JSON.stringify(args))
    .digest('hex')
    .slice(0, 16);

  // 3. SSE tool_start
  sendSSE(ctx.res, 'tool_start', {
    tool: toolName,
    est_duration_sec: opts?.estDurationSec,
    est_cost_usd: opts?.estCostUsd,
    tier: policy.tier,
  });

  const startMs = Date.now();
  let decision: string;
  let outcome: DispatchResult<T>['outcome'];
  let result: T | undefined;
  let error: Error | undefined;

  // 4. Tier decision tree. Ask-first gating already happened upstream in the
  //    SDK's canUseTool callback (agent.ts) — by the time we get here, the
  //    call is approved. We only reject the hard never-allow case.
  if (policy.tier === 'never-allow-by-default') {
    decision = 'denied';
    outcome = 'denied';
    writeAuditAndEnd(toolName, argsHash, policy.tier, decision, outcome, startMs, opts, ctx);
    return { outcome: 'denied' };
  }

  decision = policy.tier === 'always-allow' ? 'allowed' : 'approved';

  // 5. Cost cap check (only for image-api profile)
  if (policy.costProfile === 'image-api') {
    const cap = parseFloat(process.env.FLUID_DAILY_COST_CAP_USD ?? '10.00');
    const currentSpend = dailySpendUsd();
    const projected = currentSpend + (opts?.estCostUsd ?? 0);

    if (projected > cap) {
      // Hard cap exceeded
      sendSSE(ctx.res, 'budget_warning', {
        remaining_usd: Math.max(0, cap - currentSpend),
        cap_usd: cap,
        blocked: true,
      });
      logChatEvent('cost_cap_reached', {
        tool: toolName,
        current_spend_usd: currentSpend,
        est_cost_usd: opts?.estCostUsd ?? 0,
        cap_usd: cap,
      });
      decision = 'capped';
      outcome = 'capped';
      writeAuditAndEnd(toolName, argsHash, policy.tier, decision, outcome, startMs, opts, ctx);
      return { outcome: 'capped' };
    }

    // Soft warn at 80%
    if (currentSpend / cap >= 0.8) {
      sendSSE(ctx.res, 'budget_warning', {
        remaining_usd: cap - currentSpend,
        cap_usd: cap,
        blocked: false,
        warning: 'Approaching daily spend cap',
      });
    }
  }

  // 6. Run executor
  try {
    result = await executor();
    outcome = 'ok';
  } catch (err: unknown) {
    error = err instanceof Error ? err : new Error(String(err));
    // Classify ImageGenerationBlockedError as 'blocked_safety' so the agent loop
    // can send a structured signal to the model rather than a generic error.
    // We check by constructor name to avoid a circular import
    // (tool-dispatch → agent-tools → gemini-image → db-api → ...).
    const maybeBlocked = err as BlockedSafetyError;
    if (maybeBlocked?.name === 'ImageGenerationBlockedError') {
      outcome = 'blocked_safety';
    } else {
      outcome = 'error';
    }
  }

  // 7. Audit log + tool_end SSE (all paths)
  writeAuditAndEnd(toolName, argsHash, policy.tier, decision, outcome, startMs, opts, ctx);

  if (outcome === 'ok') {
    return { outcome: 'ok', result };
  }
  if (outcome === 'blocked_safety') {
    return { outcome: 'blocked_safety', error };
  }
  return { outcome: 'error', error };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function writeAuditAndEnd(
  toolName: string,
  argsHash: string,
  tier: string,
  decision: string,
  outcome: string,
  startMs: number,
  opts: { estCostUsd?: number; estDurationSec?: number } | undefined,
  ctx: DispatchContext,
): void {
  const durationMs = Date.now() - startMs;

  try {
    writeToolAuditLog({
      sessionId: ctx.chatId,
      tool: toolName,
      argsHash,
      tier,
      decision,
      costUsdEst: opts?.estCostUsd ?? 0,
      outcome,
      detailJson: JSON.stringify({ duration_ms: durationMs }),
    });
  } catch (err) {
    // Never let audit log failures break the main flow.
    console.error('[tool-dispatch] writeToolAuditLog failed:', err);
  }

  sendSSE(ctx.res, 'tool_end', {
    tool: toolName,
    duration_sec: durationMs / 1000,
    outcome,
  });
}
