/**
 * Characterization tests for the SSE streaming path in useChatStore.
 *
 * Runs in the node environment (see vitest.config.ts environmentMatchGlobs)
 * because fetch-event-source uses ReadableStream APIs that are flaky in jsdom.
 *
 * We mock @microsoft/fetch-event-source with a node-compatible implementation
 * that uses the library's own parse internals but globalThis.fetch instead of
 * window.fetch, avoiding browser-global crashes in the node test runner.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist: mock fetch-event-source before the store imports it.
// The mock uses the library's own parse pipeline but replaces window.fetch
// with globalThis.fetch and removes all document/window global calls.
// ---------------------------------------------------------------------------
vi.mock('@microsoft/fetch-event-source', async () => {
  // Import the parse helpers from the real library (pure JS, no browser deps).
  const parse = await import(
    '@microsoft/fetch-event-source/lib/cjs/parse.js' as string
  ) as any;
  const EventStreamContentType = 'text/event-stream';

  async function fetchEventSource(
    input: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
      openWhenHidden?: boolean;
      onopen?: (res: Response) => Promise<void>;
      onmessage?: (ev: { event: string; data: string; id: string; retry?: number }) => void;
      onerror?: (err: any) => void;
      onclose?: () => void;
      fetch?: typeof globalThis.fetch;
      [key: string]: any;
    },
  ): Promise<void> {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const signal = options.signal;

    // If signal already aborted, resolve immediately.
    if (signal?.aborted) return;

    let response: Response;
    try {
      response = await fetchFn(input, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal,
      });
    } catch (err: any) {
      // Network-level error (or AbortError from signal)
      if (!signal?.aborted) {
        try {
          options.onerror?.(err);
        } catch { /* re-thrown by onerror; we swallow here */ }
      }
      return;
    }

    // Validate content-type (matches library default onopen behaviour).
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith(EventStreamContentType)) {
      const err = new Error(`Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`);
      try {
        options.onerror?.(err);
      } catch { /* swallow re-throw */ }
      return;
    }

    // Parse the stream using the real library parse pipeline.
    try {
      await parse.getBytes(
        response.body,
        parse.getLines(
          parse.getMessages(
            (_id: string) => { /* no-op: last-event-id tracking not needed in tests */ },
            (_retry: number) => { /* no-op */ },
            options.onmessage,
          ),
        ),
      );
      options.onclose?.();
    } catch (err: any) {
      if (!signal?.aborted) {
        try {
          options.onerror?.(err);
        } catch { /* re-throw swallowed */ }
      }
    }
  }

  return { fetchEventSource, EventStreamContentType };
});

// ---------------------------------------------------------------------------
// Now import the stores (they'll get the mocked fetchEventSource).
// ---------------------------------------------------------------------------
import { useChatStore } from '../store/chat';
import { useCampaignStore } from '../store/campaign';
import { makeSSEResponse } from './helpers/sse-fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetChatStore() {
  useChatStore.setState({
    chats: [],
    activeChatId: 'test-chat-id',
    messages: [],
    isStreaming: false,
    abortController: null,
  });
}

function resetCampaignStore() {
  useCampaignStore.setState({
    activeCampaignId: null,
  } as any);
}

/** Minimal ok Response for non-SSE API calls (e.g. GET /api/chats). */
function makeJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Wire up global.fetch mock: SSE POST → sseResponse; everything else → [].
 */
