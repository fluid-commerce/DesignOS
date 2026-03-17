# Phase 14: Design DNA — Context

**Gathered:** 2026-03-17
**Status:** Ready for planning
**Source:** Video walkthrough analysis + deep research session

<domain>
## Phase Boundary

This phase extracts visual style intelligence from hand-designed templates into a layered, DB-backed system that agents reference during generation. The goal is to close the quality gap between AI-generated social posts (which currently look like "mini web pages") and Jonathan's hand-designed templates (which look like real social media graphics).

**Two generation modes supported:**
1. **Template mode** (future): Pick template → fill slots (AI copy or manual) → done
2. **Generation mode** (this phase): Agent creates something new, using templates as strong style exemplars

This phase focuses on Generation mode for social media posts only.

</domain>

<decisions>
## Implementation Decisions

### Data Architecture (3-tier)
- **Global visual style rules** → Patterns page/DB (`brand_patterns` table, new category). Compositor contract: layers, typography ratios, blend modes, "poster not web page" philosophy. These are Fluid's visual language, not tied to any deliverable type.
- **Per-deliverable design DNA** → Templates page/DB (new `template_design_rules` table). Social media tab with: general social media rules, Instagram-specific brand guidelines, LinkedIn-specific brand guidelines, per-archetype design notes.
- **System-level platform specs** → Pipeline code (not brand DB). Dimensions, safe areas, aspect ratios. Hardcoded config, not user-editable brand content.

### Templates Page UI Structure
- Templates page gets a "Social Media" tab
- Within that tab: general rules for all social media, then rules per platform (Instagram, LinkedIn)
- Per-archetype design notes linked to template HTML files
- Design rules should be inline-editable (like VoiceGuide page)
- This becomes a living, breathing definition that can ingest new style over time

### Pipeline Prompt Changes
- Agent system prompts for generation mode receive: global visual rules + social media general rules + platform-specific rules + matched archetype design notes + one full HTML exemplar
- Use `<example>` XML tags for the exemplar (Claude best practice)
- Include design intent annotations before the HTML exemplar
- 1 matched template, not all 7 (research shows diminishing returns after 2-3 examples, context bloat hurts quality)
- Frame anti-patterns as positive constraints (LLMs handle negation poorly)

### Asset URL Fix
- `list_brand_assets` tool must return ready-to-use `src`/`url()` values, not raw file paths
- Kill base64 embedding at the tool level — if the tool returns `url('/fluid-assets/fonts/flfontbold.ttf')`, the agent uses it verbatim
- The server already does path rewriting (`../../assets/` → `/fluid-assets/`) in HTML serving code

### Global Visual Style Rules Content (Design DNA)
Extracted from template analysis, these rules define what makes a Fluid social post look "designed" vs. a web page:
- Fixed canvas with `overflow: hidden` — poster, not a web page
- Required visual layers: background → texture/brushstroke → content → footer
- Typography scale: headline 5-8x body text (not 2-3x like web pages)
- Positioning via `position: absolute`, not flexbox/grid layouts
- Required elements: logo, tagline, at least 1 decorative element (brushstroke or circle)
- At least one `mix-blend-mode` or filter effect
- Background extends to edges; content intentionally inset
- Color palette limited to accent + black + white + opacity variants
- Edge-bleed brushstrokes (positioned partially off-canvas)

### Per-Archetype Design Notes Content
For each of the 7 templates, extract:
- What makes this archetype work visually
- The key compositional principle (e.g., problem-first = headline dominates, stat-proof = giant number as focal point)
- Which decorative elements are essential vs. optional
- The accent color mapping and mood

### Claude's Discretion
- Exact DB schema for `template_design_rules` table
- API endpoint naming/structure
- How to modify the pipeline's `loadStagePrompt` / `buildStylingPrompt` to inject the new context
- Seeder implementation details
- Whether to add a new MCP tool or extend existing `read_brand_section`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Architecture
- `canvas/src/server/api-pipeline.ts` — Pipeline tool schemas, stage prompt builders, tool executor, brand context loading
- `canvas/src/server/db-api.ts` — DB query functions for voice guide, patterns, brand assets
- `canvas/src/lib/db.ts` — SQLite schema, table creation, migrations

### Templates
- `templates/social/problem-first.html` — Exemplar template (best reference for what good output looks like)
- `templates/social/index.html` — Template library index
- `canvas/src/lib/template-configs.ts` — Template metadata and slot schemas

### Brand Data
- `canvas/src/server/brand-seeder.ts` — Seeder for voice guide docs and brand patterns from filesystem
- `brand/design-tokens.md` — Current design token definitions
- `brand/layout-archetypes.md` — Current layout archetype definitions
- `patterns/index.html` — Pattern library HTML (source for brand_patterns seeder)

### Existing Brand Pages
- `canvas/src/components/VoiceGuide.tsx` — Inline-editable voice guide (reference for similar UI pattern)
- `canvas/src/components/TemplateGallery.tsx` — Current templates page
- `canvas/src/server/watcher.ts` — API endpoints (voice-guide, brand-patterns, brand-assets routes)

### Skill Files
- `~/.agents/skills/fluid-social/SKILL.md` — Social post orchestrator (stage instructions extracted for API pipeline)
- `~/.agents/skills/copy-agent/SKILL.md` — Copy agent contract
- `~/.agents/skills/styling-agent/SKILL.md` — Styling agent contract

</canonical_refs>

<specifics>
## Specific Ideas

### Research Findings (from deep research in this session)
- **1 matched exemplar + extracted Design DNA** beats both "show all templates" and "just describe rules" (STANDARDIZE framework research)
- **Diminishing returns after 2-3 examples** — don't load all 7 templates (ICSE 2023)
- **LLMs handle negation poorly** — reframe "don't make it a web page" as "this is a fixed 1080x1080 visual poster with no scrolling" (Gadlet, HackerNoon)
- **Claude defaults to "distributional convergence"** — Inter font, purple gradients, white backgrounds without explicit guidance (Anthropic blog)
- **Design DNA + closed token set** prevents hallucinated CSS values (Hardik Pandya's design-system-for-LLMs)
- **Use `<example>` XML tags** for exemplars (Anthropic multishot prompting docs)

### Agent Context Assembly Order (for generating an Instagram pain post)
1. Global visual style rules (from patterns DB)
2. Social media general rules (from template_design_rules DB)
3. Instagram brand rules (from template_design_rules DB)
4. Problem-first archetype notes + full HTML exemplar (from template_design_rules DB)

### Current Generated Output Issues (from video analysis)
- 620KB files due to base64-embedded fonts and logos
- Brushstrokes rendered as empty divs (no actual images loaded)
- Structurally correct-ish but visually dead — no textures, no real assets
- Feels like a web page because it IS one — CSS-only with no visual assets rendering
- Not pulling in logos from assets page
- Not basing posts on curated templates

</specifics>

<deferred>
## Deferred Ideas

- Template mode (pick template → fill slots) — future phase
- One-pager and theme-section Design DNA — future phases (social media only for now)
- Structural CSS audit in spec-check (layer count, blend modes, font scale ratio) — could be Phase 15
- Visual regression testing with Puppeteer + SSIM — future
- Multimodal LLM evaluation of generated screenshots — future
- Prompt caching for Design DNA (Anthropic cache_control) — optimization after validation

</deferred>

---

*Phase: 14-design-dna*
*Context gathered: 2026-03-17 via video walkthrough analysis + deep research session*
