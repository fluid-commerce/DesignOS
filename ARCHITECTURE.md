# Architecture

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Brand Intelligence Layer                                │
│  SQLite DB (voice_guide_docs, brand_patterns, etc.)      │
│  Weight system (1-100)  •  Smart context injection       │
│  context_map routes sections per (type, stage, page)     │
└────────────────────────┬────────────────────────────────┘
                         │ brand context pre-injected by
┌────────────────────────▼────────────────────────────────┐
│  Archetype Layer (brandless structural patterns)         │
│  Filesystem: archetypes/{slug}/index.html + schema.json  │
│  Content/decorative split  •  Components as patterns     │
│  archetypeId (not templateId)  •  brush: null always     │
└────────────────────────┬────────────────────────────────┘
                         │ selected + branded by
┌────────────────────────▼────────────────────────────────┐
│  Pipeline Layer (brand-agnostic)                         │
│  Anthropic SDK (api-pipeline.ts)                         │
│  Pipeline: copy → layout → styling → spec-check → fix   │
│  Parallel creations  •  Design DNA  •  Hard rules        │
└────────────────────────┬────────────────────────────────┘
                         │ writes HTML to
┌────────────────────────▼────────────────────────────────┐
│  Runtime Layer                                           │
│  .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html │
│  SQLite records → HMR push to browser                    │
│  Vite middleware: API routes + static serving             │
└────────────────────────┬────────────────────────────────┘
                         │ renders in
┌────────────────────────▼────────────────────────────────┐
│  Canvas UI Layer                                         │
│  React 19 + Zustand 5 + Vite 6                           │
│  Dashboard → Campaign → Creation → Slide → Iteration     │
│  ContentEditor for slot editing via postMessage           │
│  LeftNav: Create, My Creations, Assets, Templates,       │
│           Patterns, Voice Guide, Settings                │
└─────────────────────────────────────────────────────────┘
```

## Data Model

```
Campaign
├── id, title, channels (JSON array)
│
├── Creation 1 (instagram)
│   ├── Slide 0
│   │   ├── Iteration 0 (generationStatus: complete, source: ai)
│   │   ├── Iteration 1 (status: winner, source: ai)
│   │   └── Annotations (pin @ x,y / sidebar notes)
│   └── Slide 1 (carousel slide 2)
│
├── Creation 2 (linkedin)
│   └── Slide 0
│       └── Iteration 0
│
└── Creation 3 (one-pager)
    └── Slide 0
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

**Creations:** `GET /api/campaigns/:cId/creations`, `GET|PATCH /api/creations/:id`, `GET /api/creations/:id/slides`

**Slides:** `GET /api/slides/:id/iterations`, `POST /api/slides/:id/iterations`

**Iterations:** `GET /api/iterations/:id`, `GET /api/iterations/:id/html`, `PATCH /api/iterations/:id/status`

**Generation:** `POST /api/generate` (SSE stream)

**Brand:** `GET /api/brand-assets`, `GET /api/brand-assets/serve/:name`, `GET /api/voice-guide`, `GET /api/brand-patterns`

**Context:** `GET|POST|PUT|DELETE /api/context-map`, `GET /api/context-log`

**Templates:** `GET /api/templates`, `POST /api/templates/preview`

### HTML Serving (`/api/iterations/:id/html`)

The iteration HTML endpoint uses a 4-strategy fallback to find the file:

1. **Stored path** — `path.resolve(projectRoot, row.html_path)`
2. **`.fluid/` relative** — `path.resolve('.fluid/', row.html_path)`
3. **Canonical path** — `.fluid/campaigns/{campaignId}/{creationId}/{slideId}/{iterationId}.html` (looked up via DB join)
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

- **Navigation state machine:** `dashboard → campaign → creation → slide` (+ iteration selection within slide view)
- **Data cache:** `campaigns[]`, `creations[]`, `slides[]`, `iterations[]`, `latestIterationByCreationId{}`
- **Race condition guard:** `_requestId` counter increments on each fetch; stale responses are discarded
- **Sidebar state:** `leftSidebarOpen`, `rightSidebarOpen`

Navigation actions fetch data then set view:
```
navigateToDashboard() → fetchCampaigns()
navigateToCampaign(id) → fetchCreations(id) → fetchLatestIterations(id)
navigateToCreation(id) → fetchSlides(id) → fetchIterations(per slide)
navigateToSlide(id) → fetchIterations(id)
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
  ├── Parse prompt for channel hints ("just LinkedIn" → 3 LinkedIn creations)
  ├── Pre-create Campaign + Creation + Slide + Iteration records in SQLite
  ├── Set all iterations to generationStatus: 'pending'
  │
  ├── Load context_map once (creation_type → brand sections per stage)
  ├── Load brand context from DB (voice docs, patterns, assets, design DNA)
  │
  ├── For each creation (parallel):
  │   ├── Pre-inject brand context per stage from context_map
  │   ├── Extract hard rules (weight ≥ 81) → system prompt directives
  │   ├── Build asset manifest (all brand asset URLs for styling stage)
  │   ├── Run pipeline: copy → layout → styling → spec-check → fix
  │   ├── Write HTML to .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html
  │   ├── Log injected context to context_log (sections, tokens, gap calls)
  │   └── Update generationStatus to 'complete'
  │
  └── Stream SSE events: { campaignId, status, stage updates, context_injected }
```

