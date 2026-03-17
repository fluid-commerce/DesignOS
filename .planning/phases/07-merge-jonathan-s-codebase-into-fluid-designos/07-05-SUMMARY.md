---
phase: 07-merge-jonathan-s-codebase-into-fluid-designos
plan: 05
subsystem: mcp
tags: [mcp, sqlite, campaign-hierarchy, templates, slot-schema, typescript]

requires:
  - phase: 07-01
    provides: SQLite db-api layer (createIteration, getIterations, getAnnotations, updateIterationStatus)
  - phase: 07-02
    provides: REST API endpoints for /api/frames/:id/iterations and /api/iterations/:id/annotations
provides:
  - MCP push_asset rewired to HTTP POST /api/frames/:frameId/iterations (creates Iteration in SQLite)
  - MCP read_annotations fetches from GET /api/iterations/:id/annotations
  - MCP read_statuses fetches iteration status map from GET /api/frames/:id/iterations
  - MCP read_history fetches full iteration chain + annotations in parallel
  - MCP iterate_request posts next-round intent to /api/frames/:frameId/iterate-request
  - 8 Jonathan template configs as TypeScript SlotSchemas with full field definitions, brush config, and gallery metadata
  - Backward compatibility handler for legacy sessionId/variationId MCP calls (throws descriptive deprecation error)
affects: [07-06, 07-07, content-editor, template-gallery, campaign-orchestrator]

tech-stack:
  added: []
  patterns:
    - MCP tools use HTTP API (localhost:5174) in production; tests call db-api directly via FLUID_DB_PATH isolation
    - Template configs are Record<string, SlotSchema> + getTemplateSchema() accessor function
    - Legacy MCP params detected and rejected with descriptive error message

key-files:
  created:
    - canvas/mcp/tools/iterate-request.ts
    - canvas/src/lib/template-configs.ts
  modified:
    - canvas/mcp/server.ts
    - canvas/mcp/types.ts
    - canvas/mcp/tools/push-asset.ts
    - canvas/mcp/tools/read-annotations.ts
    - canvas/mcp/tools/read-statuses.ts
    - canvas/mcp/tools/read-history.ts
    - canvas/mcp/__tests__/tools.test.ts

key-decisions:
  - "MCP tools call Vite HTTP API in production (no db import in MCP process); tests bypass HTTP via db-api direct calls using FLUID_DB_PATH"
  - "push_asset V2 requires campaignId/assetId/frameId; old sessionId/variationId triggers handleLegacyPushAsset() which throws descriptive deprecation error"
  - "HTML written to .fluid/campaigns/{cmp}/{ast}/{frm}/{itr}.html (canonical path from campaign hierarchy)"
  - "Template configs locked — developer-curated, no user modification of field definitions"
  - "TEMPLATE_SCHEMAS is a Record<string, SlotSchema>; TEMPLATE_METADATA is TemplateMetadata[] for gallery display"
  - "8 templates faithfully ported: t1-quote, t2-app-highlight, t3-partner-alert, t4-fluid-ad, t5-partner-announcement, t6-employee-spotlight, t7-carousel (4-slide), t8-quarterly-stats (4-slide)"

patterns-established:
  - "MCP production HTTP pattern: tools fetch from localhost:5174/api/* (MCP server is a separate process from Vite)"
  - "MCP test isolation: FLUID_DB_PATH env var per test, closeDb() before/after each test suite, vi.resetModules() for fresh imports"
  - "Template schema pattern: SlotSchema + TemplateMetadata separated; getTemplateSchema() and getTemplateMetadata() accessors"

requirements-completed: [MRGR-04, MRGR-12, MRGR-13]

duration: 7min
completed: 2026-03-12
---

# Phase 7 Plan 5: MCP Tool Rewiring + Template Config Port Summary

**All 5 MCP tools rewired from flat-file to SQLite HTTP API; 8 Jonathan templates ported as TypeScript SlotSchemas with full field definitions and gallery metadata (307 lines)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T18:43:12Z
- **Completed:** 2026-03-12T18:50:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Rewired push_asset from writing to .fluid/working/ flat files to posting iterations to the SQLite API via HTTP, with V2 params (campaignId/assetId/frameId) and backward compat that throws a descriptive deprecation error for old sessionId params
- Rewired read_annotations, read_statuses, read_history to fetch from SQLite via Vite HTTP API endpoints; created new iterate-request.ts for next-round signaling
- Ported all 8 Jonathan templates from editor.js TEMPLATES to TypeScript SlotSchema with all fields (text, image, divider), brush config, carousel counts, and gallery metadata
- Rewrote MCP tests (10 passing) to call db-api directly with FLUID_DB_PATH isolation — no running Vite server required

