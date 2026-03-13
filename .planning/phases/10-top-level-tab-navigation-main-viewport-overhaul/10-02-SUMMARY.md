---
phase: 10-top-level-tab-navigation-main-viewport-overhaul
plan: "02"
subsystem: ui
tags: [react, vite, markdown, react-markdown, remark-gfm, navigation, viewport]

# Dependency graph
requires:
  - phase: 10-top-level-tab-navigation-main-viewport-overhaul plan 01
    provides: Four-zone AppShell layout, LeftNav, ChatSidebar, NavTab store state

provides:
  - VoiceGuide component rendering 13 markdown docs with vertical side-tabs and dark-theme typography
  - Vite ?raw static imports for all 13 voice-guide/*.md files
  - /patterns/ middleware in watcher.ts for patterns iframe serving
  - /templates/ middleware confirmed present in watcher.ts
  - VoiceGuide wired directly into AppShell (voice-guide NavTab renders real content)
  - Unit tests for VoiceGuide rendering and tab switching (NAV-07, NAV-08)
  - Updated campaign-store tests for activeNavTab and chatSidebarOpen state

affects: [future voice guide content updates, patterns/templates static serving, AppShell viewport additions]

# Tech tracking
tech-stack:
  added: [react-markdown, remark-gfm]
  patterns:
    - "Vite ?raw static imports for markdown files with TypeScript *.md?raw declaration"
    - "ReactMarkdown components prop for inline dark-theme prose styling"
    - "Vertical side-tab panel + scrollable content area layout pattern"

key-files:
  created:
    - voice-guide/App_Rep_Tools.md
    - voice-guide/Builder.md
    - voice-guide/Checkout.md
    - voice-guide/Corporate_Tools.md
    - voice-guide/Droplets.md
    - voice-guide/FairShare.md
    - voice-guide/Fluid_Connect.md
    - voice-guide/Fluid_Payments.md
    - voice-guide/The_Problem_Were_Solving.md
    - voice-guide/Voice_and_Style_Guide.md
    - voice-guide/What_is_Blitz_Week.md
    - voice-guide/What_Is_Fluid.md
    - voice-guide/Why_WeCommerce_Exists.md
    - canvas/src/components/VoiceGuide.tsx
    - canvas/src/__tests__/VoiceGuide.test.tsx
  modified:
    - canvas/src/vite-env.d.ts
    - canvas/src/components/AppShell.tsx
    - canvas/src/server/watcher.ts
    - canvas/src/__tests__/campaign-store.test.ts

key-decisions:
  - "VoiceGuide imports markdown via Vite ?raw (static, zero runtime fetch) — requires *.md?raw TypeScript declaration in vite-env.d.ts"
  - "DOCS array ordered for logical reading: company identity first (What Is Fluid, The Problem, Why WeCommerce), then Voice and Style Guide, then product areas, then tools"
  - "VoiceGuide wired as direct import in AppShell (not via voiceGuideContent prop) — no external dependencies needed"
  - "ReactMarkdown components prop applies inline styles per element type for dark-theme typography without a separate CSS file"

patterns-established:
  - "Side-tab navigation: 180px left panel with borderLeft active indicator, scrollable right content area"
  - "Markdown viewport: full-height flex container, side-tabs left, prose right with 2rem padding"

requirements-completed: [NAV-07, NAV-08]

# Metrics
duration: ~20min
completed: 2026-03-13
---

# Phase 10 Plan 02: Voice Guide Viewport Summary

**React-markdown Voice Guide with 13 Fluid knowledge docs, Vite ?raw imports, vertical side-tabs, dark-theme prose styling, and /patterns/ middleware wired into the four-zone AppShell**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-13T17:00:00Z
- **Completed:** 2026-03-13T17:13:43Z
- **Tasks:** 3 (including checkpoint)
- **Files modified:** 18

## Accomplishments

- Built VoiceGuide.tsx with 13 markdown docs statically imported via Vite ?raw, vertical side-tabs with active blue-left-border indicator, and ReactMarkdown prose rendering with full dark-theme typography (headings, lists, code blocks, tables, links)
- Added /patterns/ middleware to watcher.ts (path-traversal-safe) for patterns iframe to resolve; confirmed /templates/ middleware already present from Plan 01
- Wired VoiceGuide directly into AppShell as direct import (cleaner than voiceGuideContent prop), updated campaign-store tests to cover activeNavTab and chatSidebarOpen, and wrote real VoiceGuide unit tests for NAV-07 and NAV-08
- Visual verification checkpoint passed — user approved full navigation overhaul including all 4 nav tabs, chat sidebar collapse, Voice Guide markdown rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy Voice Guide docs + install deps + build VoiceGuide component + create test stubs** - `e3fd994` (feat)
2. **Task 2: Wire VoiceGuide into AppShell + add /templates/ middleware + update store tests** - `3937c46` (feat)
3. **Task 3: Visual verification of full navigation overhaul** - checkpoint approved (no code commit)

## Files Created/Modified

- `voice-guide/*.md` (13 files) - Fluid knowledge base markdown documents
- `canvas/src/components/VoiceGuide.tsx` - Markdown renderer with vertical side-tabs and dark-theme typography
- `canvas/src/__tests__/VoiceGuide.test.tsx` - Unit tests for 13-tab rendering, tab switching, markdown rich-text (NAV-07, NAV-08)
- `canvas/src/vite-env.d.ts` - Added `*.md?raw` TypeScript module declaration
- `canvas/src/components/AppShell.tsx` - Voice Guide tab now renders `<VoiceGuide />` directly
- `canvas/src/server/watcher.ts` - Added /patterns/ static serving middleware
- `canvas/src/__tests__/campaign-store.test.ts` - Added activeNavTab and chatSidebarOpen test coverage

## Decisions Made

- Vite `?raw` for markdown imports means zero runtime fetches and full TypeScript safety — required adding `*.md?raw` declaration to vite-env.d.ts
- Direct import of VoiceGuide in AppShell (not via prop) is cleaner since VoiceGuide has no external data dependencies
- DOCS reading order: company identity → voice/style → product areas (Builder, Checkout, FairShare, etc.) → tools (App Rep Tools, Corporate Tools)
- ReactMarkdown `components` prop used for inline styles; no separate CSS file to avoid conflicts with Vite CSS scoping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four NavTab viewports (Campaigns, Templates, Patterns, Voice Guide) render real content
- Voice Guide reads from `voice-guide/*.md` at repo root — adding new docs requires adding import + DOCS entry in VoiceGuide.tsx
- Phase 10 navigation overhaul is now complete with both plans (10-01 and 10-02) done

---
*Phase: 10-top-level-tab-navigation-main-viewport-overhaul*
*Completed: 2026-03-13*

## Self-Check: PASSED

- FOUND: 10-02-SUMMARY.md
- FOUND: VoiceGuide.tsx
- FOUND: AppShell.tsx
- FOUND: watcher.ts
- FOUND: voice-guide/*.md (15 files present, 13 required minimum)
- FOUND: commit e3fd994
- FOUND: commit 3937c46
