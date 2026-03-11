import type { StreamUIMessage } from '../lib/stream-parser';

interface StreamMessageProps {
  message: StreamUIMessage;
}

/**
 * Renders a single stream event as a chat-like element.
 * Types: text (dark bubble), tool-start (status pill), status (centered grey), error (red bubble).
 */
export function StreamMessage({ message }: StreamMessageProps) {
  switch (message.type) {
    case 'text':
      return (
        <div
          data-msg-type="text"
          style={{
            backgroundColor: '#2a2a3e',
            color: '#e0e0e0',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px 8px 8px 2px',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
      );

    case 'tool-start':
      return (
        <div
          data-msg-type="tool-start"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#1e2d40',
            color: '#7bb8e0',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: '0.72rem',
          }}
        >
          <span style={{ opacity: 0.6 }}>&#9881;</span>
          {message.content}
        </div>
      );

    case 'tool-done':
      return (
        <div
          data-msg-type="tool-done"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#1e3d2e',
            color: '#7be0a0',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: '0.72rem',
          }}
        >
          <span>&#10003;</span>
          {message.content}
        </div>
      );

    case 'status':
      return (
        <div
          data-msg-type="status"
          style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '0.72rem',
            padding: '0.25rem 0',
          }}
        >
          {message.content}
        </div>
      );

    case 'error':
      return (
        <div
          data-msg-type="error"
          style={{
            backgroundColor: '#3e2a2a',
            color: '#e08080',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px 8px 8px 2px',
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}
        >
          {message.content}
        </div>
      );

    default:
      return null;
  }
}
