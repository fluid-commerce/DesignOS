/**
 * Stream parser for Claude CLI stream-json NDJSON output.
 * Converts raw NDJSON events into renderable UI messages.
 */

export interface StreamUIMessage {
  id: string;
  type: 'text' | 'tool-start' | 'tool-done' | 'status' | 'error';
  content: string;
  toolName?: string;
  timestamp: number;
}

let msgCounter = 0;

function nextId(): string {
  return `msg-${++msgCounter}`;
}

/** Reset counter (for testing only). */
export function resetCounter(): void {
  msgCounter = 0;
}

/**
 * Parse a single NDJSON event from the Claude CLI stream-json output
 * into a UI-renderable message, or null if the event should be filtered.
 *
 * @param event - Parsed JSON object from an NDJSON line
 * @param sseEventType - Optional SSE event type (e.g. 'stderr')
 */
export function parseStreamEvent(
  event: any,
  sseEventType?: string,
): StreamUIMessage | null {
  // Handle stderr forwarded as 'stderr' SSE event type
  if (sseEventType === 'stderr') {
    return {
      id: nextId(),
      type: 'status',
      content: event.text,
      timestamp: Date.now(),
    };
  }

  if (event.type === 'stream_event') {
    const inner = event.event;

    // Tool use start
    if (
      inner.type === 'content_block_start' &&
      inner.content_block?.type === 'tool_use'
    ) {
      return {
        id: nextId(),
        type: 'tool-start',
        content: `Using ${inner.content_block.name}...`,
        toolName: inner.content_block.name,
        timestamp: Date.now(),
      };
    }

    // Text delta
    if (
      inner.type === 'content_block_delta' &&
      inner.delta?.type === 'text_delta'
    ) {
      return {
        id: nextId(),
        type: 'text',
        content: inner.delta.text,
        timestamp: Date.now(),
      };
    }

    // Everything else (content_block_start for text, content_block_stop,
    // input_json_delta) is filtered out
    return null;
  }

  // Generation complete
  if (event.type === 'result') {
    return {
      id: nextId(),
      type: 'status',
      content: 'Generation complete',
      timestamp: Date.now(),
    };
  }

  // System events and anything else -- filtered
  return null;
}
