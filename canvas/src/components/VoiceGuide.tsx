import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Static ?raw imports for all 13 Voice Guide markdown docs
import whatIsFluidMd from '../../../voice-guide/What_Is_Fluid.md?raw';
import theProblemMd from '../../../voice-guide/The_Problem_Were_Solving.md?raw';
import whyWecommerceMd from '../../../voice-guide/Why_WeCommerce_Exists.md?raw';
import voiceAndStyleMd from '../../../voice-guide/Voice_and_Style_Guide.md?raw';
import builderMd from '../../../voice-guide/Builder.md?raw';
import checkoutMd from '../../../voice-guide/Checkout.md?raw';
import dropletsMd from '../../../voice-guide/Droplets.md?raw';
import fluidConnectMd from '../../../voice-guide/Fluid_Connect.md?raw';
import fluidPaymentsMd from '../../../voice-guide/Fluid_Payments.md?raw';
import fairShareMd from '../../../voice-guide/FairShare.md?raw';
import corporateToolsMd from '../../../voice-guide/Corporate_Tools.md?raw';
import appRepToolsMd from '../../../voice-guide/App_Rep_Tools.md?raw';
import blitzWeekMd from '../../../voice-guide/What_is_Blitz_Week.md?raw';

const DOCS = [
  { id: 'what-is-fluid', label: 'What Is Fluid', content: whatIsFluidMd },
  { id: 'the-problem', label: "The Problem We're Solving", content: theProblemMd },
  { id: 'why-wecommerce', label: 'Why WeCommerce Exists', content: whyWecommerceMd },
  { id: 'voice-and-style', label: 'Voice and Style Guide', content: voiceAndStyleMd },
  { id: 'builder', label: 'Builder', content: builderMd },
  { id: 'checkout', label: 'Checkout', content: checkoutMd },
  { id: 'droplets', label: 'Droplets', content: dropletsMd },
  { id: 'fluid-connect', label: 'Fluid Connect', content: fluidConnectMd },
  { id: 'fluid-payments', label: 'Fluid Payments', content: fluidPaymentsMd },
  { id: 'fair-share', label: 'FairShare', content: fairShareMd },
  { id: 'corporate-tools', label: 'Corporate Tools', content: corporateToolsMd },
  { id: 'app-rep-tools', label: 'App Rep Tools', content: appRepToolsMd },
  { id: 'blitz-week', label: 'What Is Blitz Week', content: blitzWeekMd },
] as const;

type DocId = (typeof DOCS)[number]['id'];

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
  const [activeDocId, setActiveDocId] = useState<DocId>(DOCS[0].id);

  const selectedDoc = DOCS.find((d) => d.id === activeDocId) ?? DOCS[0];

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
        {DOCS.map((doc) => {
          const isActive = doc.id === activeDocId;
          return (
            <button
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {selectedDoc.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
