/**
 * Shared preview utilities for creation/slide iframe rendering.
 * Extracted so they can be imported by both App.tsx and unit tests.
 */

import type { Iteration, Creation, Slide } from './campaign-types';

/**
 * Padding between the app chrome and the preview iframe (outside the creative).
 * The **design** safe margin is {@link ARTBOARD_SAFE_MARGIN_PX} inside the HTML.
 */
export const PREVIEW_CHROME_PADDING_PX = 24;

/**
 * Safe margin **inside** the artboard document: dashed guide is inset this many px from
 * each edge; smart guides snap to these lines so content can align 36px from the trim.
 */
export const ARTBOARD_SAFE_MARGIN_PX = 36;

/**
 * Injects a non-interactive dashed rectangle inset {@link ARTBOARD_SAFE_MARGIN_PX} from
 * the iframe viewport (before `</body>`).
 * Use only for **creation/iteration edit** HTML (`/api/iterations/:id/html`), not static
 * `/templates/...` previews. Omit from zip exports.
 */
export function injectArtboardMarginGuide(html: string): string {
  if (html.includes('id="__fluid_safe_margin"')) return html;
  const m = ARTBOARD_SAFE_MARGIN_PX;
  const guide = `<div id="__fluid_safe_margin" aria-hidden="true" style="position:fixed;inset:${m}px;border:1px dashed rgba(198,198,206,0.55);pointer-events:none;z-index:2147483646;box-sizing:border-box"></div>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${guide}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${guide}</html>`);
  return html + guide;
}

/** Minimal shape needed for preview descriptor (matches DrillDownGrid.PreviewDescriptor). */
export interface PreviewDescriptorBasic {
  src?: string;
  width: number;
  height: number;
  meta?: {
    icon?: string;
    badges?: string[];
    detail?: string;
  };
}

/** Returns true if the htmlPath looks like it could resolve to a real file. */
function isValidHtmlPath(htmlPath: string | undefined | null): boolean {
  if (!htmlPath) return false;
  // Filter out placeholder/test paths that were never resolved to real files
  const invalid = ['placeholder', 'test.html', '/path/to/variation.html', '/path/to/template.html'];
  if (invalid.includes(htmlPath)) return false;
  return true;
}

/**
 * Returns the native pixel dimensions for a given creation type.
 * Used to correctly scale iframe previews in DrillDownGrid cards.
 */
export function getCreationDimensions(creationType: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    instagram: { width: 1080, height: 1080 },
    linkedin: { width: 1200, height: 627 },
    'one-pager': { width: 816, height: 1056 },
  };
  return map[creationType] ?? { width: 1080, height: 1080 };
}

/** @deprecated Use getCreationDimensions */
export const getAssetDimensions = getCreationDimensions;

/**
 * Pure function version of renderCreationPreview — testable without React.
 * Returns an iframe src descriptor when latestIter is complete, else metadata fallback.
 */
export function buildCreationPreview(
  creation: Creation,
  latestIter: Iteration | undefined,
): PreviewDescriptorBasic {
  if (
    latestIter &&
    isValidHtmlPath(latestIter.htmlPath) &&
    latestIter.generationStatus === 'complete'
  ) {
    const dims = getCreationDimensions(creation.creationType);
    return { src: `/api/iterations/${latestIter.id}/html`, ...dims };
  }
  return {
    width: 1080,
    height: 1080,
    meta: {
      icon: 'creation',
      badges: [creation.creationType, latestIter?.generationStatus ?? 'pending'],
      detail: `${creation.slideCount} slide${creation.slideCount !== 1 ? 's' : ''}`,
    },
  };
}

/** @deprecated Use buildCreationPreview */
export const buildAssetPreview = buildCreationPreview;

/**
 * Pure function version of renderSlidePreview — testable without React.
 * Returns an iframe src descriptor when the latest iteration is complete, else metadata fallback.
 */
export function buildSlidePreview(
  slide: Slide,
  slideIterations: Iteration[],
  parentCreation: Creation | undefined,
): PreviewDescriptorBasic {
  const latest =
    slideIterations.length > 0
      ? slideIterations.reduce((best, iter) =>
          iter.iterationIndex > best.iterationIndex ? iter : best,
        )
      : null;
  if (latest && isValidHtmlPath(latest.htmlPath) && latest.generationStatus === 'complete') {
    const dims = getCreationDimensions(parentCreation?.creationType ?? 'instagram');
    return { src: `/api/iterations/${latest.id}/html`, ...dims };
  }
  return {
    width: 1080,
    height: 1080,
    meta: {
      icon: 'slide',
      badges: [`Slide ${slide.slideIndex + 1}`],
      detail: latest ? (latest.generationStatus ?? 'pending') : 'No iterations',
    },
  };
}

/** @deprecated Use buildSlidePreview */
export const buildFramePreview = buildSlidePreview;
