/**
 * Semantic font sizes for artboard text (1080-class layouts).
 *
 * **Sync:** The object `M` inside `__fluidFsPx` in `canvas/src/server/watcher.ts` must match
 * {@link TEXTBOX_FONT_PRESET_PX} (same px per preset key).
 */

export type TextBoxFontPreset =
  | 'inherit'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'custom';

export const TEXTBOX_FONT_PRESET_PX: Record<
  Exclude<TextBoxFontPreset, 'inherit' | 'custom'>,
  number
> = {
  h1: 112,
  h2: 88,
  h3: 64,
  h4: 48,
  h5: 36,
  h6: 28,
  p1: 24,
  p2: 20,
  p3: 16,
};

const PRESET_KEYS = new Set<string>(Object.keys(TEXTBOX_FONT_PRESET_PX));

export function isNamedFontPreset(
  v: string | undefined | null,
): v is Exclude<TextBoxFontPreset, 'inherit' | 'custom'> {
  return typeof v === 'string' && PRESET_KEYS.has(v);
}

export function resolveTextBoxFontSizePx(
  preset: TextBoxFontPreset | undefined,
  fontSizePx?: number | null,
): number | null {
  if (preset == null || preset === 'inherit') return null;
  if (preset === 'custom') {
    if (typeof fontSizePx !== 'number' || !Number.isFinite(fontSizePx)) return null;
    return Math.min(500, Math.max(8, Math.round(fontSizePx)));
  }
  if (isNamedFontPreset(preset)) return TEXTBOX_FONT_PRESET_PX[preset];
  return null;
}

/** Iframe postMessage fragment for textBox action. */
export function textBoxFontPostMessage(
  preset: TextBoxFontPreset | undefined,
  fontSizePx?: number | null,
  /** True when user chose “Template default” this update. */
  explicitInherit?: boolean,
): { fontSize?: string; clearFontSize?: boolean } {
  if (explicitInherit) return { clearFontSize: true };
  const px = resolveTextBoxFontSizePx(preset, fontSizePx);
  if (px == null) return {};
  return { fontSize: `${px}px` };
}
