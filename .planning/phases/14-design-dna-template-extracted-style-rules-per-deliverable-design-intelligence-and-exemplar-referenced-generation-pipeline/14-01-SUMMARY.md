---
phase: 14-design-dna-template-extracted-style-rules-per-deliverable-design-intelligence-and-exemplar-referenced-generation-pipeline
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, brand-intelligence, design-dna, seeder, api]

# Dependency graph
requires:
  - phase: 13-dam-sync
    provides: brand_assets DB table, watcher.ts API pattern, brand-seeder.ts idempotent seed pattern
  - phase: 11-api-pipeline
    provides: brand_patterns table, getBrandPatterns, seedBrandPatternsIfEmpty pattern
provides:
  - template_design_rules SQLite table with scope/platform/archetype_slug columns
  - Visual Compositor Contract seeded into brand_patterns (category visual-style)
  - 10 design rule rows seeded (1 global-social + 2 platform + 7 archetype)
  - getDesignRules, getDesignRule, getDesignRulesByArchetype, updateDesignRule in db-api.ts
  - 4 API endpoints: GET /api/design-rules, GET /api/design-rules/:id, PUT /api/design-rules/:id, GET /api/design-rules/archetype/:slug
affects: [design-dna pipeline, generation agents, phase-14-02, phase-14-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent hardcoded seed: COUNT(*) guard + INSERT with static array of rows — no file reads needed"
    - "Layered design rule scopes: global-social > platform > archetype for inheritance"

key-files:
  created: []
  modified:
    - canvas/src/lib/db.ts
    - canvas/src/server/db-api.ts
    - canvas/src/server/brand-seeder.ts
    - canvas/src/server/watcher.ts

key-decisions:
  - "Visual Compositor Contract seeded into brand_patterns (category: visual-style) rather than template_design_rules — keeps it alongside other brand reference content and accessible via existing getBrandPatterns API"
  - "Design rules use scope hierarchy: global-social > platform > archetype — agents can layer rules from broad to specific"
  - "All 7 archetype rules use platform: instagram — LinkedIn archetypes are a future concern"
  - "PUT /api/design-rules/:id + GET archetype route added for future UI editing and pipeline consumption"

patterns-established:
  - "Hardcoded seed pattern: DESIGN_RULES_SEED array of typed objects, single COUNT(*) guard, batch INSERT in loop"
  - "Route ordering: archetype/:slug must be checked before /:id to avoid slug being treated as an ID"

requirements-completed: [DNA-01, DNA-02, DNA-03, DNA-04]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 14 Plan 01: Design DNA — DB Schema, Seeder, and API Summary

**SQLite template_design_rules table with 10 seeded design rules + Visual Compositor Contract in brand_patterns, served via 4 new API endpoints**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T18:12:04Z
- **Completed:** 2026-03-17T18:15:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Created template_design_rules table in SQLite schema with scope, platform, archetype_slug, label, content, sort_order, updated_at columns
- Added DesignRule interface and 4 query functions (getDesignRules, getDesignRule, getDesignRulesByArchetype, updateDesignRule) to db-api.ts
- Seeded Visual Compositor Contract into brand_patterns (category: visual-style) — defines what makes a Fluid post look designed vs a web page
- Seeded 10 design rule rows: 1 global-social + 2 platform (instagram/linkedin) + 7 per-archetype design notes
- Added 4 API endpoints in watcher.ts following existing route patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema + db-api for template_design_rules** - `66b9213` (feat)
2. **Task 2: Seed global visual style rules + per-deliverable design DNA** - `c4047b0` (feat)

## Files Created/Modified
- `canvas/src/lib/db.ts` - Added CREATE TABLE IF NOT EXISTS template_design_rules
- `canvas/src/server/db-api.ts` - Added DesignRule interface, rowToDesignRule, getDesignRules, getDesignRule, getDesignRulesByArchetype, updateDesignRule
- `canvas/src/server/brand-seeder.ts` - Added VISUAL_COMPOSITOR_CONTRACT constant, seedGlobalVisualStyleIfEmpty, DESIGN_RULES_SEED array, seedDesignRulesIfEmpty
- `canvas/src/server/watcher.ts` - Added imports for new db-api functions and seed functions; added seed calls at startup; added 4 API routes

## Decisions Made
- Visual Compositor Contract goes into brand_patterns (visual-style category) rather than template_design_rules — it is a reference document, not a per-deliverable rule. Accessible via existing getBrandPatterns('visual-style') without new query functions.
- All 7 archetype rules use platform: 'instagram' (primary channel). LinkedIn archetypes can be added in a future plan.
- Route ordering: GET /api/design-rules/archetype/:slug checked before GET /api/design-rules/:id to prevent slug being matched as an ID.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB table and seeder complete — ready for Phase 14-02 (UI surface or pipeline consumption)
- API endpoints live at /api/design-rules — agents and UI can query design rules by scope, platform, or archetype slug
- Visual Compositor Contract accessible via GET /api/brand-patterns?category=visual-style

---
*Phase: 14-design-dna*
*Completed: 2026-03-17*
