/**
 * AbortController-based cancellation for the agent tool-use loop.
 *
 * Characterization tests for `createMessageWithRetry` — the narrowest
 * signal-propagation surface. Full runAgent end-to-end cancel is verified
 * manually (cancel mid-render_preview); this file exercises the retry helper.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  createMessageWithRetry,
  cancelChat,
  __getActiveSessionCount,
  __registerSessionForTests,
  __clearActiveSessionsForTests,
} from '../server/agent';
import { createAnthropicMock } from './helpers/anthropic-mock';

describe('createMessageWithRetry', () => {
  it('returns a scripted response on the happy path', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'hello' }], stop_reason: 'end_turn' },
    ]);
    const ctrl = new AbortController();
    const res = await createMessageWithRetry(
      mock as unknown as import('@anthropic-ai/sdk').default,
      { model: 'claude-sonnet-4-6', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] },
      ctrl.signal,
    );
    expect((res.content[0] as { text: string }).text).toBe('hello');
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].signal).toBe(ctrl.signal);
  });

  it('retries on 429 and eventually returns the scripted success', async () => {
    const mock = createAnthropicMock([
      { type: 'error', status: 429, message: 'rate_limit' },
      { type: 'message', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' },
    ]);
    const ctrl = new AbortController();
    const res = await createMessageWithRetry(
      mock as unknown as import('@anthropic-ai/sdk').default,
      { model: 'x', max_tokens: 1, messages: [] },
      ctrl.signal,
    );
    expect(mock.calls).toHaveLength(2);
    expect((res.content[0] as { text: string }).text).toBe('ok');
  });

  it('throws non-retriable errors immediately (no retry on 4xx != 429)', async () => {
    const mock = createAnthropicMock([
      { type: 'error', status: 400, message: 'bad_request' },
    ]);
    const ctrl = new AbortController();
    await expect(
      createMessageWithRetry(
        mock as unknown as import('@anthropic-ai/sdk').default,
        { model: 'x', max_tokens: 1, messages: [] },
        ctrl.signal,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(mock.calls).toHaveLength(1);
  });

  it('rejects immediately when signal is already aborted', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'x' }] },
    ]);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      createMessageWithRetry(
        mock as unknown as import('@anthropic-ai/sdk').default,
        { model: 'x', max_tokens: 1, messages: [] },
        ctrl.signal,
      ),
    ).rejects.toThrow(/cancel/i);
    expect(mock.calls).toHaveLength(0);
  });

  it('aborts mid-SDK-call when signal fires during a slow request', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'slow' }], delay_ms: 1000 },
    ]);
    const ctrl = new AbortController();
    const t0 = Date.now();
    const p = createMessageWithRetry(
      mock as unknown as import('@anthropic-ai/sdk').default,
      { model: 'x', max_tokens: 1, messages: [] },
      ctrl.signal,
    );
    setTimeout(() => ctrl.abort(), 20);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(Date.now() - t0).toBeLessThan(300);
  });

  it('aborts during backoff sleep', async () => {
    const mock = createAnthropicMock([
      { type: 'error', status: 429, message: 'rate_limit' },
      { type: 'message', content: [{ type: 'text', text: 'x' }] },
    ]);
    const ctrl = new AbortController();
    const t0 = Date.now();
    const p = createMessageWithRetry(
      mock as unknown as import('@anthropic-ai/sdk').default,
      { model: 'x', max_tokens: 1, messages: [] },
      ctrl.signal,
    );
    // First 429 fires almost immediately, then a ~500ms backoff starts.
    setTimeout(() => ctrl.abort(), 50);
    await expect(p).rejects.toThrow(/cancel/i);
    // Must land well inside the 500ms backoff window, not after it.
    expect(Date.now() - t0).toBeLessThan(300);
    // Second script was never consumed.
    expect(mock.calls).toHaveLength(1);
  });
});

describe('cancelChat + activeSessions', () => {
  it('aborts controllers registered for chatId and leaves others alone', () => {
    __clearActiveSessionsForTests();

    const a = new AbortController();
    const b = new AbortController();
    const c = new AbortController();
    __registerSessionForTests('chat-1', a);
    __registerSessionForTests('chat-1', b);
    __registerSessionForTests('chat-2', c);

    expect(__getActiveSessionCount('chat-1')).toBe(2);
    expect(__getActiveSessionCount('chat-2')).toBe(1);

    cancelChat('chat-1');

    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
    expect(c.signal.aborted).toBe(false);
  });

  it('cancelChat on unknown id is a no-op', () => {
    __clearActiveSessionsForTests();
    expect(() => cancelChat('does-not-exist')).not.toThrow();
  });
});
