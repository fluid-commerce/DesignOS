import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface VoiceGuideDoc {
  id: string;
  slug: string;
  label: string;
  content: string;
}

// Dark-theme markdown component overrides
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: '1.75rem', color: '#fff', marginTop: '2rem', marginBottom: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: '1.375rem', color: '#fff', marginTop: '2rem', marginBottom: '0.75rem', fontWeight: 600, lineHeight: 1.3 }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: '1.125rem', color: '#fff', marginTop: '1.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: '1rem', color: '#e0e0e0', marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p style={{ marginBottom: '1rem', lineHeight: 1.7 }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', lineHeight: 1.7 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem', lineHeight: 1.7 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: '0.25rem' }}>{children}</li>
  ),
  code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
    inline ? (
      <code
        style={{
          backgroundColor: '#1a1a1e',
          padding: '0.125rem 0.375rem',
          borderRadius: 3,
          fontSize: '0.875em',
          color: '#44B2FF',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        style={{
          display: 'block',
          backgroundColor: '#1a1a1e',
          padding: '1rem',
          borderRadius: 6,
          overflow: 'auto',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          color: '#d4d4d4',
          marginBottom: '1rem',
        }}
        {...props}
      >
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre style={{ margin: '0 0 1rem', overflow: 'auto' }}>{children}</pre>
  ),
  a: ({ children, href }) => (
    <a href={href} style={{ color: '#44B2FF', textDecoration: 'underline' }} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: '3px solid #44B2FF',
        paddingLeft: '1rem',
        margin: '1rem 0',
        color: '#aaa',
        fontStyle: 'italic',
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #2a2a2e', margin: '1.5rem 0' }} />,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        padding: '8px 12px',
        border: '1px solid #2a2a2e',
        backgroundColor: '#1a1a1e',
        color: '#fff',
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '8px 12px', border: '1px solid #2a2a2e', color: '#d4d4d4' }}>
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong style={{ color: '#fff', fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: '#ccc' }}>{children}</em>
  ),
};

export function VoiceGuide() {
  const [docs, setDocs] = useState<VoiceGuideDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocSlug, setActiveDocSlug] = useState<string>('');

  useEffect(() => {
    fetch('/api/voice-guide')
      .then(r => r.json())
      .then((data: VoiceGuideDoc[]) => {
        setDocs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Set first doc as active once docs load
  useEffect(() => {
    if (docs.length > 0 && !activeDocSlug) {
      setActiveDocSlug(docs[0].slug);
    }
  }, [docs, activeDocSlug]);

  const selectedDoc = docs.find(d => d.slug === activeDocSlug);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: vertical side-tabs panel */}
      <nav
        style={{
          width: 180,
          flexShrink: 0,
          borderRight: '1px solid #1e1e1e',
          backgroundColor: '#111111',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        aria-label="Voice Guide documents"
      >
        <div
          style={{
            padding: '12px 14px 8px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#555',
            borderBottom: '1px solid #1e1e1e',
            flexShrink: 0,
          }}
        >
          Voice Guide
        </div>
        {docs.map((doc) => {
          const isActive = doc.slug === activeDocSlug;
          return (
            <button
              key={doc.slug}
              onClick={() => setActiveDocSlug(doc.slug)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: '0.8125rem',
                color: isActive ? '#fff' : '#888',
                backgroundColor: isActive ? '#1a1a1e' : 'transparent',
                borderLeft: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                border: 'none',
                borderLeftWidth: 2,
                borderLeftStyle: 'solid',
                borderLeftColor: isActive ? '#44B2FF' : 'transparent',
                cursor: 'pointer',
                lineHeight: 1.4,
                transition: 'background-color 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#1a1a1e';
                  e.currentTarget.style.color = '#ccc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#888';
                }
              }}
              aria-label={doc.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {doc.label}
            </button>
          );
        })}
      </nav>

      {/* Right: markdown content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem',
          color: '#d4d4d4',
          lineHeight: 1.7,
          fontSize: '0.9375rem',
        }}
      >
        {loading && docs.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', marginTop: '2rem' }}>Loading...</p>
        ) : selectedDoc ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {selectedDoc.content}
          </ReactMarkdown>
        ) : null}
      </div>
    </div>
  );
}
