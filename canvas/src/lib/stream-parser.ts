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

    // Content block stop (tool finished executing)
    if (inner.type === 'content_block_stop') {
      return null; // filtered, tool-done comes from tool_result
    }

    // Everything else (content_block_start for text, input_json_delta) filtered
    return null;
  }

  // Tool result from Claude CLI
  if (event.type === 'tool_result') {
    return {
      id: nextId(),
      type: 'tool-done',
      content: event.tool_name
        ? `${event.tool_name} completed`
        : 'Tool completed',
      toolName: event.tool_name,
      timestamp: Date.now(),
    };
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

  // Assistant messages contain the actual response text
  // Format: { type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
  if (event.type === 'assistant' && event.message?.content) {
    const textParts = event.message.content
      .filter((c: any) => c.type === 'text' && c.text)
      .map((c: any) => c.text)
      .join('');
    if (textParts) {
      return {
        id: nextId(),
        type: 'text',
        content: textParts,
        timestamp: Date.now(),
      };
    }

    // Handle tool_use content blocks in assistant messages
    const toolUses = event.message.content.filter(
      (c: any) => c.type === 'tool_use',
    );
    for (const tool of toolUses) {
      return {
        id: nextId(),
        type: 'tool-start',
        content: `Using ${tool.name}...`,
        toolName: tool.name,
        timestamp: Date.now(),
      };
    }
  }

  // System events and anything else -- filtered
  return null;
}
