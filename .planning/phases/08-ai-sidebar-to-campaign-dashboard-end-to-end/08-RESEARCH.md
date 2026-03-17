# Phase 8: AI Sidebar to Campaign Dashboard End-to-End - Research

**Researched:** 2026-03-12
**Domain:** TypeScript / React / Vite middleware / SQLite / SSE / multi-asset orchestration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Path Unification**
- Server owns the bridge — the Vite server intercepts generated HTML files and creates iteration records in SQLite. No dependency on the agent calling push_asset. Agent just writes HTML files; server handles all DB work.
- Eliminate .fluid/working/ — all generated HTML lives at `.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html`. One canonical path, one source of truth. lineage.json becomes redundant (SQLite replaces it). Server creates the directory structure before spawning the agent.
- Keep push_asset MCP for external agents — server file watcher is the path for canvas-spawned agents. push_asset MCP tool remains for external agents (e.g., /fluid-campaign orchestrator subagents, standalone /fluid-social from CLI). Both create iteration records in SQLite + HTML on disk.
- "HTML not found on disk" fix — ensure htmlPath in SQLite always points to the canonical .fluid/campaigns/ path, and the /api/iterations/:id/html endpoint resolves from there.

**Campaign Structure from a Prompt**
- Default full spread, overridable — every campaign gets Instagram (3 variations) + LinkedIn (3 variations) + one-pager (1) = 7 assets by default. User can mention specific channels to narrow it.
- Each variation = separate Asset — 3 Instagram posts = 3 Assets, each with 1 Frame and 1 Iteration.
- Server pre-creates the structure — server creates Campaign + Assets + Frames in SQLite BEFORE spawning the agent.
- Agent renames assets after generating — server creates generic titles ("Instagram Post 1", etc.). Agent calls an API to rename each asset based on what it actually created.
- Parallel generation via subagents — spawn separate subagents for each asset, all generating simultaneously.
- Templates as references — agent sees template library and uses them as 5-star examples.

**Multi-Asset Campaign Flows**
- Add to existing campaign — when viewing a campaign, the sidebar context switches to "Add to [Campaign Name]".
- Same iterate flow, campaign-aware — star a winner, type feedback, hit Iterate. Iterations stored as new Iteration records under the same Frame.
- Per-asset status badges — dashboard shows each asset with a status badge (pending/generating/complete).

**Preview Rendering**
- Mosaic previews on campaign dashboard cards — 2x2 grid of small iframe thumbnails from first 4 assets. '+N more' badge if more.
- Full iframe preview on asset cards — each asset card shows iframe preview of latest iteration's HTML, scaled to fit grid.
- Previews at every navigation level — campaign (mosaic), asset (full iframe), frame (full iframe), iteration (full iframe).

**Post-Generation Navigation**
- Auto-navigate to campaign view — once generation completes, automatically switch the main view to show the new campaign.
- campaignId streamed back via SSE — server sends campaignId in the session event.

### Claude's Discretion
- Exact subagent prompt construction for parallel generation
- How the agent determines creative angles for each variation
- Loading skeleton / progress indicators during generation
- Error handling when individual asset generation fails (partial campaign)
- Template selection logic per variation
- Empty state treatment for assets still generating
- Auto-refresh mechanism for dashboard during generation (polling vs SSE)

### Deferred Ideas (OUT OF SCOPE)
- Progressive loading during generation — showing asset previews as they complete before all 7 are done
- Campaign merging — combining multiple campaigns into one
- Template customization by users — duplicate and modify templates post-creation
</user_constraints>

---

## Summary

Phase 8 bridges the final gap between the AI sidebar generation flow and the campaign dashboard. The core problem is well-scoped: the sidebar already works (prompts → claude subprocess → HTML on disk), the dashboard already works (SQLite → React DrillDownGrid), but they are disconnected. The sidebar writes to `.fluid/working/` session directories while the dashboard reads SQLite — the two never meet.

The key architectural shift is: **move from session-centric single-asset generation to campaign-centric multi-asset generation**. Instead of creating one Campaign/Asset/Frame for the whole session, the server will pre-create 7 Campaign/Asset/Frame records (3 Instagram + 3 LinkedIn + 1 one-pager by default), spawn parallel subagents for each asset, and stitch results into SQLite as HTML lands on disk.

