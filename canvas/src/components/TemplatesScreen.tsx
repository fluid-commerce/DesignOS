import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface SlotDef {
  slot: string;
  spec: string;
  color: string | null;
}

interface ExtraTable {
  label: string;
  headers: string[] | null;
  rows: string[][];
}

interface DbTemplate {
  id: string;
  type: string;
  num: string;
  name: string;
  file: string;
  layout: string;
  dims: string | null;
  description: string;
  contentSlots: SlotDef[];
  extraTables: ExtraTable[] | null;
  previewPath: string;
  sortOrder: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color chip rendering
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_STYLES: Record<string, React.CSSProperties> = {
  white: { background: '#1e1e1e', color: '#888' },
  blue: { background: '#0c2233', color: '#44B2FF' },
  orange: { background: '#2b1100', color: '#FF6614' },
  // one-pager slot types
  fixed: { background: '#1e1e1e', color: '#888' },
  flexible: { background: '#0c2233', color: '#44B2FF' },
  optional: { background: '#1f0c2b', color: '#c985e5' },
};

function Chip({ label, variant }: { label: string; variant: string }) {
  const style = CHIP_STYLES[variant] || CHIP_STYLES.white;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: 2,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Download ZIP helper
// ─────────────────────────────────────────────────────────────────────────────

async function downloadTemplateZip(templatePath: string, templateName: string) {
  // Dynamically load JSZip from the templates directory
  if (!(window as any).JSZip) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/templates/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }
  const JSZip = (window as any).JSZip;
  const zip = new JSZip();

  // Fetch the template HTML
  const htmlRes = await fetch(`/templates/${templatePath}.html`);
  let html = await htmlRes.text();

  // Remove nav.js script references
  html = html.replace(/<script[^>]*nav\.js[^>]*><\/script>\s*/g, '');

  // Collect all /api/brand-assets/serve/:name references and rewrite to local paths for ZIP
  const dbAssetRegex = /\/api\/brand-assets\/serve\/([^"'\s)]+)/g;
  const assetNames = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = dbAssetRegex.exec(html)) !== null) {
    assetNames.add(decodeURIComponent(match[1]));
  }

  // Fetch brand assets catalog to map name -> file_path for local paths in ZIP
  const catalogRes = await fetch('/api/brand-assets');
  const catalog: Array<{ name: string; url: string }> = catalogRes.ok ? await catalogRes.json() : [];
  const nameToPath = new Map<string, string>();
  for (const a of catalog) {
    // url is /api/brand-assets/serve/:name — extract name from the original catalog
    nameToPath.set(a.name, a.name);
  }

  // Rewrite DB URLs to relative 'assets/{name}{ext}' paths for the ZIP
  // We'll fetch the binary from the serve endpoint and include it in the ZIP
  html = html.replace(dbAssetRegex, (_full, encodedName) => {
    const name = decodeURIComponent(encodedName);
    return `assets/${name}`;
  });

  // Also handle any remaining /fluid-assets/ references (legacy fallback)
  const fluidAssetRegex = /\/fluid-assets\/([^"'\s)]+)/g;
  const legacyAssetPaths = new Set<string>();
  while ((match = fluidAssetRegex.exec(html)) !== null) {
    legacyAssetPaths.add(match[1]);
  }
  html = html.replace(fluidAssetRegex, (_full, assetPath) => `assets/${assetPath}`);

  // Add HTML to zip
  zip.file(`${templateName}.html`, html);

  // Fetch and add DB-backed assets
  for (const name of assetNames) {
    try {
      const assetRes = await fetch(`/api/brand-assets/serve/${encodeURIComponent(name)}`);
      if (assetRes.ok) {
        const blob = await assetRes.blob();
        // Determine extension from content-type
        const ct = assetRes.headers.get('content-type') || '';
        const extMap: Record<string, string> = {
          'font/ttf': '.ttf', 'font/woff2': '.woff2', 'font/woff': '.woff',
          'image/png': '.png', 'image/jpeg': '.jpg', 'image/svg+xml': '.svg',
          'image/gif': '.gif', 'image/webp': '.webp',
        };
        const ext = extMap[ct] || '';
        zip.file(`assets/${name}${ext}`, blob);
      }
    } catch {
      // Skip missing assets
    }
  }

  // Fetch and add legacy fluid-assets
  for (const assetPath of legacyAssetPaths) {
    try {
      const assetRes = await fetch(`/fluid-assets/${assetPath}`);
      if (assetRes.ok) {
        const blob = await assetRes.blob();
        zip.file(`assets/${assetPath}`, blob);
      }
    } catch {
      // Skip missing assets
    }
  }

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${templateName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplatePreview — iframe preview with hover overlay + dropdown
// ─────────────────────────────────────────────────────────────────────────────

function TemplatePreview({
  templatePath,
  templateId,
  templateName,
  layout,
}: {
  templatePath: string;
  templateId: string;
  templateName: string;
  layout: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const dims = {
    square: { w: 480, h: 480, iw: 1080, ih: 1080, scale: 0.4444 },
    landscape: { w: 480, h: 226, iw: 1340, ih: 630, scale: 0.3582 },
    letter: { w: 425, h: 550, iw: 816, ih: 1056, scale: 0.5208 },
  }[layout] || { w: 480, h: 480, iw: 1080, ih: 1080, scale: 0.4444 };

  const handleEditTemplate = () => {
    window.parent.postMessage({ type: 'editTemplate', templateId }, '*');
    setDropdownOpen(false);
  };

  const handleCreateWithAI = () => {
    window.postMessage({ type: 'openCreateModal', base: templateId }, '*');
    setDropdownOpen(false);
  };

  const handleDownloadZip = () => {
    const pathWithoutExt = templatePath.replace(/\.html$/, '');
    downloadTemplateZip(pathWithoutExt, templateName.replace(/\s+/g, '-').toLowerCase());
  };

  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        flexShrink: 0,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDropdownOpen(false); }}
    >
      <iframe
        src={`/templates/${templatePath}`}
        style={{
          width: dims.iw,
          height: dims.ih,
          border: 'none',
          transform: `scale(${dims.scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
        title={templateName}
        loading="lazy"
      />
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: hovered ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
          transition: 'background 0.18s',
        }}
      >
        {/* Full Size */}
        <a
          href={`/preview/templates/${templatePath}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#fff',
            background: '#44B2FF',
            padding: '8px 16px',
            borderRadius: 2,
            textDecoration: 'none',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.18s, transform 0.18s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          &#x2197; Full Size
        </a>
        {/* New from Template — with dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: '#44B2FF',
              background: 'transparent',
              border: '1px solid #44B2FF',
              padding: '7px 16px',
              borderRadius: 2,
              cursor: 'pointer',
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 0.18s, transform 0.18s',
              pointerEvents: hovered ? 'auto' : 'none',
            }}
          >
            &#x2726; New from Template &#x25BE;
          </button>
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 4,
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: 3,
                overflow: 'hidden',
                zIndex: 20,
                minWidth: 180,
              }}
            >
              <button
                onClick={handleEditTemplate}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ccc',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                &#x270E; Edit Template
              </button>
              <button
                onClick={handleCreateWithAI}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid #222',
                  color: '#ccc',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                &#x2726; Create with AI
              </button>
            </div>
          )}
        </div>
        {/* Download ZIP */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDownloadZip(); }}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: '#44B2FF',
            background: 'transparent',
            border: '1px solid #44B2FF',
            padding: '7px 16px',
            borderRadius: 2,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.18s, transform 0.18s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          &#x2B07; Download ZIP
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared table styles
// ─────────────────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#222',
  padding: '5px 8px',
  borderBottom: '1px solid #161616',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #121212',
  verticalAlign: 'top',
  lineHeight: 1.4,
};

const specLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: '#282828',
  marginBottom: 8,
};

// Fixed column widths for all spec tables (slot/spec/color)
const COL_SLOT = '22%';
const COL_SPEC = '62%';
const COL_COLOR = '16%';

// Render a color cell — either a Chip badge or em-dash
function ColorCell({ value }: { value: string | null }) {
  if (!value || value === '\u2014' || value === '—') return <>{'\u2014'}</>;
  const normalized = value.toLowerCase();
  if (CHIP_STYLES[normalized]) return <Chip label={normalized} variant={normalized} />;
  return <>{value}</>;
}

// Shared spec table with fixed columns
function SpecTable({
  headers,
  rows,
  isSocial = true,
}: {
  headers: string[];
  rows: Array<{ cells: (string | null)[]; isSlotRow?: boolean }>;
  isSocial?: boolean;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: COL_SLOT }} />
        <col style={{ width: COL_SPEC }} />
        <col style={{ width: COL_COLOR }} />
      </colgroup>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            <td style={{ ...tdStyle, color: '#44B2FF', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.cells[0]}
            </td>
            <td style={{ ...tdStyle, color: '#555' }}>{row.cells[1]}</td>
            <td style={{ ...tdStyle, color: '#444' }}>
              {isSocial
                ? <ColorCell value={row.cells[2] ?? null} />
                : (row.cells[1]?.includes('Fixed') ? <Chip label="fixed" variant="fixed" />
                  : row.cells[1]?.includes('Optional') ? <Chip label="optional" variant="optional" />
                  : <Chip label="flexible" variant="flexible" />)
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline-editable textarea (shared for description, design rules, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function EditableTextarea({
  value,
  onSave,
  minHeight = 60,
}: {
  value: string;
  onSave: (newValue: string) => void;
  minHeight?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  const save = () => {
    if (draft !== value) {
      onSave(draft);
      setSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    }
    setEditing(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      {saved && (
        <span style={{ position: 'absolute', top: -16, right: 0, fontSize: '0.7rem', color: '#4ade80', fontWeight: 500 }}>
          Saved
        </span>
      )}
      <textarea
        value={editing ? draft : value}
        readOnly={!editing}
        onClick={() => { if (!editing) { setEditing(true); setDraft(value); } }}
        onChange={(e) => editing && setDraft(e.target.value)}
        onBlur={() => save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        style={{
          width: '100%',
          minHeight,
          backgroundColor: '#1a1a1a',
          border: `1px solid ${editing ? '#44B2FF' : '#333'}`,
          borderRadius: 6,
          padding: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: '0.8125rem',
          color: '#ccc',
          resize: 'vertical',
          cursor: editing ? 'text' : 'pointer',
          outline: 'none',
          lineHeight: 1.6,
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
      />
      {editing && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#555' }}>
          Click away or Ctrl+Enter to save &mdash; Esc to cancel
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template row (data-driven from DB)
// ─────────────────────────────────────────────────────────────────────────────

function TemplateRow({
  t,
  designRules,
  onUpdateTemplate,
  onUpdateDesignRule,
}: {
  t: DbTemplate;
  designRules: DesignRule[];
  onUpdateTemplate: (id: string, fields: Partial<Pick<DbTemplate, 'description' | 'contentSlots' | 'extraTables'>>) => void;
  onUpdateDesignRule: (id: string, content: string) => void;
}) {
  const isSocial = t.type === 'social';
  const previewLayout = t.layout === 'letter' ? 'letter' : t.layout === 'landscape' ? 'landscape' : 'square';
  const gridCols = t.layout === 'letter' ? '425px 1fr' : '480px 1fr';
  const [activeSlideTab, setActiveSlideTab] = useState(0);

  // Match archetype design rules for this template
  const templateRules = designRules.filter(r => r.scope === 'archetype' && r.archetypeSlug === t.file);

  // Detect slide-based extra tables (carousel pattern)
  const slideTables = t.extraTables?.filter(et => /^Slide \d/.test(et.label)) ?? [];
  const nonSlideTables = t.extraTables?.filter(et => !/^Slide \d/.test(et.label)) ?? [];
  const isCarousel = slideTables.length > 1;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 48,
        alignItems: 'start',
        marginBottom: 72,
      }}
    >
      {/* Left: preview */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#44B2FF', textTransform: 'uppercase' }}>
            {t.num}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name}</span>
          {t.dims && <span style={{ fontSize: 10, color: '#2a2a2a', fontFamily: 'monospace' }}>{t.dims}</span>}
        </div>
        <TemplatePreview
          templatePath={t.previewPath}
          templateId={t.file}
          templateName={t.name}
          layout={previewLayout}
        />
      </div>

      {/* Right: spec panel */}
      <div>
        {/* Description — editable */}
        <EditableTextarea
          value={t.description}
          onSave={(desc) => onUpdateTemplate(t.id, { description: desc })}
          minHeight={50}
        />

        <div style={{ height: 20 }} />

        {/* Content Slots */}
        {t.contentSlots.length > 0 && (
          <>
            <div style={specLabelStyle}>Content Slots</div>
            <SpecTable
              headers={['Slot', isSocial ? 'Spec' : 'Type / Spec', isSocial ? 'Color' : 'Description']}
              rows={t.contentSlots.map(s => ({ cells: [s.slot, s.spec, s.color] }))}
              isSocial={isSocial}
            />
          </>
        )}

        {/* Carousel slide tabs */}
        {isCarousel && (
          <>
            <div style={specLabelStyle}>Slides</div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid #1a1a1a' }}>
              {slideTables.map((st, idx) => {
                const isActive = activeSlideTab === idx;
                const shortLabel = st.label.replace(/^Slide /, '');
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveSlideTab(idx)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: isActive ? '#fff' : '#444',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      marginBottom: -1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#666'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#444'; }}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
            {slideTables[activeSlideTab] && (
              <SpecTable
                headers={slideTables[activeSlideTab].headers || ['Slot', 'Spec', 'Color']}
                rows={slideTables[activeSlideTab].rows.map(row => ({ cells: [row[0], row[1], row[2] ?? null] }))}
                isSocial={true}
              />
            )}
          </>
        )}

        {/* Non-slide extra tables (rendered normally) */}
        {nonSlideTables.map((et, idx) => (
          <div key={idx}>
            <div style={specLabelStyle}>{et.label}</div>
            <SpecTable
              headers={et.headers || ['Slot', 'Spec', 'Color']}
              rows={et.rows.map(row => ({ cells: [row[0], row[1], row[2] ?? null] }))}
              isSocial={isSocial}
            />
          </div>
        ))}

        {/* Design Rules for this template */}
        {templateRules.length > 0 && (
          <>
            <div style={specLabelStyle}>Design Rules</div>
            {templateRules.map((rule) => (
              <div key={rule.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>{rule.label}</div>
                <EditableTextarea
                  value={rule.content}
                  onSave={(content) => onUpdateDesignRule(rule.id, content)}
                  minHeight={80}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DesignRulesPanel — collapsible card with inline-editable design rules
// ─────────────────────────────────────────────────────────────────────────────

function DesignRulesPanel({
  rules,
  loading,
  onUpdateRule,
}: {
  rules: DesignRule[];
  loading: boolean;
  onUpdateRule: (id: string, content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

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
  const instagramRules = rules.filter((r) => r.scope === 'platform' && r.platform === 'instagram');
  const linkedinRules = rules.filter((r) => r.scope === 'platform' && r.platform === 'linkedin');

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Collapsible header */}
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
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Social Media Design Rules</span>
        <span style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>
          Rules that apply to all social posts. Includes platform-specific guidelines for Instagram and LinkedIn.
        </span>
      </div>
      {/* Content */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 2000 : 0,
          transition: 'max-height 200ms ease-out',
        }}
      >
        <div style={{ padding: '1rem' }}>
          {loading && <div style={{ color: '#555', fontSize: '0.85rem' }}>Loading design rules...</div>}

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
              {globalRules.map((r) => (
                <div key={r.id} style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.375rem' }}>{r.label}</h3>
                  <EditableTextarea value={r.content} onSave={(content) => onUpdateRule(r.id, content)} minHeight={120} />
                </div>
              ))}
            </section>
          )}

          {!loading && instagramRules.length > 0 && (
            <section>
              <p style={sectionHeadingStyle}>Instagram</p>
              {instagramRules.map((r) => (
                <div key={r.id} style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.375rem' }}>{r.label}</h3>
                  <EditableTextarea value={r.content} onSave={(content) => onUpdateRule(r.id, content)} minHeight={120} />
                </div>
              ))}
            </section>
          )}

          {!loading && linkedinRules.length > 0 && (
            <section>
              <p style={sectionHeadingStyle}>LinkedIn</p>
              {linkedinRules.map((r) => (
                <div key={r.id} style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.375rem' }}>{r.label}</h3>
                  <EditableTextarea value={r.content} onSave={(content) => onUpdateRule(r.id, content)} minHeight={120} />
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplatesScreen — main export
// ─────────────────────────────────────────────────────────────────────────────

export function TemplatesScreen() {
  const [activeTab, setActiveTab] = useState<'social' | 'paid-ads' | 'one-page'>('social');
  const [socialTemplates, setSocialTemplates] = useState<DbTemplate[]>([]);
  const [paidAdTemplates, setPaidAdTemplates] = useState<DbTemplate[]>([]);
  const [onePagerTemplates, setOnePagerTemplates] = useState<DbTemplate[]>([]);
  const [designRules, setDesignRules] = useState<DesignRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);

  // Fetch templates from DB
  useEffect(() => {
    Promise.all([
      fetch('/api/db-templates?type=social').then(r => r.json()),
      fetch('/api/db-templates?type=paid-ad').then(r => r.json()),
      fetch('/api/db-templates?type=one-pager').then(r => r.json()),
    ]).then(([social, paidAd, onePager]) => {
      setSocialTemplates(social);
      setPaidAdTemplates(paidAd);
      setOnePagerTemplates(onePager);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Fetch design rules
  useEffect(() => {
    fetch('/api/design-rules')
      .then(r => r.json())
      .then((data: DesignRule[]) => {
        setDesignRules(data);
        setRulesLoading(false);
      })
      .catch(() => setRulesLoading(false));
  }, []);

  // Optimistic update for templates
  const handleUpdateTemplate = (id: string, fields: Partial<Pick<DbTemplate, 'description' | 'contentSlots' | 'extraTables'>>) => {
    const updateList = (list: DbTemplate[]) =>
      list.map(t => t.id === id ? { ...t, ...fields } : t);
    setSocialTemplates(prev => updateList(prev));
    setPaidAdTemplates(prev => updateList(prev));
    setOnePagerTemplates(prev => updateList(prev));

    fetch(`/api/db-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }).catch(() => {
      // Revert on failure — re-fetch
      fetch('/api/db-templates?type=social').then(r => r.json()).then(setSocialTemplates);
      fetch('/api/db-templates?type=paid-ad').then(r => r.json()).then(setPaidAdTemplates);
      fetch('/api/db-templates?type=one-pager').then(r => r.json()).then(setOnePagerTemplates);
    });
  };

  // Optimistic update for design rules
  const handleUpdateDesignRule = (id: string, content: string) => {
    const prev = designRules;
    setDesignRules(r => r.map(rule => rule.id === id ? { ...rule, content } : rule));

    fetch(`/api/design-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => setDesignRules(prev));
  };

  const templates = activeTab === 'social' ? socialTemplates : onePagerTemplates;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      {/* Header bar with tabs — matches My Creations pattern */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px solid #1e1e1e',
          backgroundColor: '#0d0d0d',
          padding: '14px 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          {([
            { id: 'social' as const, label: 'Social' },
            { id: 'paid-ads' as const, label: 'Paid Ads' },
            { id: 'one-page' as const, label: 'One-Page' },
          ]).map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isActive ? '#e0e0e0' : '#666',
                  backgroundColor: isActive ? '#1a1a1e' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'color 0.15s, background-color 0.15s',
                  fontFamily: 'inherit',
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
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '48px 40px',
          boxSizing: 'border-box',
        }}
      >
        {/* Subtitle */}
        <p style={{ fontSize: 14, fontWeight: 400, color: '#888', marginTop: 0, marginBottom: 32 }}>
          Designed examples that show how brand patterns come together for specific content types
        </p>

        {loading && (
          <div style={{ color: '#555', fontSize: 14 }}>Loading templates...</div>
        )}

        {/* Social tab */}
        {!loading && activeTab === 'social' && (
          <div>
            {/* Design Rules panel */}
            <DesignRulesPanel
              rules={designRules}
              loading={rulesLoading}
              onUpdateRule={handleUpdateDesignRule}
            />

            {/* Template listings */}
            {socialTemplates.length === 0 && (
              <div style={{ color: '#555', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0', fontSize: 14 }}>No templates yet</p>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: 12 }}>Templates are seeded automatically on first app startup.</p>
              </div>
            )}
            {socialTemplates.map((t, i) => (
              <div key={t.id}>
                <TemplateRow
                  t={t}
                  designRules={designRules}
                  onUpdateTemplate={handleUpdateTemplate}
                  onUpdateDesignRule={handleUpdateDesignRule}
                />
                {i < socialTemplates.length - 1 && (
                  <hr style={{ border: 'none', borderTop: '1px solid #141414', margin: '56px 0' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paid Ads tab */}
        {!loading && activeTab === 'paid-ads' && (
          <div>
            {paidAdTemplates.length === 0 && (
              <div style={{ color: '#555', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0', fontSize: 14 }}>No ad templates yet</p>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: 12 }}>Templates are seeded automatically on first app startup.</p>
              </div>
            )}
            {paidAdTemplates.map((t, i) => (
              <div key={t.id}>
                <TemplateRow
                  t={t}
                  designRules={designRules}
                  onUpdateTemplate={handleUpdateTemplate}
                  onUpdateDesignRule={handleUpdateDesignRule}
                />
                {i < paidAdTemplates.length - 1 && (
                  <hr style={{ border: 'none', borderTop: '1px solid #141414', margin: '56px 0' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* One-Page tab */}
        {!loading && activeTab === 'one-page' && (
          <div>
            {onePagerTemplates.length === 0 && (
              <div style={{ color: '#555', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0', fontSize: 14 }}>No one-pager templates yet</p>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: 12 }}>Templates are seeded automatically on first app startup.</p>
              </div>
            )}
            {onePagerTemplates.map((t, i) => (
              <div key={t.id}>
                <TemplateRow
                  t={t}
                  designRules={designRules}
                  onUpdateTemplate={handleUpdateTemplate}
                  onUpdateDesignRule={handleUpdateDesignRule}
                />
                {i < onePagerTemplates.length - 1 && (
                  <hr style={{ border: 'none', borderTop: '1px solid #141414', margin: '56px 0' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
