---
phase: 07-merge-jonathan-s-codebase-into-fluid-designos
plan: 02
subsystem: api
tags: [vite-middleware, better-sqlite3, rest-api, campaign-hierarchy, tdd]

# Dependency graph
requires:
  - phase: 07-01
    provides: db-api.ts CRUD functions, campaign-types.ts interfaces, db.ts singleton

provides:
  - /api/campaigns/* REST endpoints (14 routes) in Vite dev server middleware
  - Unit tests for campaign hierarchy CRUD (25 tests across all 5 entities)
  - Per-test DB isolation via lazy FLUID_DB_PATH reading in getDb()

affects:
  - 07-03 (React frontend — Teammate B consumes these endpoints)
  - 07-04 (Content editor — Teammate C consumes these endpoints)
  - 07-05 (MCP tools — Teammate D consumes these endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL pattern matching with regex for path segments (no router library)
    - Campaign middleware inserted before session-based middleware in configureServer()
    - Separate middleware block per concern (campaigns vs sessions vs generate)

key-files:
  created:
    - canvas/src/__tests__/campaign-api.test.ts
  modified:
    - canvas/src/server/watcher.ts
    - canvas/src/lib/db.ts

key-decisions:
  - "Campaign routes inserted as separate middleware block BEFORE session routes — clean separation, existing routes untouched"
  - "GET /api/iterations/:id reads HTML content from disk and inlines it in response as htmlContent field"
  - "POST /api/campaigns supports optional assets[] array for atomic campaign+assets creation via createCampaignWithAssets()"
  - "FLUID_DB_PATH read lazily inside getDb() (not at module load time) — enables per-test DB isolation after closeDb() reset"
  - "getIterationById not added to db-api.ts — iteration lookup by ID done inline in watcher.ts using getDb() directly to avoid scope creep"

patterns-established:
  - "Campaign middleware pattern: separate srv.middlewares.use() block for each API domain"
  - "URL routing: strip query string with url.split('?')[0] before matching"
  - "TDD test isolation: closeDb() + set FLUID_DB_PATH + lazy getDb() re-init per beforeEach"

requirements-completed:
  - MRGR-01
  - MRGR-04

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 07 Plan 02: Campaign Hierarchy REST API Summary

**14-route REST API for campaign > asset > frame > iteration > annotation hierarchy exposed via Vite middleware with 25 passing unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T17:02:35Z
- **Completed:** 2026-03-12T17:07:11Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- 14 REST endpoints covering all CRUD operations for the full campaign hierarchy
- Atomic POST /api/campaigns with assets[] for single-request campaign+assets creation
- GET /api/iterations/:id includes htmlContent from disk for one-fetch rendering
- 25 unit tests with full per-test DB isolation via closeDb() + lazy env var reading
- Zero regressions in existing 196 passing tests

## Task Commits

1. **Task 1 RED: Campaign API tests** - `57a4b96` (test)
2. **Task 1 GREEN: Campaign API endpoints** - `5cb127e` (feat)

## Files Created/Modified

- `canvas/src/__tests__/campaign-api.test.ts` - 25 unit tests for full campaign hierarchy CRUD with per-test DB isolation
- `canvas/src/server/watcher.ts` - Added 14 /api/campaigns/* routes as a separate middleware block before session routes
- `canvas/src/lib/db.ts` - Read FLUID_DB_PATH lazily inside getDb() instead of at module load time

## Decisions Made

- Campaign routes are a separate `srv.middlewares.use()` block inserted before the existing session middleware — keeps concerns separated and existing routes untouched
- `getIterationById` was not added to db-api.ts — inline DB query in the watcher for GET /api/iterations/:id avoids polluting the db-api contract for a single endpoint's need
- `FLUID_DB_PATH` is now read lazily in `getDb()` so test isolation via `closeDb()` + env var reset works correctly
- POST /api/campaigns checks for `assets` array in body and routes to `createCampaignWithAssets` for atomic creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Lazy FLUID_DB_PATH reading in getDb()**
- **Found during:** Task 1 RED (test writing)
- **Issue:** `DB_PATH` was evaluated once at module load time as a `const`. Setting `FLUID_DB_PATH` env var after module import had no effect, so `closeDb()` couldn't achieve per-test isolation — all tests shared one DB and counts accumulated across tests
- **Fix:** Changed from module-level `const DB_PATH = process.env.FLUID_DB_PATH || ...` to reading `process.env.FLUID_DB_PATH` inside `getDb()` on each new connection
- **Files modified:** `canvas/src/lib/db.ts`
- **Verification:** 25 campaign-api tests pass with isolated counts; existing db.test.ts 20 tests unchanged
- **Committed in:** `57a4b96` (RED commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality for test isolation)
**Impact on plan:** Essential fix for correct test behavior. db.ts behavior at runtime unchanged (env var still works). No scope creep.

## Issues Encountered

None — TDD flow proceeded cleanly. Pre-existing TypeScript errors in generate-endpoint.test.ts and ContentEditor.tsx are unrelated to this plan (logged in deferred-items.md). Pre-existing skill-paths.test.ts failures (5 tests) also pre-existing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All /api/campaigns/* endpoints ready for Teammate B (React frontend), Teammate C (content editor), and Teammate D (MCP tools) to consume
- Endpoint contracts: routes, request bodies, response shapes fully defined
- Existing /api/sessions, /api/generate routes untouched and functional

---
*Phase: 07-merge-jonathan-s-codebase-into-fluid-designos*
*Completed: 2026-03-12*
