# Architecture

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Brand Intelligence Layer                                │
│  13 modular docs (brand/)  •  Weight system (1-100)      │
│  Role-specific loading  •  Max 3-6 docs per subagent     │
└────────────────────────┬────────────────────────────────┘
                         │ loaded by
┌────────────────────────▼────────────────────────────────┐
│  Orchestrator Layer                                      │
│  Skill definitions (~/.agents/skills/)                   │
│  Pipeline: copy → layout → styling → spec-check → fix   │
│  Parallel subagent spawning (one per asset)              │
└────────────────────────┬────────────────────────────────┘
                         │ writes HTML to
┌────────────────────────▼────────────────────────────────┐
│  Runtime Layer                                           │
│  .fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html        │
│  SQLite records → HMR push to browser                      │
│  Vite middleware: API routes + static serving              │
└────────────────────────┬────────────────────────────────┘
                         │ renders in
┌────────────────────────▼────────────────────────────────┐
│  Canvas UI Layer                                         │
│  React 19 + Zustand 5 + Vite 6                           │
│  Dashboard → Campaign → Asset → Frame → Iteration        │
│  ContentEditor for slot editing via postMessage           │
└─────────────────────────────────────────────────────────┘
```

## Data Model

```
Campaign
├── id, title, channels (JSON array)
│
├── Asset 1 (instagram)
│   ├── Frame 0
│   │   ├── Iteration 0 (generationStatus: complete, source: ai)
│   │   ├── Iteration 1 (status: winner, source: ai)
│   │   └── Annotations (pin @ x,y / sidebar notes)
│   └── Frame 1 (carousel slide 2)
│
├── Asset 2 (linkedin)
│   └── Frame 0
│       └── Iteration 0
│
└── Asset 3 (one-pager)
    └── Frame 0
        └── Iteration 0
```

**Key fields:**
- `generationStatus` (pending/generating/complete) — AI lifecycle, separate from user review
- `status` (unmarked/winner/rejected/final) — user-facing review state
- `htmlPath` — stored path to HTML file (may be stale; server uses fallback resolution)
- `userState` (JSON) — slot edits from ContentEditor, applied on serve
- `aiBaseline` (JSON) — immutable original values from generation

## Server Architecture

The server is a **Vite middleware plugin** (`canvas/src/server/watcher.ts`), not a separate Express/Fastify process. All API routes, file watching, and static serving happen inside the Vite dev server.

### API Endpoints

**Campaigns:** `POST|GET /api/campaigns`, `GET|PATCH /api/campaigns/:id`, `GET /api/campaigns/:id/preview-urls`

**Assets:** `GET|PATCH /api/assets/:id`, `GET /api/assets/:id/frames`

**Frames:** `GET /api/frames/:id/iterations`, `POST /api/frames/:id/iterations`

**Iterations:** `GET /api/iterations/:id`, `GET /api/iterations/:id/html`, `PATCH /api/iterations/:id/status`

**Generation:** `POST /api/generate` (SSE stream)

**Templates:** `GET /api/templates`, `POST /api/templates/preview`

### HTML Serving (`/api/iterations/:id/html`)

The iteration HTML endpoint uses a 4-strategy fallback to find the file:

1. **Stored path** — `path.resolve(projectRoot, row.html_path)`
2. **`.fluid/` relative** — `path.resolve('.fluid/', row.html_path)`
3. **Canonical path** — `.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html` (looked up via DB join)
4. **Templates fallback** — `templates/social/{basename}`

After reading the file, the server:
- Rewrites asset paths (`../../assets/` → `/fluid-assets/`)
- Injects `<base href>` for iframe URL resolution
- Applies saved `userState` slot values
- Adds `postMessage` listener for live editing from ContentEditor

### HMR Updates

When generation completes or data changes, the server pushes a Vite HMR custom event (`fluid:file-change`) to the browser. The `useFileWatcher` hook in React triggers store refresh for the current view.

### Static Serving

- `/` — Jonathan's template library (`templates/index.html`)
- `/app/` — Canvas React app
- `/fluid-assets/` — Brand assets (fonts, brushstrokes, logos, textures)

## State Management

**Zustand** with a single primary store (`store/campaign.ts`):

- **Navigation state machine:** `dashboard → campaign → asset → frame` (+ iteration selection within frame view)
- **Data cache:** `campaigns[]`, `assets[]`, `frames[]`, `iterations[]`, `latestIterationByAssetId{}`
- **Race condition guard:** `_requestId` counter increments on each fetch; stale responses are discarded
- **Sidebar state:** `leftSidebarOpen`, `rightSidebarOpen`

Navigation actions fetch data then set view:
```
navigateToDashboard() → fetchCampaigns()
navigateToCampaign(id) → fetchAssets(id) → fetchLatestIterations(id)
navigateToAsset(id) → fetchFrames(id) → fetchIterations(per frame)
navigateToFrame(id) → fetchIterations(id)
```

## MCP Server

Stdio-based MCP server (`canvas/mcp/server.ts`) for agent-canvas communication:

| Tool | Purpose |
|------|---------|
| `push_asset` | Create iteration + write HTML to canonical path |
| `read_annotations` | Fetch pin/sidebar notes for an iteration |
| `read_statuses` | Get all iterations in a frame with review status |
| `read_history` | Full iteration chain for a frame |
| `iterate_request` | Signal intent to generate next round |

Agents never write SQLite directly. The MCP server and API endpoints own all database mutations.

## Generation Pipeline

```
POST /api/generate { prompt, campaignId? }
  │
  ├── Parse prompt for channel hints ("just LinkedIn" → 3 LinkedIn assets)
  ├── Pre-create Campaign + Assets + Frames + Iterations in SQLite
  ├── Set all iterations to generationStatus: 'pending'
  │
  ├── For each asset (parallel):
  │   ├── Load brand docs by role (copy: voice-rules, styling: design-tokens, etc.)
  │   ├── Load 1-2 marketing skills from skill-map.json
  │   ├── Run pipeline: copy → layout → styling → spec-check → fix
  │   ├── Write HTML to .fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html
  │   └── Update generationStatus to 'complete'
  │
  └── Stream SSE events: { campaignId, status, stderr }
