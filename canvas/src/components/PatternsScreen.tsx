import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandPattern {
  id: string;
  slug: string;
  label: string;
  category: string;
  content: string;
  weight: number;
  isCore: boolean;
  sortOrder: number;
  updatedAt: number;
}

// ─── Category Definitions (fixed, brand-agnostic) ────────────────────────────

interface CategoryDef {
  id: string;
  title: string;
  subtitle: string;
  coreType: 'markdown' | 'none';
}

const CATEGORIES: CategoryDef[] = [
  { id: 'logos', title: 'Logos', subtitle: 'Brand marks and logo usage rules.', coreType: 'none' },
  { id: 'colors', title: 'Colors', subtitle: 'Color palette and usage rules.', coreType: 'markdown' },
  { id: 'typography', title: 'Typography', subtitle: 'Font families, scales, and typographic rules.', coreType: 'markdown' },
  { id: 'images', title: 'Images', subtitle: 'Photography, mockups, and image usage.', coreType: 'none' },
  { id: 'decorations', title: 'Decorations', subtitle: 'Textures, brushstrokes, and decorative elements.', coreType: 'none' },
  { id: 'archetypes', title: 'Archetypes', subtitle: 'Layout templates and compositional structures.', coreType: 'markdown' },
];

// ─── Pattern styles ─────────────────────────────────────────────────────────

const PATTERN_STYLES = `
  .pattern-content {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.75);
  }
  .pattern-content h2 {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin: 24px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pattern-content h3 {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    margin: 20px 0 8px;
  }
  .pattern-content h4 {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    margin: 16px 0 6px;
  }
  .pattern-content p { margin: 8px 0; }
  .pattern-content strong { color: #fff; font-weight: 700; }
  .pattern-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 13px;
  }
  .pattern-content th {
    text-align: left;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.45);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pattern-content td {
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.75);
  }
  .pattern-content code {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
    font-size: 12px;
    background: rgba(255,255,255,0.06);
    padding: 2px 6px;
    border-radius: 3px;
    color: #FF8B58;
  }
  .pattern-content pre {
    background: #111;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    overflow-x: auto;
  }
  .pattern-content pre code {
    background: none;
    padding: 0;
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255,255,255,0.75);
  }
  .pattern-content ul, .pattern-content ol { padding-left: 24px; margin: 8px 0; }
  .pattern-content li { margin: 4px 0; }
  .pattern-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }

  /* Preview sandbox */
  @font-face {
    font-family: 'flfontbold';
    src: url('/api/brand-assets/serve/flfontbold') format('truetype');
    font-weight: 700; font-style: normal;
  }
  @font-face {
    font-family: 'NeueHaas';
    src: url('/api/brand-assets/serve/Inter-VariableFont') format('truetype');
    font-weight: 100 900; font-style: normal;
  }
  .code-preview-sandbox {
    font-family: 'Inter', 'NeueHaas', sans-serif;
    color: #fff; background: #000; padding: 24px; font-size: 14px; line-height: 1.5;
  }
  .code-preview-sandbox img { max-width: 100%; height: auto; }
  .code-preview-sandbox .footer {
    position: relative; display: flex; justify-content: space-between; align-items: center; padding: 22px 68px;
  }
  .code-preview-sandbox .footer-left { display: flex; align-items: center; gap: 12px; }
  .code-preview-sandbox .footer-left img { height: 18px; opacity: 0.8; }
  .code-preview-sandbox .footer-separator { width: 1px; height: 14px; background: rgba(255,255,255,0.15); }
  .code-preview-sandbox .footer-right img { height: 22px; opacity: 0.8; }

  @keyframes patterns-spin { to { transform: rotate(360deg); } }
`;

// ─── Preprocess markdown to combine adjacent CSS+HTML code blocks ─────────────

