---
phase: 21-linkedin-and-one-pager-archetypes
plan: 03
subsystem: archetypes
tags: [html, css, print, one-pager, archetype, pipeline, typescript]

# Dependency graph
requires:
  - phase: 21-01
    provides: Platform-aware validator and slug suffix convention (-li, -op)
  - phase: 20-pipeline-integration-archetype-selection-and-slotschema-attachment
    provides: scanArchetypes(), resolveArchetypeSlug(), api-pipeline.ts archetype infrastructure
provides:
  - 3 one-pager archetype directories (case-study-op, product-feature-op, company-overview-op)
  - Print-spec enforcement (@page rule, 612x792 body, overflow:hidden, flexbox layout)
  - filterArchetypesByPlatform() exported from api-pipeline.ts
  - Complete archetype README with all 19 archetypes across 3 platforms
affects:
  - phase: 22-image-integration-and-template-vs-archetype-routing
  - api-pipeline
  - archetype-selection

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One-pager archetypes use flexbox/grid layout (not position:absolute) for print-safe flow
    - "@page { size: 8.5in 11in; margin: 0.5in; } required in every -op archetype"
    - filterArchetypesByPlatform() uses slug suffix as platform signal — zero-config for new archetypes

key-files:
  created:
    - archetypes/case-study-op/index.html
    - archetypes/case-study-op/schema.json
    - archetypes/case-study-op/README.md
    - archetypes/product-feature-op/index.html
    - archetypes/product-feature-op/schema.json
    - archetypes/product-feature-op/README.md
    - archetypes/company-overview-op/index.html
    - archetypes/company-overview-op/schema.json
    - archetypes/company-overview-op/README.md
  modified:
    - canvas/src/server/api-pipeline.ts
    - archetypes/README.md

key-decisions:
  - "One-pager body uses display:flex flex-direction:column on .page wrapper (not position:absolute) for print-safe document flow"
  - "filterArchetypesByPlatform() uses endsWith('-li') / endsWith('-op') slug convention — consistent with validator getPlatformForSlug()"
  - "filterArchetypesByPlatform() not yet wired into runApiPipeline() — provides the primitive for Phase 22 to wire routing"
  - "archetypes/README.md expanded with Platform Conventions table and complete listings for all 3 platforms (19 total)"

patterns-established:
  - "Print archetype pattern: @page + overflow:hidden + flexbox column layout on .page wrapper"
  - "One-pager footer pushed to bottom via margin-top:auto on .footer inside flex column"
  - "Stat strip pattern: display:grid repeat(3,1fr) with gap:1px background trick for cell borders"

requirements-completed: [ARCH-21-06, ARCH-21-07, ARCH-21-08, ARCH-21-09]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 21 Plan 03: One-Pager Archetypes Summary

**3 print-spec one-pager archetypes (case-study-op, product-feature-op, company-overview-op) + filterArchetypesByPlatform() pipeline function, all 19 archetypes pass validation with 0 errors**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T19:38:20Z
- **Completed:** 2026-03-24T19:42:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Built 3 one-pager archetypes at US Letter dimensions (612x792) with full print spec enforcement: `@page` rule, `overflow: hidden`, flexbox column layout on `.page` wrapper, footer pushed to bottom via `margin-top: auto`
- Added `filterArchetypesByPlatform()` to `canvas/src/server/api-pipeline.ts` — pure function using slug suffix convention (`-li`=linkedin, `-op`=one-pager, no suffix=instagram)
- Updated `archetypes/README.md` with Platform Conventions table and complete inventory of all 19 archetypes across 3 platforms
- All 19 archetypes (10 Instagram + 6 LinkedIn + 3 One-Pager) pass `validate-archetypes.cjs all` with 0 errors, 0 warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Build 3 one-pager archetypes with print spec** - `cd09a5e` (feat)
2. **Task 2: Add pipeline filterArchetypesByPlatform + update README** - `a27f52f` (feat)

## Files Created/Modified

- `archetypes/case-study-op/index.html` - Hero + 3-stat strip + 2-col challenge/solution + footer (13 fields, @page rule)
- `archetypes/case-study-op/schema.json` - SlotSchema, platform: one-pager, 612x792
- `archetypes/case-study-op/README.md` - Purpose, structure, when to use/not use
- `archetypes/product-feature-op/index.html` - Hero + 2x2 feature grid + footer with URL (12 fields, @page rule)
- `archetypes/product-feature-op/schema.json` - SlotSchema, platform: one-pager, 612x792
- `archetypes/product-feature-op/README.md` - Purpose, structure, when to use/not use
- `archetypes/company-overview-op/index.html` - Headline + 3-stat strip + editorial + highlights list + footer (13 fields, @page rule)
- `archetypes/company-overview-op/schema.json` - SlotSchema, platform: one-pager, 612x792
- `archetypes/company-overview-op/README.md` - Purpose, structure, when to use/not use
- `canvas/src/server/api-pipeline.ts` - Added exported `filterArchetypesByPlatform()` function
- `archetypes/README.md` - Added Platform Conventions table, LinkedIn section, One-Pager section

## Decisions Made

- One-pager layout uses `display: flex; flex-direction: column` on `.page` wrapper (not absolute positioning) — print-safe document flow that respects natural page height without coordinate math
- `filterArchetypesByPlatform()` uses the same `endsWith('-li')` / `endsWith('-op')` suffix convention as the validator's `getPlatformForSlug()` — consistent, zero-config for new archetypes
- Function not yet wired into `runApiPipeline()` — exported as primitive for Phase 22 routing layer
- Stat strip uses `grid-template-columns: repeat(3, 1fr)` with `gap: 1px; background: rgba(255,255,255,0.06)` on the container — standard CSS gap trick to create cell dividers without border duplication

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `TransformOverlay.tsx`, `BuildHero.tsx`, `PromptInput.tsx`, and `brand-context.test.ts` — 14 errors in 4 files unrelated to this plan's changes. `api-pipeline.ts` has 0 TypeScript errors. Pre-existing errors logged and out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 19 archetypes validated and ready for pipeline selection
- `filterArchetypesByPlatform()` exported and ready to wire into `runApiPipeline()` after `scanArchetypes()` call
- Phase 22 can wire platform-based archetype filtering using `ctx.creationType` as the filter key

---
*Phase: 21-linkedin-and-one-pager-archetypes*
*Completed: 2026-03-24*
