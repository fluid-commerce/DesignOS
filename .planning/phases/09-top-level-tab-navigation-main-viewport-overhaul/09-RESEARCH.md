# Phase 10: App Navigation Overhaul — Icon Left Nav + Collapsible Chat Sidebar - Research

**Researched:** 2026-03-13
**Domain:** React layout restructuring, icon nav, collapsible panels, markdown rendering
**Confidence:** HIGH

## Summary

This phase restructures the canvas app's top-level layout from the current flat [chat sidebar | main viewport | content editor] arrangement into a four-zone layout: [icon nav | collapsible chat sidebar | main viewport | content editor]. The primary challenge is replacing AppShell.tsx and wiring a new nav dimension into the existing Zustand store without disrupting the established campaign drill-down, right sidebar, and generation flow.

The secondary challenge is the Voice Guide viewport — rendering 14 markdown documents from a new `voice-guide/` folder with a vertical side-tab selector. No markdown library currently exists in the project, so one must be chosen and installed.

The existing codebase is well-suited to this change. AppShell is a single self-contained layout component (312 lines). The Zustand campaign store already tracks `leftSidebarOpen` / `rightSidebarOpen` and the navigation pattern (four views switching content) is the same pattern used by the existing campaign drill-down. New store state for `activeNavTab` and `chatSidebarOpen` can be added cleanly.

**Primary recommendation:** Replace AppShell with a new four-zone layout that introduces `LeftNav` (icon strip, ~52px wide) and repositions the existing PromptSidebar as the `ChatSidebar`. Add `activeNavTab` to the campaign store. Build Voice Guide as a new `VoiceGuide.tsx` viewport component with inline side-tabs and `react-markdown` for rendering.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Left Nav
- Slim vertical icon bar, leftmost UI element, always visible
- Four main items: Campaigns, Templates, Patterns, Voice Guide
- Each item is an icon with hover tooltip revealing the name
- AI Chat toggle icon at the bottom of the left nav (separate from the 4 main items)
- Clicking a nav item switches the main viewport content

#### AI Chat Sidebar
- This is the existing PromptSidebar (prompt input, stream output, session list) — repositioned, not rebuilt
- Lives between left nav and main viewport
- Collapsible — toggled via the bottom icon in the left nav
- When collapsed, main viewport expands to fill the space
- Persists across all nav tabs (not affected by viewport switching)

