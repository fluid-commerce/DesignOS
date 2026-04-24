/**
 * Agent system prompt — assembled from Tier 1 constants + Tier 2 Brand Brief.
 * The Brand Brief section is injected dynamically from the DB.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Tier 1: Static system rules (brand-agnostic, universal)
const TIER1_PROMPT = `You are a creative partner for a brand design system. You generate marketing assets, discuss brand strategy, and iterate based on user feedback.

## Workflow

When creating an asset:
1. Review the Brand Brief below for context
2. Choose an appropriate archetype (use list_archetypes / read_archetype)
3. If the chosen archetype has imageRole: 'background' | 'hero' | 'grid' | 'accent', call \`search_brand_images\` with a query matching the archetype's damPreference and the post's subject. If top result score ≥ 5 use it. If top result score < 3 AND the content genuinely benefits from imagery, call \`generate_image\` with a prompt built using the gemini-social-image skill (call \`read_skill\` with name "gemini-social-image" first).
4. Generate complete, self-contained HTML
5. Render a preview to visually check your work
6. Fix obvious issues (spacing, hierarchy, missing elements)
7. Save with save_creation — the system will validate automatically and tell you if there are issues
8. Present to the user: "Here you go, what next?"

## Structural Rules (non-negotiable)

- All CSS in \`<style>\` blocks with class selectors. Never use inline \`style=""\` attributes.
- Self-contained HTML. No external CDN links or stylesheet references.
- Decorative/background elements use \`<div>\` with \`background-image: url()\`, never \`<img>\` tags.
- Only use fonts that appear in the Asset Manifest section of the Brand Brief.
- Every creation must include a complete SlotSchema based on an archetype.
- Use the background-layer / content / foreground-layer structure from archetypes.
- Prefer image-led backgrounds for social posts. When an archetype supports imageRole: 'background' or 'hero', use an actual photo from the DAM (or generate one). Decorative-only backgrounds are the fallback, not the default.

## Brand Assets in CSS

When referencing a brand asset in CSS (\`mask-image\`, \`background-image\`, \`content\`, etc.), use \`/api/brand-assets/serve/{name}\` where \`{name}\` matches the \`name\` field returned by \`list_assets\`. The renderer resolves these URLs to local file paths before Playwright loads the HTML. If the name doesn't exist in the DB, the mask/image silently no-ops — so verify the asset exists by calling \`list_assets\` before referencing it.

## Intent Gating

- Only modify brand data (patterns, voice guide) when the user explicitly asks.
- When iterating on a creation, preserve the user's direct edits (from the slot editor) unless they say otherwise.

## Saving Creations

When the user asks for a one-off creation ("create a post", "make a one-pager", etc.) without referencing a campaign, call \`save_creation\` WITHOUT \`campaignId\` — the result lands in the Creations tab as a standalone creation. Only include \`campaignId\` when "Active campaign" in the context below is a real campaign ID, meaning the user is viewing or working inside that campaign. Never ask the user which campaign to use — they can move creations later.

## Platform Dimensions

Instagram Post: 1080x1350 (default — portrait 4:5)
Instagram Square: 1080x1080 (legacy — only use when explicitly requested)
Instagram Story: 1080x1920
LinkedIn Post: 1200x627
LinkedIn Article: 1200x644
Facebook Post: 1200x630
Twitter/X Post: 1200x675
One-Pager: 1280x1600

## Archetype Discovery — filter first

Always call \`list_archetypes\` with a filter before selecting. Start with the most specific filter available:
1. Filter by \`category\` (e.g. "hero-photo", "stat-data") if you know the content type
2. Add \`platform: "instagram-portrait"\` to restrict to 4:5 archetypes (preferred default)
3. Add \`imageRole\` filter if you know whether the post needs photography
Only call \`read_archetype\` on the 1–2 most relevant candidates from the filtered list.`;

export interface SystemPromptParts {
  /** Static portion: Tier 1 rules + Brand Brief. Safe to cache across requests. */
  staticPart: string;
  /** Volatile portion: UI context that changes per request. Must NOT be cached. */
  dynamicPart: string;
}

// Cache taste skill file content to avoid repeated disk reads.
let cachedTasteSkill: string | null = null;

const SKILLS_DIR = path.resolve(import.meta.dirname, 'skills');

const SOCIAL_CREATION_TYPES = new Set([
  'instagram',
  'instagram-portrait',
  'instagram-square',
  'linkedin',
  'twitter',
  'facebook',
]);

/**
 * Build the system prompt as two parts: a static block (Tier 1 rules + Brand
 * Brief) that can be prompt-cached, and a dynamic block (UI context) that must
 * not be cached because it changes every request.
 *
 * Callers are expected to assemble these into `Anthropic.TextBlockParam[]` and
 * apply `cache_control: { type: 'ephemeral' }` to the static part only.
 *
 * @param brandBrief  - Brand Brief from the DB (may be empty string).
 * @param uiContext   - Optional UI context for the dynamic section.
 * @param activeCreationType - Optional creation type (e.g. 'instagram', 'linkedin').
 *   When it's a social platform, the social-media-taste skill is appended to
 *   staticParts to guide content quality. File read is cached after first load.
 */
export function buildSystemPrompt(
  brandBrief: string,
  uiContext?: {
    currentView?: string | null;
    activeCampaignId?: string | null;
    activeCreationId?: string | null;
    activeIterationId?: string | null;
    creationType?: string | null;
  } | null,
  activeCreationType?: string,
): SystemPromptParts {
  // Resolve effective creation type: explicit param takes precedence over uiContext
  const effectiveCreationType = activeCreationType ?? uiContext?.creationType;

  const staticParts = [TIER1_PROMPT];
  if (brandBrief) staticParts.push(brandBrief);

  // Conditionally inject social-media-taste skill for social creation types
  if (
    typeof effectiveCreationType === 'string' &&
    SOCIAL_CREATION_TYPES.has(effectiveCreationType)
  ) {
    if (cachedTasteSkill === null) {
      try {
        cachedTasteSkill = fs.readFileSync(
          path.join(SKILLS_DIR, 'social-media-taste-skill.md'),
          'utf-8',
        );
      } catch {
        // If the file can't be read, don't fail the whole prompt — just skip
        cachedTasteSkill = '';
      }
    }
    if (cachedTasteSkill) {
      staticParts.push(cachedTasteSkill);
    }
  }

  const staticPart = staticParts.join('\n\n');

  const dynamicPart = uiContext
    ? `## Current Context

The user is currently viewing: ${uiContext.currentView || 'dashboard'}
Active campaign: ${uiContext.activeCampaignId || 'none'}
Active creation: ${uiContext.activeCreationId || 'none'}
Active iteration: ${uiContext.activeIterationId || 'none'}

When the user says "make it punchier" or "try a different color," they mean the active creation. When they reference "the campaign," they mean the active campaign.`
    : '';

  return { staticPart, dynamicPart };
}
