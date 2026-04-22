import { useState } from 'react';
import { TEMPLATE_METADATA, type TemplateMetadata } from '../lib/template-configs';

interface TemplateGalleryProps {
  onSelectTemplate: (template: TemplateMetadata) => void;
  /**
   * 'modal' — compact version inside the creation flow modal.
   * 'standalone' — legacy full-page view (kept for compatibility).
   * Defaults to 'modal'.
   */
  mode?: 'modal' | 'standalone';
  /** Currently selected template id (for controlled highlight from parent) */
  selectedTemplateId?: string | null;
}

function getDimensionBadge(template: TemplateMetadata): string {
  const { width, height } = template.dimensions;
  if (width === height) return `${width}px`;
  if (width > height) return 'landscape';
  return 'portrait';
}

/**
 * Numbered list of templates matching Jonathan's design.
 * "✦ From Scratch" row at top, then numbered 01–N.
 * Selected row highlighted with subtle blue background.
 */
export function TemplateGallery({
  onSelectTemplate,
  mode = 'modal',
  selectedTemplateId,
}: TemplateGalleryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0.55rem 0.875rem',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background-color 0.12s',
    gap: '0.75rem',
    userSelect: 'none',
  };

  return (
    <div
      style={{
        padding: mode === 'modal' ? '0.5rem 0' : '1rem 0',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {mode === 'standalone' && (
        <h2 style={{ margin: '0 0 1rem 0.875rem', fontSize: '1.1rem', color: '#fff' }}>
          Choose a Template
        </h2>
      )}

      {/* From Scratch row */}
      <div
        onClick={() =>
          onSelectTemplate({
            templateId: 'scratch',
            name: 'From Scratch',
            description: 'Start with a blank canvas',
            thumbnailPath: '',
            platform: 'unknown',
            dimensions: { width: 1080, height: 1080 },
          })
        }
        onMouseEnter={() => setHoveredId('scratch')}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          ...rowBase,
          backgroundColor:
            selectedTemplateId === 'scratch'
              ? 'rgba(68,178,255,0.12)'
              : hoveredId === 'scratch'
                ? 'rgba(255,255,255,0.04)'
                : 'transparent',
          borderLeft:
            selectedTemplateId === 'scratch' ? '2px solid #44B2FF' : '2px solid transparent',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            color: selectedTemplateId === 'scratch' ? '#44B2FF' : '#888',
            fontWeight: 600,
            letterSpacing: '0.04em',
            flexShrink: 0,
            minWidth: 24,
          }}
        >
          ✦
        </span>
        <span
          style={{
            fontSize: '0.85rem',
            color: selectedTemplateId === 'scratch' ? '#44B2FF' : '#ccc',
            fontWeight: selectedTemplateId === 'scratch' ? 600 : 400,
            flex: 1,
          }}
        >
          From Scratch
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: '#2a2a2e', margin: '0.375rem 0.875rem' }} />

      {/* Template rows */}
      {TEMPLATE_METADATA.map((template, index) => {
        const num = String(index + 1).padStart(2, '0');
        const badge = getDimensionBadge(template);
        const isSelected = selectedTemplateId === template.templateId;
        const isHovered = hoveredId === template.templateId;

        return (
          <div
            key={template.templateId}
            onClick={() => onSelectTemplate(template)}
            onMouseEnter={() => setHoveredId(template.templateId)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              ...rowBase,
              backgroundColor: isSelected
                ? 'rgba(68,178,255,0.12)'
                : isHovered
                  ? 'rgba(255,255,255,0.04)'
                  : 'transparent',
              borderLeft: isSelected ? '2px solid #44B2FF' : '2px solid transparent',
            }}
          >
            {/* Number */}
            <span
              style={{
                fontSize: '0.7rem',
                color: isSelected ? '#44B2FF' : '#555',
                fontWeight: 600,
                letterSpacing: '0.04em',
                flexShrink: 0,
                minWidth: 24,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {num}
            </span>

            {/* Template name */}
            <span
              style={{
                fontSize: '0.85rem',
                color: isSelected ? '#fff' : '#ccc',
                fontWeight: isSelected ? 500 : 400,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {template.name}
            </span>

            {/* Dimension badge */}
            <span
              style={{
                fontSize: '0.65rem',
                padding: '2px 7px',
                borderRadius: 4,
                backgroundColor: isSelected ? 'rgba(68,178,255,0.18)' : 'rgba(255,255,255,0.06)',
                color: isSelected ? '#44B2FF' : '#666',
                flexShrink: 0,
                letterSpacing: '0.03em',
                fontWeight: 500,
              }}
            >
              {badge}
            </span>
          </div>
        );
      })}

      {TEMPLATE_METADATA.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', padding: '2rem' }}>
          No templates available.
        </div>
      )}
    </div>
  );
}
