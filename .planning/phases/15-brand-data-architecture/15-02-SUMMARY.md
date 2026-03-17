---
phase: 15-brand-data-architecture
plan: "02"
subsystem: brand-assets
tags: [db-migration, ui-components, api-routes, category-taxonomy]
dependency_graph:
  requires: []
  provides: [brand_assets.description, PUT /api/brand-assets/:id, AssetsScreen category tabs]
  affects: [AssetsScreen, db-api, watcher, asset-scanner]
tech_stack:
  added: []
  patterns: [inline-edit-optimistic-update, category-tab-filter, db-migration-try-catch]
key_files:
  created: []
  modified:
    - canvas/src/lib/db.ts
    - canvas/src/server/db-api.ts
    - canvas/src/server/watcher.ts
    - canvas/src/server/asset-scanner.ts
    - canvas/src/components/AssetsScreen.tsx
    - canvas/src/__tests__/brand-assets.test.ts
decisions:
  - "CATEGORY_MAP added to asset-scanner.ts so new filesystem scans use semantic categories (brushstrokes dir -> decorations); DB migration handles existing rows idempotently"
  - "description editing uses optimistic update with revert on failure — no loading state on card during save"
  - "filteredBrandAssets computed from brandAssets state; empty-category state shows 'No assets in this category' instead of blank"
metrics:
  duration: "5min"
  completed: "2026-03-17"
  tasks_completed: 2
  files_modified: 6
---

# Phase 15 Plan 02: Assets Category Taxonomy + Description Editing Summary

Brand assets recategorized from 9 granular filesystem categories to 4 semantic categories (Fonts, Images, Brand Elements, Decorations), with per-asset description editing and category tab filtering in AssetsScreen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DB migration + API routes for asset description and category updates | 6d1104f | db.ts, db-api.ts, watcher.ts, asset-scanner.ts, brand-assets.test.ts |
| 2 | Enhance AssetsScreen.tsx with category tabs, descriptions, and section descriptions | cb67817 | AssetsScreen.tsx |

## What Was Built

### Task 1: DB + API Layer

**db.ts** — Two new idempotent migrations added after existing DAM column migrations:
- `ALTER TABLE brand_assets ADD COLUMN description TEXT` — nullable text field for per-asset descriptions
- Three `UPDATE brand_assets SET category = ...` statements recategorizing existing rows from granular to semantic categories (photos → images, logos → brand-elements, brushstrokes/circles/lines/scribbles/underlines/xs → decorations; fonts stays as-is)

**db-api.ts** — Three additions:
- `description: string | null` field on `BrandAsset` interface
- `description: (row.description as string | null) ?? null` in `rowToBrandAsset` mapper
- `updateBrandAsset(id, { category?, description? })` function using dynamic SET clause with positional params

**watcher.ts** — New `PUT /api/brand-assets/:id` route using regex match pattern, parses body, calls `updateBrandAsset`, returns `{ ok: true }`. Import updated to include `updateBrandAsset`.

**asset-scanner.ts** — Added `CATEGORY_MAP` constant mapping filesystem directory names to semantic categories. Scanner now uses `CATEGORY_MAP[category] ?? 'decorations'` when inserting new rows.

### Task 2: AssetsScreen UI

**AssetsScreen.tsx** — Enhanced with:
- `ASSET_CATEGORIES` array (all/fonts/images/brand-elements/decorations)
- `CATEGORY_DESCRIPTIONS` record with per-category descriptions for agents
- `activeCategory` state with tab filter bar showing count badges `(N)`
- `filteredBrandAssets` computed value filtering brandAssets by activeCategory
- `description: string | null` on `BrandAssetUI` interface
- `editingDescId`, `editDescContent`, `savedDescId` states for inline editing
- `saveDescription(id, description)` with optimistic update, fetch PUT, 2s "Saved" flash
- "Add description..." placeholder in italic var(--text-muted) when description is null
- Empty category state: "No assets in this category."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] brand-assets.test.ts expected old category name**
- **Found during:** Task 1 verification
- **Issue:** Test `getBrandAssets filters by category` called `getBrandAssets('brushstrokes')` expecting 2 results, but after CATEGORY_MAP was added to asset-scanner.ts, brushstrokes directory now seeds assets as `'decorations'`
- **Fix:** Updated test to use `getBrandAssets('decorations')` and assert `category === 'decorations'`
- **Files modified:** `canvas/src/__tests__/brand-assets.test.ts`
- **Commit:** 6d1104f

**2. [Rule 2 - Missing functionality] asset-scanner.ts needed CATEGORY_MAP**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified updating brand-seeder.ts CATEGORY_MAP, but the actual asset seeding is done by asset-scanner.ts (not brand-seeder.ts which handles patterns/voice-guide). Without updating asset-scanner.ts, new filesystem scans would still insert old granular category names.
- **Fix:** Added `CATEGORY_MAP` to asset-scanner.ts instead of (non-existent) brand-seeder.ts CATEGORY_MAP. The brand-seeder.ts CATEGORY_MAP is for brand_patterns categories, not brand_assets.
- **Files modified:** `canvas/src/server/asset-scanner.ts`
- **Commit:** 6d1104f

## Self-Check

### Files exist:
- [x] `canvas/src/lib/db.ts` — contains `ALTER TABLE brand_assets ADD COLUMN description TEXT`
- [x] `canvas/src/server/db-api.ts` — contains `export function updateBrandAsset`
- [x] `canvas/src/server/watcher.ts` — contains `const brandAssetIdMatch = url.match`
- [x] `canvas/src/components/AssetsScreen.tsx` — contains `ASSET_CATEGORIES`, `activeCategory`, `saveDescription`

### Commits exist:
- [x] 6d1104f — feat(15-02): DB migration for description column and category recategorization
- [x] cb67817 — feat(15-02): AssetsScreen category tabs, descriptions, and inline editing

### Tests: 358 pass, 0 fail

## Self-Check: PASSED