## Brand Data Loading

Brand data lives in SQLite (`canvas/fluid.db`), managed through the app's UI pages. The pipeline is **brand-agnostic** — all stage prompts are generic, brand identity is runtime data from the DB.

**DB tables:** `voice_guide_docs`, `brand_patterns`, `brand_assets`, `templates`, `template_design_rules`, `context_map`, `context_log`

**Smart context injection:** The `context_map` table maps `(creation_type, stage, page)` to specific brand sections. Wildcard patterns (`voice-guide:*`, `category:*`) expand at runtime. Token budgets enforce per-stage limits (Copy ~8K, Layout ~6K, Styling ~10K). The `context_log` records what was actually injected per generation for observability.

**Design DNA:** For social posts, layout and styling stages receive Design DNA sourced from `brand_patterns` (visual-style category) and `template_design_rules`. Includes visual compositor contract, platform rules, archetype notes, and HTML exemplar.

**System-invariant hard rules** (in stage system prompts, not DB):
- Copy length: IG ~20 words, LI ~30 words total visible copy
- Inline styles ban: all styling in `<style>` blocks, never `style=""` attributes
- Font enforcement: only brand-registered fonts allowed (non-brand triggers full fix loop)
- Decorative elements: `<div>` with `background-image`, never `<img>` tags
- Circle emphasis: CSS mask with proper bounding box

**Weight system** (in each doc): rules carry weights 1-100. Enforcement:
- 81-100 = must follow (brand-critical) — auto-promoted to hard rules in system prompt
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

## Archetype System

Archetypes are **brandless structural layout patterns** — content skeletons stored on the filesystem (`archetypes/`), not in the database. They define spatial hierarchy and content slots without any brand expression.

### Archetypes vs Templates

| | Templates | Archetypes |
|---|---|---|
| **Storage** | Database (SQLite) | Filesystem (`archetypes/`) |
| **Brand** | Fully styled, brand-specific | Brandless, neutral placeholder |
| **Selection** | Exact match on `templateId` | Best structural fit for content type |
| **Output** | Renderable HTML + SlotSchema | Renderable HTML + SlotSchema (identical shape) |

Both produce the same output format. The pipeline can select either; the editor sidebar works with both.

### Content/Decorative Split

Archetypes enforce a strict separation:
- **Content (archetype-defined):** text blocks, image zones, layout structure, positioning
- **Decorative (brand-defined, injected at generation):** brushstrokes, textures, circles, gradients, logos

Each archetype includes a `.decorative-zone` div where the pipeline injects brand decorative elements. The archetype `schema.json` sets `brush: null` — the brand layer provides all decorative transform targets.

### Brand Neutrality Rules

Archetypes must contain zero brand expression:
- No brand fonts, colors, or asset URLs
- No `text-transform: uppercase` (casing is a brand decision)
- No rotated side labels or other brand-specific layout conventions
- Placeholder text in sentence case, concise and neutral
- All styling: grayscale, `font-family: sans-serif`

### Design Components

Reusable mid-level functional blocks in `archetypes/components/`. Each component has `pattern.html` + `README.md`. Components are **reference patterns, not runtime includes** — when building an archetype, copy the markup and SlotSchema fields directly. There is no partial/import system.

### Key Schema Rules

- Use `archetypeId` (not `templateId`) to avoid collision with `TEMPLATE_SCHEMAS` in `template-configs.ts`
- `brush` is always `null` — brand layer merges decorative fields at generation time
- Every `sel` in `fields` must match a CSS class in `index.html`
- Authoritative spec: `archetypes/SPEC.md`

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
| Canonical file paths | `.fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html` prevents collisions |
| Zustand over Redux/Context | Minimal boilerplate, single store, race condition guard built-in |
| MCP via stdio, not TCP | No external service; integrates with agent's context window |
| Brand-agnostic pipeline | No brand hardcoded in prompts; brand identity is runtime DB data |
| Smart context injection | context_map pre-injects brand data per (type, stage); agents don't self-discover |
| Hard rules extraction | Weight ≥ 81 patterns auto-promoted to NON-NEGOTIABLE system prompt directives |
| HMR push on data changes | Server sends custom Vite HMR event after writes; `useFileWatcher` refreshes UI |
| Parallel subagents per asset | Each asset gets fresh context; no cross-contamination between assets |
| Archetypes on filesystem, not DB | Structural patterns are code artifacts; version-controlled, not user-editable data |
| `archetypeId` not `templateId` | Avoids collision with `TEMPLATE_SCHEMAS` lookup in `resolveSlotSchemaForIteration()` |
| Content/decorative split | Archetypes define layout only; `.decorative-zone` + `brush: null` defers all brand decoration to pipeline |
| Components as patterns | No runtime include/partial system; components are reference HTML for copy-paste composition |
