---
phase: 11-api-pipeline-hardening-routing-context-injection-cost-ux
plan: "01"
subsystem: api-pipeline
tags: [routing, singularity-detection, standalone-creation, preview-path-fix, tdd]
dependency_graph:
  requires: []
  provides: [isSingleCreation routing, standalone creation sentinel campaign, iteration id passthrough]
  affects: [canvas/src/server/watcher.ts, canvas/src/server/db-api.ts, canvas/src/__tests__/routing.test.ts]
tech_stack:
  added: []
  patterns: [SINGULAR_PATTERNS/CAMPAIGN_PATTERNS regex arrays, sentinel campaign pattern, TDD red-green]
key_files:
  created:
    - canvas/src/__tests__/routing.test.ts
  modified:
    - canvas/src/server/watcher.ts
    - canvas/src/server/db-api.ts
    - canvas/vitest.config.ts
decisions:
  - "isSingleCreation detection: SINGULAR_PATTERNS checked first, CAMPAIGN_PATTERNS override to false — clear precedence"
  - "Standalone sentinel campaign: __standalone__ title in campaigns table, satisfies NOT NULL FK without architectural changes"
  - "createIteration id passthrough: optional id field with ?? nanoid() fallback — zero breaking change to callers"
  - "getOrCreateStandaloneCampaign uses getDb() directly for idempotent lookup + createCampaign only if not found"
  - "Auto-fix Rule 1: 3 escaped backslash-! chars (\\!== \\! \\!) in pre-existing watcher.ts caused brand-seeder tests to fail — fixed as blocking bug"
metrics:
  duration: "~15min"
  completed: "2026-03-16"
  tasks_completed: 1
  files_modified: 4
---

# Phase 11 Plan 01: Prompt Routing & Preview Path Fix Summary

Single-creation prompt routing with SINGULAR/CAMPAIGN pattern detection, standalone sentinel campaign, and iteration DB id passthrough that aligns filesystem paths with DB rows.

## What Was Built

**1. Singularity detection in parseChannelHints (watcher.ts)**

`parseChannelHints` now returns `isSingleCreation: boolean` and `inferredType?: string` in addition to `channels` and `creationCounts`. Two regex arrays drive the logic:

- `SINGULAR_PATTERNS` (7 patterns): detect single-asset intent (`/\ba\s+post\b/i`, `/^create\s+a\s+/i`, etc.)
- `CAMPAIGN_PATTERNS` (5 patterns): campaign keywords (`campaign`, `series`, `posts`, etc.) override singularity

The function is now exported so tests can import it directly.

**2. Standalone creation routing in /api/generate (watcher.ts)**

When `isSingleCreation` is true, the generate handler:
- Calls `getOrCreateStandaloneCampaign()` to get/create the `__standalone__` sentinel campaign
- Creates exactly 1 creation under that sentinel (not a new named campaign with 7 assets)
- SSE session event now includes `isSingleCreation` field for client navigation

**3. createIteration optional id (db-api.ts)**

`createIteration` input type gains `id?: string`. When provided, it's used as the iteration's DB row id instead of generating a new nanoid. The generation call in `/api/generate` now passes `id: iterationId` pre-generated before the HTML path is constructed, ensuring `iterationId` in the path matches the DB row id. This makes `/api/iterations/:id/html` find the correct file.

**4. Tests (routing.test.ts)**

15 tests covering all behavior cases:
- Singularity detection (8 cases)
- Type inference for single creations (4 cases)
- Backward compatibility for channel-only hints (3 cases)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 escaped backslash-! syntax errors in watcher.ts**
- **Found during:** GREEN phase — vitest transform failed on `/api/voice-guide` handler
- **Issue:** Pre-existing watcher.ts had `\!==`, `\!doc`, and `req.url\!` (backslash-escaped exclamation marks from a prior editor/tool bug) which are not valid TypeScript/JavaScript syntax
- **Fix:** Replaced all 3 instances with unescaped `!`
- **Files modified:** canvas/src/server/watcher.ts
- **Impact:** This also fixed 13 pre-existing test failures in brand-seeder.test.ts (which imports watcher.ts indirectly) — net test improvement from 21 failures to 8 failures

### Deviation Rule Notes

- vitest.config.ts: Added `routing.test.ts` to `node` environment (same as `api-pipeline.test.ts`). watcher.ts imports Anthropic SDK which throws in jsdom environment.

## Self-Check: PASSED

- FOUND: canvas/src/__tests__/routing.test.ts
- FOUND: canvas/src/server/watcher.ts (modified)
- FOUND: canvas/src/server/db-api.ts (modified)
- FOUND commit: 7f8c18f (test — routing tests)
- FOUND commit: 6321033 (feat — implementation)
- All 15 routing tests pass: CONFIRMED
