import { useState, useRef, useEffect } from 'react';
import type { TemplateMetadata } from '../lib/template-configs';
import { getTemplateSchema } from '../lib/template-configs';

interface TemplateCustomizerProps {
  template: TemplateMetadata;
  campaignId: string;
  onBack: () => void;
  /** Called with the campaignId after the creation+slide+iteration are created. */
  onCreated: (campaignId: string) => void;
}

const ACCENT_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'orange', hex: '#F26522' },
  { name: 'blue', hex: '#44B2FF' },
  { name: 'green', hex: '#22c55e' },
  { name: 'purple', hex: '#8b5cf6' },
];

/**
 * Template customization form shown after selecting a template from the gallery.
 *
 * In the campaign model, creating a template creation creates:
 *   Creation (title, creationType, slideCount=1)
 *     Slide (slideIndex=0)
 *       Iteration (source='template', templateId, slotSchema from template-configs)
 *
 * The HTML content is left empty for now (templateId can be used by the iframe
 * server to serve the correct HTML). The slotSchema is stored in the iteration
 * so ContentEditor can immediately render the right editing fields.
 */
export function TemplateCustomizer({ template, campaignId, onBack, onCreated }: TemplateCustomizerProps) {
  const [title, setTitle] = useState(template.name);
  const [accentColor, setAccentColor] = useState('orange');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);

    try {
      // 1. Create the creation
      const creationRes = await fetch(`/api/campaigns/${campaignId}/creations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          creationType: template.platform,
          slideCount: 1,
        }),
      });
      if (!creationRes.ok) throw new Error(`Failed to create creation: ${creationRes.status}`);
      const creation = await creationRes.json();

      // 2. Create slide 0
      const slideRes = await fetch(`/api/creations/${creation.id}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideIndex: 0 }),
      });
      if (!slideRes.ok) throw new Error(`Failed to create slide: ${slideRes.status}`);
      const slide = await slideRes.json();

      // 3. Create the iteration with slotSchema from template config
      const slotSchema = getTemplateSchema(template.templateId);
      const htmlPath = `templates/${template.templateId}.html`;

      const iterRes = await fetch(`/api/slides/${slide.id}/iterations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iterationIndex: 0,
          htmlPath,
          source: 'template',
          templateId: template.templateId,
          slotSchema: slotSchema ?? null,
          aiBaseline: null,
        }),
      });
      if (!iterRes.ok) throw new Error(`Failed to create iteration: ${iterRes.status}`);

      // 4. Navigate to the campaign (which will reload creations)
      onCreated(campaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create creation');
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%' }}>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#44B2FF',
          cursor: 'pointer',
          fontSize: '0.85rem',
          padding: 0,
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Templates
      </button>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Template preview — live iframe scaled to fit */}
        <div style={{ flexShrink: 0 }}>
          <TemplatePreviewIframe template={template} />
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
            {template.dimensions.width} × {template.dimensions.height}px
          </div>
        </div>

        {/* Customization form */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', color: '#fff' }}>
            {template.name}
          </h3>

          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: '#666', lineHeight: 1.5 }}>
            {template.description}
          </p>

          {/* Creation title */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="tmpl-title" style={labelStyle}>Creation Title</label>
            <input
              id="tmpl-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this creation..."
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#44B2FF')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
            />
          </div>

          {/* Accent color selection */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>Accent Color</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setAccentColor(c.name)}
                  title={c.name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: c.hex,
                    border: accentColor === c.name ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: accentColor === c.name ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none',
                    transition: 'box-shadow 0.12s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Notes / brief */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="tmpl-notes" style={labelStyle}>Notes (optional)</label>
            <textarea
              id="tmpl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or brief for this creation..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              onFocus={(e) => (e.target.style.borderColor = '#44B2FF')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
            />
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.625rem 0.875rem',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#f87171',
            }}>
              {error}
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            style={{
              backgroundColor: creating || !title.trim() ? '#1a2530' : '#44B2FF',
              color: creating || !title.trim() ? '#444' : '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '0.6rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: creating || !title.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (!creating && title.trim()) {
                e.currentTarget.style.backgroundColor = '#3a9fe0';
              }
            }}
            onMouseLeave={(e) => {
              if (!creating && title.trim()) {
                e.currentTarget.style.backgroundColor = '#44B2FF';
              }
            }}
          >
            {creating ? 'Creating...' : 'Create Creation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Scaled iframe preview of a template for the customizer panel. */
function TemplatePreviewIframe({ template }: { template: TemplateMetadata }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const { width, height } = template.dimensions;
  const containerWidth = 280;
  const containerHeight = template.platform === 'linkedin-landscape' ? 132 : 200;

  useEffect(() => {
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    setScale(Math.min(scaleX, scaleY) * 0.95);
  }, [width, height, containerWidth, containerHeight]);

  const previewSrc = `/templates/${template.templateId}.html`;

  return (
    <div
      ref={containerRef}
      style={{
        width: containerWidth,
        height: containerHeight,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid #2a2a2e',
        backgroundColor: '#0d0d0d',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        width,
        height,
      }}>
        <iframe
          src={previewSrc}
          width={width}
          height={height}
          style={{ border: 'none', display: 'block', pointerEvents: 'none' }}
          title={`${template.name} preview`}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#888',
  marginBottom: '0.3rem',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1a1a1e',
  border: '1px solid #2a2a2e',
  borderRadius: 6,
  color: '#e0e0e0',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};
