import React, { useState } from 'react';
import type { ChatMessageUI, ToolCallUI } from '../store/chat';

function ToolCallBlock({ tc }: { tc: ToolCallUI }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = tc.status === 'pending' ? '\u23F3' : tc.status === 'error' ? '\u274C' : '\u2705';
  const label = (tc.tool ?? 'unknown').replace(/_/g, ' ');

  return (
    <div className="chat-tool-call" onClick={() => setExpanded(!expanded)}>
      <div className="chat-tool-header">
        <span className="chat-tool-status">{statusIcon}</span>
        <span className="chat-tool-name">{label}</span>
        {tc.hasImage && <span className="chat-tool-badge">screenshot</span>}
        <span className="chat-tool-expand">{expanded ? '\u25BE' : '\u25B8'}</span>
      </div>
      {expanded && tc.result && (
        <pre className="chat-tool-result">{tc.result}</pre>
      )}
      {expanded && tc.error && (
        <pre className="chat-tool-result chat-tool-error">{tc.error}</pre>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageUI }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message chat-message-${message.role}`}>
      <div className="chat-message-role">{isUser ? 'You' : 'Agent'}</div>
      {message.content && (
        <div className="chat-message-content">{message.content}</div>
      )}
      {message.toolCalls.length > 0 && (
        <div className="chat-tool-calls">
          {message.toolCalls.map((tc, idx) => (
            <ToolCallBlock key={tc.id ?? idx} tc={tc} />
          ))}
        </div>
      )}
      {message.isStreaming && !message.content && message.toolCalls.length === 0 && (
        <div className="chat-message-thinking">Thinking...</div>
      )}
    </div>
  );
}
