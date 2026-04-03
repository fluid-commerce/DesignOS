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
  /** CSS selector for the `<img>` (src updates, imgStyle, Reposition). */
  sel: string;
  label: string;
  dims?: string;       // display hint e.g. '353 x 439px'
  /**
   * Click-to-move / CSS transform target (e.g. `.photo` wrapper). If omitted, derived from `sel`:
   * selectors ending with ` img` use the parent token (`.photo img` → `.photo`) so the whole frame moves.
   */
  frameSel?: string;
}

/**
 * Element that receives layout transform in the preview (usually the visible frame, not the `<img>`).
 */
export function imageLayoutSel(field: ImageField): string {
  const explicit = field.frameSel?.trim();
  if (explicit) return explicit;
  const s = field.sel.trim();
  if (/\s+img$/i.test(s)) {
    const parent = s.replace(/\s+img$/i, '').trim();
    return parent || s;
  }
  return s;
}

/** A visual separator between groups of fields (e.g. carousel slide boundaries). */
export interface DividerField {
  type: 'divider';
  label: string;       // e.g. 'Slide 01 - Cover'
}

/** A group of related fields (e.g. stat card, quote block) rendered as a collapsible unit. */
export interface GroupField {
  type: 'group';
  id: string;          // unique group identifier
  label: string;       // "Stat Card", "Quote Block"
  sel: string;         // CSS selector of the group container div
  fields: (TextField | ImageField)[];  // nested fields (non-recursive)
}

/** Union of all field types in a slot schema. */
export type SlotField = TextField | ImageField | DividerField | GroupField;

/**
 * Full slot schema for an asset.
 * Emitted as JSON by the layout subagent alongside the HTML file.
 * Applies to both template-based and AI-generated assets.
 */
export interface SlotSchema {
  templateId?: string;          // set for template-based assets
  archetypeId?: string;         // set for archetype-based assets (added Phase 20)
  platform?: 'instagram-square' | 'linkedin-landscape' | 'one-pager';  // added Phase 21
  width: number;                // asset width in pixels
  height: number;               // asset height in pixels
  fields: SlotField[];          // ordered list of editable fields
  brush?: string | null;        // CSS selector for movable element (one per template)
  brushLabel?: string;          // label for the brush/transform element
  /** Extra pickable/transform elements (e.g. carousel arrow) with their own persisted transform keys */
  brushAdditional?: ReadonlyArray<{ sel: string; label: string }>;
  carouselCount?: number;       // number of slides (undefined for single-frame assets)
}

/** How layout is adjusted in the preview for a picked element */
export type TransformTargetKind = 'text' | 'image' | 'brush' | 'group';

export interface TransformTarget {
  sel: string;
  label: string;
  kind: TransformTargetKind;
  /** When `kind === 'text'`, how the parent applies updates (matches slot field `mode`). */
  mode?: FieldMode;
}

/**
 * Selectors that can be picked in the preview: text (text box resize), image & brush (transform).
 */
export function collectTransformTargets(schema: SlotSchema): TransformTarget[] {
  const out: TransformTarget[] = [];
  const seen = new Set<string>();

  function walkFields(fields: SlotField[]): void {
    for (const f of fields) {
      if (f.type === 'group') {
        // Group container is a transform target (draggable unit)
        if (!seen.has(f.sel)) {
          seen.add(f.sel);
          out.push({ sel: f.sel, label: f.label, kind: 'group' });
        }
        walkFields(f.fields);  // also collect children for field editing
        continue;
      }
      if (f.type === 'text') {
        if (!seen.has(f.sel)) {
          seen.add(f.sel);
          out.push({ sel: f.sel, label: f.label, kind: 'text', mode: f.mode });
        }
        continue;
      }
      if (f.type === 'image') {
        const layoutSel = imageLayoutSel(f);
        if (!seen.has(layoutSel)) {
          seen.add(layoutSel);
          out.push({ sel: layoutSel, label: f.label, kind: 'image' });
        }
      }
    }
  }

  walkFields(schema.fields);

  if (schema.brush && !seen.has(schema.brush)) {
    const bl = schema.brushLabel;
    out.push({
      sel: schema.brush,
      label: bl ? bl.charAt(0).toUpperCase() + bl.slice(1) : 'Decorative element',
      kind: 'brush',
    });
  }
  for (const extra of schema.brushAdditional ?? []) {
    if (!extra.sel || seen.has(extra.sel)) continue;
    seen.add(extra.sel);
    out.push({
      sel: extra.sel,
      label: extra.label ? extra.label.charAt(0).toUpperCase() + extra.label.slice(1) : 'Decorative element',
      kind: 'brush',
    });
  }
  return out;
}

/** Pick payload from the preview iframe (same shape as editor `pickedTransform`). */
export interface LayoutPickRef {
  sel: string;
  kind: TransformTargetKind;
}

/**
 * Map a preview click pick to the sidebar slot key (`field.sel` in slotValues).
 * Text uses the picked selector directly; image picks use the frame selector (e.g. `.photo`) → img `sel`.
 */
export function slotFieldSelFromLayoutPick(
  schema: SlotSchema | null,
  picked: LayoutPickRef | null
): string | null {
  if (!schema || !picked) return null;

  function findInFields(fields: SlotField[]): string | null {
    for (const x of fields) {
      if (x.type === 'group') {
        const found = findInFields(x.fields);
        if (found) return found;
        continue;
      }
      if (picked!.kind === 'text' && x.type === 'text' && x.sel === picked!.sel) {
        return x.sel;
      }
      if (picked!.kind === 'image' && x.type === 'image' && imageLayoutSel(x) === picked!.sel) {
        return x.sel;
      }
    }
    return null;
  }

  if (picked.kind === 'text' || picked.kind === 'image') {
    return findInFields(schema.fields);
  }
  // Group picks don't map to a content field — they're container-level only
  return null;
}
