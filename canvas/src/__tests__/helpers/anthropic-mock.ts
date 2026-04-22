import type Anthropic from '@anthropic-ai/sdk';

/**
 * Minimal Anthropic SDK mock.
 *
 * Scripted `messages.create` calls return pre-baked Message objects or throw
 * pre-baked errors. Shape matches the surface used in
 * canvas/src/server/agent.ts (non-streaming create, with optional
 * { signal } in the second arg once the AbortController migration lands).
 */

type TextBlock = { type: 'text'; text: string };
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type ContentBlock = TextBlock | ToolUseBlock;

export type ScriptedMessage = {
  type: 'message';
  content: ContentBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** Delay before returning (for AbortController cancellation tests). */
  delay_ms?: number;
};

export type ScriptedError = {
  type: 'error';
  status: number;
  message: string;
  delay_ms?: number;
};

export type Scripted = ScriptedMessage | ScriptedError;

export type CreateCall = {
  params: Anthropic.MessageCreateParamsNonStreaming;
  signal?: AbortSignal;
};

export class MockAnthropic {
  private queue: Scripted[] = [];
  public calls: CreateCall[] = [];

  constructor(_opts?: unknown) {}

  setScripts(scripts: Scripted[]): void {
    this.queue = [...scripts];
  }

  pushScript(s: Scripted): void {
    this.queue.push(s);
  }

  messages = {
    create: async (
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ): Promise<Anthropic.Message> => {
      this.calls.push({ params, signal: options?.signal });

      const next = this.queue.shift();
      if (!next) {
        throw new Error('MockAnthropic: messages.create called but no scripted response queued');
      }

      // Short-circuit if already aborted before we do anything.
      if (options?.signal?.aborted) {
        throw makeAbortError();
      }

      if (next.delay_ms && next.delay_ms > 0) {
        await sleepCancellable(next.delay_ms, options?.signal);
      }

      if (next.type === 'error') {
        const err = new Error(next.message) as Error & { status?: number };
        err.status = next.status;
        throw err;
      }

      return {
        id: `msg_${this.calls.length}`,
        type: 'message',
        role: 'assistant',
        model: params.model,
        stop_reason: next.stop_reason ?? 'end_turn',
        stop_sequence: null,
        content: next.content as Anthropic.ContentBlock[],
        usage: {
          input_tokens: next.usage?.input_tokens ?? 100,
          output_tokens: next.usage?.output_tokens ?? 50,
          cache_read_input_tokens: next.usage?.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: next.usage?.cache_creation_input_tokens ?? 0,
        },
      } as unknown as Anthropic.Message;
    },
  };
}

/**
 * Build an error matching the shape the Anthropic SDK throws on AbortSignal.
 */
function makeAbortError(): Error {
  const err = new Error('Request was aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * sleep(ms) that rejects with AbortError if the signal fires during the wait.
 */
function sleepCancellable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeAbortError());
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(makeAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Convenience factory matching how tests typically construct a mock.
 *
 * ```ts
 * vi.mock('@anthropic-ai/sdk', () => {
 *   const { MockAnthropic } = require('../helpers/anthropic-mock');
 *   return { default: MockAnthropic };
 * });
 * ```
 */
export function createAnthropicMock(scripts: Scripted[] = []): MockAnthropic {
  const m = new MockAnthropic();
  m.setScripts(scripts);
  return m;
}
