---
phase: 13-dam-sync
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, dam, sync, file-download, brand-assets, vitest]

# Dependency graph
requires:
  - phase: 12-api-pipeline-hardening-routing-context-injection-cost-ux
    provides: brand_assets table, db.ts migration pattern, vitest node environment setup
  - phase: 07-merge-jonathan-s-codebase-into-fluid-designos
    provides: brand-seeder.ts startup seeder pattern, asset-scanner.ts INSERT OR IGNORE pattern

provides:
  - DB schema migration: 6 new DAM columns on brand_assets (source, dam_asset_id, dam_asset_url, last_synced_at, dam_modified_at, dam_deleted) + UNIQUE INDEX
  - dam-client.ts: typed Fluid DAM REST API client (flattenDamTree, damQuery, listBrandElements, getCompanyIdFromToken)
  - db-api.ts extensions: upsertDamAsset (incremental sync) and softDeleteRemovedDamAssets
  - dam-sync.ts: runDamSync runner (download + upsert + soft-delete cycle)
  - dam-sync.test.ts: 13 unit tests covering all sync behaviors

affects: [13-dam-sync plan 02, watcher.ts Vite server integration, /api/brand-assets endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DAM tree flattening: flattenDamTree() recursively walks nested tree response keyed by path components"
    - "Incremental sync: skip upsert when dam_modified_at hasn't changed (ISO string lexicographic comparison)"
    - "Soft-delete pattern: dam_deleted=1 marks removed DAM assets, getBrandAssets excludes them"
    - "JWT company_id extraction: Buffer.from(token.split('.')[1], 'base64') — no signature verification needed server-side"
    - "File naming for uniqueness: {code}-{sanitizedName}{ext} prevents collisions on same display names"

key-files:
  created:
    - canvas/src/server/dam-client.ts
    - canvas/src/server/dam-sync.ts
    - canvas/src/__tests__/dam-sync.test.ts
  modified:
    - canvas/src/lib/db.ts
    - canvas/src/server/db-api.ts
    - canvas/vitest.config.ts

key-decisions:
  - "DAM asset code field (not id) used as dam_asset_id — code is a stable human-readable string identifier, id is numeric and less stable"
  - "file_path for DAM assets stored as dam/{filename} so Vite middleware serves at /fluid-assets/dam/{filename} — consistent with local asset path pattern"
  - "getBrandAssets filters use (dam_deleted = 0 OR dam_deleted IS NULL) to be safe with both new and migrated rows"
  - "runDamSync never throws — all errors captured in result.errors array for fire-and-forget startup use"

requirements-completed: [DAM-01, DAM-02, DAM-03, DAM-04, DAM-05]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 13 Plan 01: DAM Sync Core Engine Summary

**Fluid DAM sync foundation: DB schema migration with 6 DAM columns, typed REST API client with tree flattening, incremental upsert + soft-delete sync runner, and 13 unit tests — all using existing project stack with no new dependencies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T13:37:45Z
- **Completed:** 2026-03-17T13:41:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- DB schema extended with 6 DAM columns on brand_assets + UNIQUE INDEX on dam_asset_id, using established try-catch migration pattern
- Typed DAM REST API client covers JWT decode, POST /dam/query with Bearer auth, paginated tree listing, and recursive tree flattening
- Sync runner downloads CDN assets to disk, upserts incrementally (skips unchanged), soft-deletes removed assets — never throws on failure
- 13 unit tests pass covering all behaviors: tree flatten, JWT decode, upsert (insert/skip/update/resurrect), soft-delete, offline handling

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema migration + DAM client + db-api DAM functions** - `64d3013` (feat)
2. **Task 2: DAM sync runner + unit tests + vitest config** - `1b5adc7` (feat)

## Files Created/Modified

- `canvas/src/lib/db.ts` - Added 6 DAM columns via try-catch migrations + UNIQUE INDEX on dam_asset_id
- `canvas/src/server/dam-client.ts` - Typed Fluid DAM REST API client (flattenDamTree, damQuery, listBrandElements, getCompanyIdFromToken, isRawDamAsset, RawDamAsset)
- `canvas/src/server/db-api.ts` - Added upsertDamAsset, softDeleteRemovedDamAssets, DamAssetRow; updated getBrandAssets to exclude dam_deleted rows
- `canvas/src/server/dam-sync.ts` - runDamSync (main sync runner), downloadAsset, sanitizeFilename, getMimeTypeFromUrl, DamSyncResult
- `canvas/src/__tests__/dam-sync.test.ts` - 13 unit tests with node environment annotation and temp DB isolation
- `canvas/vitest.config.ts` - Added dam-sync.test.ts to environmentMatchGlobs for node environment

## Decisions Made

- **code as dam_asset_id**: The DAM's `code` field is a stable string identifier used as `dam_asset_id`. The numeric `id` field is less stable across DAM environments.
- **File path convention**: DAM assets stored at `{assetsDir}/dam/{code}-{sanitizedName}{ext}`, file_path in DB as `dam/{filename}`. Consistent with local asset pattern where file_path is relative to assetsDir.
- **No-throw sync design**: `runDamSync` wraps the entire body in try-catch and captures errors in `result.errors[]`. Designed for fire-and-forget startup use (plan 02 will wire this up).
- **Soft-delete filter**: `(dam_deleted = 0 OR dam_deleted IS NULL)` handles both newly migrated rows (NULL) and explicitly set rows (0) correctly.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed test assertion using expect().not.toThrow() pattern**
- **Found during:** Task 2 verification run
- **Issue:** Test used `let result; await expect(async () => { result = ... }).not.toThrow()` — `result` was `undefined` outside the closure
- **Fix:** Changed to direct `const result = await runDamSync(...)` since runDamSync never throws by design
- **Files modified:** canvas/src/__tests__/dam-sync.test.ts
- **Verification:** All 13 tests pass after fix
- **Committed in:** 1b5adc7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test assertion pattern)
**Impact on plan:** Single test assertion bug fixed inline. No scope changes.

## Issues Encountered

- Two pre-existing test failures (`template-endpoint.test.ts`, `watcher-hardening.test.ts`) unrelated to this plan — they fail because they import `watcher.ts` which instantiates the Anthropic SDK in jsdom environment. These are out-of-scope per deviation rules and logged as pre-existing issues.

## User Setup Required

None — no external service configuration required. The VITE_FLUID_DAM_TOKEN env var is used by the sync runner but is already documented as a required env var for the DAM Picker feature (Phase 07).

## Next Phase Readiness

- Plan 02 can now wire `runDamSync` into Vite server startup via `watcher.ts` and add a `POST /api/dam-sync` endpoint
- All sync building blocks are tested and committed: dam-client.ts, dam-sync.ts, db-api DAM functions
- getBrandAssets already excludes soft-deleted rows so existing UI and MCP tools get correct data automatically

---
*Phase: 13-dam-sync*
*Completed: 2026-03-17*

## Self-Check: PASSED

All files confirmed present:
- canvas/src/server/dam-client.ts — FOUND
- canvas/src/server/dam-sync.ts — FOUND
- canvas/src/__tests__/dam-sync.test.ts — FOUND
- .planning/phases/13-dam-sync/13-01-SUMMARY.md — FOUND

All commits confirmed:
- 64d3013 (Task 1: DB schema + dam-client + db-api) — FOUND
- 1b5adc7 (Task 2: dam-sync runner + tests + vitest config) — FOUND
