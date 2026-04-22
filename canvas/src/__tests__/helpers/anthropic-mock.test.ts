import { describe, it, expect } from 'vitest';
import { createAnthropicMock } from './anthropic-mock';

describe('anthropic-mock', () => {
  it('returns scripted text response', async () => {
    const mock = createAnthropicMock([
      {
        type: 'message',
        content: [{ type: 'text', text: 'hello world' }],
        stop_reason: 'end_turn',
      },
    ]);

    const res = await mock.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.stop_reason).toBe('end_turn');
    expect(res.content).toEqual([{ type: 'text', text: 'hello world' }]);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].params.model).toBe('claude-sonnet-4-6');
  });

  it('returns tool_use blocks', async () => {
    const mock = createAnthropicMock([
      {
        type: 'message',
        content: [
          { type: 'text', text: 'calling tool' },
          { type: 'tool_use', id: 'tu_1', name: 'list_assets', input: { category: 'logos' } },
        ],
        stop_reason: 'tool_use',
      },
    ]);

    const res = await mock.messages.create({ model: 'x', max_tokens: 1, messages: [] });
    expect(res.stop_reason).toBe('tool_use');
    expect(res.content).toHaveLength(2);
    expect(res.content[1]).toMatchObject({ type: 'tool_use', name: 'list_assets' });
  });

  it('throws scripted error with status code', async () => {
    const mock = createAnthropicMock([
      { type: 'error', status: 429, message: 'rate_limit' },
    ]);

    await expect(
      mock.messages.create({ model: 'x', max_tokens: 1, messages: [] }),
    ).rejects.toMatchObject({ status: 429, message: 'rate_limit' });
  });

  it('throws when called more times than scripts queued', async () => {
    const mock = createAnthropicMock([]);
    await expect(
      mock.messages.create({ model: 'x', max_tokens: 1, messages: [] }),
    ).rejects.toThrow(/no scripted response/);
  });

  it('aborts pre-scheduled call with signal already aborted', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'x' }] },
    ]);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      mock.messages.create(
        { model: 'x', max_tokens: 1, messages: [] },
        { signal: ctrl.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('aborts mid-delay when signal fires', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'slow' }], delay_ms: 1000 },
    ]);
    const ctrl = new AbortController();
    const p = mock.messages.create(
      { model: 'x', max_tokens: 1, messages: [] },
      { signal: ctrl.signal },
    );
    // Abort well before the 1s delay elapses.
    setTimeout(() => ctrl.abort(), 20);
    const t0 = Date.now();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it('queues multiple scripts and delivers in order', async () => {
    const mock = createAnthropicMock([
      { type: 'message', content: [{ type: 'text', text: 'one' }] },
      { type: 'message', content: [{ type: 'text', text: 'two' }] },
    ]);
    const r1 = await mock.messages.create({ model: 'x', max_tokens: 1, messages: [] });
    const r2 = await mock.messages.create({ model: 'x', max_tokens: 1, messages: [] });
    expect((r1.content[0] as { text: string }).text).toBe('one');
    expect((r2.content[0] as { text: string }).text).toBe('two');
  });
});
