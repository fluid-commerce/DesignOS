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

type TemplatesTab = 'templates' | 'social-media-dna';

// ─────────────────────────────────────────────────────────────────────────────
// DesignDnaPanel — inline-editable design rules grouped by scope
// ─────────────────────────────────────────────────────────────────────────────

function DesignDnaPanel() {
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
    // Optimistic update
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
      // Revert on failure
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '0.85rem' }}>
        Loading design rules...
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
        <p>No design rules found.</p>
        <p style={{ fontSize: '0.75rem', color: '#444' }}>Run the server to seed the database.</p>
      </div>
    );
  }

  const globalRules = rules.filter((r) => r.scope === 'global-social');
  const platformRules = rules.filter((r) => r.scope === 'platform');
  const instagramRules = platformRules.filter((r) => r.platform === 'instagram');
  const linkedinRules = platformRules.filter((r) => r.platform === 'linkedin');
  const archetypeRules = rules.filter((r) => r.scope === 'archetype');

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

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* General Social Media */}
      {globalRules.length > 0 && (
        <section>
          <p style={{ ...sectionHeadingStyle, marginTop: 0 }}>General Social Media</p>
          {globalRules.map((r) => renderRule(r, 120))}
        </section>
      )}

      {/* Instagram */}
      {instagramRules.length > 0 && (
        <section>
          <p style={sectionHeadingStyle}>Instagram</p>
          {instagramRules.map((r) => renderRule(r, 120))}
        </section>
      )}

      {/* LinkedIn */}
      {linkedinRules.length > 0 && (
        <section>
          <p style={sectionHeadingStyle}>LinkedIn</p>
          {linkedinRules.map((r) => renderRule(r, 120))}
        </section>
      )}

      {/* Archetype Design Notes */}
      {archetypeRules.length > 0 && (
        <section>
          <p style={sectionHeadingStyle}>Archetype Design Notes</p>
          {archetypeRules.map((r) => renderRule(r, 80))}
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplatesScreen — tab bar wrapping template iframe + Design DNA panel
// ─────────────────────────────────────────────────────────────────────────────

export function TemplatesScreen() {
  const [activeTab, setActiveTab] = useState<TemplatesTab>('templates');

  const tabs: { id: TemplatesTab; label: string }[] = [
    { id: 'templates', label: 'Templates' },
    { id: 'social-media-dna', label: 'Social Media DNA' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        flexShrink: 0,
        borderBottom: '1px solid #1e1e1e',
        backgroundColor: '#0d0d0d',
        padding: '0 1rem',
        gap: '2px',
      }}>
        {tabs.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '10px 14px',
                fontSize: '0.72rem',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: isActive ? '#fff' : '#888',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s',
                fontFamily: 'inherit',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#ccc';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#888';
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Templates iframe — always mounted, hidden when not active to preserve scroll state */}
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'templates' ? 'block' : 'none' }}>
          <iframe
            src="/templates/"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Template Library"
          />
        </div>

        {/* Social Media DNA panel */}
        {activeTab === 'social-media-dna' && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <DesignDnaPanel />
          </div>
        )}
      </div>
    </div>
  );
}
