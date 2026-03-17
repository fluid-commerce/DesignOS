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
            backgroundColor: '#2a2a2e',
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

    case 'stage-running': {
      const stageLabels: Record<string, string> = {
        copy: '\u{1F4DD} Writing copy',
        layout: '\u{1F9F1} Building layout',
        styling: '\u{1F3A8} Applying styling',
        'spec-check': '\u2713 Running spec-check',
      };
      const label = stageLabels[message.content] ?? message.content;
      return (
        <div
          data-msg-type="stage-running"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#1e2d40',
            color: '#7bb8e0',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: '0.72rem',
          }}
        >
          <span className="spin" style={{ display: 'inline-block', width: 12, height: 12 }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          </span>
          {label}
        </div>
      );
    }

    case 'stage-done': {
      const doneLabels: Record<string, string> = {
        copy: '\u{1F4DD} Copy complete',
        layout: '\u{1F9F1} Layout complete',
        styling: '\u{1F3A8} Styling complete',
        'spec-check': '\u2713 Spec-check complete',
      };
      const doneLabel = doneLabels[message.content] ?? `${message.content} complete`;
      return (
        <div
          data-msg-type="stage-done"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#1e3d2e',
            color: '#7be0a0',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: '0.72rem',
          }}
        >
          <span>&#10003;</span>
          {doneLabel}
        </div>
      );
    }

    case 'stage-narrative':
      return (
        <div
          data-msg-type="stage-narrative"
          style={{
            backgroundColor: '#2a2a2e',
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

    default:
      return null;
  }
}
