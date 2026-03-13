---
phase: 08-ai-sidebar-to-campaign-dashboard-end-to-end
plan: 02
subsystem: api
tags: [vite, sqlite, sse, spawn, multi-asset, campaign, better-sqlite3]

# Dependency graph
requires:
  - phase: 08-01
    provides: "db-api functions: updateAsset, updateIterationGenerationStatus, getCampaignPreviewUrls, getLatestIterationByFrame"
provides:
  - "Multi-asset /api/generate handler — pre-creates 7 SQLite records, spawns N parallel subagents"
  - "PATCH /api/assets/:id — agent-driven asset title rename"
  - "GET /api/campaigns/:id/preview-urls — returns up to 4 preview entries for campaign mosaic"
  - "Canonical HTML path format: .fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html"
  - "Campaign-level generation lock (activeCampaignGeneration)"
  - "parseChannelHints() + buildAssetList() for channel/asset computation from prompt"
affects:
  - 08-03-campaign-dashboard
  - 09-chat-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "activeChildren Map<assetId, ChildProcess> for parallel subprocess tracking"
    - "Pre-create all DB records before spawning — structure exists before generation starts"
    - "Canonical path: .fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html"
    - "Campaign-level lock (activeCampaignGeneration string | null) for full campaign serialization"
    - "SSE session event carries campaignId immediately after DB creation"
    - "done event fires only after ALL N children close — prevents auto-navigate race"

key-files:
  created:
  modified:
    - canvas/src/server/watcher.ts
    - canvas/src/__tests__/generate-endpoint.test.ts
    - canvas/src/__tests__/campaign-api.test.ts

key-decisions:
  - "activeCampaignGeneration lock covers full-campaign generations only; iterate mode uses legacy activeChild lock and is not blocked"
  - "parseChannelHints uses regex for 'just linkedin', 'instagram only', 'one-pager only' patterns; no hint defaults to 3+3+1 spread"
  - "Pre-create ALL DB records synchronously before spawning any subagent — guarantees campaignId can be streamed immediately"
  - "done SSE event only fires when completedCount >= totalCount — counter tracks each child.on(close) individually"
  - "PATCH /api/assets/:id returns 200 { ok: true } on success; updateAsset is fire-and-forget so 404 path uses try-catch"
  - "getCampaignPreviewUrls already implemented in Plan 01; Task 2 adds the HTTP endpoint wrapper and tests"

patterns-established:
  - "Multi-asset generation: pre-create records, stream campaignId, spawn N children, gate done event on all-complete"
  - "Parallel subagent multiplexing: each SSE frame includes assetId field for client-side routing"

requirements-completed: [E2E-01, E2E-02, E2E-03, E2E-04, E2E-06]

# Metrics
duration: 9min
completed: 2026-03-12
---

# Phase 8 Plan 02: Multi-Asset Generate Endpoint Summary

**Campaign-centric /api/generate handler — pre-creates 7 Assets+Frames+Iterations in SQLite, spawns parallel subagents writing to .fluid/campaigns/ canonical paths, streams campaignId via SSE before generation starts**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-12T22:46:10Z
- **Completed:** 2026-03-12T22:55:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Refactored /api/generate from single-session single-asset to campaign-centric multi-asset parallel generation
- Pre-creates full Campaign > Asset > Frame > Iteration hierarchy in SQLite before spawning any subagent
- Canonical HTML paths follow .fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html — no more .fluid/working/ for new generations
- N subagents spawn in parallel, each writing to their own canonical path
- campaignId streamed to client via SSE session event immediately after DB creation
- done event fires only after ALL N children close (prevents auto-navigate race condition)
- PATCH /api/assets/:id and GET /api/campaigns/:id/preview-urls endpoints added
- 18 new tests across generate-endpoint and campaign-api test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor /api/generate for multi-asset campaign creation** - `d54ec39` (feat)
2. **Task 2: Add PATCH /api/assets/:id and GET /api/campaigns/:id/preview-urls endpoints + tests** - `712d1ed` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `canvas/src/server/watcher.ts` - Multi-asset generate handler, two new endpoints, parallel subagent tracking
- `canvas/src/__tests__/generate-endpoint.test.ts` - New tests: 7 assets, canonical paths, parallel spawn, done gate, campaign lock
- `canvas/src/__tests__/campaign-api.test.ts` - New tests: updateAsset rename, getCampaignPreviewUrls (5 cases)

## Decisions Made
- `activeCampaignGeneration` lock covers only full-campaign generations; iterate mode uses the legacy `activeChild` lock and is not blocked by campaign lock
- `parseChannelHints` regex-matches "just linkedin / instagram only / one-pager only" patterns; no match defaults to 3 IG + 3 LI + 1 one-pager (7 total)
- All DB records pre-created synchronously before spawning — this ensures campaignId can be streamed immediately and the dashboard can show placeholders
- `done` event fires only when `completedCount >= totalCount` — each child's `close` event increments the counter
- New campaign generations do NOT create `.fluid/working/` directories; legacy iterate flow still creates working dirs

## Deviations from Plan

None - plan executed exactly as written. The PATCH endpoint and preview-urls endpoint were added in Task 1 (same commit as the refactor) since they're both part of watcher.ts, then Task 2 added the tests.

## Issues Encountered
- Pre-existing TypeScript errors in `skill-paths.test.ts` (missing `beforeAll` import) and `generate-endpoint.test.ts` (EventEmitter type mismatch) — both pre-existing, not caused by this plan, not fixed (out of scope).
- Pre-existing test failures in `skill-paths.test.ts` (checking for `canvas-active` sentinel in skill files) — not related to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /api/generate now creates full campaign structure in SQLite and writes to canonical paths
- Campaign dashboard (Plan 03/04) can read from .fluid/campaigns/ paths via GET /api/campaigns/:id/preview-urls
- PATCH /api/assets/:id allows subagents to set descriptive titles after generating
- All Plan 02 endpoints are ready for dashboard integration

---
*Phase: 08-ai-sidebar-to-campaign-dashboard-end-to-end*
*Completed: 2026-03-12*
