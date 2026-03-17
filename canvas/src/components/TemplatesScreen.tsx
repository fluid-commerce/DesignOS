import { useState, useEffect, useRef } from 'react';

interface DesignRule {
  id: string;
  scope: string;
  platform: string | null;
  archetypeSlug: string | null;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

interface CollapsibleSectionProps {
  label: string;
  description?: string;
  defaultExpanded: boolean;
  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleSection — animated expand/collapse with chevron
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({ label, description, defaultExpanded, children }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ marginBottom: 1 }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((v) => !v)}
        style={{
          height: 44,
          backgroundColor: '#141414',
          borderBottom: '1px solid #1e1e1e',
          paddingLeft: 24,
          paddingRight: 16,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: 10,
        }}
      >
        {/* Chevron */}
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: expanded ? '#44B2FF' : '#555',
          }}
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Label */}
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</span>
        {description && (
          <span style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>{description}</span>
        )}
      </div>
      {/* Content */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 2000 : 0,
          transition: 'max-height 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template card definitions — descriptive names, no archetype/template suffix
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_CARDS = [
  {
    slug: 'problem-first',
    name: 'Problem-First',
    purpose: 'Lead with the pain point, then present the solution',
    previewFile: 'problem-first.html',
  },
  {
    slug: 'quote',
    name: 'Quote',
    purpose: 'Feature a compelling testimonial or thought leadership quote',
    previewFile: 'quote.html',
  },
  {
    slug: 'stat-proof',
    name: 'Stat Proof',
    purpose: 'Lead with a powerful statistic that demands attention',
    previewFile: 'stat-proof.html',
  },
  {
    slug: 'app-highlight',
    name: 'App Highlight',
    purpose: 'Showcase a product feature or interface screenshot',
    previewFile: 'app-highlight.html',
  },
  {
    slug: 'partner-alert',
    name: 'Partner Alert',
    purpose: 'Announce a partnership or integration',
    previewFile: 'partner-alert.html',
  },
  {
    slug: 'comparison',
    name: 'Comparison',
    purpose: 'Side-by-side before/after or versus layout',
    previewFile: null,
  },
  {
    slug: 'timeline',
    name: 'Timeline',
    purpose: 'Sequential steps or chronological progression',
    previewFile: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TemplatesScreen — unified page: collapsible social rules + per-template cards
// ─────────────────────────────────────────────────────────────────────────────

export function TemplatesScreen() {
  const [rules, setRules] = useState<DesignRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/design-rules')
      .then((r) => r.json())
      .then((data: DesignRule[]) => {
        setRules(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const startEditing = (rule: DesignRule) => {
    setEditingId(rule.id);
    setEditContent(rule.content);
  };

  const saveRule = async (id: string, content: string) => {
    const prevRules = rules;
    setRules((r) => r.map((rule) => (rule.id === id ? { ...rule, content } : rule)));
    setEditingId(null);

    try {
      const res = await fetch(`/api/design-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedId(id);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedId(null), 2000);
    } catch {
      setRules(prevRules);
    }
  };

  const handleBlur = (id: string) => {
    if (editingId === id) {
      saveRule(id, editContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveRule(id, editContent);
    }
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const renderRule = (rule: DesignRule, minHeight: number) => {
    const isEditing = editingId === rule.id;
    const isSaved = savedId === rule.id;

    return (
      <div key={rule.id} style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>{rule.label}</h3>
          {isSaved && (
            <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 500 }}>Saved</span>
          )}
        </div>
        <textarea
          value={isEditing ? editContent : rule.content}
          readOnly={!isEditing}
          onClick={() => !isEditing && startEditing(rule)}
          onChange={(e) => isEditing && setEditContent(e.target.value)}
          onBlur={() => handleBlur(rule.id)}
          onKeyDown={(e) => handleKeyDown(e, rule.id)}
          style={{
            width: '100%',
            minHeight,
            backgroundColor: '#1a1a1a',
            border: `1px solid ${isEditing ? '#44B2FF' : '#333'}`,
            borderRadius: 6,
            padding: '12px',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: '0.8125rem',
            color: '#ccc',
            resize: 'vertical',
            cursor: isEditing ? 'text' : 'pointer',
            outline: 'none',
            lineHeight: 1.6,
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        {isEditing && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#555' }}>
            Click away or Ctrl+Enter to save — Esc to cancel
          </p>
        )}
      </div>
    );
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: '0.75rem',
    marginTop: '1.5rem',
    paddingBottom: '0.375rem',
    borderBottom: '1px solid #1e1e1e',
  };

  const globalRules = rules.filter((r) => r.scope === 'global-social');
  const platformRules = rules.filter((r) => r.scope === 'platform');
  const instagramRules = platformRules.filter((r) => r.platform === 'instagram');
  const linkedinRules = platformRules.filter((r) => r.platform === 'linkedin');
  const archetypeRules = rules.filter((r) => r.scope === 'archetype');

  return (
    <div
      style={{
        padding: '24px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#0d0d0d',
      }}
    >
      {/* Page heading + subtitle */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>
          Templates
        </h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: '#888', marginTop: 4, marginBottom: 0 }}>
          Designed examples that show how brand patterns come together for specific content types
        </p>
      </div>

      {/* Social Media Design Rules — collapsible, collapsed by default */}
      <CollapsibleSection
        label="Social Media Design Rules"
        description="Rules that apply to all social posts. Includes platform-specific guidelines for Instagram and LinkedIn."
        defaultExpanded={false}
      >
        <div style={{ padding: '1rem' }}>
          {loading && (
            <div style={{ color: '#555', fontSize: '0.85rem' }}>Loading design rules...</div>
          )}

          {!loading && rules.length === 0 && (
            <div style={{ color: '#555', fontSize: '0.85rem' }}>
              <p style={{ margin: 0 }}>No design rules found.</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#444' }}>
                Run the server to seed the database.
              </p>
            </div>
          )}

          {!loading && globalRules.length > 0 && (
            <section>
              <p style={{ ...sectionHeadingStyle, marginTop: 0 }}>General Social Media</p>
              {globalRules.map((r) => renderRule(r, 120))}
            </section>
          )}

          {!loading && instagramRules.length > 0 && (
            <section>
              <p style={sectionHeadingStyle}>Instagram</p>
              {instagramRules.map((r) => renderRule(r, 120))}
            </section>
          )}

          {!loading && linkedinRules.length > 0 && (
            <section>
              <p style={sectionHeadingStyle}>LinkedIn</p>
              {linkedinRules.map((r) => renderRule(r, 120))}
            </section>
          )}
        </div>
      </CollapsibleSection>

      {/* Template cards */}
      {TEMPLATE_CARDS.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          marginTop: 32,
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="32" height="32" rx="3" />
            <line x1="4" y1="14" x2="36" y2="14" />
            <line x1="20" y1="14" x2="20" y2="36" />
          </svg>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', margin: '12px 0 4px' }}>
            No templates yet
          </h4>
          <p style={{ fontSize: 12, fontWeight: 400, color: '#888', margin: 0, maxWidth: 300 }}>
            Templates are seeded automatically on first app startup.
          </p>
        </div>
      ) : (
      <div
        style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 24,
        }}
      >
        {TEMPLATE_CARDS.map((template) => {
          const templateRules = archetypeRules.filter((r) => r.archetypeSlug === template.slug);

          return (
            <div
              key={template.slug}
              style={{
                backgroundColor: '#1a1a1e',
                border: '1px solid #1e1e1e',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Template HTML preview */}
              {template.previewFile ? (
                <iframe
                  src={`/templates/social/${template.previewFile}`}
                  style={{ width: '100%', height: 300, border: 'none', display: 'block' }}
                  title={template.name}
                  sandbox="allow-scripts"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 300,
                    backgroundColor: '#111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#444',
                    fontSize: 13,
                  }}
                >
                  Preview not available
                </div>
              )}

              {/* Template name + purpose */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e1e' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {template.name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 400, color: '#888' }}>
                  {template.purpose}
                </p>
              </div>

              {/* Per-template design rules — collapsible, collapsed by default */}
              {templateRules.length > 0 && (
                <CollapsibleSection label="Design Rules" defaultExpanded={false}>
                  <div style={{ padding: '1rem' }}>
                    {templateRules.map((r) => renderRule(r, 80))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