```

## Brand Data Loading

Brand data lives in SQLite (`canvas/fluid.db`), managed through the app's UI pages. Agents load brand context at runtime via pipeline tools (`list_brand_sections`, `read_brand_section`, `list_brand_assets`).

**DB tables:** `voice_guide_docs`, `brand_patterns`, `brand_assets`, `templates`, `template_design_rules`

**Weight system** (in each doc): rules carry weights 1-100. Enforcement:
- 81-100 = must follow (brand-critical)
- 51-80 = should follow (strong preference)
- 21-50 = recommended (flexible)
- 1-20 = nice-to-have

## Template System

Templates use Jonathan's standard format:
1. **Live HTML** — the actual rendered output
2. **Slot schema** — structured content slots (headline, subline, CTA, images)
3. **Annotations** — FIXED / FLEXIBLE / OPTIONAL per element
4. **Dimensions** — native pixel size (1080x1080, 1200x627, 816x1056)

8 social templates have been ported to TypeScript configs in `canvas/src/lib/template-configs.ts` for programmatic access via the template gallery UI.

## Testing

Vitest with real SQLite (no mocking):

```bash
cd canvas
npm test              # Run all tests
npm test -- db.test   # Run specific test file
```

**Database isolation:** Every test file sets `FLUID_DB_PATH` to a temp directory so tests never touch the production `fluid.db`. Pattern:

```typescript
beforeAll(() => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  process.env.FLUID_DB_PATH = path.join(dir, 'test.db');
});
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Vite middleware, not Express | One process, HMR integration, simpler deployment |
| SQLite with WAL mode | Concurrent reads from MCP + Vite, no external DB dependency |
| HTML on disk, metadata in SQLite | Files are the artifact; DB tracks relationships and state |
| Canonical file paths | `.fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html` prevents collisions |
| Zustand over Redux/Context | Minimal boilerplate, single store, race condition guard built-in |
| MCP via stdio, not TCP | No external service; integrates with agent's context window |
| Brand docs as required context | Agents can't skip brand rules; weight system enables tuning |
| Max 3-6 brand docs per agent | Prevents context overload; role-specific loading |
| HMR push on data changes | Server sends custom Vite HMR event after writes; `useFileWatcher` refreshes UI |
| Parallel subagents per asset | Each asset gets fresh context; no cross-contamination between assets |
