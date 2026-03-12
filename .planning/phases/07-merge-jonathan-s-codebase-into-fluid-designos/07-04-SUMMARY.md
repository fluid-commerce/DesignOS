---
phase: 07-merge-jonathan-s-codebase-into-fluid-designos
plan: "04"
subsystem: canvas-editor
tags: [react, zustand, postmessage, editor, slots, export]
dependency_graph:
  requires: ["07-01"]
  provides: [ContentEditor, SlotField, PhotoReposition, BrushTransform, CarouselSelector, ExportActions, editor-store]
  affects: [canvas-app-shell]
tech_stack:
  added: []
  patterns:
    - Zustand store with postMessage IPC to scaled iframe
    - Schema-driven field rendering (text/image/divider)
    - Capture API using html2canvas via postMessage round-trip
key_files:
  created:
    - canvas/src/store/editor.ts
    - canvas/src/components/ContentEditor.tsx
    - canvas/src/components/SlotField.tsx
    - canvas/src/components/PhotoReposition.tsx
    - canvas/src/components/BrushTransform.tsx
    - canvas/src/components/CarouselSelector.tsx
    - canvas/src/components/ExportActions.tsx
    - canvas/src/__tests__/editor-store.test.ts
  modified: []
decisions:
  - iframeRef stored in Zustand store so all components share one reference without prop drilling
  - BrushTransform uses numeric inputs matching Jonathan's sidebar controls; direct drag via iframe mousedown is handled by iframe-side script
  - ExportActions uses global pendingCaptures map with timeout to handle postMessage capture round-trips
  - PhotoReposition opens as modal overlay triggered from ImageSlotField thumbnail click
metrics:
  duration: 4min
  completed_date: "2026-03-12"
  tasks: 2
  files: 8
---

# Phase 7 Plan 4: Content Editor Right Sidebar Summary

Right sidebar editor components — slot fields, photo repositioning, brush/transform, carousel selector, and export. Faithful React/TypeScript port of Jonathan's editor.js, consuming the SlotSchema contract from Wave 0.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Editor store + SlotField + ContentEditor + tests | 0078cc7 | editor.ts, SlotField.tsx, ContentEditor.tsx, editor-store.test.ts |
| 2 | PhotoReposition + BrushTransform + CarouselSelector + ExportActions | 1210cdc | PhotoReposition.tsx, BrushTransform.tsx, CarouselSelector.tsx, ExportActions.tsx |

## What Was Built

**Editor store (`canvas/src/store/editor.ts`):** Zustand store that manages `selectedIterationId`, `slotSchema`, `slotValues`, `isDirty`, and `iframeRef`. `selectIteration(id)` fetches the iteration from the API, loads its schema, and pre-populates slot values from `userState` (preferred) or `aiBaseline`. `updateSlotValue(sel, value, mode)` updates local state and immediately sends a `postMessage({ type: 'tmpl', sel, value, mode })` to the iframe for live preview. `saveUserState()` PATCHes `/api/iterations/:id/user-state`.

**SlotField (`canvas/src/components/SlotField.tsx`):** Renders the correct input component by field type. TextField uses a textarea (rows hint from schema) or single-line input. ImageField shows a thumbnail, file browse button, and triggers PhotoReposition. DividerField renders a styled section separator. All changes flow through the editor store.

**ContentEditor (`canvas/src/components/ContentEditor.tsx`):** Right sidebar container. Loads iteration into editor store on mount. Renders CarouselSelector (when carouselCount > 1), all SlotField instances, BrushTransform section (when brush selector is set), ExportActions, and a sticky Save button when isDirty. Graceful fallback when slotSchema is null.

**PhotoReposition (`canvas/src/components/PhotoReposition.tsx`):** Modal overlay with Fit/Fill toggle buttons and a draggable focus point crosshair. Drag computes percentage-based objectPosition and sends `imgStyle` postMessage. Mirrors Jonathan's focus-drag implementation.

**BrushTransform (`canvas/src/components/BrushTransform.tsx`):** Numeric controls for X, Y, Rotate, Scale W%, Scale H% of the brush element. Sends `transform` action postMessage on each change. Reads current transform from iframe on first render.

**CarouselSelector (`canvas/src/components/CarouselSelector.tsx`):** Horizontal tab strip with "01", "02", ... slide buttons. Active slide highlighted in blue. Sends `setSlide` postMessage. Matches Jonathan's slide switcher UX.

**ExportActions (`canvas/src/components/ExportActions.tsx`):** Three download buttons. JPG and WebP use a postMessage `capture` round-trip with html2canvas (injected on demand via h2c URL). HTML fetches raw content from `/api/iterations/:id/html`. All buttons show loading state during operation.

## Test Results

- 17 unit tests for editor store: all pass
- TypeScript: 0 new errors (4 pre-existing errors in unrelated test files remain)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Checking created files exist and commits are present.

## Self-Check: PASSED

All 8 created files exist on disk. Both task commits (0078cc7, 1210cdc) verified in git log.
