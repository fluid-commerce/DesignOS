import { useState, useEffect, useRef } from 'react';

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

// ─── Category → Display Group ─────────────────────────────────────────────────

interface PatternGroup {
  id: string;
  title: string;
  subtitle: string;
  slugs: string[]; // ordered
}

const DISPLAY_GROUPS: PatternGroup[] = [
  {
    id: 'visual-tokens',
    title: 'Visual Tokens',
    subtitle: 'Color foundations, typography rules, and opacity patterns.',
    slugs: ['color-palette', 'typography', 'opacity-patterns'],
  },
  {
    id: 'brand-assets',
    title: 'Brand Assets',
    subtitle: 'Textures, emphasis elements, photos, logos, and footer structure.',
    slugs: [
      'brushstroke-textures',
      'circles-underlines',
      'lines',
      'scribbles',
      'x-marks',
      'photos-mockups',
      'logos-icons',
      'footer-structure',
    ],
  },
  {
    id: 'patterns',
    title: 'Patterns',
    subtitle: 'Compositional rules, FLFont usage, and layout archetypes.',
    slugs: ['flfont-taglines', 'layout-archetypes', 'visual-compositor-contract'],
  },
];

// ─── Rewrite asset paths ──────────────────────────────────────────────────────

function rewriteAssetPaths(html: string): string {
  // DB content has ../assets/ or assets/ paths — rewrite to /fluid-assets/
  let result = html
    .replace(/\.\.\/assets\//g, '/fluid-assets/')
    .replace(/(?<=['"])assets\//g, '/fluid-assets/');

  // Inject mask-image inline from data-mask attributes so masks render immediately
  // without needing a useEffect (which can race with React re-renders)
  result = result.replace(
    /data-mask="([^"]+)"([^>]*?)style="([^"]*)"/g,
    (_, maskUrl, between, existingStyle) => {
      const maskCss = `-webkit-mask-image: url('${maskUrl}'); mask-image: url('${maskUrl}');`;
      return `data-mask="${maskUrl}"${between}style="${existingStyle} ${maskCss}"`;
    }
  );

  return result;
}

// ─── Pattern styles (from patterns/index.html <style> block) ──────────────────

const PATTERN_STYLES = `
  /* ============================================================
     FONT FACES
     ============================================================ */
  @font-face {
    font-family: 'flfontbold';
    src: url('/fluid-assets/fonts/flfontbold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
  }
  @font-face {
    font-family: 'NeueHaas';
    src: url('/fluid-assets/fonts/Inter-VariableFont.ttf') format('truetype');
    font-weight: 100 900;
    font-style: normal;
  }
  @font-face {
    font-family: 'Inter';
    src: url('/fluid-assets/fonts/Inter-VariableFont.ttf') format('truetype');
    font-weight: 100 900;
    font-style: normal;
  }

  /* ============================================================
     PATTERN CONTENT STYLES
     ============================================================ */
  .pattern-content {
    font-family: 'Inter', 'NeueHaas', sans-serif;
    font-size: 15px;
    line-height: 1.6;
    color: #fff;
  }

  /* Section subtitle */
  .pattern-content .section-subtitle {
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    margin-bottom: 32px;
  }
  .pattern-content .subsection {
    margin-bottom: 48px;
  }
  .pattern-content .subsection-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 16px;
    color: rgba(255,255,255,0.9);
  }

  /* Weight badges */
  .pattern-content .weight-badge {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 3px;
    font-weight: 600;
    margin-left: 8px;
    vertical-align: middle;
  }
  .pattern-content .weight-critical { background: rgba(255,59,48,0.2); color: #ff3b30; }
  .pattern-content .weight-strong { background: rgba(255,139,88,0.2); color: #FF8B58; }
  .pattern-content .weight-flexible { background: rgba(66,177,255,0.2); color: #42b1ff; }
  .pattern-content .weight-optional { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }

  /* Code blocks */
  .pattern-content .code-block {
    background: #111;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    padding: 20px;
    margin: 16px 0;
    overflow-x: auto;
    position: relative;
  }
  .pattern-content .code-block pre {
    margin: 0;
    font-family: 'Space Mono', 'SF Mono', 'Menlo', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255,255,255,0.75);
    white-space: pre;
  }
  .pattern-content .code-block .code-label {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* Color swatches */
  .pattern-content .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .pattern-content .swatch {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .pattern-content .swatch-color {
    height: 80px;
  }
  .pattern-content .swatch-info {
    padding: 12px;
    background: #111;
  }
  .pattern-content .swatch-hex {
    font-family: monospace;
    font-size: 13px;
    color: #fff;
  }
  .pattern-content .swatch-label {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    margin-top: 4px;
  }

  /* Typography samples */
  .pattern-content .type-sample {
    margin-bottom: 24px;
    padding: 24px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
  }
  .pattern-content .type-sample-meta {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    margin-top: 8px;
    font-family: monospace;
  }

  /* Asset previews */
  .pattern-content .asset-preview {
    background: #000;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }
  .pattern-content .asset-preview img {
    max-width: 100%;
    height: auto;
  }
  .pattern-content .asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
  }

  /* Opacity demo */
  .pattern-content .opacity-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }
  .pattern-content .opacity-sample {
    width: 60px;
    height: 40px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
  }

  /* Table */
  .pattern-content .info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }
  .pattern-content .info-table th,
  .pattern-content .info-table td {
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pattern-content .info-table th {
    color: rgba(255,255,255,0.45);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pattern-content .info-table td { color: rgba(255,255,255,0.75); }
  .pattern-content .info-table code {
    font-family: monospace;
    font-size: 12px;
    background: rgba(255,255,255,0.06);
    padding: 2px 6px;
    border-radius: 3px;
  }

  /* Wireframe boxes */
  .pattern-content .wireframe {
    background: #111;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 24px;
    min-height: 200px;
    position: relative;
  }
  .pattern-content .wireframe-element {
    background: rgba(255,255,255,0.06);
    border: 1px dashed rgba(255,255,255,0.15);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    text-align: center;
    margin-bottom: 8px;
  }
  .pattern-content .wireframe-label {
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 12px;
  }

  /* Footer demo */
  .pattern-content .footer-demo {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 68px;
    background: #000;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
  }
  .pattern-content .footer-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pattern-content .footer-left img { height: 20px; }
  .pattern-content .footer-separator {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,0.15);
  }
  .pattern-content .footer-right img { height: 24px; }

  /* Layout grid */
  .pattern-content .layout-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
  }
  .pattern-content .layout-card {
    background: #0a0a0a;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    overflow: hidden;
  }
  .pattern-content .layout-card-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pattern-content .layout-card-header h4 {
    font-size: 14px;
    font-weight: 700;
  }
  .pattern-content .layout-card-body {
    padding: 20px;
  }

  /* Details / collapsible */
  .pattern-content details {
    margin: 12px 0;
  }
  .pattern-content details summary {
    cursor: pointer;
    font-size: 13px;
    color: #42b1ff;
    padding: 8px 0;
  }
  .pattern-content details summary:hover { text-decoration: underline; }

  /* Generic code/inline elements */
  .pattern-content code {
    font-family: monospace;
    font-size: 12px;
    background: rgba(255,255,255,0.06);
    padding: 2px 6px;
    border-radius: 3px;
  }

  /* Fix data-mask elements — apply mask-image from data attribute via JS */

  /* Spinner animation */
  @keyframes patterns-spin { to { transform: rotate(360deg); } }
`;

// ─── PatternSection Component ─────────────────────────────────────────────────

interface PatternSectionProps {
  pattern: BrandPattern;
  onSave: (slug: string, content: string) => Promise<void>;
  savedSlug: string | null;
  failedSlug: string | null;
}

function PatternSection({ pattern, onSave, savedSlug, failedSlug }: PatternSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  // After render, apply data-mask attributes as actual mask-image styles
  useEffect(() => {
    if (!contentRef.current || editing) return;
    const masked = contentRef.current.querySelectorAll('[data-mask]');
    masked.forEach((el) => {
      const maskPath = el.getAttribute('data-mask');
      if (!maskPath) return;
      const url = maskPath.startsWith('/') ? maskPath : `/fluid-assets/${maskPath.replace(/^\.\.\/assets\//, '')}`;
      const s = (el as HTMLElement).style;
      s.webkitMaskImage = `url('${url}')`;
      s.maskImage = `url('${url}')`;
    });
  }, [pattern.content, editing]);

  const handleStartEdit = () => {
    setEditContent(pattern.content);
    setEditing(true);
  };

  const handleSave = async () => {
    setEditing(false);
    await onSave(pattern.slug, editContent);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const rewrittenContent = rewriteAssetPaths(pattern.content);
  const isSaved = savedSlug === pattern.slug;
  const isFailed = failedSlug === pattern.slug;

  return (
    <div style={{ marginBottom: 80, paddingTop: 32 }}>
      {/* Section title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          margin: 0,
          color: '#fff',
        }}>
          {pattern.label}
        </h2>

        {/* Edit toggle */}
        <button
          onClick={editing ? handleCancel : handleStartEdit}
          style={{
            background: editing ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${editing ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: editing ? '#ff3b30' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'all 0.15s',
          }}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>

        {isSaved && (
          <span style={{ fontSize: 12, color: '#44b574', fontWeight: 500 }}>Saved</span>
        )}
        {isFailed && (
          <span style={{ fontSize: 12, color: '#ff3b30', fontWeight: 500 }}>Save failed</span>
        )}
      </div>

      {/* Content: visual render or edit textarea */}
      {editing ? (
        <div style={{ marginTop: 16 }}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '100%',
              minHeight: 400,
              backgroundColor: '#111',
              border: '1px solid #42b1ff',
              borderRadius: 6,
              padding: 16,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 12,
              color: 'rgba(255,255,255,0.75)',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleSave}
              style={{
                background: '#42b1ff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: '#000',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>
              Ctrl+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className="pattern-content"
          dangerouslySetInnerHTML={{ __html: rewrittenContent }}
        />
      )}
    </div>
  );
}

// ─── PatternsScreen ───────────────────────────────────────────────────────────

export function PatternsScreen() {
  const [patterns, setPatterns] = useState<BrandPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  const savePattern = async (slug: string, content: string) => {
    const prevPatterns = patterns;
    // Optimistic update
    setPatterns((ps) => ps.map((p) => (p.slug === slug ? { ...p, content } : p)));

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

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#000',
      }}>
        <div style={{
          width: 20,
          height: 20,
          border: '2px solid #333',
          borderTopColor: '#555',
          borderRadius: '50%',
          animation: 'patterns-spin 0.8s linear infinite',
        }} />
        <style>{PATTERN_STYLES}</style>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#000',
        color: '#777',
        fontSize: 14,
        padding: 24,
        textAlign: 'center',
      }}>
        Failed to load Patterns data. Check the server is running and refresh.
      </div>
    );
  }

  // ─── Build pattern map for quick lookup ─────────────────────────────────────

  const patternMap = new Map<string, BrandPattern>();
  for (const p of patterns) {
    patternMap.set(p.slug, p);
  }

  // Patterns not in any display group (catch-all)
  const groupedSlugs = new Set(DISPLAY_GROUPS.flatMap((g) => g.slugs));
  const ungrouped = patterns.filter((p) => !groupedSlugs.has(p.slug));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#000',
    }}>
      {/* Inject pattern styles */}
      <style>{PATTERN_STYLES}</style>

      {/* Fixed header bar */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: '#000',
        padding: '14px 1rem',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>
          Patterns
        </h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 0 }}>
          Visual building blocks — color foundations, typographic rules, spacing systems, and compositional techniques
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '48px 64px 96px',
        maxWidth: 1200,
        boxSizing: 'border-box',
      }}>

        {/* Display groups */}
        {DISPLAY_GROUPS.map((group) => {
          const groupPatterns = group.slugs
            .map((slug) => patternMap.get(slug))
            .filter((p): p is BrandPattern => p !== undefined);

          if (groupPatterns.length === 0) return null;

          return (
            <div key={group.id} style={{ marginBottom: 32 }}>
              {/* Group header */}
              <div style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: 12,
                marginBottom: 48,
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.25)',
                  marginBottom: 4,
                }}>
                  {group.title}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  {group.subtitle}
                </div>
              </div>

              {/* Pattern sections */}
              {groupPatterns.map((pattern) => (
                <PatternSection
                  key={pattern.slug}
                  pattern={pattern}
                  onSave={savePattern}
                  savedSlug={savedSlug}
                  failedSlug={failedSlug}
                />
              ))}
            </div>
          );
        })}

        {/* Ungrouped patterns */}
        {ungrouped.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              paddingBottom: 12,
              marginBottom: 48,
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.25)',
                marginBottom: 4,
              }}>
                Other
              </div>
              <div style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.35)',
              }}>
                Additional patterns and rules.
              </div>
            </div>
            {ungrouped.map((pattern) => (
              <PatternSection
                key={pattern.slug}
                pattern={pattern}
                onSave={savePattern}
                savedSlug={savedSlug}
                failedSlug={failedSlug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
