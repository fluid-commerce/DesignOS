# Phase 7: Merge Jonathan's Codebase into Fluid DesignOS - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild Jonathan's content creation tool (template library, content editor, campaign management, carousel support, DAM integration) inside Chey's existing React/Vite/Zustand canvas app. Creates a unified creative workspace where AI generation and manual editing share the same interface and data model. Jonathan's vanilla JS/iframe/postMessage architecture is NOT preserved — his UI patterns, visual polish, and UX flows are faithfully reproduced in Chey's stack.

**Merger direction:** Jonathan's project merges INTO Chey's Fluid Design OS. Chey's system is the foundation; Jonathan's UI becomes the visual/interaction layer rebuilt natively.

**Guiding principle:** AI is always-available, never required. Users can generate entire campaigns with a single prompt, build everything manually from templates, or any mix. The editing experience is identical for template-based and AI-generated assets.

</domain>

<decisions>
## Implementation Decisions

### Data Model & Persistence

- **SQLite for all metadata** via better-sqlite3 (sync, no ORM). Thin API layer — agents and MCP tools go through endpoints, not direct file writes. Solves the fragility of scattered JSON files being inconsistently edited by LLMs.
- **HTML variations stay on disk**, referenced by path in the database. SQLite owns the Campaign > Asset > Frame > Iteration hierarchy, annotations, statuses, and baseline diff tracking.
- **Start fresh** — no migration of existing `.fluid/working/` session data. Old sessions are archived/accessible but not converted to the new model. New campaign model designed without backward compatibility constraints.
- **Data hierarchy:** Campaign > Asset > Frame > Iteration. Frames are sub-items within an asset (carousel slides, or a single frame for single-image assets). Each Frame has its own independent iteration history. Only AI generations create new iterations; manual edits modify in-place. Baseline diff tracking stores AI-generated original vs user-modified state per iteration.

### Navigation & App Shell

- **Unified dashboard** — campaigns are the primary organizing unit. Single view with filter/sort by content type, not separate tabs per content type. No sub-tabs (Templates / Creations / Campaigns).
- **Collapsible sidebars** — left sidebar (AI chat) and right sidebar (content editor) can both collapse to icons. Default: left open, right closed until an iteration is selected. User controls screen real estate.
- **Full-size previews at every drill-down level** — not thumbnail grids. Reuse the existing VariationGrid component pattern (iframes at native dimensions in a responsive grid) at every level: campaigns show assets, assets show frames, frames show iterations. Same visual paradigm throughout.
- **Breadcrumb navigation** at top for jumping to any level (Campaign / Asset / Frame 3 / v2). Back button for one-level-up. Transition details are Claude's discretion.
- **Templates live inside the 'New' creation flow** — not a persistent top-level section. Template gallery appears when creating a new asset (+ button or AI prompt). Follows the existing Gallery > Customizer path pattern.
- **No brand reference bar** — brand rules are enforced by the agent pipeline and spec-check, not shown to users. Keeps UI clean.
- **Header mirrors Jonathan's visual design** — use his typography, spacing, badge style, and overall polish as the reference. Adapted for unified dashboard context (no content-type tabs).

### Content Editor & Template System

- **Keep iframe sandboxing** — templates and AI-generated assets render in iframes (existing AssetFrame pattern). CSS isolation, proven in both systems, html2canvas export compatibility.
- **Layout subagent emits slot schema** — the layout subagent writes a field definition schema (selectors, field types, labels) alongside the HTML output. The right sidebar reads this schema to build its editor fields. Post-processing extracts current values from the iframe via those selectors. This applies to BOTH template-based and AI-generated assets.
- **Feature parity between templates and AI-generated assets** — same editing experience regardless of how the asset was created. If templates support brush/transform, AI assets do too (layout subagent designates movable element in its slot schema). Photo repositioning, content slot editing, export — all identical.
- **Developer-curated, locked templates** — Jonathan's 8 templates are source of truth for social media. Users create FROM templates but can't modify template definitions. New templates added by developers only.
- **Jonathan's UI patterns faithfully preserved** — right sidebar content slot fields, photo repositioning (Fit/Fill + focus point), brush/transform controls (one movable element, SVG overlay with drag/rotate/scale), carousel slide selector, export actions (JPG, WebP, HTML).

### Campaign & Multi-Channel Generation

