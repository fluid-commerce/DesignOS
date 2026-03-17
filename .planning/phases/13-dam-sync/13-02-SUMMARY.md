---
phase: 13-dam-sync
plan: 02
subsystem: ui
tags: [react, dam, brand-assets, sync, vite, sqlite, better-sqlite3]

# Dependency graph
requires:
  - phase: 13-dam-sync plan 01
    provides: runDamSync, DamSyncResult, dam-sync.ts, dam-client.ts, upsertDamAsset, softDeleteRemovedDamAssets, DB schema with 6 DAM columns

provides:
  - POST /api/dam-sync endpoint returning DamSyncResult JSON
  - Startup DAM sync (fire-and-forget, VITE_FLUID_DAM_TOKEN gated)
  - GET /api/brand-assets?include_deleted=true support
  - BrandAsset interface extended with source and damDeleted fields
  - getAllBrandAssets() function (includes soft-deleted rows)
  - AssetsScreen: Brand Assets section with sync status bar, Sync now button, DAM badge, Removed from DAM badge

affects: [UI brand asset grid, DAM picker, agent brand context loading]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Probe-then-show pattern: AssetsScreen probes /api/dam-sync on mount only if no dam assets exist, to detect token presence without page load delay"
    - "no-token state hides sync bar entirely — zero UI noise for installs without DAM configured"
    - "include_deleted=true query param pattern for soft-delete visibility in UI"

key-files:
  created: []
  modified:
    - canvas/src/server/watcher.ts
    - canvas/src/server/db-api.ts
    - canvas/src/components/AssetsScreen.tsx

key-decisions:
  - "Probe-on-mount strategy: if no dam assets in DB, fire a POST /api/dam-sync probe to detect token. 400 = no token (hide bar). 200/500 = token configured (show bar). Avoids dedicated /api/dam-token-status endpoint."
  - "getAllBrandAssets queries without dam_deleted filter — returns everything including soft-deleted for UI to show Removed from DAM badge"
  - "Brand Assets section added above Saved Assets — brand catalog is primary, user saves are secondary"

requirements-completed: [DAM-06, DAM-07, DAM-08, DAM-09, DAM-10]

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 13 Plan 02: DAM Sync Wiring + AssetsScreen UI Summary

**DAM sync wired into Vite server startup (fire-and-forget) and POST /api/dam-sync endpoint added; AssetsScreen updated with Brand Assets section showing sync status bar, Sync now button, DAM source badges, and amber Removed from DAM badges**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-17T13:44:00Z
- **Completed:** 2026-03-17T13:49:37Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting user verification)
- **Files modified:** 3

## Accomplishments

- Vite server now fires DAM sync on startup when VITE_FLUID_DAM_TOKEN is set (non-blocking, fire-and-forget, logs result to console)
- POST /api/dam-sync endpoint added — returns DamSyncResult JSON, 400 when no token, 500 on error
- GET /api/brand-assets now supports ?include_deleted=true, returning soft-deleted rows with source/damDeleted metadata
- AssetsScreen rebuilt with Brand Assets section: sync status bar, Sync now button, DAM badge on sourced assets, amber Removed from DAM badge on soft-deleted assets; sync bar hidden entirely when no token configured

## Task Commits

Each task was committed atomically:

1. **Task 1: Watcher integration — startup sync + POST /api/dam-sync + db-api extensions** - `de17f4f` (feat)
2. **Task 2: AssetsScreen UI — sync status bar, DAM badges, brand assets grid** - `dd40c0a` (feat)
3. **Task 3: Visual verification** — checkpoint:human-verify (pending user verification)

## Files Created/Modified

- `canvas/src/server/watcher.ts` - Added runDamSync import, startup sync call, POST /api/dam-sync endpoint, include_deleted support in GET /api/brand-assets, getAllBrandAssets import
- `canvas/src/server/db-api.ts` - Extended BrandAsset interface with source/damDeleted fields, updated rowToBrandAsset, added getAllBrandAssets()
- `canvas/src/components/AssetsScreen.tsx` - Full component rebuild: Brand Assets section with sync status bar + grid, DAM/Removed from DAM badges, Saved Assets section preserved, SyncSpinner + CloudSyncIcon SVG components, getRelativeTime helper

## Decisions Made

- **Probe-on-mount strategy**: If no dam assets exist in DB, probe POST /api/dam-sync to detect token presence. 400 = no-token (hide bar). 200/500 = token configured (show bar). Avoids adding a dedicated /api/dam-token-status endpoint.
- **getAllBrandAssets without filter**: New function queries all brand_assets rows without the dam_deleted filter. getBrandAssets still excludes soft-deleted rows for backward compatibility (used by MCP tools and pipeline brand context loading).
- **Brand Assets above Saved Assets**: Brand catalog (auto-synced, company-wide) is primary content; user-saved assets from the DAM Picker are secondary.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — the interfaces from Plan 01 were exactly as specified. Full 361-test suite passed after both tasks.

## User Setup Required

- Set `VITE_FLUID_DAM_TOKEN` in `canvas/.env` to enable DAM sync
- Restart the dev server — startup sync fires automatically
- Terminal will log: `[dam-sync] Startup sync: N synced, N skipped, N soft-deleted`

## Next Phase Readiness

- Task 3 (visual verification) awaits user browser check
- After verification, Phase 13 Plan 02 is complete
- Plan 03 (if any) can proceed with confidence that DAM sync pipeline is end-to-end functional

---
*Phase: 13-dam-sync*
*Completed: 2026-03-17*