Preview rendering at all levels is a companion concern: `renderAssetPreview` and `renderFramePreview` in App.tsx currently return metadata-only descriptors. They need to fetch and show live iframe previews. Campaign cards in CampaignDashboard.tsx need a mosaic (2x2 grid of iframes). All the plumbing for iframe rendering already exists — it's wired at the iteration level only.

**Primary recommendation:** Refactor `/api/generate` in watcher.ts to be campaign-first (pre-create structure, spawn N parallel subagents, canonical paths), then wire previews top-down in App.tsx and CampaignDashboard.tsx.

---

## Standard Stack

All libraries are already installed. No new dependencies required.

### Core (already in canvas/package.json)
| Library | Version | Purpose | Role in this phase |
|---------|---------|---------|---------------------|
| better-sqlite3 | ^12.6.2 | Synchronous SQLite for all campaign metadata | Pre-create campaign structure, auto-ingest iterations |
| nanoid | ^5.0.0 | Generate IDs for Campaign/Asset/Frame/Iteration | Already used in db-api.ts |
| vite + @vitejs/plugin-react | ^6.0.0 / ^4.3.0 | Serves all API endpoints as middleware | /api/generate refactor lives here |
| zustand | ^5.0.0 | Client state for generation, campaign navigation | generationStore already has activeCampaignId |
| react | ^19.0.0 | UI components | DrillDownGrid, CampaignDashboard, PromptSidebar |
| chokidar | ^4.0.0 | File system watcher (already watching .fluid/working/) | Will watch .fluid/campaigns/ instead |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process (spawn) | built-in | Spawns claude subprocesses | Multiple parallel spawns for multi-asset |
| node:readline | built-in | Line-by-line SSE streaming from child stdout | Already used, extend for parallel streams |
| node:fs/promises | built-in | Directory creation, file reads | Create canonical path structure |

### No new dependencies needed
The entire phase is a refactor and wiring exercise within the existing stack.

---

## Architecture Patterns

### Current State (what exists)

```
canvas/src/
├── server/
│   ├── watcher.ts          # Vite plugin: file watcher + ALL API middleware (43.5KB)
│   └── db-api.ts           # SQLite CRUD: Campaign > Asset > Frame > Iteration
├── components/
│   ├── App.tsx             # renderAssetPreview / renderFramePreview (metadata-only)
│   ├── CampaignDashboard.tsx  # Campaign cards (no mosaic preview)
│   ├── DrillDownGrid.tsx   # Iframe preview wired only at iteration level
│   ├── PromptSidebar.tsx   # Calls /api/generate, navigates on completion
│   └── StatusBadge.tsx     # Exists, not yet used on asset cards
├── store/
│   ├── campaign.ts         # navigateToCampaign, fetchAssets, etc.
│   └── generation.ts       # activeCampaignId already captured from SSE
├── hooks/
│   └── useGenerationStream.ts  # SSE hook, already sets campaignId
└── lib/
    ├── db.ts               # getDb() singleton with FLUID_DB_PATH override
    └── campaign-types.ts   # Campaign, Asset, Frame, Iteration interfaces
```

### Target State (what this phase produces)

```
.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html
  — one canonical path for all AI-generated HTML (no more .fluid/working/)
```

### Pattern 1: Server Pre-Creates Campaign Structure

**What:** Before spawning any claude subprocess, the server atomically creates all Campaign + Asset + Frame records in SQLite and all directories on disk.

**When to use:** Every fresh generation from the sidebar prompt (not iteration).

**How it works:**
```
1. Parse prompt for channel hints ("just LinkedIn" → only LinkedIn)
2. Default: 3 Instagram assets + 3 LinkedIn assets + 1 one-pager = 7 assets
3. createCampaignWithAssets() — one SQLite transaction for Campaign + all Assets
4. createFrame() for each Asset (frameIndex: 0)
5. mkdir -p .fluid/campaigns/{campaignId}/{assetId}/{frameId}/
6. Spawn N claude subprocesses in parallel (one per asset)
7. Stream session event with campaignId back to client immediately
```

**Key constraint:** `createCampaignWithAssets()` already exists in db-api.ts and supports atomic creation. It does NOT create frames — add `createFramesForAssets()` helper or loop after the transaction.

### Pattern 2: Canonical Path for Generated HTML

**What:** Every iteration's HTML lives at a predictable path derived from its IDs.

**Path structure:**
```
.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html
```

