# Phase 8: AI Sidebar to Campaign Dashboard End-to-End - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the AI sidebar's generation flow produce campaigns that actually appear in the campaign dashboard with visual previews, correct multi-asset structure, and working HTML paths at every navigation level. Currently the sidebar creates sessions on disk (.fluid/working/) but never writes to SQLite, so nothing appears in the dashboard. This phase bridges that gap end-to-end.

Does NOT include: chat UI redesign (Phase 9), asset linking/base64 refactor (Phase 4.2).

</domain>

<decisions>
## Implementation Decisions

### Data Path Unification
- **Server owns the bridge** — the Vite server intercepts generated HTML files and creates iteration records in SQLite. No dependency on the agent calling push_asset. Agent just writes HTML files; server handles all DB work.
- **Eliminate .fluid/working/** — all generated HTML lives at `.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html`. One canonical path, one source of truth. lineage.json becomes redundant (SQLite replaces it). Server creates the directory structure before spawning the agent.
- **Keep push_asset MCP for external agents** — server file watcher is the path for canvas-spawned agents. push_asset MCP tool remains for external agents (e.g., `/fluid-campaign` orchestrator subagents, standalone `/fluid-social` from CLI). Both create iteration records in SQLite + HTML on disk.
- **"HTML not found on disk" fix** — ensure htmlPath in SQLite always points to the canonical .fluid/campaigns/ path, and the /api/iterations/:id/html endpoint resolves from there.

### Campaign Structure from a Prompt
- **Default full spread, overridable** — every campaign gets Instagram (3 variations) + LinkedIn (3 variations) + one-pager (1) = 7 assets by default. User can mention specific channels to narrow it (e.g., "just a LinkedIn post" = only LinkedIn). Orchestrator infers intent from prompt.
- **Each variation = separate Asset** — 3 Instagram posts = 3 Assets, each with 1 Frame and 1 Iteration. Campaign > Assets grid shows all variations side-by-side with previews.
- **Server pre-creates the structure** — server creates Campaign + Assets + Frames in SQLite BEFORE spawning the agent. Server handles structure (how many, what types). Agent handles creative direction (angles, messaging, design).
- **Agent renames assets after generating** — server creates generic titles ("Instagram Post 1", etc.). Agent calls an API to rename each asset based on what it actually created.
- **Parallel generation via subagents** — spawn separate subagents for each asset, all generating simultaneously. Matches existing orchestrator pattern.
- **Templates as references** — agent sees template library and uses them as 5-star examples (consistent with SOCL-07). Different variations can use different templates.

### Multi-Asset Campaign Flows
- **Add to existing campaign** — when viewing a campaign, the sidebar context switches to "Add to [Campaign Name]". New assets attach to the existing campaign instead of creating a new one.
- **Same iterate flow, campaign-aware** — star a winner, type feedback, hit Iterate. Iterations stored as new Iteration records in SQLite under the same Frame (not round directories on disk).
- **Per-asset status badges** — dashboard shows each asset with a status badge (pending/generating/complete) so user can see which channels are done vs still working.

### Preview Rendering
- **Mosaic previews on campaign dashboard cards** — each campaign card shows a 2x2 grid of small iframe thumbnails from the campaign's first 4 assets. '+N more' badge if more.
- **Full iframe preview on asset cards** — at campaign detail level, each asset card shows iframe preview of latest iteration's HTML, scaled to fit the grid. Fulfills MRGR-06.
- **Previews at every navigation level** — campaign (mosaic), asset (full iframe), frame (full iframe), iteration (full iframe). No metadata-only cards anywhere.

### Post-Generation Navigation
- **Auto-navigate to campaign view** — once generation completes, automatically switch the main view to show the new campaign's assets with previews. User sees results immediately.
- **campaignId streamed back via SSE** — server sends campaignId in the session event so the client knows where to navigate on completion.

### Claude's Discretion
- Exact subagent prompt construction for parallel generation
- How the agent determines creative angles for each variation
- Loading skeleton / progress indicators during generation
- Error handling when individual asset generation fails (partial campaign)
- Template selection logic per variation
- Empty state treatment for assets still generating
- Auto-refresh mechanism for dashboard during generation (polling vs SSE)

</decisions>

<specifics>
## Specific Ideas

- "It should have created the campaign so that it had a full range of assets by default. For social, both Instagram and LinkedIn. At least a few posts talking about it from different angles with different designs/using different templates."
- "Every asset should have just one iteration, not a whole bunch of iterations."
- "We really need to be seeing previews of the assets at every step."
- Server should NOT make creative decisions — it handles structure (counts, types), agent handles creativity (angles, messaging, design, naming).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **DrillDownGrid component**: Already supports iframe previews via `src` property on PreviewDescriptor. Currently only used at iteration level — needs wiring at campaign/asset/frame levels.
- **useCampaignStore**: Zustand store with full CRUD + navigation. Already has fetchCampaigns, fetchAssets, fetchFrames, fetchIterations.
- **/api/campaigns POST**: Already supports atomic creation with assets array via createCampaignWithAssets() in db-api.ts.
- **useGenerationStream hook**: SSE streaming from /api/generate — already captures sessionId, recently extended to capture campaignId.
- **/fluid-campaign orchestrator skill**: Exists from Phase 7 — takes a brief, decomposes into per-channel tasks. Not yet wired to sidebar.
- **push_asset MCP tool**: Exists, creates iterations via HTTP API + writes HTML to disk. Keep for external agent usage.

### Established Patterns
- Server-owned metadata: LLM never directly writes campaign records (Phase 4/7 decision)
- Vite middleware for all API endpoints (no separate Express server)
- DrillDownGrid's renderPreview callback: returns PreviewDescriptor with `src` (iframe) or `meta` (metadata card)
- createCampaignWithAssets() transaction for atomic multi-record creation
- Full-size iframe scale() pattern at every drill-down level (Phase 7 decision)

### Integration Points
- **watcher.ts /api/generate handler** (line ~477): Where campaign structure creation needs to happen, before spawning claude. Currently has a bridge but needs refactoring to eliminate .fluid/working/.
- **App.tsx renderAssetPreview / renderFramePreview**: Currently return metadata-only PreviewDescriptors — need to return iframe src instead.
- **CampaignDashboard.tsx**: Campaign cards need mosaic preview rendering.
- **/api/iterations/:id/html**: Existing HTML serving endpoint — needs htmlPath to resolve correctly from campaigns/ path.

</code_context>

<deferred>
## Deferred Ideas

- **Progressive loading during generation** — showing asset previews as they complete (before all 7 are done) rather than waiting for full completion.
- **Campaign merging** — combining multiple campaigns into one.
- **Template customization by users** — duplicate and modify templates post-creation.

</deferred>

---

*Phase: 08-ai-sidebar-to-campaign-dashboard-end-to-end*
*Context gathered: 2026-03-12*