#### Campaigns Viewport
- Exactly the existing drill-down views (CampaignDashboard, DrillDownGrid, etc.)
- Breadcrumbs move into the main viewport area (not in top-level nav anymore)
- Breadcrumb styling: smaller text (0.8125rem, #666, 400 weight, cursor pointer, 4px padding, 4px border-radius, max-width 160px, ellipsis overflow)
- Current view title: existing header style (1rem, 600 weight, white, -0.01em letter-spacing, Inter)
- Nothing else changes about the drill-down behavior

#### Templates Viewport
- Render `/Users/cheyrasmussen/Fluid-DesignOS/templates/index.html` as-is inside the main viewport
- Use iframe embedding for now

#### Patterns Viewport
- Render `/Users/cheyrasmussen/Fluid-DesignOS/patterns/index.html` as-is inside the main viewport
- Use iframe embedding for now

#### Voice Guide Viewport
- Copy markdown docs from `/Users/cheyrasmussen/Downloads/Fluid Knowledge Base and Messaging 2026 Master` into a repo folder (e.g., `voice-guide/` at root)
- 14 markdown documents currently
- Vertical side-tabs on the left of the viewport, one per document
- Main area renders the selected markdown as rich text (not raw markdown)
- Build a markdown renderer (not iframe — actual rendered markdown)

### Claude's Discretion
- Icon choices for nav items (should be clear/intuitive)
- Left nav width (should be slim — ~48-56px range)
- Chat sidebar collapse animation (if any)
- Voice Guide side-tab styling and width
- Markdown rendering library choice (or hand-rolled)
- How to handle the transition from current AppShell layout to new layout
- Mobile/responsive behavior (not specified — desktop-first is fine)

### Deferred Ideas (OUT OF SCOPE)
- Templates/Patterns integration beyond iframe (future: native React rendering)
- Voice Guide editing capabilities (currently read-only)
- Search within Voice Guide documents
- Mobile/responsive layout adjustments
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19 (already installed) | Component framework | Already in project |
| Zustand | ^5 (already installed) | State — nav tab + chat sidebar open state | Already used for all layout state in this project |
| react-markdown | ^9.x | Markdown to React tree rendering | Zero-dependency approach for rich text rendering from .md files; maintained, widely used, no bundler friction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| remark-gfm | ^4.x | GitHub Flavored Markdown (tables, strikethrough) | Voice Guide docs likely use GFM syntax |

### Not Needed
- No routing library — viewport switching is pure state (`activeNavTab`), same pattern as existing `currentView` in campaign store
- No animation library — CSS `width` transition (already used for left/right sidebars) is sufficient for chat sidebar collapse

### Installation
```bash
cd /Users/cheyrasmussen/Fluid-DesignOS/canvas
npm install react-markdown remark-gfm
```

---

## Architecture Patterns

### New Layout Zone Order
```
[LeftNav 52px] → [ChatSidebar 280px, collapsible] → [MainViewport flex-1] → [ContentEditor 320px, collapsible]
```

All four zones are siblings in the body `<div style={{ display: 'flex' }}>`. The existing header is removed (breadcrumbs move into the campaigns viewport). The `LeftNav` and `ContentEditor` are always present; `ChatSidebar` animates width between 280px and 0.

### Recommended Project Structure Changes
```
canvas/src/
├── components/
│   ├── AppShell.tsx         # REPLACE — new four-zone shell, no header
│   ├── LeftNav.tsx          # NEW — icon strip with tooltip items + chat toggle
│   ├── ChatSidebar.tsx      # NEW — thin wrapper around existing PromptSidebar
│   ├── VoiceGuide.tsx       # NEW — vertical side-tabs + markdown renderer
│   ├── Breadcrumb.tsx       # KEEP unchanged — just moves into viewport header
│   └── ... (all others unchanged)
├── store/
│   └── campaign.ts          # EXTEND — add activeNavTab, chatSidebarOpen
voice-guide/                 # NEW — 14 .md files copied from Downloads
```

### Pattern 1: Nav Tab State in Zustand Campaign Store
**What:** Add `activeNavTab: 'campaigns' | 'templates' | 'patterns' | 'voice-guide'` and `chatSidebarOpen: boolean` to the existing `CampaignStore`.
**When to use:** All layout state already lives in campaign store (`leftSidebarOpen`, `rightSidebarOpen`). Keeping it co-located avoids a new store.
**Example:**
```typescript
// In campaign.ts — extend the interface:
type NavTab = 'campaigns' | 'templates' | 'patterns' | 'voice-guide';

interface CampaignStore {
  // ... existing fields ...
  activeNavTab: NavTab;
  chatSidebarOpen: boolean;
  setActiveNavTab: (tab: NavTab) => void;
  toggleChatSidebar: () => void;
}

// Initial state:
activeNavTab: 'campaigns',
chatSidebarOpen: true,

// Actions:
setActiveNavTab: (tab) => set({ activeNavTab: tab }),
toggleChatSidebar: () => set((s) => ({ chatSidebarOpen: !s.chatSidebarOpen })),
```

### Pattern 2: LeftNav Component
**What:** Stateless icon strip. Renders 4 nav items (icons + hover tooltip) and a bottom chat toggle icon. Calls `setActiveNavTab` and `toggleChatSidebar` from store.
**When to use:** Always visible, no collapse behavior of its own.
**Example:**
```typescript
// LeftNav.tsx — simplified structure
const NAV_ITEMS = [
  { id: 'campaigns', label: 'Campaigns', icon: <GridIcon /> },
  { id: 'templates', label: 'Templates', icon: <LayoutIcon /> },
  { id: 'patterns', label: 'Patterns', icon: <SwatchIcon /> },
  { id: 'voice-guide', label: 'Voice Guide', icon: <BookIcon /> },
] as const;

// Each item renders a <button> with title={label} for native browser tooltip
// Active tab: border-left: 2px solid #44B2FF (brand blue accent)
// Width: 52px, border-right: 1px solid #1e1e1e
```

### Pattern 3: iframe Serving for Templates + Patterns
**What:** The `templates/index.html` and `patterns/index.html` files are served by Vite from the project root. To render them inside the app, use a same-origin `<iframe src="/templates/" />` with `width: 100%; height: 100%; border: none`.
**When to use:** Both Templates and Patterns viewports.
**Important:** Vite must serve these static HTML files. Check that `templates/` and `patterns/` directories exist at the project root and are accessible. If not already served, add a Vite static serve config or use the existing Vite middleware.

**Vite static file serving:** Vite automatically serves files from the `public/` folder. Files outside `public/` (like `templates/` and `patterns/` at the repo root) need explicit configuration or a middleware.

**Current situation:** The existing `watcher.ts` server already rewrites asset paths for templates. The Vite config may already serve these. Verify before adding config.

```typescript
// Templates viewport — just an iframe
<iframe
  src="/templates/"
  style={{ width: '100%', height: '100%', border: 'none' }}
  title="Template Library"
/>
```

### Pattern 4: VoiceGuide Component
**What:** Reads 14 `.md` files from `voice-guide/` directory, renders a vertical tab list on the left, and the selected document as rich text on the right using `react-markdown`.
**When to use:** Voice Guide viewport.

**File loading approach:** Import `.md` files as raw strings using Vite's `?raw` import suffix (already supported by Vite, no plugin needed).

```typescript
// Static imports using Vite raw imports — no server roundtrip needed
import appRepToolsMd from '../../../voice-guide/App_Rep_Tools.md?raw';
// ... 14 imports total

const DOCS = [
  { id: 'app-rep-tools', label: 'App Rep Tools', content: appRepToolsMd },
  { id: 'builder', label: 'Builder', content: builderMd },
  // ...
];
```

**react-markdown usage:**
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {selectedDoc.content}
</ReactMarkdown>
```

**Side-tab layout:**
```
[side-tabs 160px | flex-shrink: 0] → [markdown content area flex-1 | overflow-y: auto | padding: 2rem]
```
Side-tabs: `display: flex; flex-direction: column;` with `border-right: 1px solid #1e1e1e`. Active tab: `background: #1a1a1e; color: #fff; border-left: 2px solid #44B2FF`.

### Pattern 5: AppShell Replacement
**What:** New AppShell drops the 52px header, renders four zones in a horizontal flex. Breadcrumb is no longer in AppShell — it renders inside the Campaigns viewport header (already exists in the viewport content in App.tsx for campaign drill-down views).
**Layout:**
```
<div style={{ display: 'flex', height: '100vh' }}>
  <LeftNav />                       // 52px, always visible
  <ChatSidebar />                   // collapsible width, PromptSidebar inside
  <main style={{ flex: 1 }}>       // viewport content
    {renderViewportContent()}
  </main>
  <aside>                           // ContentEditor, unchanged
    {rightSidebar}
  </aside>
</div>
```

### Anti-Patterns to Avoid
- **Rebuilding PromptSidebar:** User locked: reposition only, do not rebuild. Wrap it in `ChatSidebar.tsx` thin wrapper that applies width transition.
- **Multiple stores for nav state:** Keep `activeNavTab` and `chatSidebarOpen` in existing `CampaignStore`. Avoids prop drilling and keeps all layout state co-located.
- **Dynamic `import()` for markdown files:** Adds async complexity unnecessarily. Vite `?raw` static imports are simpler and produce no loading state.
- **Passing breadcrumb down through layers:** Breadcrumb already reads from Zustand directly — it renders fine anywhere in the tree. No prop changes needed.
- **Removing the existing `leftSidebarOpen` / `toggleLeftSidebar` state:** These are still referenced inside AppShell for the old chat sidebar. The rename to `chatSidebarOpen` should be done cleanly — the old names are no longer meaningful but any tests referencing them must be updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing + rendering | Custom MD parser or regex-based renderer | `react-markdown` + `remark-gfm` | Handles edge cases: nested lists, code blocks, tables, images, inline HTML; ~13KB gzipped |
| Tooltip on nav icons | Absolute-positioned div with JS show/hide | HTML `title` attribute (native browser tooltip) | Zero code, accessible, sufficient for a slim nav at 52px width |
| Static file serving for iframes | Express route reading files from disk | Vite's built-in static file serving | Already established in this project; no new server code needed |

**Key insight:** The markdown rendering problem looks simple but has many edge cases (code blocks with language hints, GFM tables, nested blockquotes). `react-markdown` handles all of these with two dependencies.

---

## Common Pitfalls

### Pitfall 1: iframe src path resolution for Templates/Patterns
**What goes wrong:** The Templates (`templates/index.html`) and Patterns (`patterns/index.html`) files live at the repo root, not in `canvas/public/`. A naive `<iframe src="/templates/" />` will 404 because Vite only auto-serves `canvas/public/` by default.
**Why it happens:** Vite's dev server root is `canvas/` — files outside are not automatically accessible.
**How to avoid:** Check the Vite config for existing static middleware. If not present, add a Vite plugin that serves `../templates/` and `../patterns/` from the canvas dev server. Alternatively, add a symlink in `canvas/public/` pointing to the directories.
**Warning signs:** iframe shows blank or 404 during dev.

**Investigation needed:** Read `canvas/vite.config.ts` to confirm whether static middleware already handles this. The STATE.md notes Jonathan added path-rewriting middleware in `watcher.ts` — check if it already covers these paths.

### Pitfall 2: Renaming leftSidebarOpen breaks existing tests
**What goes wrong:** The campaign store has `leftSidebarOpen`, `toggleLeftSidebar`, `setRightSidebarOpen`. Tests in `campaign-store.test.ts` reference these. Renaming to `chatSidebarOpen` breaks tests silently if they still compile via TypeScript structural typing.
**Why it happens:** Zustand store changes are not type-checked at test boundaries.
**How to avoid:** Search all test files for `leftSidebarOpen` and `toggleLeftSidebar` and update them. Or keep the old names as aliases during migration.
**Warning signs:** Tests pass but refer to stale state names.

### Pitfall 3: Vite raw imports for .md files require tsconfig allowance
**What goes wrong:** TypeScript doesn't know the type of `import foo from './file.md?raw'` — it resolves to `any` or errors depending on tsconfig.
**Why it happens:** Vite handles `?raw` at the bundler level, not TypeScript level.
**How to avoid:** Add a declaration to `vite-env.d.ts`:
```typescript
// canvas/src/vite-env.d.ts — add:
declare module '*.md?raw' {
  const content: string;
  export default content;
}
```
**Warning signs:** TypeScript error `Cannot find module '*.md?raw'`.

### Pitfall 4: Header removal orphans the "New Asset" button
**What goes wrong:** The current AppShell header contains the "New Asset" button (rendered when `onNewAsset` callback is provided). Removing the header means this button has no home.
**Why it happens:** The button lives in AppShell header, which is being removed.
**How to avoid:** The "New Asset" button should move into the Campaigns viewport header area (the breadcrumb bar area that already exists in App.tsx for the campaign view). Plan for this relocation explicitly.

### Pitfall 5: Chat sidebar width transition disrupts ContentEditor
**What goes wrong:** When the chat sidebar collapses, the `main` and `ContentEditor` flex-grow to fill the space. If ContentEditor has a fixed pixel width, this can cause layout jumps.
**Why it happens:** CSS flex layout redistributes space from collapsing element.
**How to avoid:** Keep ContentEditor as a fixed-width `aside` with `flexShrink: 0`. The `main` area should have `flex: 1; min-width: 0` to absorb the space change cleanly.

---

## Code Examples

### Voice Guide file list (14 documents confirmed)
```
App_Rep_Tools.md
Builder.md
Checkout.md
Corporate_Tools.md
Droplets.md
FairShare.md
Fluid_Connect.md
Fluid_Payments.md
The_Problem_Were_Solving.md
Voice_and_Style_Guide.md
What_is_Blitz_Week.md
What_Is_Fluid.md
Why_WeCommerce_Exists.md
(13 .md files — 1 .docx excluded, not renderable)
```
Note: `Fluid Marketing Messaging Exploration and Ideas.docx` should be excluded (not renderable as markdown).

### Vite-env.d.ts addition for .md?raw imports
```typescript
// canvas/src/vite-env.d.ts
/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}
```

### Store extension (campaign.ts additions)
```typescript
export type NavTab = 'campaigns' | 'templates' | 'patterns' | 'voice-guide';

// In interface:
activeNavTab: NavTab;
chatSidebarOpen: boolean;
setActiveNavTab: (tab: NavTab) => void;
toggleChatSidebar: () => void;

// In initial state:
activeNavTab: 'campaigns',
chatSidebarOpen: true,

// In actions:
setActiveNavTab: (tab) => set({ activeNavTab: tab }),
toggleChatSidebar: () => set((s) => ({ chatSidebarOpen: !s.chatSidebarOpen })),
```

### CSS width transition pattern (reuses existing AppShell pattern)
```typescript
// ChatSidebar wrapper — mirrors existing left sidebar pattern
<aside style={{
  width: chatSidebarOpen ? 280 : 0,
  flexShrink: 0,
  overflow: 'hidden',
  transition: 'width 0.2s ease',
  borderRight: chatSidebarOpen ? '1px solid #1e1e1e' : 'none',
}}>
  <PromptSidebar />
</aside>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Header bar with breadcrumb + wordmark | Breadcrumb moves into viewport, header removed | Phase 10 | Campaigns viewport needs its own top bar |
| PromptSidebar as "left sidebar" in AppShell | PromptSidebar wrapped as collapsible "chat sidebar", positioned after new icon nav | Phase 10 | Repositioned, not rebuilt |
| Single leftSidebarOpen flag | Separate chatSidebarOpen (collapsible chat) + activeNavTab (which viewport) | Phase 10 | More explicit state model |

**Deprecated/outdated in this phase:**
- `leftSidebarOpen` / `toggleLeftSidebar` in campaign store: rename to `chatSidebarOpen` / `toggleChatSidebar` for clarity (or add new and deprecate old)
- AppShell header (52px fixed height): removed; breadcrumb moves into Campaigns viewport

---

## Open Questions

1. **Vite static serving for `/templates/` and `/patterns/` iframes**
   - What we know: These HTML files live at the repo root, outside `canvas/public/`
   - What's unclear: Whether existing Vite middleware (`vite.config.ts` + `watcher.ts`) already serves these directories at `/templates/` and `/patterns/`
   - Recommendation: Read `canvas/vite.config.ts` (full file) and `canvas/server/watcher.ts` at plan time to confirm before writing the iframe task. If not served, Plan 01 should add a Vite static plugin entry.

2. **"New Asset" button relocation**
   - What we know: Button currently lives in AppShell header; header is being removed
   - What's unclear: Whether the button should move to the left nav (as a `+` icon), into the Campaigns viewport top bar, or be accessible only when on the Campaigns tab
   - Recommendation: User context says "Claude's discretion" — place it in the Campaigns viewport top bar next to the breadcrumb (consistent with campaign-scoped action). Only visible when on Campaigns tab and `activeCampaignId` is set.

3. **Keeping or retiring `leftSidebarOpen` naming**
   - What we know: Tests reference `leftSidebarOpen` and `toggleLeftSidebar`
   - What's unclear: Whether to rename or alias
   - Recommendation: Rename cleanly and update all test references. The old name is misleading post-overhaul. Document the rename explicitly in the plan task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 + @testing-library/react ^16 |
| Config file | `canvas/vitest.config.ts` |
| Quick run command | `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test -- --reporter=dot` |
| Full suite command | `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Left nav renders 4 tab items + chat toggle | unit | `npm test -- LeftNav` | Wave 0 |
| NAV-02 | Clicking nav item updates activeNavTab in store | unit | `npm test -- campaign-store` | Update existing |
| NAV-03 | Chat sidebar collapses/expands via toggle | unit | `npm test -- AppShell` | Wave 0 |
| NAV-04 | Campaigns viewport shows existing drill-down | integration | `npm test -- campaign-store` | Update existing |
| NAV-05 | Templates viewport renders iframe | unit | `npm test -- AppShell` | Wave 0 |
| NAV-06 | Patterns viewport renders iframe | unit | `npm test -- AppShell` | Wave 0 |
| NAV-07 | Voice Guide renders markdown content | unit | `npm test -- VoiceGuide` | Wave 0 |
| NAV-08 | Voice Guide side-tab switching changes displayed doc | unit | `npm test -- VoiceGuide` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test -- --reporter=dot`
- **Per wave merge:** `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `canvas/src/__tests__/LeftNav.test.tsx` — covers NAV-01, NAV-02
- [ ] `canvas/src/__tests__/VoiceGuide.test.tsx` — covers NAV-07, NAV-08
- [ ] `canvas/src/__tests__/AppShell.test.tsx` — covers NAV-03, NAV-05, NAV-06 (new AppShell structure)
- [ ] Update `canvas/src/vite-env.d.ts` — add `*.md?raw` module declaration

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `canvas/src/components/AppShell.tsx` — full layout structure confirmed
- Direct codebase inspection: `canvas/src/store/campaign.ts` — existing store fields and patterns
- Direct codebase inspection: `canvas/package.json` — confirmed no markdown library currently installed
- Direct codebase inspection: `canvas/vitest.config.ts` + `canvas/src/__tests__/` — confirmed test framework and existing tests
- Direct filesystem inspection: `Downloads/Fluid Knowledge Base and Messaging 2026 Master/` — confirmed 13 .md files + 1 .docx (14 total docs, 13 renderable)
- Vite documentation (knowledge): `?raw` suffix is a first-class Vite feature for importing files as strings, no plugin needed

### Secondary (MEDIUM confidence)
- `react-markdown` npm package: Well-known library, current major version is 9.x, supports React 18/19, uses remark pipeline. Confidence based on training knowledge; verify exact version at install time.
- `remark-gfm` npm package: Standard remark plugin for GFM syntax. Version 4.x compatible with remark-markdown v9. Verify at install time.

### Tertiary (LOW confidence)
- None — all critical claims are backed by direct codebase inspection or well-established Vite/React patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing deps confirmed by direct inspection; react-markdown recommendation is well-established
- Architecture: HIGH — based on direct reading of AppShell, campaign store, and App.tsx
- Pitfalls: HIGH — iframe path pitfall confirmed by codebase structure (templates/ at repo root, not in public/); others based on direct code inspection

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable React/Vite ecosystem; react-markdown API is stable)
