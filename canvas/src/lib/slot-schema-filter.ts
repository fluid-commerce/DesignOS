/**
 * Filter slot schema fields for the properties panel so only elements the user
 * can update on the current slide are shown (carousel) or only editable fields (single-frame).
 */

import type { SlotField } from './slot-schema';

/** Parse [data-slide="N"] from a CSS selector; null if absent. */
export function getSlideIndexFromSelector(sel: string): number | null {
  const m = sel.match(/\[data-slide="(\d+)"\]/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Fields the user can edit for the active carousel slide, including the section divider
 * that labels that slide. Non-carousel: only text/image (no dividers).
 */
export function filterFieldsForSlide(
  fields: SlotField[],
  activeSlide: number,
  carouselMode: boolean
): SlotField[] {
  if (!carouselMode) {
    return fields.filter((f) => {
      if (f.type === 'group') return true;  // Groups always pass through (children are filtered in UI)
      return f.type === 'text' || f.type === 'image';
    });
  }

  const out: SlotField[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.type === 'divider') {
      let slideForDivider = 1;
      for (let j = i + 1; j < fields.length; j++) {
        const next = fields[j];
        if (next.type === 'divider') break;
        if (next.type === 'text' || next.type === 'image') {
          const s = getSlideIndexFromSelector(next.sel);
          if (s != null) {
            slideForDivider = s;
            break;
          }
        }
      }
      if (slideForDivider === activeSlide) out.push(f);
      continue;
    }
    if (f.type === 'group') {
      // Include group if any child belongs to this slide
      const hasVisibleChild = f.fields.some(child => {
        const s = getSlideIndexFromSelector(child.sel);
        return s === null || s === activeSlide;
      });
      if (hasVisibleChild) out.push(f);
      continue;
    }
    if (f.type === 'text' || f.type === 'image') {
      const s = getSlideIndexFromSelector(f.sel);
      if (s === null || s === activeSlide) out.push(f);
    }
  }
  return out;
}

/** Whether the transform brush target applies to the active slide. */
export function brushVisibleForSlide(
  brush: string | null | undefined,
  activeSlide: number,
  carouselMode: boolean
): boolean {
  if (!brush) return false;
  if (!carouselMode) return true;
  const s = getSlideIndexFromSelector(brush);
  if (s === null) return true;
  return s === activeSlide;
}