**Iteration ID strategy:** Use nanoid() pre-generated before spawning the agent — the server creates a "pending" Iteration record with this ID and the canonical path as htmlPath. The file doesn't exist yet. The file watcher (or post-generation ingest) writes the HTML there.

**Why this fixes "HTML not found":** The htmlPath in SQLite always points to a path that exists (server writes it there) or will exist (server writes it on agent close). No more roundDir paths like `.fluid/working/20260311-154019/round-1/styled.html`.

### Pattern 3: Parallel Subagent Spawning

**What:** Spawn one claude subprocess per asset simultaneously, each with a specific asset-level prompt and campaign context.

**Existing pattern:** Current code spawns one `activeChild`. Extend to support N children tracked by assetId.

**Implementation approach:**
```typescript
// Track per-asset children instead of a single lock
const activeChildren: Map<string, ChildProcess> = new Map();

// Spawn one per asset
for (const asset of assets) {
  const child = spawn('claude', buildAssetArgs(asset, campaignId, frameId));
  activeChildren.set(asset.id, child);
  child.on('close', () => {
    activeChildren.delete(asset.id);
    autoIngestHtml(asset);
  });
}
```

**Concurrency lock:** The existing single-generation lock (`activeChild`) needs to change to a campaign-level lock. If a campaign generation is active, reject new campaigns (409). Iterations on existing assets still allowed.

### Pattern 4: Auto-Ingest HTML on Close

**What:** When each subagent closes, scan its output dir for HTML files and create Iteration records in SQLite (already exists as `autoIngestHtmlToIterations()`).

**Current limitation:** `autoIngestHtmlToIterations()` uses roundDir paths. In the new model, agent writes directly to the canonical path. The server can pre-allocate the iterationId and pass it as the output filename to the agent prompt.

**Preferred approach:** Tell the agent exactly what filename to write:
```
Write your generated HTML to exactly this path:
.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html
```

Then after close, update the pre-created Iteration record from `status: 'pending'` to `status: 'complete'`.

**Requires:** Add `status: 'pending' | 'generating' | 'complete'` to Iteration (or reuse existing status field — currently `'winner' | 'rejected' | 'final' | 'unmarked'`). Need a separate `generationStatus` field or extend the type.

### Pattern 5: Asset-Level Iframe Previews

**What:** `renderAssetPreview` in App.tsx currently returns `meta` (no iframe). It needs to return `src: /api/iterations/{latestIterationId}/html`.

**Current state:**
```typescript
// App.tsx line ~119 — returns metadata only
const renderAssetPreview = (item: DrillDownItem<Asset>): PreviewDescriptor => ({
  width: 320,
  height: 180,
  meta: { icon: 'asset', badges: [item.data.assetType], ... },
});
```

**Target state:**
```typescript
const renderAssetPreview = (item: DrillDownItem<Asset>): PreviewDescriptor => {
  const latestIteration = getLatestIterationForAsset(item.id); // from store
  if (latestIteration?.htmlPath) {
    return { src: `/api/iterations/${latestIteration.id}/html`, width: ..., height: ... };
  }
  return { width: ..., height: ..., meta: { ... } }; // fallback while generating
};
```

**Requires:** Store needs to cache latest iterations per asset. Either:
- Option A: Add `iterationsByAssetId: Record<string, Iteration>` to campaign store (denormalized)
- Option B: Fetch all iterations when navigating to campaign view (one extra API call per asset)
- Option C: Add `/api/campaigns/{id}/summary` endpoint returning campaigns + latest iterations in one call

Option A is simplest given existing Zustand store structure.

### Pattern 6: Campaign Card Mosaic Preview

**What:** Campaign cards in CampaignDashboard.tsx need a 2x2 grid of small iframe thumbnails from the campaign's first 4 assets.

**Current state:** CampaignDashboard.tsx renders campaign cards with title/channel badges (no previews). DrillDownGrid handles the rendering.

**Implementation:** CampaignDashboard uses its own `DrillDownItem<Campaign>` → `PreviewDescriptor`. Currently this returns `meta`. Need to extend PreviewDescriptor to support mosaic mode OR implement mosaic inside CampaignDashboard.tsx directly.

**Recommended approach:** Add a custom campaign card renderer in CampaignDashboard that renders a 2x2 grid of scaled iframes. Keep it separate from DrillDownGrid's single-iframe card. The mosaic is campaign-specific UI.

