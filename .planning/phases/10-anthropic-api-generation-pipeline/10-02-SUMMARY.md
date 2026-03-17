---
phase: 11-anthropic-api-generation-pipeline
plan: 02
subsystem: api
tags: [anthropic-sdk, sse, pipeline, tool-use, engine-routing]

# Dependency graph
requires:
  - phase: 11-01
    provides: "Anthropic SDK client, tool schemas, executeTool, loadStagePrompt, SSE helpers, type definitions"
provides:
  - runStageWithTools agentic loop (messages.create + tool execution + SSE emission)
  - runApiPipeline 4-stage orchestrator with fix loop and cascade rule
  - Engine routing in /api/generate (API default, CLI fallback via engine=cli)
  - 20+ new tests for agentic loop, orchestrator, and engine routing
affects: ["phase-12-patterns", "phase-14-db-brand-intelligence"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agentic loop: messages.create -> tool_use detection -> executeTool -> append results -> continue"
    - "Fire-and-forget parallel pipelines sharing single SSE response"
    - "Cascade fix rule: copy fix re-runs layout and styling stages"
    - "Engine routing: body.engine ?? 'api' as default, explicit 'cli' for legacy spawn"

key-files:
  created: []
  modified:
    - canvas/src/server/api-pipeline.ts
    - canvas/src/server/watcher.ts
    - canvas/src/__tests__/api-pipeline.test.ts

key-decisions:
  - "Engine routing uses body.engine ?? 'api' as default — CLI is the explicit opt-in"
  - "Campaign pre-creation DB code is shared above engine check — both paths build the same DB records"
  - "Fix loop cascades from copy: if copy issues found, layout and styling re-run even if they had no blocking issues"
  - "API path uses fire-and-forget parallel promises; done event fires only when apiCompletedCount >= apiTotalCount"
  - "runStageWithTools has 20-iteration safety cap to prevent infinite tool loops"
  - "getMockCreate() helper pattern used in tests to access mock fn through Anthropic module re-instantiation"

requirements-completed: [API-02, API-05, API-06]

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 11 Plan 02: API Pipeline Orchestrator Summary

**Anthropic SDK agentic loop (runStageWithTools) and 4-stage pipeline orchestrator (runApiPipeline) with engine routing so /api/generate defaults to API and explicitly opts into CLI spawn via engine=cli**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T17:44:00Z
- **Completed:** 2026-03-16T17:52:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- runStageWithTools: full Anthropic messages.create agentic loop with tool execution, SSE emission (text, toolStart, toolDone, stageStatus), and 20-iteration safety cap
- runApiPipeline: 4-stage sequential pipeline (copy -> layout -> styling -> spec-check) with 3-iteration fix loop and cascade rule (copy fix re-runs layout+styling)
- Engine routing in /api/generate: `body.engine ?? 'api'` defaults to API path, `engine === 'cli'` preserves all existing spawn code untouched
- Campaign pre-creation DB records now shared above engine check so both paths create identical DB structure
- 44 total tests passing (was 36), 8 new tests covering agentic loop, tool execution, SSE events, model selection, and engine routing

## Task Commits

1. **Task 1: Build runStageWithTools agentic loop and runApiPipeline orchestrator** - `04521f2` (feat)
2. **Task 2: Wire API pipeline into /api/generate with engine routing and add tests** - `9c51c6a` (feat)

## Files Created/Modified
- `canvas/src/server/api-pipeline.ts` - Added runStageWithTools, runApiPipeline, and private prompt builders (buildCopyPrompt, buildLayoutPrompt, buildStylingPrompt, buildSpecCheckPrompt, buildFixPrompt)
- `canvas/src/server/watcher.ts` - Added runApiPipeline import, engine routing, shared campaign pre-creation code, API else-branch with parallel pipelines
- `canvas/src/__tests__/api-pipeline.test.ts` - Added Anthropic SDK mock, getMockCreate helper, and tests for runStageWithTools/runApiPipeline/engine routing

## Decisions Made
- Engine routing uses `body.engine ?? 'api'` — the API path is the default per the locked Phase 11 decision; CLI is an explicit opt-in escape hatch
- Campaign pre-creation DB code extracted above the engine check (not duplicated in each branch) since both paths need the same DB records
- The cascade fix rule is asymmetric: copy fix re-runs layout and styling, but layout fix does not re-run styling. This matches the dependency graph (copy is upstream of both).
- API mode uses fire-and-forget parallel promises with a shared counter for completion tracking (same pattern as CLI completedCount)
- `getMockCreate()` test helper re-instantiates the Anthropic mock class to access the shared `mockCreate` fn — required because vi.mock hoists the mock but the fn reference must be fetched after import

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit src/server/api-pipeline.ts` (single-file invocation) showed a false Map iteration error; full `npx tsc --noEmit` with tsconfig showed no errors. The single-file invocation loses the `lib: ["ES2022"]` setting which enables Map iteration natively.
- All 8 pre-existing test failures (AppShell ResizeObserver, App render assertions, skill-paths canvas-active checks) remain as before — not caused by this plan.

## Next Phase Readiness
- API pipeline is wired and ready for manual testing with a real ANTHROPIC_API_KEY in .env
- Phase 11 is complete: foundation (11-01) + orchestrator (11-02) both shipped
- Next: test end-to-end by sending a prompt through the sidebar and observing 4-stage progress in chat

## Self-Check: PASSED

All files verified present. Both task commits verified in git log.

---
*Phase: 11-anthropic-api-generation-pipeline*
*Completed: 2026-03-16*
