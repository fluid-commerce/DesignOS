---
phase: 04-canvas-iteration
plan: 03
subsystem: ui
tags: [react, zustand, annotations, timeline, iteration, canvas]

requires:
  - phase: 04-01
    provides: "Canvas scaffold with SessionSidebar, VariationGrid, AssetFrame, sessions store"
provides:
  - "Annotation store with pin/sidebar CRUD and debounced persistence"
  - "Spatial pin annotations with percentage-based positioning"
  - "Sidebar notes grouped by variation"
  - "Iteration timeline with round nodes and legacy format support"
  - "Context bundler writing iterate-request.json"
  - "API endpoints for annotations and iterate-request persistence"
affects: [04-04, phase-05]

tech-stack:
  added: []
  patterns:
    - "Percentage-based pin positioning (x/y as 0-100% of native dimensions)"
    - "Debounced auto-save on annotation mutations (300ms)"
    - "Winner auto-rejects other variations in same round"
    - "Context bundler collects rejection patterns for agent consumption"

key-files:
  created:
    - "canvas/src/store/annotations.ts"
    - "canvas/src/hooks/useAnnotations.ts"
    - "canvas/src/components/AnnotationPin.tsx"
    - "canvas/src/components/AnnotationThread.tsx"
    - "canvas/src/components/SidebarNotes.tsx"
    - "canvas/src/components/Timeline.tsx"
    - "canvas/src/components/TimelineNode.tsx"
    - "canvas/src/components/IteratePanel.tsx"
    - "canvas/src/components/PromptReveal.tsx"
    - "canvas/src/lib/context-bundler.ts"
    - "canvas/src/__tests__/annotations.test.ts"
    - "canvas/src/__tests__/Timeline.test.tsx"
  modified:
    - "canvas/src/components/AssetFrame.tsx"
    - "canvas/src/components/VariationGrid.tsx"
    - "canvas/src/App.tsx"
    - "canvas/src/server/watcher.ts"
    - "canvas/src/__tests__/VariationGrid.test.tsx"

key-decisions:
  - "Pin positions stored as percentage (0-100) of native asset dimensions for scale-independent rendering"
  - "Auto-reject logic lives in App.tsx callback, not in the store, to keep store actions pure"
  - "API endpoints for annotations and iterate-request added to existing Vite middleware plugin"

patterns-established:
  - "Annotation overlay uses pointer-events crosshair for pin placement UX"
  - "Thread popovers positioned relative to pin percentage coordinates"
  - "IteratePanel gated on winner selection -- disabled state with helper text"

requirements-completed: [CANV-02, CANV-03]

duration: 6min
completed: 2026-03-11
---

# Phase 4 Plan 03: Annotations and Iteration Timeline Summary

**Figma-style spatial pin annotations, sidebar notes, branching iteration timeline, and context-bundled iterate workflow**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-11T00:11:45Z
- **Completed:** 2026-03-11T00:17:52Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Full annotation system with pin (spatial) and sidebar (text-only) types, Zustand store with debounced auto-save, and API persistence
- Branching iteration timeline rendering round nodes with variation statuses, winner highlights, and collapsible prompt reveals
- Iterate panel that bundles winner, annotations, rejection patterns into iterate-request.json for agent consumption
- 32 tests passing across annotations, timeline, sessions, and grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Annotation system -- store, hooks, pins, threads, sidebar notes, persistence** - `8e3acda` (feat)
2. **Task 2: AssetFrame annotation wiring, timeline, status management, and iterate panel** - `c2607a1` (feat)

## Files Created/Modified
- `canvas/src/store/annotations.ts` - Zustand store with annotation CRUD, status management, debounced save
- `canvas/src/hooks/useAnnotations.ts` - Convenience hook with session-aware loading and filtered getters
- `canvas/src/components/AnnotationPin.tsx` - Numbered circle marker with human/agent color coding
- `canvas/src/components/AnnotationThread.tsx` - Popover showing annotation text, replies, and reply input
- `canvas/src/components/SidebarNotes.tsx` - Right panel with notes grouped by variation and add-note form
- `canvas/src/components/Timeline.tsx` - Vertical timeline with round nodes and legacy format support
- `canvas/src/components/TimelineNode.tsx` - Round node with variation labels, winner highlight, and PromptReveal
- `canvas/src/components/IteratePanel.tsx` - Feedback textarea with winner-gated Iterate button
- `canvas/src/components/PromptReveal.tsx` - Collapsible prompt section for timeline rounds
- `canvas/src/lib/context-bundler.ts` - Bundles winner, feedback, rejection patterns into iterate-request.json
- `canvas/src/components/AssetFrame.tsx` - Updated with click-to-pin overlay, pin rendering, status cycling
- `canvas/src/components/VariationGrid.tsx` - Updated to pass annotation props to AssetFrame
- `canvas/src/App.tsx` - Full layout with timeline, sidebar notes, iterate panel, and winner auto-reject
- `canvas/src/server/watcher.ts` - Added annotation and iterate-request API endpoints
- `canvas/src/__tests__/annotations.test.ts` - 6 tests for annotation store operations
- `canvas/src/__tests__/Timeline.test.tsx` - 7 tests for timeline, iterate panel, prompt reveal, status mgmt
- `canvas/src/__tests__/VariationGrid.test.tsx` - Updated to match new VariationGrid props

## Decisions Made
- Pin positions stored as percentage (0-100) of native asset dimensions -- scale-independent across display sizes
- Auto-reject logic kept in App.tsx callback rather than store to keep store actions pure and composable
- API endpoints for annotations and iterate-request added to existing Vite middleware plugin (watcher.ts) rather than separate server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated VariationGrid test to match new props**
- **Found during:** Task 2 (AssetFrame and VariationGrid updates)
- **Issue:** Existing VariationGrid test didn't pass the new required annotation props
- **Fix:** Added default noop callbacks and annotation props to test renders
- **Files modified:** canvas/src/__tests__/VariationGrid.test.tsx
- **Verification:** All tests pass
- **Committed in:** c2607a1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary test update to match new component API. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Annotation and iteration systems complete, ready for Plan 04 (end-to-end integration testing)
- Canvas now supports the full review loop: view variations -> annotate -> pick winner -> iterate
- iterate-request.json output is compatible with MCP tools from Plan 02

## Self-Check: PASSED

- All 12 created files verified on disk
- Commits 8e3acda and c2607a1 verified in git log
- 32 tests passing, TypeScript compiles cleanly

---
*Phase: 04-canvas-iteration*
*Completed: 2026-03-11*