**Data needed:** For each campaign in the list, need up to 4 iteration URLs. This means either:
- Fetch assets + latest iterations per campaign on dashboard load (N+1 per campaign — expensive)
- Add a `/api/campaigns/previews` bulk endpoint that returns `campaignId → [iterationId, ...] × 4`

**Recommended:** Add `GET /api/campaigns/{id}/preview-urls` returning first 4 iteration IDs for a campaign. Cache in component state. Lazy-load on scroll (intersection observer) to avoid 7×4=28 iframe loads on dashboard.

### Pattern 7: Add-to-Existing-Campaign Flow

**What:** When user is viewing a campaign (currentView === 'campaign'), sidebar context switches to "Add to [Campaign Name]" mode.

**PromptSidebar already has:** `activeCampaignId` from generation store, `navigateToCampaign` from campaign store.

**New behavior:**
- If `useCampaignStore.currentView === 'campaign'` AND `activeCampaignId !== null` → show "Adding to [campaign title]" label
- On submit: POST to `/api/generate` with `{ ..., existingCampaignId: activeCampaignId }`
- Server: skip campaign creation, add new assets to existing campaign

**PromptSidebar needs access to:** `useCampaignStore((s) => s.currentView)` and `useCampaignStore((s) => s.activeCampaignId)` — both available.

### Pattern 8: Asset Rename API

**What:** After generating, agent calls an API to rename its asset with a descriptive title.

**New endpoint:** `PATCH /api/assets/{id}` with body `{ title: string }`

**New db-api.ts function:**
```typescript
export function updateAsset(id: string, input: { title?: string }): void {
  const db = getDb();
  if (input.title !== undefined) {
    db.prepare('UPDATE assets SET title = ? WHERE id = ?').run(input.title, id);
  }
}
```

**Agent receives in prompt:** `assetId` and instruction to call the rename API after generating.

### Anti-Patterns to Avoid

- **Writing lineage.json in new flow:** lineage.json is the old session paradigm. Do not create it for new campaign-centric generations. The new flow uses only SQLite.
- **Blocking on all subagents before streaming session event:** Stream campaignId immediately after DB creation, before any subagents finish. Client navigates to campaign view and sees pending states in real-time.
- **Embedding full HTML in SSE stream:** Current flow embeds campaign context in the prompt (not SSE). Keep it that way — SSE carries only sessionId + campaignId for navigation.
- **Single activeChild lock for multi-asset:** Must support N parallel children. Replace the single lock with a campaign-level lock and per-asset child map.
- **Iframe src without cache-busting:** When an asset transitions from pending → complete, the iframe src is the same URL. The browser may cache the 404. Use `?t={timestamp}` query param on src after generation completes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-record DB creation | Custom transaction logic | `createCampaignWithAssets()` in db-api.ts | Already exists, tested |
| SSE streaming from child | Custom socket or polling | Existing readline + res.write pattern | Already handles backpressure |
| File watching for new HTML | Manual polling loop | chokidar (already watching) | Event-driven, debounced |
| UUID/nanoid generation | `crypto.randomUUID()` | `nanoid()` | Already imported everywhere |
| Campaign store navigation | Custom routing | `useCampaignStore.navigateToCampaign()` | Already handles async data fetch |
| iframe scaling | Custom CSS | DrillDownGrid's `scale()` pattern | Already tested at iteration level |

---

## Common Pitfalls

### Pitfall 1: htmlPath Mismatch Between SQLite and Disk

**What goes wrong:** Iteration record created with path `A`, agent writes to path `B`. `/api/iterations/:id/html` reads path `A` and gets 404.

**Why it happens:** Current `autoIngestHtmlToIterations()` uses `path.relative(projectRoot, absPath)` which can differ from what push_asset stores (`campaigns/{campaignId}/...`).

**How to avoid:** Pre-generate the iterationId with nanoid() before spawning. Tell the agent the exact filename to write. Server creates the Iteration record with `htmlPath = campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html` — the path that will exist when the agent writes there.

**Warning signs:** `/api/iterations/:id/html` returns 404 even though the HTML file exists somewhere on disk.

### Pitfall 2: Iteration Status Field Collision

**What goes wrong:** The existing `Iteration.status` field (`'winner' | 'rejected' | 'final' | 'unmarked'`) is used for user review decisions. Using it for generation status (`pending/generating/complete`) creates semantic confusion.

