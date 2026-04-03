import { useState, useEffect, useCallback } from 'react';

type StyleScope = 'global' | 'instagram' | 'linkedin' | 'one-pager';

interface BrandStyle {
  id: string;
  scope: string;
  cssContent: string;
  updatedAt: number;
}

const SCOPES: { id: StyleScope; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'one-pager', label: 'One-Pager' },
];

export function StylesScreen() {
  const [activeScope, setActiveScope] = useState<StyleScope>('global');
  const [brandStyles, setBrandStyles] = useState<Record<StyleScope, string>>({
    global: '',
    instagram: '',
    linkedin: '',
    'one-pager': '',
  });
  const [systemDefaults, setSystemDefaults] = useState<Record<StyleScope, string>>({
    global: '',
    instagram: '',
    linkedin: '',
    'one-pager': '',
  });
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load brand styles and system defaults
  useEffect(() => {
    Promise.all([
      fetch('/api/brand-styles').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/system-styles').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([styles, defaults]) => {
      if (Array.isArray(styles)) {
        const map: Record<string, string> = {};
        for (const s of styles as BrandStyle[]) {
          map[s.scope] = s.cssContent;
        }
        setBrandStyles(prev => ({ ...prev, ...map }));
      }
      setSystemDefaults(prev => ({ ...prev, ...(defaults as Record<string, string>) }));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/brand-styles/${activeScope}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cssContent: brandStyles[activeScope] }),
      });
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } catch (err) {
      console.error('Failed to save brand style:', err);
    } finally {
      setSaving(false);
    }
  }, [activeScope, brandStyles]);

  const handleCssChange = useCallback((value: string) => {
    setBrandStyles(prev => ({ ...prev, [activeScope]: value }));
  }, [activeScope]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading styles...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Styles</h1>
        <p style={styles.subtitle}>
          CSS layer system — brand overrides merge on top of system defaults.
        </p>
      </div>

      {/* Scope tabs */}
      <div style={styles.tabs}>
        {SCOPES.map(({ id, label }) => {
          const isActive = activeScope === id;
          return (
            <button
              key={id}
              onClick={() => setActiveScope(id)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#aaa';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#666';
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div style={styles.content}>
        {/* System defaults (read-only) */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionLabel}>System Defaults</span>
            <span style={styles.readOnlyBadge}>Read-only</span>
          </div>
          <textarea
            readOnly
            value={systemDefaults[activeScope]}
            style={styles.codePreview}
            spellCheck={false}
          />
        </div>

        {/* Brand overrides (editable) */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionLabel}>Brand Overrides</span>
            {saveFlash && <span style={styles.savedBadge}>Saved</span>}
          </div>
          <textarea
            value={brandStyles[activeScope]}
            onChange={(e) => handleCssChange(e.target.value)}
            placeholder={`/* Brand CSS overrides for ${activeScope} scope */\n/* Properties here override system defaults */\n\n:root {\n  --font-headline: 'YourFont', sans-serif;\n}`}
            style={styles.codeEditor}
            spellCheck={false}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.saveButton,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0d0d0d',
  },
  loading: {
    padding: '3rem',
    color: '#666',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  header: {
    flexShrink: 0,
    padding: '24px 1.5rem 16px',
    borderBottom: '1px solid #1e1e1e',
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
    color: '#e0e0e0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '0.8125rem',
    color: '#666',
    lineHeight: 1.4,
  },
  tabs: {
    flexShrink: 0,
    display: 'flex',
    gap: '2px',
    padding: '0 1.5rem',
    borderBottom: '1px solid #1e1e1e',
    backgroundColor: '#0d0d0d',
  },
  tab: {
    padding: '10px 16px',
    fontSize: '0.75rem',
    fontWeight: 400,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: '#666',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.15s',
    fontFamily: 'inherit',
  },
  tabActive: {
    fontWeight: 600,
    color: '#e0e0e0',
    borderBottomColor: '#44B2FF',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#888',
  },
  readOnlyBadge: {
    fontSize: '0.6rem',
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#555',
    padding: '2px 6px',
    border: '1px solid #2a2a2e',
    borderRadius: 3,
  },
  savedBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#44b574',
    letterSpacing: '0.04em',
  },
  codePreview: {
    width: '100%',
    minHeight: 160,
    maxHeight: 240,
    padding: '12px 14px',
    backgroundColor: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 6,
    color: '#666',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    resize: 'vertical' as const,
    outline: 'none',
  },
  codeEditor: {
    width: '100%',
    minHeight: 240,
    padding: '12px 14px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2e',
    borderRadius: 6,
    color: '#e0e0e0',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  saveButton: {
    alignSelf: 'flex-start',
    padding: '8px 20px',
    backgroundColor: '#44B2FF',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
};