function mockFetchWithSSE(sseResponse: Response) {
  vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL, _init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/messages')) {
      return Promise.resolve(sseResponse);
    }
    return Promise.resolve(makeJsonResponse([]));
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetChatStore();
  resetCampaignStore();
  vi.spyOn(global, 'fetch');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChatStore SSE streaming', () => {
  it('1. Happy path: 3 text events + done accumulate content and finish streaming', async () => {
    const sseResponse = makeSSEResponse([
      { event: 'text', data: { text: 'Hello' } },
      { event: 'text', data: { text: ' world' } },
      { event: 'text', data: { text: '!' } },
      { event: 'done', data: {} },
    ]);
    mockFetchWithSSE(sseResponse);

    useChatStore.getState().sendMessage('Hi');

    await vi.waitFor(
      () => {
        const state = useChatStore.getState();
        expect(state.isStreaming).toBe(false);
        const assistantMsg = state.messages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.content).toBe('Hello world!');
      },
      { timeout: 2000 },
    );

    // The SSE POST must be called with the messages URL
    const calls = vi.mocked(global.fetch).mock.calls;
    const sseCall = calls.find(([url]) => typeof url === 'string' && url.includes('/messages'));
    expect(sseCall).toBeDefined();
    // Must include signal so AbortController cancellation still works
    expect((sseCall![1] as RequestInit).signal).toBeDefined();
  });

  it('2. tool_start + tool_result update toolCalls on the assistant message', async () => {
    const sseResponse = makeSSEResponse([
      { event: 'tool_start', data: { toolUseId: 'tc-1', name: 'generate_image', input: { prompt: 'test' } } },
      { event: 'tool_result', data: { toolUseId: 'tc-1', result: 'done', hasImage: true } },
      { event: 'done', data: {} },
    ]);
    mockFetchWithSSE(sseResponse);

    useChatStore.getState().sendMessage('Make an image');

    await vi.waitFor(
      () => {
        const state = useChatStore.getState();
        expect(state.isStreaming).toBe(false);
        const assistantMsg = state.messages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.toolCalls).toHaveLength(1);
        const tc = assistantMsg?.toolCalls[0];
        expect(tc?.id).toBe('tc-1');
        expect(tc?.tool).toBe('generate_image');
        expect(tc?.status).toBe('complete');
        expect(tc?.result).toBe('done');
        expect(tc?.hasImage).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it('3. creation_ready triggers fetchCampaigns on the campaign store', async () => {
    const fetchCampaignsSpy = vi
      .spyOn(useCampaignStore.getState(), 'fetchCampaigns')
      .mockResolvedValue();

    const sseResponse = makeSSEResponse([
      { event: 'creation_ready', data: { campaignId: 'camp-1' } },
      { event: 'done', data: {} },
    ]);
    mockFetchWithSSE(sseResponse);

    useChatStore.getState().sendMessage('Create something');

    await vi.waitFor(
      () => {
        expect(fetchCampaignsSpy).toHaveBeenCalled();
        expect(useChatStore.getState().isStreaming).toBe(false);
      },
      { timeout: 2000 },
    );
  });

  it('4. Malformed JSON in a data: line is dropped and the stream still completes', async () => {
    // Build a response with one bad event, then a good event, then done.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: text\ndata: {bad json\n\n'));
        controller.enqueue(encoder.encode('event: text\ndata: {"text":"OK"}\n\n'));
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        controller.close();
      },
    });
    const badResponse = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    mockFetchWithSSE(badResponse);

    // Should not throw
    useChatStore.getState().sendMessage('Test malformed');

    await vi.waitFor(
      () => {
        const state = useChatStore.getState();
        expect(state.isStreaming).toBe(false);
        const assistantMsg = state.messages.find((m) => m.role === 'assistant');
        // The good text event must be present; the bad one dropped silently
        expect(assistantMsg?.content).toContain('OK');
      },
      { timeout: 2000 },
    );
  });

  it('5. Server closes connection mid-stream: isStreaming becomes false (connection-dropped fix)', async () => {
    // errorAtEnd simulates server killing the connection before a done event
    const sseResponse = makeSSEResponse(
      [{ event: 'text', data: { text: 'Partial...' } }],
      { errorAtEnd: new Error('connection dropped') },
    );
    mockFetchWithSSE(sseResponse);

    useChatStore.getState().sendMessage('Streaming message');

    await vi.waitFor(
      () => {
        const state = useChatStore.getState();
        // Post-migration fix: onerror must finalize streaming so UI doesn't hang
        expect(state.isStreaming).toBe(false);
      },
      { timeout: 2000 },
    );
  });

  it('6. Mid-chunk splits: text still arrives intact', async () => {
    // splitAcross: 4 splits each event payload across 4 separate ReadableStream chunks
    const sseResponse = makeSSEResponse(
      [
        { event: 'text', data: { text: 'Split content arrives intact' } },
        { event: 'done', data: {} },
      ],
      { splitAcross: 4 },
    );
    mockFetchWithSSE(sseResponse);

    useChatStore.getState().sendMessage('Test chunked');

    await vi.waitFor(
      () => {
        const state = useChatStore.getState();
        expect(state.isStreaming).toBe(false);
        const assistantMsg = state.messages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.content).toBe('Split content arrives intact');
      },
      { timeout: 2000 },
    );
  });
});