- **Full multi-channel campaigns (Jonathan's vision)** — campaign creation includes channel selection across Instagram, LinkedIn, Blog, One Pager. System generates options across all selected channels.
- **Campaign orchestrator skill** — new top-level skill (e.g., /fluid-campaign) takes a brief, decomposes into per-channel generation tasks, dispatches to existing skill pipelines (fluid-social, fluid-one-pager, etc.). One prompt generates everything.
- **5 fixed option slots per channel** — matching Jonathan's UI design. Empty slots are fine. No per-channel count configuration.
- **DAM integration: merge everything Jonathan has built** — both UI elements (Fluid DAM indicator, Browse Assets button, file attachment flow) AND any backend/integration code. Wire up what's functional, preserve the rest as working scaffolding ready to connect. Nothing Jonathan built gets left behind.
- **Carousel support** — multi-frame assets with per-frame iteration history. Slide selector in right sidebar for quick frame switching. All carousel editing UX from Jonathan's system preserved.

### Claude's Discretion

- Exact SQLite schema design and data access layer implementation
- Breadcrumb transition animations (or lack thereof)
- Sidebar collapse/expand animations and icon design
- Carousel navigation UX details (prev/next, keyboard support, page indicators)
- Export implementation specifics (html2canvas configuration, quality settings)
- How the brief-to-prompt bridge works (Jonathan's "Generate Prompt" → Chey's skill pipeline)
- Error states, loading skeletons, empty states throughout the drill-down

</decisions>

<specifics>
## Specific Ideas

- Jonathan's header design is the visual reference for the merged product's header — his typography, spacing, badge styling, and overall polish
- The VariationGrid responsive iframe pattern (from the current canvas) is reused at every drill-down level for visual consistency
- Layout subagent is responsible for emitting the slot schema that drives the right sidebar — this is the bridge between AI generation and manual editing
- "I want the same functionalities to be shared by templates and AI-generated assets. The end experience should be the same — this enables humans to better collaborate with the AI on iterating."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AssetFrame component** (canvas/src/components/): iframe renderer already handling native dimensions, can be extended for content slot editing
- **VariationGrid component**: responsive grid of AssetFrames — reuse at every drill-down level
- **Zustand stores** (sessions, generation, annotations): patterns for the new campaign/asset/frame stores
- **MCP tools** (push_asset, read_annotations, read_statuses, read_history, read_iteration_request): need to be rewired to use SQLite API instead of direct file access
- **useGenerationStream hook**: SSE streaming for Claude CLI generation — reuse for campaign orchestrator
- **stream-parser**: NDJSON parsing from Claude CLI output — reuse as-is
- **fluidWatcherPlugin**: Vite plugin for file watching — may need adaptation for SQLite-based model

### Established Patterns
- **Vite dev server with middleware plugin**: API endpoints served via Vite (no separate Express server)
- **Server-owned lineage**: LLM never directly reads/writes metadata — server handles atomically
- **Round-based iteration**: rounds[] array pattern for iteration history
- **Star-based winner UX**: toggle winner status, single-variation auto-infer

### Integration Points
- **MCP server** (canvas/mcp/server.ts): 5 tools need to be updated to use SQLite API
- **Vite middleware** (vite.config.ts): API endpoints for sessions, generation, annotations — all need campaign hierarchy
- **Skill orchestrators** (fluid-social, fluid-one-pager, fluid-theme-section): need campaign-aware output routing
- **context-bundler.ts**: builds iteration context payloads — needs campaign/frame context

### Jonathan's Codebase (Reference/Context/Jonathan's Codebase/)
- **index.html**: Template gallery with 8 templates, design system reference bar
- **editor.html + editor.js**: Full editor with iframe preview, postMessage IPC, right sidebar, brush/transform
- **templates/**: 8 HTML template files (t1-quote through t8-quarterly-stats)
- **fonts/**: FLFont, Inter, NeueHaas custom fonts
- **Template config format**: JS objects with field definitions (type, selector, label, mode) — port to TypeScript

</code_context>

<deferred>
## Deferred Ideas

- **Expanding brush/transform to multiple elements** — currently one movable element per template. Post-merger enhancement.
- **AI-generated templates** — templates are developer-curated only for now. AI template generation could be a future phase.
- **Per-asset-type Frame naming** — use "Frames" universally. Custom naming (slides, pages, etc.) is post-merger.
- **Multi-user / collaboration** — single user scope for the merger.
- **New export formats** — stick with JPG, WebP, HTML for now.
- **Template customization by users** — duplicate and modify templates is a post-merger feature.

</deferred>

---

*Phase: 07-merge-jonathan-s-codebase-into-fluid-designos*
*Context gathered: 2026-03-12*