function preprocessPatternMarkdown(content: string): string {
  const consecutivePattern = /```css\n([\s\S]*?)```\s*\n\s*```html\n([\s\S]*?)```/g;
  let result = content.replace(consecutivePattern, (_match, css: string, html: string) => {
    return '```html\n<style>' + css.trimEnd() + '</style>\n' + html.trimEnd() + '\n```';
  });
  const reversePattern = /```html\n([\s\S]*?)```\s*\n\s*```css\n([\s\S]*?)```/g;
  result = result.replace(reversePattern, (_match, html: string, css: string) => {
    return '```html\n<style>' + css.trimEnd() + '</style>\n' + html.trimEnd() + '\n```';
  });
  const cssBlockPattern = /```css\n([\s\S]*?)```/g;
  result = result.replace(cssBlockPattern, (_match, code: string) => {
    const lines = code.split('\n');
    const cssLines: string[] = [];
    const htmlLines: string[] = [];
    let foundHtml = false;
    for (const line of lines) {
      if (!foundHtml && /^\s*<(?!!)/.test(line)) foundHtml = true;
      if (foundHtml) htmlLines.push(line); else cssLines.push(line);
    }
    if (htmlLines.length > 0 && cssLines.length > 0) {
      return '```html\n<style>' + cssLines.join('\n').trimEnd() + '</style>\n' + htmlLines.join('\n').trimEnd() + '\n```';
    }
    return _match;
  });
  return result;
}

// ─── CodePreview ──────────────────────────────────────────────────────────────

