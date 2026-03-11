import { describe, it, expect, beforeEach } from 'vitest';
import { parseStreamEvent, resetCounter } from '../lib/stream-parser';
import { useGenerationStore } from '../store/generation';

describe('parseStreamEvent', () => {
  beforeEach(() => {
    resetCounter();
  });

  it('converts text_delta events to text UI messages', () => {
    const event = {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello world' },
      },
    };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('text');
    expect(msg!.content).toBe('Hello world');
    expect(msg!.id).toMatch(/^msg-\d+$/);
  });

  it('converts tool_use content_block_start to tool-start messages', () => {
    const event = {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        content_block: { type: 'tool_use', name: 'Write' },
      },
    };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('tool-start');
    expect(msg!.toolName).toBe('Write');
    expect(msg!.content).toContain('Write');
  });

  it('converts result event to status message with "Generation complete"', () => {
    const event = { type: 'result' };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('status');
    expect(msg!.content).toBe('Generation complete');
  });

  it('returns null for system events', () => {
    const event = { type: 'system', system: 'some system info' };
    const msg = parseStreamEvent(event);
    expect(msg).toBeNull();
  });

  it('returns null for input_json_delta events', () => {
    const event = {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'input_json_delta', partial_json: '{"key":' },
      },
    };
    const msg = parseStreamEvent(event);
    expect(msg).toBeNull();
  });

  it('converts stderr SSE events to status messages', () => {
    const event = { text: 'Loading skill...' };
    const msg = parseStreamEvent(event, 'stderr');
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('status');
    expect(msg!.content).toBe('Loading skill...');
  });
});

describe('useGenerationStore', () => {
  beforeEach(() => {
    useGenerationStore.setState({
      status: 'idle',
      events: [],
      activeSessionId: null,
      activePid: null,
    });
  });

  it('starts in idle state', () => {
    const state = useGenerationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.events).toEqual([]);
  });

  it('transitions idle -> generating on startGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('test-session');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('generating');
    expect(state.activeSessionId).toBe('test-session');
    expect(state.events).toEqual([]);
  });

  it('transitions generating -> complete on completeGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('test-session');
    store.completeGeneration();
    expect(useGenerationStore.getState().status).toBe('complete');
  });

  it('accumulates events via addEvent', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('test-session');
    store.addEvent({ id: 'msg-1', type: 'text', content: 'Hello', timestamp: 1 });
    store.addEvent({ id: 'msg-2', type: 'text', content: ' world', timestamp: 2 });
    expect(useGenerationStore.getState().events).toHaveLength(2);
  });

  it('clears events on startGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('session-1');
    store.addEvent({ id: 'msg-1', type: 'text', content: 'old', timestamp: 1 });
    store.startGeneration('session-2');
    expect(useGenerationStore.getState().events).toEqual([]);
    expect(useGenerationStore.getState().activeSessionId).toBe('session-2');
  });

  it('transitions to error state on errorGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('test-session');
    store.errorGeneration('Something went wrong');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('error');
  });

  it('resets to idle state', () => {
    const store = useGenerationStore.getState();
    store.startGeneration('test-session');
    store.addEvent({ id: 'msg-1', type: 'text', content: 'test', timestamp: 1 });
    store.reset();
    const state = useGenerationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.events).toEqual([]);
    expect(state.activeSessionId).toBeNull();
  });
});