**Why it happens:** Temptation to reuse existing field to avoid schema migration.

**How to avoid:** Add a separate `generationStatus` column to the `iterations` table (`'pending' | 'generating' | 'complete'`). Keep `status` for review decisions only. Add `generationStatus` to the `Iteration` TypeScript interface and `rowToIteration()`.

**Warning signs:** Filters on status for review show "pending" assets that haven't been reviewed.

### Pitfall 3: Parallel Subagent Lock Collision

**What goes wrong:** Spawning 7 subagents simultaneously but the activeChild lock rejects all but the first.

**Why it happens:** Current `/api/generate` uses a single `activeChild` variable as a mutex.

**How to avoid:** Replace `activeChild: ChildProcess | null` with `activeChildren: Map<string, ChildProcess>` keyed by assetId. Add a campaign-level lock: `activeCampaignGeneration: string | null` that prevents launching a new full campaign while one is in progress.

**Warning signs:** 409 errors for assets 2-7 in the generation log; only one asset appears in the dashboard.

### Pitfall 4: Dashboard Mosaic Triggers 28+ Simultaneous iframes

**What goes wrong:** Campaign list with 4+ campaigns each loads 4 iframes = 16+ iframes, each loading HTML from disk. Browser memory pressure, janky scroll.

**Why it happens:** Naive implementation loads all previews eagerly.

**How to avoid:** Use IntersectionObserver to lazy-load mosaic iframes only when the campaign card enters the viewport. Alternatively, scale thumbnails very small (e.g., 80x80px display, 1080px native) and only load the top 4 campaigns eagerly.

**Warning signs:** Dashboard hangs on campaigns with many assets; browser tab memory exceeds 2GB.

### Pitfall 5: Auto-Navigate Race with Asset Data Load

**What goes wrong:** `navigateToCampaign(campaignId)` called 500ms after generation completes. Fetches assets. But iteration records may not yet exist (agent is still writing). Campaign view shows assets with no previews.

**Why it happens:** The 500ms delay in PromptSidebar is a rough guess; actual write time varies.

**How to avoid:** Use the `done` SSE event (already implemented) rather than a timeout. The `done` event fires after `autoIngestHtmlToIterations()` completes. The auto-navigate in PromptSidebar already uses `generationStatus === 'complete'` trigger. Ensure the done event is only sent after all subagents finish (wait for all N children to close before firing done).

**Warning signs:** Campaign detail view shows pending assets even when generation succeeded; refresh shows them correctly.

### Pitfall 6: .fluid/working/ Sessions Still Created in New Flow

**What goes wrong:** Old code path still creates session directories under `.fluid/working/` even for new campaign-centric generations.

**Why it happens:** The `/api/generate` handler currently always creates a session directory in `absDir` (`.fluid/working/`). Refactoring must explicitly skip this for the new campaign-centric path.

**How to avoid:** Add a feature flag or detection in the generate handler: if the request is campaign-based, skip session directory creation entirely. Move `absDir` usage to legacy iteration path only.

**Warning signs:** `.fluid/working/` fills up with directories despite the new flow being "canonical path only."

---

## Code Examples

Verified patterns from the existing codebase:

### Pre-Creating Campaign + Assets (db-api.ts)
```typescript
// Source: canvas/src/server/db-api.ts — createCampaignWithAssets()
const { campaign, assets } = createCampaignWithAssets(
  { title: 'Spring Campaign', channels: ['instagram', 'linkedin', 'one-pager'] },
  [
    { title: 'Instagram Post 1', assetType: 'instagram', frameCount: 1 },
    { title: 'Instagram Post 2', assetType: 'instagram', frameCount: 1 },
    { title: 'Instagram Post 3', assetType: 'instagram', frameCount: 1 },
    { title: 'LinkedIn Post 1', assetType: 'linkedin', frameCount: 1 },
    { title: 'LinkedIn Post 2', assetType: 'linkedin', frameCount: 1 },
    { title: 'LinkedIn Post 3', assetType: 'linkedin', frameCount: 1 },
    { title: 'One-Pager',       assetType: 'one-pager', frameCount: 1 },
  ]
);
// Then create one Frame per Asset (createCampaignWithAssets does NOT create frames)
for (const asset of assets) {
  createFrame({ assetId: asset.id, frameIndex: 0 });
}
```

