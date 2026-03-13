---
phase: 10-top-level-tab-navigation-main-viewport-overhaul
plan: "01"
subsystem: canvas-navigation
tags: [navigation, layout, react, zustand, vitest]
dependency_graph:
  requires: []
  provides: [LeftNav, ChatSidebar, four-zone-AppShell, NavTab-store-state]
  affects: [AppShell, App, campaign-store, watcher]
tech_stack:
  added: []
  patterns: [four-zone-layout, store-driven-viewport-switching, collapsible-sidebar]
key_files:
  created:
    - canvas/src/components/LeftNav.tsx
    - canvas/src/components/ChatSidebar.tsx
    - canvas/src/__tests__/LeftNav.test.tsx
    - canvas/src/__tests__/AppShell.test.tsx
  modified:
    - canvas/src/store/campaign.ts
    - canvas/src/components/AppShell.tsx
    - canvas/src/server/watcher.ts
decisions:
  - "Four-zone layout: LeftNav (52px) | ChatSidebar (0/280px) | Viewport (flex) | ContentEditor — no header bar across top"
  - "chatSidebarOpen is canonical; leftSidebarOpen kept in sync for backward compat — both toggle together"
  - "AppShell.props backward-compatible: existing leftSidebar/rightSidebar/children/onNewAsset props unchanged; voiceGuideContent added as optional"
  - "Patterns middleware added to watcher.ts (Plan said Plan 02 Task 2 but needed now for iframe to resolve)"
metrics:
  duration: 7min
  completed: "2026-03-13"
  tasks_completed: 3
  files_modified: 7
---

# Phase 10 Plan 01: Four-Zone Navigation Layout Summary

Four-zone canvas app layout with slim icon-based LeftNav, collapsible ChatSidebar, viewport-switching AppShell, and new NavTab/chatSidebarOpen store state.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 0 | Wave 0 test stubs for LeftNav and AppShell | 348f039 | 2 created |
| 1 | Campaign store extension + LeftNav + ChatSidebar | 45f614e | 4 modified/created |
| 2 | AppShell four-zone rewrite + patterns middleware | 45d429c | 3 modified |

## What Was Built

### LeftNav component (`canvas/src/components/LeftNav.tsx`)
- 52px wide vertical icon bar with 4 nav tabs (Campaigns, Templates, Patterns, Voice Guide)
- Each tab: 40x40px button, `title=` attribute for native tooltip, inline SVG icon
- Active tab indicator: `borderLeft: '2px solid #44B2FF'`, `background: #1a1a1e`
- Chat toggle at bottom (pushed with `marginTop: auto`), blue when open
- Reads/writes `activeNavTab` and `chatSidebarOpen` from `useCampaignStore`

### ChatSidebar component (`canvas/src/components/ChatSidebar.tsx`)
- Thin wrapper: `width: chatSidebarOpen ? 280 : 0` with `transition: 'width 0.2s ease'`
- `overflow: hidden` — PromptSidebar content hidden but not unmounted during collapse

### Campaign store extension (`canvas/src/store/campaign.ts`)
- Added `NavTab` type: `'campaigns' | 'templates' | 'patterns' | 'voice-guide'`
- Added `activeNavTab: NavTab` (initial: `'campaigns'`) and `chatSidebarOpen: boolean` (initial: `true`)
- Added `setActiveNavTab(tab)` and `toggleChatSidebar()` actions
- `leftSidebarOpen` kept in sync with `chatSidebarOpen` in both toggle actions for backward compatibility

### AppShell rewrite (`canvas/src/components/AppShell.tsx`)
- Four-zone horizontal flex layout: LeftNav | ChatSidebar | main viewport | right sidebar
- Header bar removed entirely
- `renderViewport()` switches on `activeNavTab`:
  - `campaigns`: slim breadcrumb bar (40px, `borderBottom`) + New Asset button + `{children}`
  - `templates`: `<iframe src="/templates/" title="Template Library" />`
  - `patterns`: `<iframe src="/patterns/" title="Pattern Library" />`
  - `voice-guide`: placeholder text (Plan 02 will replace)
- Right sidebar (ContentEditor) unchanged — same collapse/expand behavior with LayersIcon

### Patterns middleware (`canvas/src/server/watcher.ts`)
- Added `/patterns/` middleware serving `patterns/index.html` and static assets
- Follows same pattern as existing `/templates/` middleware
- Required for patterns iframe to resolve (Plan 02 Task 2 description was slightly premature)

## Tests

| File | Tests | Coverage |
|------|-------|----------|
| `LeftNav.test.tsx` | 4 passing | NAV-01 (4 buttons render), NAV-02 (tab click updates store, chat toggle flips state) |
| `AppShell.test.tsx` | 3 passing | NAV-03 (templates iframe), NAV-05 (patterns iframe), NAV-06 (chat sidebar width 0) |

All 7 new tests pass. Full suite: 254 pass / 5 fail (5 pre-existing skill-paths failures unrelated to this plan).

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing] Added /patterns/ middleware in watcher.ts**
- **Found during:** Task 2 — AppShell renders `<iframe src="/patterns/" />` but no middleware existed
- **Issue:** Without middleware, patterns iframe would 404 on every load
- **Fix:** Added patterns middleware block in watcher.ts following exact same pattern as templates middleware
- **Files modified:** `canvas/src/server/watcher.ts`
- **Commit:** 45d429c

## Self-Check: PASSED

All required files exist. All 3 task commits verified in git log.
