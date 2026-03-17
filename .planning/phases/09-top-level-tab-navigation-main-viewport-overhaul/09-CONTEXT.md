# Phase 10: App Navigation Overhaul — Icon Left Nav + Collapsible Chat Sidebar - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning
**Source:** Direct conversation with user

<domain>
## Phase Boundary

This phase restructures the canvas app's top-level layout from a flat sidebar+viewport arrangement to a proper navigation hierarchy:

1. **Slim icon-based left nav** — leftmost element, always visible
2. **Collapsible AI chat sidebar** — between left nav and main viewport
3. **Main viewport** — controlled by left nav selection
4. **Right content editor** — unchanged, stays on right side

The left nav replaces the current top-level navigation. The chat sidebar (existing PromptSidebar) is repositioned and made collapsible. Four viewport sections are wired up.

</domain>

<decisions>
## Implementation Decisions

### Left Nav
- Slim vertical icon bar, leftmost UI element, always visible
- Four main items: Campaigns, Templates, Patterns, Voice Guide
- Each item is an icon with hover tooltip revealing the name
- AI Chat toggle icon at the bottom of the left nav (separate from the 4 main items)
- Clicking a nav item switches the main viewport content

### AI Chat Sidebar
- This is the existing PromptSidebar (prompt input, stream output, session list) — repositioned, not rebuilt
- Lives between left nav and main viewport
- Collapsible — toggled via the bottom icon in the left nav
- When collapsed, main viewport expands to fill the space
- Persists across all nav tabs (not affected by viewport switching)

### Campaigns Viewport
- Exactly the existing drill-down views (CampaignDashboard, DrillDownGrid, etc.)
- Breadcrumbs move into the main viewport area (not in top-level nav anymore)
- Breadcrumb styling: smaller text (0.8125rem, #666, 400 weight, cursor pointer, 4px padding, 4px border-radius, max-width 160px, ellipsis overflow)
- Current view title: existing header style (1rem, 600 weight, white, -0.01em letter-spacing, Inter)
- Nothing else changes about the drill-down behavior

### Templates Viewport
- Render /Users/cheyrasmussen/Fluid-DesignOS/templates/index.html as-is inside the main viewport
- Use iframe embedding for now

### Patterns Viewport
- Render /Users/cheyrasmussen/Fluid-DesignOS/patterns/index.html as-is inside the main viewport
- Use iframe embedding for now

### Voice Guide Viewport
- Copy markdown docs from '/Users/cheyrasmussen/Downloads/Fluid Knowledge Base and Messaging 2026 Master' into a repo folder (e.g., voice-guide/ at root)
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

</decisions>

<specifics>
## Specific Ideas

- Layout order: [slim icon nav] → [collapsible chat sidebar] → [main viewport] → [right content editor]
- The right sidebar (ContentEditor) is unchanged and stays on the right
- Chat sidebar is always available regardless of which nav item is selected
- Templates and Patterns use iframe embedding (simplest path, these are standalone HTML pages)
- Voice Guide needs actual markdown rendering with rich text output

</specifics>

<deferred>
## Deferred Ideas

- Templates/Patterns integration beyond iframe (future: native React rendering)
- Voice Guide editing capabilities (currently read-only)
- Search within Voice Guide documents
- Mobile/responsive layout adjustments

</deferred>

---

*Phase: 10-top-level-tab-navigation-main-viewport-overhaul*
*Context gathered: 2026-03-13 via direct conversation*