### Canonical Path Construction
```typescript
// Canonical HTML path for an iteration
const iterationId = nanoid();
const htmlPath = `campaigns/${campaignId}/${assetId}/${frameId}/${iterationId}.html`;
const absPath = path.join(projectRoot, '.fluid', htmlPath);
await fs.mkdir(path.dirname(absPath), { recursive: true });
// Pre-create iteration record (HTML doesn't exist yet)
createIteration({ frameId, iterationIndex: 0, htmlPath, source: 'ai' });
// Tell agent to write to absPath
```

### SSE Session Event (watcher.ts)
```typescript
// Source: canvas/src/server/watcher.ts line ~693
res.write(`data: ${JSON.stringify({
  type: 'session',
  sessionId: actualSessionId,
  campaignId,
  assetId,
  frameId
})}\n\n`);
```

### Client-Side Campaign ID Capture (useGenerationStream.ts)
```typescript
// Source: canvas/src/hooks/useGenerationStream.ts line ~91-96
if (parsed.type === 'session' && parsed.sessionId) {
  setSessionId(parsed.sessionId);
  if (parsed.campaignId) {
    setCampaignId(parsed.campaignId);
  }
}
```

### Auto-Navigate on Completion (PromptSidebar.tsx)
```typescript
// Source: canvas/src/components/PromptSidebar.tsx line ~77-87
useEffect(() => {
  if (prevStatusRef.current === 'generating' && generationStatus === 'complete' && activeCampaignId) {
    const timer = setTimeout(() => {
      navigateToCampaign(activeCampaignId);
    }, 500);
    return () => clearTimeout(timer);
  }
  prevStatusRef.current = generationStatus;
}, [generationStatus, activeCampaignId, navigateToCampaign]);
```

### Asset-Level Iframe Preview (App.tsx — current + target)
```typescript
// Current (canvas/src/App.tsx line ~119):
const renderAssetPreview = (item: DrillDownItem<Asset>): PreviewDescriptor => ({
  width: 320, height: 180,
  meta: { icon: 'asset', badges: [item.data.assetType], ... },
});

// Target: needs latestIterationByCampaignId lookup from store
const renderAssetPreview = (item: DrillDownItem<Asset>): PreviewDescriptor => {
  const latestIter = latestIterationByAssetId[item.id];
  if (latestIter) {
    const dims = getDimensions(item.data.assetType);
    return { src: `/api/iterations/${latestIter.id}/html`, ...dims };
  }
  return { width: 1080, height: 1080, meta: { icon: 'asset', badges: ['generating...'] } };
};
```

### Iteration HTML Serving Endpoint (watcher.ts)
```typescript
// Source: canvas/src/server/watcher.ts line ~354-374
// GET /api/iterations/:id/html — resolves htmlPath relative to project root
const htmlContent = await fs.readFile(
  path.resolve(srv.config.root, '..', row.html_path),
  'utf-8'
);
```

---

## State of the Art

| Old Approach | Current/Target Approach | Status |
|--------------|------------------------|--------|
| Sessions as organizing unit (.fluid/working/{sessionId}/) | Campaigns as organizing unit (SQLite + .fluid/campaigns/) | Phase 8 implements this shift |
| lineage.json for iteration tracking | SQLite Iteration records | Phase 8 removes lineage.json from new flow |
| Single asset per sidebar generation | 7 assets (3 IG + 3 LI + 1 one-pager) by default | Phase 8 |
| push_asset MCP as only SQLite bridge | Auto-ingest on agent close as primary; push_asset retained for external agents | Already partially done, needs refinement |
| Metadata-only asset/frame cards | Full iframe previews at all levels | Phase 8 wires this |

---

## Open Questions

1. **Iteration generationStatus field**
   - What we know: Existing `Iteration.status` is for review decisions (`winner/rejected/final/unmarked`)
   - What's unclear: Does the DB schema need a migration to add `generationStatus` column, or can we infer "pending" from htmlPath file not-yet-existing?
   - Recommendation: Add `generation_status TEXT DEFAULT 'pending'` column via ALTER TABLE in db.ts schema init. Use it for per-asset status badges on the dashboard. This avoids semantic confusion.

