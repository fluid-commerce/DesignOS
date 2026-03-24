---
phase: 20-pipeline-integration-archetype-selection-and-slotschema-attachment
plan: 02
subsystem: api
tags: [archetypes, pipeline, slotschema, prompt-builders, orchestration]

# Dependency graph
requires:
  - phase: 20-plan-01
    provides: scanArchetypes, resolveArchetypeSlug, PipelineContext.iterationId, updateIterationSlotSchema
provides:
  - buildCopyPrompt with dynamic archetypeList param
  - buildLayoutPrompt with slot-fill mode (archetype HTML skeleton)
  - buildStylingPrompt with DECORATIONS comment instruction
  - attachSlotSchema — merges archetype schema with decoration comment, persists to DB
  - runApiPipeline — fully rewired: scan->copy->resolve->layout->styling->attachSchema->spec-check
affects: [pipeline, editor-sidebar, slot-schema, archetype-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Slot-fill layout pattern: archetype HTML skeleton injected into layout prompt, agent fills only text content
    - DECORATIONS comment strategy: agent declares brush selectors in machine-readable HTML comment
    - Dynamic archetype list: scanArchetypes() at pipeline entry, formatted as bullet list for copy agent

key-files:
  created: []
  modified:
    - canvas/src/server/api-pipeline.ts
    - canvas/src/__tests__/api-pipeline.test.ts

key-decisions:
  - "ARCHETYPE_TEMPLATE_FILES and DEFAULT_ARCHETYPE deleted — new archetypes are filesystem-scanned, not hardcoded"
  - "buildLayoutPrompt has slot-fill mode (archetype HTML + slug) with freestyle fallback (no archetype)"
  - "buildStylingPrompt DECORATIONS instruction is always appended — not conditional"
  - "attachSlotSchema is non-fatal — HTML already written, SlotSchema failure just means editor sidebar won't have custom fields"
  - "Fix loop cascade uses new buildLayoutPrompt signature (archetypeHtml + resolvedArchetypeSlug) so slot-fill persists through fix iterations"

requirements-completed: [PIPE-20-04, PIPE-20-05, PIPE-20-06, PIPE-20-07, PIPE-20-08]

# Metrics
duration: 12min
completed: 2026-03-24
---

# Phase 20 Plan 02: Pipeline Rewire — Prompt Builders, attachSlotSchema, runApiPipeline Orchestration Summary

**Rewired 4-stage pipeline from freestyle HTML generation to archetype slot-fill: dynamic archetype list in copy prompt, skeleton injection in layout prompt, DECORATIONS comment in styling prompt, and SlotSchema attachment post-styling**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-24T17:00:00Z
- **Completed:** 2026-03-24T17:12:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Deleted `ARCHETYPE_TEMPLATE_FILES` Record and `DEFAULT_ARCHETYPE` constant — old hardcoded mapping gone
- Refactored `loadDesignDna`: removed HTML exemplar injection, `archetypeSlug` param is now required (not optional)
- Rewrote `buildCopyPrompt`: added `archetypeList?: string` param, dynamic `## Available Archetypes` section
- Rewrote `buildLayoutPrompt`: slot-fill mode when archetype HTML + slug provided, freestyle fallback otherwise
- Updated `buildStylingPrompt`: added `DECORATION DECLARATION` instruction block for machine-readable decoration detection
- Added `attachSlotSchema()`: reads archetype schema.json, parses DECORATIONS HTML comment, merges brush/brushAdditional, persists via `updateIterationSlotSchema`
- Rewired `runApiPipeline`: scanArchetypes at entry, archetypeList into copy, resolveArchetypeSlug post-copy, HTML read for layout, attachSlotSchema post-styling
- Fix loop cascade updated to use new `buildLayoutPrompt` signature
- Full TDD cycle (RED → GREEN): 67 tests passing, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite prompt builders, delete old mapping, add attachSlotSchema** - `1adc539` (feat)
2. **Task 2: Integrate archetype flow into runApiPipeline orchestration** - `097d4e8` (feat)

## Files Created/Modified

- `canvas/src/server/api-pipeline.ts` — Deleted ARCHETYPE_TEMPLATE_FILES/DEFAULT_ARCHETYPE, rewrote buildCopyPrompt/buildLayoutPrompt/buildStylingPrompt, added attachSlotSchema, refactored loadDesignDna, rewired runApiPipeline orchestration
- `canvas/src/__tests__/api-pipeline.test.ts` — Added db-api mock, added imports for new exports, added 13 new tests for buildCopyPrompt/buildLayoutPrompt/buildStylingPrompt/attachSlotSchema

## Decisions Made

- `buildLayoutPrompt` has two modes: slot-fill (archetype HTML + slug) and freestyle fallback (no archetype). The fallback ensures backward compatibility if archetypes are missing.
- `attachSlotSchema` is wrapped in a non-fatal try/catch in runApiPipeline — HTML is already generated at that point, so a schema attachment failure should not block the pipeline.
- Fix loop cascade preserves the slot-fill mode: `archetypeHtml` and `resolvedArchetypeSlug` are in scope throughout runApiPipeline so re-run layout calls during fix iterations use the same archetype.

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

`brand-context.test.ts` has 11 pre-existing failures that existed before this plan's changes. These tests were failing on the committed state from Plan 01 (confirmed via `git stash` + test run). They are out of scope per deviation rules and logged here for awareness:
- `list_brand_sections` category filters not matching DB state in worktree
- `buildCopyPrompt` tests expecting `list_brand_sections` instruction (these date from before the prompt rewrite in Plan 02)

## Self-Check: PASSED

- FOUND: canvas/src/server/api-pipeline.ts
- FOUND: canvas/src/__tests__/api-pipeline.test.ts
- FOUND: .planning/phases/20-pipeline-integration-archetype-selection-and-slotschema-attachment/20-02-SUMMARY.md
- FOUND commit: 1adc539 (Task 1)
- FOUND commit: 097d4e8 (Task 2)
- 67 tests passing, 0 failures in api-pipeline.test.ts

---
*Phase: 20-pipeline-integration-archetype-selection-and-slotschema-attachment*
*Completed: 2026-03-24*
