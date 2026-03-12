---
phase: 08-ai-sidebar-to-campaign-dashboard-end-to-end
plan: 03
subsystem: ui
tags: [react, zustand, iframe, preview, campaign, typescript, vitest]

# Dependency graph
requires:
  - phase: 08-01
    provides: Iteration.generationStatus field, getCampaignPreviewUrls DB function, /api/campaigns/:id/preview-urls endpoint
  - phase: 08-02
    provides: Multi-asset campaign generation flow, 'done' SSE event fired only after all subagents complete
provides:
  - Asset and frame cards show live iframe previews when generationStatus='complete'
  - Campaign cards show 2x2 mosaic of iframe previews lazy-fetched via preview-urls API
  - latestIterationByAssetId populated in campaign store on navigateToCampaign
  - StatusBadge extended to accept GenerationStatus (pending/generating/complete with amber pulse)
  - PromptSidebar detects campaign view and shows "Adding to: [Campaign]" mode
  - existingCampaignId sent in generate POST body when in add-to-campaign mode
  - Auto-navigate to campaign on generation complete (no 500ms delay)
affects:
  - phase-09-chat-ui
  - future preview/iteration rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure preview builder functions (buildAssetPreview, buildFramePreview) in lib/preview-utils.ts for testability"
    - "Zustand store action (fetchLatestIterations) called in navigateToCampaign for always-fresh preview data"
    - "Campaign card mosaic via html srcDoc with nested iframes — no new API endpoint required"
    - "IntersectionObserver lazy-load via CampaignMosaic component + eager prefetch fallback"

key-files:
  created:
    - canvas/src/lib/preview-utils.ts
  modified:
    - canvas/src/store/campaign.ts
    - canvas/src/App.tsx
    - canvas/src/components/CampaignDashboard.tsx
    - canvas/src/components/PromptSidebar.tsx
    - canvas/src/components/StatusBadge.tsx
    - canvas/src/hooks/useGenerationStream.ts
    - canvas/src/__tests__/campaign-store.test.ts

key-decisions:
  - "buildAssetPreview and buildFramePreview extracted to preview-utils.ts (pure functions) so renderPreview closures in App.tsx stay thin and logic is fully testable"
  - "Campaign card mosaic uses html srcDoc with nested iframes rather than a CampaignMosaic React component overlaid on DrillDownGrid cards — avoids DrillDownGrid refactor while delivering visual preview"
  - "Eager prefetch of preview URLs on campaign list load (not pure IntersectionObserver lazy) — simpler, correct, avoids hidden-div IO Observer hacks"
  - "StatusBadge pulse animation via CSS @keyframes injected inline — no external CSS dependency"
  - "500ms delay removed from auto-navigate in PromptSidebar — Plan 02 ensures 'done' SSE fires only after all subagents complete"
  - "existingCampaignId added to GenerateOptions interface in useGenerationStream so type is explicit"

patterns-established:
  - "Preview data fetching pattern: store populates latestIterationByAssetId in navigateToCampaign, components read from store not fetch directly"
  - "GenerationStatus union in StatusBadge: GENERATION_KEYS set used to distinguish from VariationStatus without runtime instanceof"

requirements-completed: [E2E-03, E2E-04, E2E-05, E2E-06, E2E-07]

# Metrics
duration: 25min
completed: 2026-03-12
---

# Phase 08 Plan 03: Visual Previews + Campaign-Aware Sidebar Summary

**iframe previews at every navigation level (campaign mosaic, asset, frame) plus sidebar campaign-mode detection with existingCampaignId generation flow**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-12T16:35:00Z
- **Completed:** 2026-03-12T17:00:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Asset cards show live iframe previews when `generationStatus === 'complete'`, fall back to metadata cards with status badge text when pending/generating
- Frame cards use the latest iteration (by `iterationIndex`) for iframe preview with correct asset-type dimensions
- Campaign cards show 2x2 mosaic of iframe previews fetched from `/api/campaigns/:id/preview-urls`
- `latestIterationByAssetId` populated on every `navigateToCampaign` call via new `fetchLatestIterations` store action
- StatusBadge now accepts `GenerationStatus | VariationStatus` union; amber pulse on "generating"
- PromptSidebar shows "Adding to: [Campaign Name]" banner when viewing a campaign; sends `existingCampaignId` in generate POST body
- Auto-navigate to campaign fires immediately on completion (500ms delay removed)
- 17 new unit tests covering `getAssetDimensions`, `buildAssetPreview`, `buildFramePreview`, and `fetchLatestIterations`

