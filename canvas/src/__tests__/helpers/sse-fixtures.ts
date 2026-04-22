/**
 * SSE stream test harness.
 *
 * Builds Response objects with a ReadableStream body that emits SSE-framed
 * chunks. Used by both the current hand-rolled SSE parser
 * (canvas/src/store/chat.ts) and, after the 1.6 migration, the
 * @microsoft/fetch-event-source-based parser. The fixtures are shared so the
 * two implementations are exercised against identical inputs.
 */

export type SSEEvent = {
  event: string;
  data: unknown;
};

export type SSEChunkOptions = {
  /**
   * Split each event across N random chunks. Useful for exercising mid-stream
   * parser resumption. Default 1 (one chunk per event).
   */
  splitAcross?: number;
  /**
   * Inject SSE keep-alive comments (`: keep-alive\n\n`) between events.
   */
  injectKeepAlives?: boolean;
  /**
   * Terminate the stream with an error instead of normal close, to simulate
   * server-killed connection mid-stream.
   */
  errorAtEnd?: Error;
  /**
   * Delay between chunks (ms). Useful to interleave with AbortController
   * cancel events in tests.
   */
  chunkDelayMs?: number;
};

/**
 * Serialize one SSE event per the `text/event-stream` wire format.
 *
 * ```
 * event: <name>\n
 * data: <json>\n
 * \n
 * ```
 */
export function serializeEvent(e: SSEEvent): string {
  const dataLine = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
  return `event: ${e.event}\ndata: ${dataLine}\n\n`;
}

export function makeSSEResponse(
  events: SSEEvent[],
  options: SSEChunkOptions = {},
): Response {
  const stream = makeSSEStream(events, options);
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export function makeSSEStream(
  events: SSEEvent[],
  options: SSEChunkOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];

  for (const e of events) {
    const serialized = serializeEvent(e);
    if (options.injectKeepAlives) {
      chunks.push(': keep-alive\n\n');
    }
    if (options.splitAcross && options.splitAcross > 1) {
      chunks.push(...chunkString(serialized, options.splitAcross));
    } else {
      chunks.push(serialized);
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        if (options.chunkDelayMs && options.chunkDelayMs > 0) {
          await sleep(options.chunkDelayMs);
        }
        controller.enqueue(encoder.encode(c));
        // Yield so queued chunks drain to pending reads before we close or
        // error the stream. Without this, `controller.error(...)` can
        // preempt the enqueued chunk and the consumer's first read rejects
        // instead of seeing the payload first.
        await Promise.resolve();
      }
      if (options.errorAtEnd) {
        controller.error(options.errorAtEnd);
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Build a response with a malformed `data:` line (split mid-JSON) followed by
 * a valid event — exercises the parser's resilience to partial chunks.
 */
export function makeMalformedSSEResponse(validTail: SSEEvent[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // A chunk that starts an event but never completes it, followed by stray
      // CRLFs and a multi-line data block.
      controller.enqueue(encoder.encode('event: partial\ndata: {"incomplete":'));
      controller.enqueue(encoder.encode('\r\n\r\n'));
      controller.enqueue(encoder.encode(': a keep-alive comment\n\n'));
      controller.enqueue(encoder.encode('event: multiline\ndata: line-one\ndata: line-two\n\n'));
      for (const e of validTail) {
        controller.enqueue(encoder.encode(serializeEvent(e)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function chunkString(s: string, parts: number): string[] {
  const size = Math.max(1, Math.ceil(s.length / parts));
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    out.push(s.slice(i, i + size));
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
