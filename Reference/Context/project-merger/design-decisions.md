# Design Decisions Log

Explicit decisions made during merger planning. These are binding unless revisited.

## Hierarchy & Terminology

- **Data hierarchy**: Campaign > Asset > Frames > Iterations
- **"Frames"** is the default name for sub-items within an asset (e.g., individual slides of a carousel). The name may vary by asset type in the future, but that's out of scope for the merger.
- **Iterations live at the Frame level** — each Frame has its own revision history.

## Navigation & Drill-Down

- **Consistent drill-down pattern**: Campaign grid > Asset grid > Frame grid (if applicable) > Iteration grid
- Same visual paradigm at every level — grids of thumbnails, click to go deeper
- **Selecting an iteration** opens Jonathan's right sidebar editor for that iteration
- **Breadcrumbs + back button** for navigation: breadcrumb trail at top (e.g., `Campaign / Asset / Frame 3 / Iteration 2`) for jumping to any level, plus a back button for one-level-up
- **Campaign grid view**: Grid/gallery of asset thumbnails. **FLAG**: Update this decision as needed when Jonathan's codebase is fully analyzed by an agent.

## Header & App Shell

- **Minimal header**: Logo/branding + breadcrumb navigation only
- Must feel like a **web app** (contained, navigable) not a standalone page
- Visual polish comes from Jonathan's design language

## AI Chat & Right Sidebar

- **Independent workflows, shared data**: AI chat (left sidebar) generates/iterates. Right sidebar is for manual edits. They don't directly control each other.
- **Shared underlying data**: When AI creates a new iteration, the right sidebar reflects that iteration's state if selected. They stay in sync through the data layer, not through direct coupling.
- **AI is always-available collaborator, never required**: Users can generate a full campaign with one prompt, build everything manually, or any mix. AI can be introduced at any point in any workflow.

## Manual Edits & Iterations

- **Manual edits do NOT create new iterations** — they modify the current iteration in-place.
- **Only AI generations create new iterations.**
- **Baseline tracking**: The system must remember the original AI-generated state of each iteration vs. what the user manually changed. This diff data feeds the learning loop ("here's what AI produced vs. what the user preferred").

## Campaign Generation

- **AI can generate entire campaigns from a single prompt** — creates multiple assets with frames.
- After generation, user lands directly in the **campaign grid view** — no wizard, no review screen, no friction.

## Tech Stack

- **Rebuild Jonathan's UI in Chey's stack**, preserving his design patterns, UX flows, and visual polish faithfully.
- Jonathan's system is vanilla JS + HTML/CSS with iframe-based rendering and postMessage IPC. The merger does NOT keep this stack — it gets rebuilt, but the patterns and design are preserved.

## Templates

- **Templates are curated, not AI-generated.** Developers add templates by hand.
- **Jonathan's 8 templates are source of truth** for social media asset templates.

## Scope

- **Full feature parity** is the goal of the initial merger: campaigns, carousels, templates, AI generation, iteration tracking, feedback loop, all working end-to-end.
- **No phased rollout** — ship the complete merged product.
- **Single user** — no multi-user or collaboration features for the merger.

## Exports

- **Same as Jonathan's**: JPG, WebP, HTML code download. No new formats for the merger.

## Preserved As-Is

- **Canvas MCP integration** stays wired up — the fluid-canvas tools remain connected.
- **Brush/transform system**: Keep Jonathan's single-brush-per-template approach. One movable element per template. Evolve post-merger.
- **Chey's iteration view** becomes the deepest level of the drill-down (Campaigns > Assets > Frames > *Iterations*).

## Out of Scope

- Lane Fluid Sandbox (duplicate reference material — ignore)
- Per-asset-type Frame naming (use "Frames" universally for now)
- Multi-user/collaboration
- New export formats
- Expanding brush/transform to multiple elements
- AI-generated templates

## Research Items

See [[research-needed]] for items that need technical investigation.