2. **Frame-level preview in "add to existing campaign" flow**
   - What we know: When iterating on an asset, new Iteration records go under the same Frame. Current renderFramePreview returns metadata-only.
   - What's unclear: Should clicking a Frame card show the latest iteration's preview or all iterations in a grid?
   - Recommendation: renderFramePreview should show the latest iteration HTML as preview (same as asset-level). Frame detail shows all iterations in the DrillDownGrid.

3. **Multi-asset SSE streaming aggregation**
   - What we know: Current SSE streams one child's stdout. With 7 parallel subagents, the client receives one SSE connection but events come from N processes.
   - What's unclear: Should the server multiplex all 7 streams onto one SSE connection, or use a separate SSE connection per asset?
   - Recommendation: Multiplex all streams onto the single `/api/generate` SSE connection with an `assetId` field in each event frame. Client can show per-asset progress in the PromptSidebar. This keeps the existing SSE hook interface.

4. **Template dimensions for non-template AI iterations**
   - What we know: `renderIterationPreview` uses `TEMPLATE_METADATA` to look up dimensions by `templateId`. AI-generated iterations have `templateId: null`.
   - What's unclear: How does the code know whether a prompt-generated asset is Instagram (1080x1080) or LinkedIn (1200x627)?
   - Recommendation: Store `assetType` on the Iteration record (or derive from Asset). Use asset type → dimension lookup in renderAssetPreview. A mapping already implied by the `assetType` field: `{ instagram: 1080x1080, linkedin: 1200x627, 'one-pager': 816x1056 }`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `canvas/vitest.config.ts` |
| Quick run command | `cd canvas && npm test -- --reporter=dot` |
| Full suite command | `cd canvas && npm test` |
| Node environment tests | Files matching `mcp/**/*.test.ts`; all others use jsdom |

### Existing Test Coverage Relevant to Phase 8

| File | What it Tests | Relevant To |
|------|--------------|-------------|
| `__tests__/campaign-api.test.ts` | CRUD for Campaign/Asset/Frame/Iteration | db-api.ts changes |
| `__tests__/campaign-store.test.ts` | Zustand store navigation and data fetching | navigateToCampaign, fetchAssets |
| `__tests__/generate-endpoint.test.ts` | /api/generate handler | Multi-asset refactor |
| `__tests__/db.test.ts` | Schema init and basic queries | generationStatus column |
| `__tests__/watcher-hardening.test.ts` | autoIngestHtmlToIterations, canonical paths | HTML path fixes |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File |
|----------|-----------|-------------------|------|
| Server creates Campaign + 7 Assets + 7 Frames atomically before spawning agents | unit | `npm test -- campaign-api` | `__tests__/campaign-api.test.ts` |
| Canonical htmlPath format: `campaigns/{cId}/{aId}/{fId}/{iterId}.html` | unit | `npm test -- watcher-hardening` | `__tests__/watcher-hardening.test.ts` |
| /api/iterations/:id/html resolves canonical path correctly | unit | `npm test -- generate-endpoint` | `__tests__/generate-endpoint.test.ts` |
| generationStatus column in iterations table | unit | `npm test -- db` | `__tests__/db.test.ts` |
| PATCH /api/assets/:id updates title | unit | `npm test -- campaign-api` | new test in `__tests__/campaign-api.test.ts` |
| navigateToCampaign called on generation complete with campaignId | unit | `npm test -- campaign-store` | `__tests__/campaign-store.test.ts` |
| renderAssetPreview returns iframe src when iteration exists | unit | `npm test -- PromptSidebar` | new test in `__tests__/` |
| Mosaic preview fetches up to 4 iteration URLs per campaign | unit | manual | new test in `__tests__/` |

### Sampling Rate
- **Per task commit:** `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test -- --reporter=dot 2>&1 | tail -5`
- **Per wave merge:** `cd /Users/cheyrasmussen/Fluid-DesignOS/canvas && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/campaign-api.test.ts` — add test for `PATCH /api/assets/:id` (rename endpoint)
- [ ] `__tests__/db.test.ts` — add test for `generationStatus` column schema
- [ ] `__tests__/watcher-hardening.test.ts` — add test for canonical path format and auto-ingest with pre-allocated iterationId
- [ ] `__tests__/generate-endpoint.test.ts` — add test for multi-asset pre-creation (7 assets) and parallel spawn mock

---

## Implementation Work Map

The following is a concrete map of what needs to change, organized by file, to guide plan creation:

