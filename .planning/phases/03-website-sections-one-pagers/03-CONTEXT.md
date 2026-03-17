# Phase 3: Website Sections + One-Pagers - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the proven orchestrator-subagent pattern to generate Gold Standard .liquid website sections and sales collateral one-pagers. Builds two new slash commands: `/fluid-theme-section` (atomic section generator) and `/fluid-one-pager` (sales collateral generator). Does NOT include `/fluid-theme-page` or `/fluid-theme` (full page/theme orchestration) — those are future phases.

</domain>

<decisions>
## Implementation Decisions

### Orchestrator reuse
- Mode-aware agents: same 4 agent files (copy, layout, styling, spec-check) detect mode (social/section/one-pager) and load different brand docs and rules per mode
- Orchestrator passes mode explicitly to agents (e.g., mode=section, platform=shopify) — agents do not auto-detect from file type
- Two new slash commands: `/fluid-theme-section` and `/fluid-one-pager`
- `/fluid-theme-page` (orchestrates sections for one page) and `/fluid-theme` (full theme planning across pages) are deferred to a future phase
- Session-based working directory pattern (`.fluid/working/{sessionId}/` with lineage.json) carries forward from Phase 2

### Gold Standard decomposition
- Gold Standard workflow doc is split (NOT rewritten) into role-mapped files under `docs/fluid-themes-gold-standard/` — preserve exact original wording, just decompose into multiple focused .md files
- Split by agent role: schema-rules.md (layout agent), button-system.md (styling agent), validation-checklist.md (spec-check agent), theme-tokens.md (styling agent), etc.
- Weight hierarchy: Gold Standard doc = 100 (source of truth), empirical data from querying Fluid repos = 100, Lane/AJ's baseline-controls + themes docs = ~50 (current thinking, not fully ironed out), our existing website-section-specs.md = reworkable
- Lane's 111 existing .liquid sections are NOT references — their schemas are broken (editor sidebar controls don't work consistently). No existing section is truly Gold Standard
- Research agents query Fluid's backend (`/Users/cheyrasmussen/fluid`) and frontend (`/Users/cheyrasmussen/fluid-mono`) repos to understand the full pipeline empirically
- scaffold.cjs update deferred until after research — no point updating based on spec that may not match reality
- Research produces a persistent summary doc (`docs/fluid-themes-gold-standard/EMPIRICAL-FINDINGS.md`) documenting how the theme system actually works

### Research agent queries (all high priority)
- How schema gets rendered into editor sidebar controls (the full pipeline)
- How .liquid gets rendered into DOM-ready code
- How theme variables (colors, fonts, spacing) resolve in section templates
- How blocks are rendered, reordered, added, removed — what `block.fluid_attributes` does
- Find a working section end-to-end: .liquid file → rendered page → editor sidebar
- Use `/query-fluid-backend` and `/query-fluid-mono` skills to explore the repos

### Section type coverage
- Comprehensive 10+ section types built from scratch as templates
- Templates in Jonathan's format adapted for .liquid: live preview + content slot specs + schema documentation + creation instructions
- Build one hero section first as proof-of-concept, validate it works in the editor by pushing to a dev theme (`fluid theme push`), then scale to remaining types
- Manual validation: push to dev theme, open editor, verify every control works in the sidebar
- Templates go in `templates/sections/` (parallel to `templates/social/`)

### One-pager content model
- Same 4-agent pipeline with mode=one-pager (copy → layout → styling → spec-check)
- Full range: product feature, partner/integration, company overview, case study, comparison sheet
- 5+ one-pager templates for full coverage
- Letter size (8.5x11") with @page CSS rules — "Print to PDF" from browser produces clean document
- Use existing `Reference/Brand reference material/Generated Examples/One-Pagers/live-editor-one-pager.html` as content/style starting point
- 4 Figma Community one-pagers saved to `Reference/One-Pager Layouts/` for LAYOUT reference only (not content or style)

### Claude's Discretion
- Exact decomposition boundaries within the Gold Standard doc (which paragraphs go to which agent-role file)
- How to structure the proof-of-concept validation workflow
- Which 10+ specific section types to include (informed by common web patterns and Fluid's use cases)
- Technical approach for mode-aware agent switching (flag-based branching vs separate instruction blocks)

</decisions>

<specifics>
## Specific Ideas

- Layout blocks extracted from Figma references for one-pager templates: hero/headline zone, stats/proof points (large numbers), feature list (bullets/cards/3-column), about/overview text, CTA footer, product image placement, badge/callout elements
- "Meditation app" layout: two-column hero + 2x2 text grid. "AI sales" layout: headline + stats column right + bullet lists. "Startup fact sheet": editorial dark layout with giant stat numbers + full-bleed image breaking layout. "Floral services": display headline + 3-photo strip + 3-column feature cards
- Lane explicitly said: do NOT use any of the 111 existing sections as reference — they suck. Build from scratch
- The Gold Standard .md language is well-defined — keep exact wording when splitting, don't rephrase or regenerate
- Lane/AJ's baseline-controls doc represents their best current thinking but isn't fully ironed out yet (weight ~50)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `copy-agent.md`, `layout-agent.md`, `styling-agent.md`, `spec-check-agent.md`: Phase 2 agents to extend with mode-awareness
- `.claude/skills/fluid-social/SKILL.md`: Orchestrator pattern to mirror for `/fluid-theme-section` and `/fluid-one-pager`
- `tools/scaffold.cjs`: Existing .liquid scaffolding tool (will be updated AFTER research, not before)
- `tools/schema-validation.cjs`: Validates .liquid schema structure
- `tools/brand-compliance.cjs`: Validates brand tokens
- `brand/website-section-specs.md`: Current website section rules (reworkable based on research findings)
- `patterns/index.html`: Brand building blocks reference (circles, brushstrokes, footer)

### Established Patterns
- Orchestrator → subagent pipeline: copy → layout → styling → spec-check → fix loop (proven in Phase 2)
- Session-based working directory with lineage.json
- Jonathan's template format: live preview + slot specs + creation instructions
- CLI tools output dual format (JSON stdout + human stderr)
- Mode passed explicitly from orchestrator to agents

### Integration Points
- `/query-fluid-backend` skill: explores `/Users/cheyrasmussen/fluid` (Rails backend)
- `/query-fluid-mono` skill: explores `/Users/cheyrasmussen/fluid-mono` (frontend monorepo)
- `fluid theme push`: pushes sections to dev theme for validation
- `Reference/Fluid Themes/`: 12 docs covering themes CLI, overview, developer guide, schema components, page editor, variables, API reference, baseline-controls
- `Reference/Fluid Themes/GOLD_STANDARD_WORKFLOW.md`: The monolithic source of truth to decompose
- `Reference/One-Pager Layouts/`: 4 layout reference images (layout patterns only, not style)
- `Reference/Brand reference material/Generated Examples/One-Pagers/live-editor-one-pager.html`: Existing one-pager as content/style starting point

</code_context>

<deferred>
## Deferred Ideas

- `/fluid-theme-page` — orchestrates multiple sections into a single page (coordinates section order, shared settings, page-level consistency). Own phase.
- `/fluid-theme` — full theme planning across multiple pages (plans page types, coordinates cross-page consistency, generates shared theme settings). Own phase.
- Lane/AJ's baseline-controls may eventually supersede parts of the Gold Standard — but not in this initial build. Track for future reconciliation.

</deferred>

---

*Phase: 03-website-sections-one-pagers*
*Context gathered: 2026-03-10*
