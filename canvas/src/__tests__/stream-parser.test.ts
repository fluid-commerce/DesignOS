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

  it('returns null for tool_use content_block_start (filtered — stage badges replace tool noise)', () => {
    const event = {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        content_block: { type: 'tool_use', name: 'Write' },
      },
    };
    const msg = parseStreamEvent(event);
    expect(msg).toBeNull();
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

  it('converts stage_status starting events to stage-running messages', () => {
    const event = { type: 'stage_status', stage: 'copy', status: 'starting' };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('stage-running');
    expect(msg!.content).toBe('copy');
    expect(msg!.stage).toBe('copy');
  });

  it('converts stage_status done events to stage-done messages', () => {
    const event = { type: 'stage_status', stage: 'copy', status: 'done' };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('stage-done');
    expect(msg!.content).toBe('copy');
    expect(msg!.stage).toBe('copy');
  });

  it('converts stage_narrative events to stage-narrative messages', () => {
    const event = { type: 'stage_narrative', text: 'Copy ready.', stage: 'copy' };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('stage-narrative');
    expect(msg!.content).toBe('Copy ready.');
    expect(msg!.stage).toBe('copy');
  });

  it('converts stage_status other statuses to regular status messages', () => {
    const event = { type: 'stage_status', stage: 'copy', status: 'max-tokens-reached' };
    const msg = parseStreamEvent(event);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('status');
    expect(msg!.content).toBe('[copy] max-tokens-reached');
  });

  it('returns null for tool_result events (filtered — stage badges replace tool noise)', () => {
    const event = { type: 'tool_result', tool_name: 'read_file' };
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
    store.startGeneration();
    store.setSessionId('test-session');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('generating');
    expect(state.activeSessionId).toBe('test-session');
    expect(state.events).toEqual([]);
  });

  it('transitions generating -> complete on completeGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration();
    store.completeGeneration();
    expect(useGenerationStore.getState().status).toBe('complete');
  });

  it('accumulates events via addEvent', () => {
    const store = useGenerationStore.getState();
    store.startGeneration();
    store.addEvent({ id: 'msg-1', type: 'text', content: 'Hello', timestamp: 1 });
    store.addEvent({ id: 'msg-2', type: 'text', content: ' world', timestamp: 2 });
    expect(useGenerationStore.getState().events).toHaveLength(2);
  });

  it('clears events on startGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration();
    store.setSessionId('session-1');
    store.addEvent({ id: 'msg-1', type: 'text', content: 'old', timestamp: 1 });
    store.startGeneration();
    store.setSessionId('session-2');
    expect(useGenerationStore.getState().events).toEqual([]);
    expect(useGenerationStore.getState().activeSessionId).toBe('session-2');
  });

  it('transitions to error state on errorGeneration', () => {
    const store = useGenerationStore.getState();
    store.startGeneration();
    store.errorGeneration('Something went wrong');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('error');
  });

  it('resets to idle state', () => {
    const store = useGenerationStore.getState();
    store.startGeneration();
    store.addEvent({ id: 'msg-1', type: 'text', content: 'test', timestamp: 1 });
    store.reset();
    const state = useGenerationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.events).toEqual([]);
    expect(state.activeSessionId).toBeNull();
  });
});
