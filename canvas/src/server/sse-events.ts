/**
 * sse-events.ts — canonical SSE event name constants.
 *
 * Keep this list in sync with:
 *   - agent.ts sendSSE call sites (server emitters)
 *   - canvas/src/store/chat.ts (client reducer / event handling)
 *
 * Adding new events here is the signal to update both server emitters and the
 * client reducer. This file is documentation and type-safety; refactoring
 * existing agent.ts call sites to use these constants is deferred to avoid
 * cascading churn.
 *
 * Actual event names verified by grepping sendSSE(res, '...' in agent.ts:
 *   text, tool_start, tool_result, creation_ready, validation_result, error, done
 */

export const SSE_EVENTS = {
  // ─── Existing events (already used by agent.ts — do not rename) ──────────
  TEXT: 'text',
  /** Emitted when the agent begins a tool call (block.type === 'tool_use'). */
  TOOL_START: 'tool_start',
  /** Emitted after a tool completes (success or error). */
  TOOL_RESULT: 'tool_result',
  /** Emitted after save_creation / edit_creation returns a valid iterationId. */
  CREATION_READY: 'creation_ready',
  /** Emitted alongside CREATION_READY when brand compliance validation ran. */
  VALIDATION_RESULT: 'validation_result',
  ERROR: 'error',
  DONE: 'done',

  // ─── Phase 24 additions — DO NOT EMIT YET (wired up in later dispatches) ─
  /** ask-first / long-running tool begun (tool-dispatch wrapper, dispatch 2). */
  TOOL_PROGRESS: 'tool_progress',
  /** ask-first tool paused for user approval (dispatch 2). */
  PERMISSION_PROMPT: 'permission_prompt',
  /** Daily spend cap hit — image generation blocked (dispatch 2+). */
  BUDGET_WARNING: 'budget_warning',
} as const;

export type SseEventName = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];