## Task Commits

Each task was committed atomically:

1. **Task 1: Campaign store extension + asset/frame iframe previews** - `b83f475` (feat)
2. **Task 2: Mosaic previews + StatusBadge + sidebar campaign mode** - `ced586e` (feat)

## Files Created/Modified

- `canvas/src/lib/preview-utils.ts` — `getAssetDimensions`, `buildAssetPreview`, `buildFramePreview` pure functions
- `canvas/src/store/campaign.ts` — `latestIterationByAssetId` state, `fetchLatestIterations` action
- `canvas/src/App.tsx` — `renderAssetPreview` and `renderFramePreview` use new pure helpers; `latestIterationByAssetId` subscribed from store; asset subtitle shows generation status
- `canvas/src/components/CampaignDashboard.tsx` — `CampaignMosaic` component, `buildMosaicSrcDoc` helper, mosaic prefetch in `CampaignDashboard`
- `canvas/src/components/PromptSidebar.tsx` — "Adding to" banner, `existingCampaignId` in generate opts, removed 500ms delay
- `canvas/src/components/StatusBadge.tsx` — extended with `GenerationStatus` union and pulse animation
- `canvas/src/hooks/useGenerationStream.ts` — `existingCampaignId` added to `GenerateOptions` interface
- `canvas/src/__tests__/campaign-store.test.ts` — 17 new tests, updated existing mocks for `fetchLatestIterations`

## Decisions Made

- Extracted preview builder logic to `preview-utils.ts` so App.tsx renders are thin and logic is unit-testable
- Campaign mosaic uses `html` (srcDoc) in `PreviewDescriptor` rather than overriding DrillDownGrid — avoids structural refactor
- Eager prefetch of preview URLs when campaigns list changes (vs pure IntersectionObserver) — simpler and equally correct for the dashboard use case
- `existingCampaignId` added as first-class field to `GenerateOptions` interface (not spread as `Record<string, unknown>`) for type safety

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added existingCampaignId to GenerateOptions interface**
- **Found during:** Task 2 (PromptSidebar campaign integration)
- **Issue:** Plan specified sending `existingCampaignId` in POST body but `GenerateOptions` interface in `useGenerationStream.ts` didn't declare the field, requiring unsafe type cast
- **Fix:** Added `existingCampaignId?: string` to `GenerateOptions` interface — now properly typed end-to-end
- **Files modified:** canvas/src/hooks/useGenerationStream.ts
- **Verification:** TypeScript compiles cleanly with no casts
- **Committed in:** ced586e (Task 2 commit)

**2. [Rule 1 - Bug] Fixed existing navigateToCampaign tests missing fetchLatestIterations mocks**
- **Found during:** Task 1 verification (test run)
- **Issue:** Existing `navigateToCampaign` tests only mocked one fetch call (assets). After adding `fetchLatestIterations`, those tests got uncaught mock errors (stderr noise) because there were no additional mocks
- **Fix:** Added `makeJsonResponse([])` mock calls for the frames fetch in affected existing tests
- **Files modified:** canvas/src/__tests__/campaign-store.test.ts
- **Verification:** All 39 tests pass, no uncaught mock errors
- **Committed in:** b83f475 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing interface field, 1 test mock gap)
**Impact on plan:** Both fixes necessary for correctness and clean test output. No scope creep.

## Issues Encountered

- `DrillDownGrid` renders `renderPreview` synchronously, making async per-card fetching impossible without component refactor. Solved by pre-fetching preview URLs at campaign list load time and feeding results back via `mosaicData` state to `renderPreview`
- `CampaignMosaic` component with IntersectionObserver is present in the file for future use, but the primary mosaic rendering goes through `buildMosaicSrcDoc` + `html` srcDoc in `PreviewDescriptor`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All navigation levels (dashboard, campaign, asset, frame) now show live HTML previews
- Generation status visible on asset cards throughout the campaign view
- Sidebar correctly routes prompts to existing campaigns when appropriate
- Phase 09 (Conversational chat UI) can proceed — no blockers from this plan

---
*Phase: 08-ai-sidebar-to-campaign-dashboard-end-to-end*
*Completed: 2026-03-12*
