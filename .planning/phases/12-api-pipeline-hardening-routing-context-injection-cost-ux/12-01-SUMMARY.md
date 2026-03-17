---
phase: 12-api-pipeline-hardening-routing-context-injection-cost-ux
plan: "01"
subsystem: api
tags: [cleanup, dead-code, server, watcher, pipeline]

requires:
  - phase: 11-api-pipeline-hardening-routing-context-injection-cost-ux
    provides: runApiPipeline as default generation path, API mode campaign generation

provides:
  - watcher.ts with zero CLI generation code — spawn, child_process, iterate mode, CLI campaign branch all removed
  - Simplified /api/generate/cancel endpoint (lock-only, no child killing)
  - ~295 lines of dead code removed from server codebase
  - generate-endpoint.test.ts deleted (tested removed CLI spawn behavior)
  - api-pipeline.test.ts cleaned of CLI engine routing test

affects: [13-pipeline-integration, any future watcher.ts changes]

tech-stack:
  added: []
  patterns:
    - "API-only generation: runApiPipeline is the single code path for all campaign generation"
    - "Lean cancel: /api/generate/cancel only clears activeCampaignGeneration lock, no child process management"

key-files:
  created: []
  modified:
    - canvas/src/server/watcher.ts
    - canvas/src/__tests__/api-pipeline.test.ts
  deleted:
    - canvas/src/__tests__/generate-endpoint.test.ts

key-decisions:
  - "Deleted generate-endpoint.test.ts entirely — tested spawn/child_process behavior that no longer exists"
  - "Removed body.engine='cli' test from api-pipeline.test.ts — CLI path no longer exists, only one engine"
  - "Updated comment in cancel endpoint to remove CLI references — no behavior change, just clarity"

requirements-completed: [CLEAN-01, CLEAN-02]

duration: 10min
completed: 2026-03-16
---

# Phase 12 Plan 01: CLI Dead Code Removal Summary

**Removed ~295 lines of spawn/child_process CLI generation code from watcher.ts — API pipeline via runApiPipeline is now the only generation path**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-16T02:00:00Z
- **Completed:** 2026-03-16T02:10:00Z
- **Tasks:** 2
- **Files modified:** 2 (+ 1 deleted)

## Accomplishments
- Removed entire iterate mode block (~130 lines of claude -p spawn for single-asset iteration)
- Removed CLI campaign generation branch (~140 lines of parallel spawn subagents)
- Removed unused imports: spawn, ChildProcess, createReadStream, createInterface
- Removed CLI state variables: activeChild, activeChildren Map
- Simplified /api/generate/cancel to only clear activeCampaignGeneration lock
- Deleted generate-endpoint.test.ts (tested dead CLI spawn code)
- Removed CLI engine routing test from api-pipeline.test.ts

## Task Commits

1. **Task 1: Remove CLI generation paths from watcher.ts** - `fa0105e` (feat)
2. **Task 2: Clean up CLI-referencing tests** - `aa7e074` (feat)

## Files Created/Modified
- `canvas/src/server/watcher.ts` - Removed all CLI generation code; 1951 → 1656 lines (-295)
- `canvas/src/__tests__/api-pipeline.test.ts` - Removed CLI engine test; kept child_process mock for execSync
- `canvas/src/__tests__/generate-endpoint.test.ts` - Deleted (tested removed CLI spawn behavior)

## Decisions Made
- Deleted generate-endpoint.test.ts entirely rather than updating — all tests in the file tested CLI behavior that no longer exists
- Kept `vi.mock('node:child_process')` in api-pipeline.test.ts — it's used by run_brand_check tool tests (execSync), not CLI generation

## Deviations from Plan

None - plan executed exactly as written. Minor addition: updated a code comment "BEFORE spawning" → "BEFORE running pipelines" to remove stale spawn reference in comment text.

## Issues Encountered
None.

## Next Phase Readiness
- watcher.ts is clean — single API pipeline path, no dead code branches
- Ready for phase 12-02 (context injection / cost improvements)
- TypeScript errors in BuildHero, ContentEditor, LeftNav are pre-existing and out of scope

---
*Phase: 12-api-pipeline-hardening-routing-context-injection-cost-ux*
*Completed: 2026-03-16*
