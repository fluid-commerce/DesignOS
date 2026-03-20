/**
 * Slot schema types — TypeScript port of Jonathan's field config format.
 * The layout subagent emits a SlotSchema JSON alongside every HTML output.
 * The right sidebar reads this schema to render editor fields.
 *
 * Source: Jonathan's editor.js TEMPLATES config structure.
 */

/** How text content is updated in the template's HTML. */
export type FieldMode = 'text' | 'pre' | 'br';

/** An editable text field in the template. */
export interface TextField {
  type: 'text';
  sel: string;         // CSS selector in template HTML
  label: string;
  mode: FieldMode;
  rows?: number;       // textarea rows hint
}

/** An editable image field in the template. */
export interface ImageField {
  type: 'image';
  sel: string;         // CSS selector for <img> element
  label: string;
  dims?: string;       // display hint e.g. '353 x 439px'
}

/** A visual separator between groups of fields (e.g. carousel slide boundaries). */
export interface DividerField {
  type: 'divider';
  label: string;       // e.g. 'Slide 01 - Cover'
}

/** Union of all field types in a slot schema. */
export type SlotField = TextField | ImageField | DividerField;

/**
 * Full slot schema for an asset.
 * Emitted as JSON by the layout subagent alongside the HTML file.
 * Applies to both template-based and AI-generated assets.
 */
export interface SlotSchema {
  templateId?: string;          // set for template-based assets
  width: number;                // asset width in pixels
  height: number;               // asset height in pixels
  fields: SlotField[];          // ordered list of editable fields
  brush?: string | null;        // CSS selector for movable element (one per template)
  brushLabel?: string;          // label for the brush/transform element
  carouselCount?: number;       // number of slides (undefined for single-frame assets)
}

/** How layout is adjusted in the preview for a picked element */
export type TransformTargetKind = 'text' | 'image' | 'brush';

export interface TransformTarget {
  sel: string;
  label: string;
  kind: TransformTargetKind;
}

/**
 * Selectors that can be picked in the preview: text (text box resize), image & brush (transform).
 */
export function collectTransformTargets(schema: SlotSchema): TransformTarget[] {
  const out: TransformTarget[] = [];
  const seen = new Set<string>();
  for (const f of schema.fields) {
    if (f.type === 'text' || f.type === 'image') {
      if (!seen.has(f.sel)) {
        seen.add(f.sel);
        out.push({
          sel: f.sel,
          label: f.label,
          kind: f.type === 'text' ? 'text' : 'image',
        });
      }
    }
  }
  if (schema.brush && !seen.has(schema.brush)) {
    const bl = schema.brushLabel;
    out.push({
      sel: schema.brush,
      label: bl ? bl.charAt(0).toUpperCase() + bl.slice(1) : 'Decorative element',
      kind: 'brush',
    });
  }
  return out;
}