function CodePreview({ code, language }: { code: string; language: string }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');

  const hasEmbeddedStyle = language === 'html' && code.includes('<style>');
  const cssSource = hasEmbeddedStyle ? (code.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').trim() : '';
  const htmlSource = hasEmbeddedStyle ? code.replace(/<style>[\s\S]*?<\/style>\s*/, '').trim() : '';

  const previewHtml = (() => {
    if (language === 'html') return code;
    if (language === 'css') {
      const colors = [...code.matchAll(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g)].map(m => m[1]);
      const uniqueColors = [...new Set(colors)].slice(0, 16);
      const swatches = uniqueColors.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">${
        uniqueColors.map(c => `<div style="width:32px;height:32px;border-radius:4px;background:${c};border:1px solid rgba(255,255,255,0.1);" title="${c}"></div>`).join('')
      }</div>` : '';
      const classNames = [...code.matchAll(/\.([\w-]+)\s*\{/g)].map(m => m[1]);
      const samples = classNames.map(cls => `<div class="${cls}" style="margin-bottom:8px;min-height:1em;">${cls.replace(/[-_]/g, ' ')}</div>`).join('\n');
      return `<style>${code}</style><div style="padding:16px;font-family:'Inter',sans-serif;color:rgba(255,255,255,0.75);font-size:14px;">${swatches}${samples}</div>`;
    }
    return code;
  })();

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
    border: 'none', borderBottom: active ? '2px solid #42b1ff' : '2px solid transparent',
    background: 'none', color: active ? '#42b1ff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.15s',
  });

  const codeStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)', background: 'none', padding: 0,
  };

  return (
    <div style={{ margin: '12px 0', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', background: '#111' }}>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0a', padding: '0 8px' }}>
        <button style={tabStyle(tab === 'preview')} onClick={() => setTab('preview')}>Preview</button>
        <button style={tabStyle(tab === 'code')} onClick={() => setTab('code')}>Code</button>
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingRight: 8 }}>
          {hasEmbeddedStyle ? 'css + html' : language}
        </span>
      </div>
      {tab === 'preview' ? (
        <div className="code-preview-sandbox" style={{ padding: 0, background: '#000', minHeight: 40, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      ) : hasEmbeddedStyle ? (
        <div style={{ overflow: 'auto', background: '#111' }}>
          {cssSource && (<>
            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>CSS</div>
            <pre style={{ margin: 0, padding: '4px 20px 16px', background: '#111' }}><code style={codeStyle}>{cssSource}</code></pre>
          </>)}
          {htmlSource && (<>
            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>HTML</div>
            <pre style={{ margin: 0, padding: '4px 20px 16px', background: '#111' }}><code style={codeStyle}>{htmlSource}</code></pre>
          </>)}
        </div>
      ) : (
        <pre style={{ margin: 0, padding: 20, overflow: 'auto', background: '#111' }}><code style={codeStyle}>{code}</code></pre>
      )}
    </div>
  );
}

// ─── ReactMarkdown components ────────────────────────────────────────────────

const markdownComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  code({ className, children }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '');
    if (match) {
      const code = String(children).replace(/\n$/, '');
      return <CodePreview code={code} language={match[1]} />;
    }
    return <code className={className}>{children}</code>;
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>;
  },
};

// ─── Weight Badge ────────────────────────────────────────────────────────────

function WeightBadge({ weight }: { weight: number }) {
  const color = weight >= 81 ? '#ff6b6b' : weight >= 51 ? '#f0a85e' : weight >= 21 ? '#42b1ff' : '#666';
  const bg = weight >= 81 ? 'rgba(255,107,107,0.12)' : weight >= 51 ? 'rgba(240,168,94,0.12)' : weight >= 21 ? 'rgba(66,177,255,0.12)' : 'rgba(255,255,255,0.04)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      color, background: bg, border: `1px solid ${color}22`,
      letterSpacing: '0.02em', lineHeight: 1,
    }}>
      W{weight}
    </span>
  );
}

// ─── RuleCard ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  pattern: BrandPattern;
  onSave: (slug: string, updates: { content?: string; weight?: number; label?: string }) => Promise<void>;
  onDelete?: (slug: string) => Promise<void>;
  flash: string | null;
  flashType: 'saved' | 'failed';
}

function RuleCard({ pattern, onSave, onDelete, flash, flashType }: RuleCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const handleStartEdit = () => { setEditContent(pattern.content); setEditing(true); };
  const handleSave = async () => { setEditing(false); await onSave(pattern.slug, { content: editContent }); };
  const handleCancel = () => setEditing(false);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') handleCancel();
  };

  const isFlashed = flash === pattern.slug;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, flex: 1 }}>
          {pattern.label}
        </h3>
        <WeightBadge weight={pattern.weight} />
        <button
          onClick={editing ? handleCancel : handleStartEdit}
          style={{
            background: editing ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${editing ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            color: editing ? '#ff3b30' : 'rgba(255,255,255,0.4)', cursor: 'pointer',
            letterSpacing: '0.02em', transition: 'all 0.15s',
          }}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        {!pattern.isCore && onDelete && (
          <button
            onClick={() => { if (confirm(`Delete "${pattern.label}"?`)) onDelete(pattern.slug); }}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600,
              color: 'rgba(255,255,255,0.25)', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Delete
          </button>
        )}
        {isFlashed && (
          <span style={{ fontSize: 11, fontWeight: 500, color: flashType === 'saved' ? '#44b574' : '#ff3b30' }}>
            {flashType === 'saved' ? 'Saved' : 'Failed'}
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 20px 20px' }}>
        {editing ? (
          <div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{
                width: '100%', minHeight: 300, backgroundColor: '#0a0a0a',
                border: '1px solid #42b1ff', borderRadius: 6, padding: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 12, color: 'rgba(255,255,255,0.75)', resize: 'vertical',
                outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleSave} style={{
                background: '#42b1ff', border: 'none', borderRadius: 4,
                padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#000', cursor: 'pointer',
              }}>Save</button>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>
                Ctrl+Enter to save, Esc to cancel
              </span>
            </div>
          </div>
        ) : (
          <div className="pattern-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {preprocessPatternMarkdown(pattern.content)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Rule Form ───────────────────────────────────────────────────────────

function AddRuleForm({ category, onAdd }: { category: string; onAdd: (data: { label: string; category: string; content: string; weight: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [weight, setWeight] = useState(50);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!label.trim() || !content.trim()) return;
    setSaving(true);
    await onAdd({ label: label.trim(), category, content: content.trim(), weight });
    setLabel(''); setContent(''); setWeight(50); setOpen(false); setSaving(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', padding: '10px 16px', background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.3)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', marginTop: 8,
        }}
      >
        + Add Rule
      </button>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(66,177,255,0.3)',
      borderRadius: 10, padding: 20, marginTop: 8,
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input
          placeholder="Rule name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          style={{
            flex: 1, padding: '8px 12px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#fff', fontSize: 14, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Weight</label>
          <input
            type="number" min={1} max={100} value={weight}
            onChange={(e) => setWeight(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
            style={{
              width: 56, padding: '6px 8px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: '#fff', fontSize: 13, textAlign: 'center', outline: 'none',
            }}
          />
        </div>
      </div>
      <textarea
        placeholder="Write your rule in markdown..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{
          width: '100%', minHeight: 200, backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12, color: 'rgba(255,255,255,0.75)', resize: 'vertical',
          outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !label.trim() || !content.trim()}
          style={{
            background: '#42b1ff', border: 'none', borderRadius: 4,
            padding: '6px 16px', fontSize: 12, fontWeight: 600, color: '#000', cursor: 'pointer',
            opacity: saving || !label.trim() || !content.trim() ? 0.4 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
        <button
          onClick={() => { setOpen(false); setLabel(''); setContent(''); setWeight(50); }}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
            padding: '6px 14px', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── CategorySection ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: CategoryDef;
  corePattern: BrandPattern | undefined;
  rules: BrandPattern[];
  onSave: (slug: string, updates: { content?: string; weight?: number; label?: string }) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
  onAdd: (data: { label: string; category: string; content: string; weight: number }) => Promise<void>;
  flash: string | null;
  flashType: 'saved' | 'failed';
}

function CategorySection({ category, corePattern, rules, onSave, onDelete, onAdd, flash, flashType }: CategorySectionProps) {
  return (
    <div style={{ marginBottom: 56 }}>
      {/* Category header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)', marginBottom: 6,
        }}>
          {category.title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          {category.subtitle}
        </div>
      </div>

      {/* Core section: markdown */}
      {category.coreType === 'markdown' && corePattern && (
        <RuleCard
          pattern={corePattern}
          onSave={onSave}
          flash={flash}
          flashType={flashType}
        />
      )}

      {/* Core empty state */}
      {category.coreType === 'markdown' && !corePattern && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '24px 20px', marginBottom: 16,
          color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic',
        }}>
          No core {category.title.toLowerCase()} data defined yet.
        </div>
      )}

      {/* Custom rules */}
      {rules.map(rule => (
        <RuleCard
          key={rule.slug}
          pattern={rule}
          onSave={onSave}
          onDelete={onDelete}
          flash={flash}
          flashType={flashType}
        />
      ))}

      {/* Add rule button */}
      <AddRuleForm category={category.id} onAdd={onAdd} />
    </div>
  );
}

// ─── PatternsScreen ───────────────────────────────────────────────────────────

export function PatternsScreen() {
  const [patterns, setPatterns] = useState<BrandPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [flashType, setFlashType] = useState<'saved' | 'failed'>('saved');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/brand-patterns')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((pats: BrandPattern[]) => { setPatterns(pats); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const showFlash = useCallback((slug: string, type: 'saved' | 'failed') => {
    setFlash(slug); setFlashType(type);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), type === 'saved' ? 2000 : 4000);
  }, []);

  const savePattern = useCallback(async (slug: string, updates: { content?: string; weight?: number; label?: string }) => {
    const prev = patterns;
    setPatterns(ps => ps.map(p => p.slug === slug ? { ...p, ...updates } : p));
    try {
      const res = await fetch(`/api/brand-patterns/${slug}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      showFlash(slug, 'saved');
    } catch {
      setPatterns(prev);
      showFlash(slug, 'failed');
    }
  }, [patterns, showFlash]);

  const deletePattern = useCallback(async (slug: string) => {
    const prev = patterns;
    setPatterns(ps => ps.filter(p => p.slug !== slug));
    try {
      const res = await fetch(`/api/brand-patterns/${slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setPatterns(prev);
      showFlash(slug, 'failed');
    }
  }, [patterns, showFlash]);

  const addPattern = useCallback(async (data: { label: string; category: string; content: string; weight: number }) => {
    try {
      const res = await fetch('/api/brand-patterns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const created: BrandPattern = await res.json();
      setPatterns(ps => [...ps, created]);
      showFlash(created.slug, 'saved');
    } catch {
      showFlash('__add__', 'failed');
    }
  }, [showFlash]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#000' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #333', borderTopColor: '#555', borderRadius: '50%', animation: 'patterns-spin 0.8s linear infinite' }} />
        <style>{PATTERN_STYLES}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#000', color: '#777', fontSize: 14, padding: 24, textAlign: 'center' }}>
        Failed to load Patterns data. Check the server is running and refresh.
      </div>
    );
  }

  // Group patterns by category, exclude visual-style (compositor contract)
  const byCategory = new Map<string, BrandPattern[]>();
  for (const p of patterns) {
    if (p.category === 'visual-style') continue;
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#000' }}>
      <style>{PATTERN_STYLES}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#000', padding: '14px 1rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>Patterns</h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 0 }}>
          Visual building blocks — color foundations, typographic rules, and compositional techniques
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 64px 96px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {CATEGORIES.map(cat => {
            const catPatterns = byCategory.get(cat.id) || [];
            const corePattern = catPatterns.find(p => p.isCore);
            const rules = catPatterns.filter(p => !p.isCore).sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <CategorySection
                key={cat.id}
                category={cat}
                corePattern={corePattern}
                rules={rules}
                onSave={savePattern}
                onDelete={deletePattern}
                onAdd={addPattern}
                flash={flash}
                flashType={flashType}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
