/**
 * capabilities.ts — explicit capability registry for all agent tools.
 *
 * One row per agent tool. Source of truth for permission tier, cost profile,
 * and (later) routing decisions in the tool-dispatch wrapper.
 *
 * Tier semantics:
 *   - 'always-allow': read-only, no spend, no state mutation — skip approval
 *   - 'ask-first': real side effect (spend, DB state change) — prompt user
 *   - 'never-allow-by-default': reserved for future destructive ops
 *
 * Keep this file in sync with the TOOL_DEFINITIONS array in agent.ts.
 * Adding a tool to agent.ts without adding a row here will cause the
 * TOOL_POLICY completeness test (phase-24-dispatch-1.test.ts) to fail.
 */

export type ToolTier = 'always-allow' | 'ask-first' | 'never-allow-by-default';
export type CostProfile = 'free' | 'tokens' | 'image-api';

export interface ToolPolicy {
  name: string;
  tier: ToolTier;
  costProfile: CostProfile;
  /** One-line describing what this tool does. */
  responsibility: string;
  sideEffect: 'read' | 'write-db' | 'spend-api' | 'write-fs';
}

export const TOOL_POLICY: Record<string, ToolPolicy> = {
  // ─── Brand Discovery (read-only) ─────────────────────────────────────────

  list_voice_guide: {
    name: 'list_voice_guide',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'List all voice guide documents with slug, title, and short description.',
    sideEffect: 'read',
  },
  read_voice_guide: {
    name: 'read_voice_guide',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Read the full content of a voice guide document by slug.',
    sideEffect: 'read',
  },
  list_patterns: {
    name: 'list_patterns',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'List brand patterns, optionally filtered by category.',
    sideEffect: 'read',
  },
  read_pattern: {
    name: 'read_pattern',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Read the full content of a brand pattern by slug.',
    sideEffect: 'read',
  },
  list_assets: {
    name: 'list_assets',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'List brand assets (fonts, images, logos, decorations).',
    sideEffect: 'read',
  },
  list_templates: {
    name: 'list_templates',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'List all available templates with id, name, type, and description.',
    sideEffect: 'read',
  },
  read_template: {
    name: 'read_template',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Read a template by its numeric ID, including design rules.',
    sideEffect: 'read',
  },
  list_archetypes: {
    name: 'list_archetypes',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'List layout archetypes with metadata and optional filters.',
    sideEffect: 'read',
  },
  read_archetype: {
    name: 'read_archetype',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Read an archetype layout by slug, including HTML, schema, and notes.',
    sideEffect: 'read',
  },

  // ─── Brand Editing (write-db, ask-first) ─────────────────────────────────

  update_pattern: {
    name: 'update_pattern',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Update the content of an existing brand pattern by slug.',
    sideEffect: 'write-db',
  },
  create_pattern: {
    name: 'create_pattern',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Create a new brand pattern in a category.',
    sideEffect: 'write-db',
  },
  delete_pattern: {
    name: 'delete_pattern',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Delete a brand pattern by slug.',
    sideEffect: 'write-db',
  },
  update_voice_guide: {
    name: 'update_voice_guide',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Update the content of an existing voice guide document by slug.',
    sideEffect: 'write-db',
  },
  create_voice_guide: {
    name: 'create_voice_guide',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Create a new voice guide document.',
    sideEffect: 'write-db',
  },

  // ─── Visual / Creation (write-db, ask-first for save ops) ────────────────

  render_preview: {
    name: 'render_preview',
    tier: 'always-allow',
    costProfile: 'tokens',
    responsibility: 'Render HTML to a screenshot image for visual QA.',
    sideEffect: 'read',
  },
  save_creation: {
    name: 'save_creation',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Save HTML as a new creation in a campaign.',
    sideEffect: 'write-db',
  },
  edit_creation: {
    name: 'edit_creation',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Update the HTML of an existing iteration.',
    sideEffect: 'write-db',
  },
  save_as_template: {
    name: 'save_as_template',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility: 'Save an existing iteration as a reusable template.',
    sideEffect: 'write-db',
  },

  // ─── Context (read-only) ─────────────────────────────────────────────────

  get_ui_context: {
    name: 'get_ui_context',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Get the current UI context passed from the frontend.',
    sideEffect: 'read',
  },
  get_creation: {
    name: 'get_creation',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Get full details of a creation iteration including slot schema.',
    sideEffect: 'read',
  },
  get_campaign: {
    name: 'get_campaign',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility: 'Get campaign details including all its creations.',
    sideEffect: 'read',
  },

  // ─── Phase 24 additions ──────────────────────────────────────────────────

  search_brand_images: {
    name: 'search_brand_images',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility:
      'Search the brand image library (DAM) by query before requesting image generation.',
    sideEffect: 'read',
  },

  // generate_image: executor built in dispatch 3.
  generate_image: {
    name: 'generate_image',
    tier: 'ask-first',
    costProfile: 'image-api',
    responsibility:
      'Generate a new brand image via Gemini 2.5 Flash Image. Call search_brand_images first — only generate when no existing DAM asset matches.',
    sideEffect: 'spend-api',
  },

  promote_generated_image: {
    name: 'promote_generated_image',
    tier: 'ask-first',
    costProfile: 'free',
    responsibility:
      'Promote a generated (or uploaded) image to the curated brand library by changing its source to local.',
    sideEffect: 'write-db',
  },

  read_skill: {
    name: 'read_skill',
    tier: 'always-allow',
    costProfile: 'free',
    responsibility:
      'Read a whitelisted agent skill markdown file (social-media-taste or gemini-social-image) to guide content or image generation.',
    sideEffect: 'read',
  },
};

export function getToolPolicy(name: string): ToolPolicy | undefined {
  return TOOL_POLICY[name];
}
