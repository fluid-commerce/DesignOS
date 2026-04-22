import { useState } from 'react';
import type { Annotation } from '../lib/types';

interface AnnotationThreadProps {
  annotation: Annotation;
  onReply: (annotationId: string, text: string) => void;
  onClose: () => void;
}

/**
 * Popover panel showing an annotation's text and replies,
 * with an input field to add a new reply.
 */
export function AnnotationThread({ annotation, onReply, onClose }: AnnotationThreadProps) {
  const [replyText, setReplyText] = useState('');

  const handleSubmit = () => {
    const text = replyText.trim();
    if (!text) return;
    onReply(annotation.id, text);
    setReplyText('');
  };

  const isAgent = annotation.authorType === 'agent';

  return (
    <div
      data-testid={`annotation-thread-${annotation.id}`}
      style={{
        position: 'absolute',
        left: `${(annotation.x ?? 0) + 2}%`,
        top: `${(annotation.y ?? 0) + 2}%`,
        width: 260,
        maxHeight: 320,
        backgroundColor: '#1e1e1e',
        border: '1px solid #2a2a2e',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #2a2a2e',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isAgent ? '#8b5cf6' : '#44B2FF',
              marginRight: 6,
            }}
          />
          {annotation.author} &middot; Pin #{annotation.pinNumber}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0 4px',
          }}
          aria-label="Close thread"
        >
          x
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem 0.75rem',
        }}
      >
        {/* Original annotation */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#e0e0e0' }}>{annotation.text}</p>
          <span style={{ fontSize: '0.65rem', color: '#666' }}>
            {new Date(annotation.createdAt).toLocaleString()}
          </span>
        </div>

        {/* Replies */}
        {(annotation.replies ?? []).map((r) => (
          <div
            key={r.id}
            style={{
              marginBottom: '0.5rem',
              paddingLeft: '0.5rem',
              borderLeft: `2px solid ${r.authorType === 'agent' ? '#8b5cf6' : '#44B2FF'}`,
            }}
          >
            <span style={{ fontSize: '0.7rem', color: '#888' }}>{r.author}</span>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#ccc' }}>{r.text}</p>
            <span style={{ fontSize: '0.6rem', color: '#555' }}>
              {new Date(r.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '0.5rem 0.75rem',
          borderTop: '1px solid #2a2a2e',
        }}
      >
        <input
          data-testid="reply-input"
          type="text"
          placeholder="Reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          style={{
            flex: 1,
            backgroundColor: '#1a1a1e',
            border: '1px solid #2a2a2e',
            borderRadius: 4,
            color: '#e0e0e0',
            padding: '4px 8px',
            fontSize: '0.8rem',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            backgroundColor: '#44B2FF',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
