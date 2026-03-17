---
created: "2026-03-13T21:14:02.351Z"
title: Refactor variant navigation to unified creation view
area: ui
files:
  - canvas/src/App.tsx
  - canvas/src/store/campaign.ts
  - canvas/src/store/editor.ts
  - canvas/src/components/VersionGrid.tsx
  - canvas/src/components/DrillDownGrid.tsx
  - canvas/src/components/ContentEditor.tsx
  - canvas/src/lib/campaign-types.ts
  - canvas/src/lib/preview-utils.ts
---

## Problem

The current navigation requires two separate drill-down levels to reach variants: Creation → Slide → Iteration. This is clunky — users must navigate into a slide grid, then into an iteration grid, before they can see or compare variants. The proposed UX collapses this into a single unified creation view where slides are navigated via carousel + tabs, and variants appear as a bottom bar thumbnail overlay.

## Solution

### Navigation Changes
- Remove `'slide'` as a separate drill-down view in `currentView` state
- When navigating to a creation, immediately show the editor with slide 01 and its best version
- `activeSlideId` and `activeIterationId` set automatically on creation entry

### Main Preview Area
- Full-size preview of selected version of current slide
- Next slide peeks from right edge (faded) for multi-slide creations
- Left/right carousel arrows to advance between slides
- Numbered slide tabs (01, 02, 03, 04) in sidebar area for quick-jump, synced with carousel

### Version Bottom Bar (new component, collapsible)
- Only renders when current slide has 2+ versions
- Semi-transparent dark panel (rgba(50,48,48,0.8), rounded-[7.027px])
- Collapsible via chevron toggle
- Thumbnail strip (~114px square), horizontally scrollable with fade-out gradient on overflow
- Sort order: starred/winner (leftmost, blue border #44b2ff) → unmarked (by index) → rejected (rightmost, faded + diagonal X overlay corner-to-corner)
- Star (blue FA solid #44b2ff) + reject/close (white FA solid) icon actions per thumbnail
- Starring un-stars any previous winner on that slide (one winner per slide max)
- "Slide Versions N/M" label with count in blue (#3ba9ff)
- Left/right nav arrows in header row

### Slide Memory (ephemeral state)
- `Map<slideId, iterationId>` tracks last-viewed version per slide within a session
- Priority when entering a slide: (1) last-viewed in session → (2) starred/winner version → (3) most recent version (highest index)
- Resets when leaving the creation view entirely

### Rejected Version Treatment
- Thumbnail faded out with diagonal X (two crossing lines corner to corner)
- Pushed to far right of thumbnail strip
- Still visible but flagged so generation agent avoids using as inspiration

### What Does NOT Change
- DB schema (Iteration.status already has 'winner' | 'rejected' | 'final' | 'unmarked')
- API endpoints (PATCH /api/iterations/:id/status already works)
- Right sidebar content editor (ContentEditor.tsx)
- Editor store / postMessage IPC (store/editor.ts)
- SlotSchema / slot editing flow

### Figma Reference
- Bottom bar element: figma.com/design/9qtDbeDfJbtulzQeZRzs0Q/Social-Media-Asseets?node-id=275-880
- Full frame context: figma.com/design/9qtDbeDfJbtulzQeZRzs0Q/Social-Media-Asseets?node-id=275-838

### Terminology Mapping
- "Iteration" in codebase = "version/variant" in UI
- Iteration.status 'winner' = starred
- Iteration.status 'rejected' = rejected
