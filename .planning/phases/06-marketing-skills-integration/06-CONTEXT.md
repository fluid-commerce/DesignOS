# Phase 6: Marketing Skills Integration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Copy 30 marketing domain skills from ~/.agents/skills/ into this repo, create a skill-to-task mapping manifest, update all orchestrator skills to load marketing expertise alongside brand docs, and distribute marketing skills globally via sync.sh. No new subagent roles — existing copy/layout/styling/spec-check agents get smarter through skill loading.

Requirements: TBD (to be derived during planning).

</domain>

<decisions>
## Implementation Decisions

### Skill loading strategy
- Static manifest at `brand/skill-map.json` defines which skills load for each (asset type + subagent role) combo
- Same pattern as `brand/index.md` agent loading notes — predictable, auditable, easy to tune
- 1-2 marketing skills max per subagent alongside brand docs (token budget constraint)
- Operator can override default skill set via `--skills` flag on any orchestrator command (e.g., `/fluid-social "topic" --skills copywriting,pricing-strategy`) — full override, not additive
- Skill map lives in `brand/skill-map.json` alongside brand docs — same ecosystem, tunable by Phase 5 learning loop

### Packaging & distribution
- Marketing skills copied as-is into `skills/marketing/` directory in this repo (no rewriting/ingestion)
- Each skill retains its original SKILL.md structure from ~/.agents/skills/
- Source of truth moves to this repo — sync.sh overwrites any existing copies at ~/.agents/skills/ or ~/.claude/commands/
- Skills distributed globally via sync.sh so they're available as standalone tools outside the Fluid pipeline AND as subagent context within it
- No deduplication logic needed — sync.sh simply overwrites with the repo version

### Skill-to-task mapping
- Mapping granularity: per asset type (social-post, website-section, one-pager), not per archetype/template
- 3 asset types × 4 subagent roles = 12 mapping entries in skill-map.json
- Human-curated mapping — during execution, Claude proposes the full mapping and walks operator through it skill-by-skill for interactive approval (same approval walkthrough pattern as Phase 5 feedback ingestion)
- All 30 skills should be evaluated for mapping; skills that don't naturally map to any asset type still get distributed as standalone tools

### Subagent architecture
- No new subagent roles — existing 4-role pipeline (copy → layout → styling → spec-check) unchanged
- Existing subagents get enriched via marketing skill loading (copy agent absorbs copywriting/CRO/psychology knowledge, spec-check absorbs SEO/analytics knowledge)
- Brand docs are PRIMARY, marketing skills are SECONDARY reference — if a marketing skill contradicts a brand doc, brand wins. Orchestrator delegation messages frame this explicitly: "Load marketing expertise (reference only — brand docs take precedence)"
- Orchestrator skills (fluid-social, fluid-one-pager, fluid-theme-section) updated directly to include marketing skill loading in delegation messages — no wrapper/loader abstraction

### Skill delivery to subagents
- File path in delegation message — orchestrator tells subagent "Read skills/marketing/copywriting/SKILL.md" (same pattern as brand docs today)
- Subagent reads the file itself — no content passed in delegation messages (existing anti-pattern rule)
- Brand context listed first in delegation, marketing expertise listed second, reinforcing the hierarchy

### Claude's Discretion
- Exact framing language in delegation messages (beyond the "reference only — brand docs take precedence" requirement)
- Whether skill-map.json is consumed by orchestrators at runtime (dynamic read) or hardcoded into orchestrator skills during a build step
- How to handle --skills flag validation (unknown skill names, too many skills)
- Sync.sh implementation details for distributing marketing skills

</decisions>

<specifics>
## Specific Ideas

- "I want them as-is, but packaged up with our current skills so they're installed all together" — no rewriting, single installation
- "Whatever makes it so that fluid brand is weighted heavier than general expertise in the case of a direct contradiction" — clear hierarchy: brand > marketing skills
- "Walk me through the whole curation process so I can make decision-by-decision" — interactive skill mapping approval during execution
- "Distribute globally, ensure we're not duplicating if someone already has them. (overwrite with most recent from the repo)" — repo is authoritative source, sync.sh overwrites

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `brand/index.md`: Agent loading notes per role — pattern to extend with marketing skill references
- `brand/skill-map.json`: New file, but follows established brand/ directory pattern
- `sync.sh` (referenced in Phase 1): Distributes skills to ~/.claude/commands/ and ~/.cursor/skills/ — needs extension for marketing skills
- 3 orchestrator skills in `.claude/skills/`: fluid-social, fluid-one-pager, fluid-theme-section — all need delegation message updates
- 4 subagent definitions: copy-agent, layout-agent, styling-agent, spec-check-agent — no changes needed (they just read whatever files the orchestrator tells them to)

### Established Patterns
- Brand doc loading: orchestrator lists specific file paths in delegation message, subagent reads them
- Anti-pattern: never pass file contents in delegation messages (SKILL.md rule in fluid-social)
- Weight system (1-100) with brand docs at 81-100 — marketing skills implicitly below this threshold
- `--debug`, `--ref`, `--template` flags already exist on orchestrators — `--skills` follows the same pattern

### Integration Points
- `brand/skill-map.json` — new manifest consumed by orchestrator skills
- `skills/marketing/` — new directory housing 30 copied SKILL.md files
- `.claude/skills/fluid-social/SKILL.md` — delegation messages updated with marketing skill reads
- `.claude/skills/fluid-one-pager/SKILL.md` — same updates
- `.claude/skills/fluid-theme-section/SKILL.md` — same updates
- `sync.sh` — extended to distribute skills/marketing/ contents globally
- `brand/index.md` — updated with marketing skill loading notes

### Source Material
- 30 marketing skills at ~/.agents/skills/ (copywriting, page-cro, marketing-psychology, social-content, sales-enablement, seo-audit, analytics-tracking, ad-creative, cold-email, content-strategy, copy-editing, paid-ads, schema-markup, site-architecture, ai-seo, programmatic-seo, ab-test-setup, email-sequence, launch-strategy, competitor-alternatives, referral-program, pricing-strategy, free-tool-strategy, marketing-ideas, marketing-psychology, popup-cro, signup-flow-cro, onboarding-cro, form-cro, paywall-upgrade-cro, churn-prevention, revops)
- Skill analysis from earlier in this conversation: 8 domains (CRO, SEO, Content/Copy, Paid Media, Sales, Psychology, Analytics, Growth), all deep (150-450+ lines each)

</code_context>

<deferred>
## Deferred Ideas

- **Dynamic prompt-based skill selection** — orchestrator analyzes prompt and adds skills beyond the manifest defaults. Deferred in favor of static manifest + --skills override for v1.
- **Per-archetype skill overrides** — social-post/stat-proof loads analytics-tracking while social-post/manifesto doesn't. Could be added to skill-map.json later if needed.
- **Skill condensation/summaries** — creating shorter versions of skills for token efficiency. Deferred because 1-2 skills per subagent keeps token budget manageable.
- **Marketing skill weight system** — numeric weights on marketing skill rules (like brand docs have). Would enable spec-check to validate against marketing best practices. Future phase.

</deferred>

---

*Phase: 06-marketing-skills-integration*
*Context gathered: 2026-03-11*