## Task Commits

Both tasks were committed atomically by coordinated wave agents:

1. **Task 1: Rewire MCP tools to SQLite API** - `fe8c6d6` (feat: Breadcrumb/DrillDownGrid + MCP rewire by 07-03 agent)
2. **Task 2: Port Jonathan's 8 template configs** - `0e493f6` (docs: 07-04 SUMMARY + template-configs.ts)

Note: This is a wave 1 plan; tasks were committed by sibling agents (07-03 and 07-04) that ran concurrently. The 07-05 agent verified the work is complete and correct, ran all tests, and confirmed type safety.

## Files Created/Modified

- `canvas/mcp/types.ts` - Campaign-aware MCP types (PushAssetInput V2, ReadAnnotationsInput, ReadStatusesInput, ReadHistoryInput, IterateRequestInput, PushAssetInputLegacy)
- `canvas/mcp/server.ts` - Updated to register V2 tool signatures with backward compat detection
- `canvas/mcp/tools/push-asset.ts` - Rewired to HTTP POST /api/frames/:frameId/iterations; writes HTML to .fluid/campaigns hierarchy
- `canvas/mcp/tools/read-annotations.ts` - Fetches from GET /api/iterations/:id/annotations
- `canvas/mcp/tools/read-statuses.ts` - Fetches from GET /api/frames/:id/iterations, returns iterationId->status map
- `canvas/mcp/tools/read-history.ts` - Parallel fetch of iterations + annotations per iteration, returns FrameHistory
- `canvas/mcp/tools/iterate-request.ts` - NEW: POST /api/frames/:frameId/iterate-request for next-round signaling
- `canvas/mcp/__tests__/tools.test.ts` - Rewritten tests calling db-api directly (10 tests, 0 failures)
- `canvas/src/lib/template-configs.ts` - NEW: All 8 template SlotSchemas + TemplateMetadata + getTemplateSchema/getTemplateMetadata/getTemplateIds accessors (307 lines)

## Decisions Made

- MCP tools call Vite HTTP API (localhost:5174) in production — the MCP server runs as a separate Node process, not within Vite, so HTTP is the correct production transport
- Tests bypass HTTP by importing db-api directly with FLUID_DB_PATH pointing to an isolated temp DB per test suite
- Legacy sessionId/variationId MCP params are detected in server.ts and forwarded to handleLegacyPushAsset() which throws a descriptive deprecation error with migration guidance
- Template configs use `Record<string, SlotSchema>` (not Map) for JSON-safe serialization
- brushLabel added where Jonathan had named brushes; null brush preserved where Jonathan had none

## Deviations from Plan

None — plan executed exactly as written. All MCP tools rewired. All 8 templates ported faithfully. Tests pass without running Vite server.

## Issues Encountered

The wave parallel execution meant both Task 1 (MCP rewiring) and Task 2 (template configs) were already committed to HEAD by sibling wave agents (07-03 and 07-04) when the 07-05 agent started. The 07-05 agent verified correctness, ran all tests (10/10 passing), confirmed no type errors in modified files, and proceeded to write documentation.

## Next Phase Readiness

- MCP tools are production-ready for agents to push assets into the campaign hierarchy
- Template configs feed directly into the ContentEditor right sidebar (plan 07-04) via getTemplateSchema()
- Agents can use push_asset V2 to create Iteration records with slotSchema for template-based and AI-generated assets
- read_history provides full iteration chain context agents need to avoid repeating rejected patterns

---
*Phase: 07-merge-jonathan-s-codebase-into-fluid-designos*
*Completed: 2026-03-12*

## Self-Check: PASSED

- canvas/mcp/server.ts: FOUND
- canvas/mcp/tools/push-asset.ts: FOUND
- canvas/mcp/tools/read-annotations.ts: FOUND
- canvas/mcp/tools/read-statuses.ts: FOUND
- canvas/mcp/tools/read-history.ts: FOUND
- canvas/mcp/tools/iterate-request.ts: FOUND
- canvas/mcp/__tests__/tools.test.ts: FOUND
- canvas/src/lib/template-configs.ts: FOUND
- 07-05-SUMMARY.md: FOUND
- Commits fe8c6d6 and 0e493f6: FOUND
- MCP tests: 10/10 PASS
