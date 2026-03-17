import { useState, useEffect, useRef, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandPattern {
  id: string;
  slug: string;
  label: string;
  category: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

// ─── Group mapping ────────────────────────────────────────────────────────────

function getPatternGroup(category: string): 'foundations' | 'rules' {
  if (category === 'design-tokens') return 'foundations';
  return 'rules';
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  label: string;
  description?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function CollapsibleSection({ label, description, defaultExpanded = true, children }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          height: 44,
          backgroundColor: '#141414',
          borderBottom: '1px solid #1e1e1e',
          paddingLeft: 24,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            marginRight: 10,
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: expanded ? '#44B2FF' : '#555',
          }}
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</span>
        {description && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#555', marginLeft: 12 }}>{description}</span>
        )}
      </div>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
          transition: 'max-height 200ms ease-out, opacity 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── PatternCard ──────────────────────────────────────────────────────────────

interface PatternCardProps {
  pattern: BrandPattern;
  onSave: (slug: string, content: string) => Promise<void>;
  isEditing: boolean;
  isSaved: boolean;
  isSaveFailed: boolean;
  editContent: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

function PatternCard({
  pattern,
  isEditing,
  isSaved,
  isSaveFailed,
  editContent,
  onStartEdit,
  onEditChange,
  onBlur,
  onKeyDown,
}: PatternCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#1a1a1e',
        border: `1px solid ${hovered ? '#2a2a2e' : '#1e1e1e'}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Visual preview */}
      {pattern.content.trim() ? (
        <iframe
          srcDoc={pattern.content}
          sandbox="allow-scripts"
          style={{ width: '100%', height: 160, border: 'none', background: '#0d0d0d', display: 'block' }}
          title={pattern.label}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#555',
            background: '#0d0d0d',
          }}
        >
          No preview available
        </div>
      )}

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 4px 12px' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>{pattern.label}</span>
        {isSaved && (
          <span style={{ fontSize: 12, color: '#44B2FF', fontWeight: 500 }}>Saved</span>
        )}
      </div>

      {/* Editable text */}
      <div style={{ padding: '0 12px 12px 12px', flex: 1 }}>
        <textarea
          value={isEditing ? editContent : pattern.content}
          readOnly={!isEditing}
          onClick={() => !isEditing && onStartEdit()}
          onChange={(e) => isEditing && onEditChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          style={{
            width: '100%',
            minHeight: 80,
            backgroundColor: '#141414',
            border: `1px solid ${isEditing ? '#44B2FF' : '#2a2a2e'}`,
            borderRadius: 6,
            padding: 10,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: '0.75rem',
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
          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#555' }}>
            Click away or Ctrl+Enter to save — Esc to cancel
          </p>
        )}
        {isSaveFailed && (
          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#f87171' }}>
            Save failed. Your change was not applied — the previous value has been restored.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── PatternsScreen ───────────────────────────────────────────────────────────

export function PatternsScreen() {
  const [patterns, setPatterns] = useState<BrandPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/brand-patterns')
      .then((r) => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then((data: BrandPattern[]) => {
        setPatterns(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const startEditing = (pattern: BrandPattern) => {
    setEditingSlug(pattern.slug);
    setEditContent(pattern.content);
    setFailedSlug(null);
  };

  const savePattern = async (slug: string, content: string) => {
    const prevPatterns = patterns;
    // Optimistic update
    setPatterns((ps) => ps.map((p) => (p.slug === slug ? { ...p, content } : p)));
    setEditingSlug(null);

    try {
      const res = await fetch(`/api/brand-patterns/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedSlug(slug);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedSlug(null), 2000);
    } catch {
      // Revert on failure
      setPatterns(prevPatterns);
      setFailedSlug(slug);
      if (failedTimerRef.current) clearTimeout(failedTimerRef.current);
      failedTimerRef.current = setTimeout(() => setFailedSlug(null), 4000);
    }
  };

  const handleBlur = (slug: string) => {
    if (editingSlug === slug) {
      savePattern(slug, editContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, slug: string) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      savePattern(slug, editContent);
    }
    if (e.key === 'Escape') {
      setEditingSlug(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#0d0d0d',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid #333',
            borderTopColor: '#555',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#0d0d0d',
          color: '#777',
          fontSize: 14,
          padding: 24,
          textAlign: 'center',
        }}
      >
        Failed to load Patterns data. Check the server is running and refresh.
      </div>
    );
  }

  const foundationsPatterns = patterns.filter((p) => getPatternGroup(p.category) === 'foundations');
  const rulesPatterns = patterns.filter((p) => getPatternGroup(p.category) === 'rules');

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 24,
    padding: '16px 0',
  };

  const renderPatternCard = (pattern: BrandPattern) => (
    <PatternCard
      key={pattern.slug}
      pattern={pattern}
      onSave={savePattern}
      isEditing={editingSlug === pattern.slug}
      isSaved={savedSlug === pattern.slug}
      isSaveFailed={failedSlug === pattern.slug}
      editContent={editContent}
      onStartEdit={() => startEditing(pattern)}
      onEditChange={setEditContent}
      onBlur={() => handleBlur(pattern.slug)}
      onKeyDown={(e) => handleKeyDown(e, pattern.slug)}
    />
  );

  return (
    <div
      style={{
        padding: 24,
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#0d0d0d',
      }}
    >
      <CollapsibleSection
        label="Foundations"
        description={`${foundationsPatterns.length} patterns`}
        defaultExpanded={true}
      >
        <div style={gridStyle}>
          {foundationsPatterns.map(renderPatternCard)}
        </div>
      </CollapsibleSection>

      <div style={{ height: 48 }} />

      <CollapsibleSection
        label="Rules"
        description={`${rulesPatterns.length} patterns`}
        defaultExpanded={true}
      >
        <div style={gridStyle}>
          {rulesPatterns.map(renderPatternCard)}
        </div>
      </CollapsibleSection>
    </div>
  );
}