### watcher.ts (most work here)

1. **Replace single `activeChild` with `activeChildren: Map<string, ChildProcess>`** and `activeCampaignGeneration: string | null` campaign lock
2. **Refactor `/api/generate` handler:**
   - Parse prompt for channel hints (simple keyword detection: "just LinkedIn", "Instagram only")
   - Build default asset list (3 IG + 3 LI + 1 one-pager) or narrowed list
   - Call `createCampaignWithAssets()` + `createFrame()` per asset + mkdir per asset dir
   - Pre-allocate iterationIds and create pending Iteration records
   - Spawn N parallel subagents, each with specific asset context + canonical output path
   - Multiplex all stdout onto the SSE connection with assetId tagging
   - Wait for all N children to close before sending `event: done`
3. **Add `PATCH /api/assets/:id`** endpoint for agent-driven rename
4. **Add `GET /api/campaigns/:id/preview-urls`** endpoint returning up to 4 iteration IDs
5. **Update `autoIngestHtmlToIterations()`** to handle pre-allocated iterationId case (update record vs create new)
6. **Remove session directory creation** from non-iteration new-generation path (stop writing to `.fluid/working/`)

### db-api.ts

1. **Add `updateAsset(id, { title })`** function
2. **Add `getLatestIterationByFrame(frameId)`** helper (for asset preview lookup)
3. **Add `updateIterationGenerationStatus(id, status)`** function

### db.ts (schema)

1. **Add `generation_status TEXT DEFAULT 'complete'`** column to iterations table (ALTER TABLE for existing DBs, CREATE TABLE for new)

### campaign-types.ts

1. **Add `generationStatus?: 'pending' | 'generating' | 'complete'`** to Iteration interface

### App.tsx

1. **Replace `renderAssetPreview`** — return iframe `src` when latest iteration exists for the asset
2. **Replace `renderFramePreview`** — return iframe `src` for latest iteration in the frame
3. **Add `latestIterationByAssetId` state** or extend campaign store to track this
4. **Load latest iterations when navigating to campaign view** (fetchLatestIterations)

### CampaignDashboard.tsx

1. **Add mosaic preview rendering** for campaign cards — 2x2 grid of small scaled iframes
2. **Lazy-load mosaics** with IntersectionObserver to avoid 28+ simultaneous iframes
3. **Add per-asset status badges** using StatusBadge component (already exists)

### PromptSidebar.tsx

1. **Add "Add to existing campaign" mode detection** — check `useCampaignStore.currentView === 'campaign'`
2. **Pass `existingCampaignId`** to generate call when in campaign context

### store/campaign.ts

1. **Add `fetchLatestIterations(campaignId)`** action that bulk-loads latest iteration per asset
2. **Add `latestIterationByAssetId: Record<string, Iteration>`** to store state

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `canvas/src/server/watcher.ts` — full API handler map, existing generation flow, autoIngestHtmlToIterations implementation
- Direct code inspection of `canvas/src/server/db-api.ts` — all CRUD functions, createCampaignWithAssets transaction
- Direct code inspection of `canvas/src/App.tsx` — renderAssetPreview/renderFramePreview current state, DrillDownGrid wiring
- Direct code inspection of `canvas/src/components/PromptSidebar.tsx` — auto-navigate, iterate mode, generate call
- Direct code inspection of `canvas/src/store/campaign.ts` — full store interface, navigation actions
- Direct code inspection of `canvas/src/store/generation.ts` — activeCampaignId capture
- Direct code inspection of `canvas/src/hooks/useGenerationStream.ts` — SSE parsing, campaignId capture
- Direct code inspection of `.planning/phases/08-ai-sidebar-to-campaign-dashboard-end-to-end/08-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- Inspection of `__tests__/` directory — 20 test files, existing coverage map
- Inspection of `.fluid/working/` and `.fluid/campaigns/` — confirms disconnect between old and new paths
- `canvas/package.json` — confirms stack (vitest 3.x, better-sqlite3, nanoid, zustand 5, react 19)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire stack already installed and in production use
- Architecture: HIGH — based on direct code reading, not assumptions
- Pitfalls: HIGH — identified from actual code paths (autoIngestHtmlToIterations, activeChild lock, htmlPath resolution)
- Implementation work map: HIGH — specific file + line-level findings

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable project, no external dependency changes expected)
