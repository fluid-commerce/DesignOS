# Architecture

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Brand Intelligence Layer                                │
│  SQLite DB: voice_guide_docs, brand_patterns,            │
│  brand_assets, templates, template_design_rules          │
│  Weight system (1-100) drives rule enforcement           │
└────────────────────────┬────────────────────────────────┘
                         │ assembled into Brand Brief by
┌────────────────────────▼────────────────────────────────┐
│  Archetype Layer (brandless structural patterns)         │
│  Filesystem: archetypes/{slug}/index.html + schema.json  │
│  Background/content/foreground split                     │
│  archetypeId (not templateId) • brush: null always       │
└────────────────────────┬────────────────────────────────┘
                         │ selected + branded by
┌────────────────────────▼────────────────────────────────┐
│  Creative Agent                                          │
│  Anthropic SDK with tool use (canvas/src/server/agent.ts)│
│  Single loop — no staged sub-pipeline                    │
│  SSE stream back to UI                                   │
└────────────────────────┬────────────────────────────────┘
                         │ writes via save_creation to
┌────────────────────────▼────────────────────────────────┐
│  Runtime Layer                                           │
│  .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html │
│  SQLite records → HMR push to browser                    │
│  Vite middleware: API routes + static serving            │
└────────────────────────┬────────────────────────────────┘
                         │ renders in
┌────────────────────────▼────────────────────────────────┐
│  Canvas UI Layer                                         │
│  React 19 + Zustand 5 + Vite 6                           │
│  Dashboard → Campaign → Creation → Slide → Iteration     │
│  ContentEditor for slot editing via postMessage          │
│  ChatSidebar talks to the agent via SSE                  │
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

**Chat / Generation:** `GET|POST /api/chats`, `GET|DELETE /api/chats/:id`, `POST /api/chats/:id/messages` (SSE), `POST /api/chats/:id/cancel`

**Brand:** `GET /api/brand-assets`, `GET /api/brand-assets/serve/:name`, `GET /api/voice-guide`, `GET /api/brand-patterns`, `GET /api/templates`

**Context:** `GET|POST|PUT|DELETE /api/context-map`, `GET /api/context-log`

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

**Zustand** with three primary stores:

- `store/campaign.ts` — navigation state machine + data cache + race condition guard (`_requestId`)
- `store/chat.ts` — active chat sessions, SSE streaming, tool call UI, cancellation
- `store/editor.ts` — slot editing UI state

Navigation actions fetch data then set view:
```
navigateToDashboard() → fetchCampaigns()
navigateToCampaign(id) → fetchCreations(id) → fetchLatestIterations(id)
navigateToCreation(id) → fetchSlides(id) → fetchIterations(per slide)
navigateToSlide(id) → fetchIterations(id)
```

## MCP Server

Stdio-based MCP server (`canvas/mcp/server.ts`) for external agent-canvas communication.

| Tool | Purpose |
|------|---------|
| `push_asset` | Create iteration + write HTML to canonical path |

The canvas's own creative agent does not go through MCP — it uses the tool set defined in `canvas/src/server/agent-tools.ts` directly. MCP is retained for external Claude Code sessions that want to push generated output into the canvas from outside the app.

## Creative Agent

A single Anthropic tool-use loop handles the entire creation flow.

```
POST /api/chats/:id/messages { text, uiContext }
  │
  ├── Build system prompt: Tier 1 (universal rules) + Tier 2 (Brand Brief from DB) + UI context
  ├── Start tool-use loop:
  │   ├── Brand discovery tools (list_voice_guide, read_pattern, list_assets, list_archetypes, …)
  │   ├── Preview tool (render_preview) for self-critique
  │   ├── Creation tools (save_creation, edit_creation, save_as_template)
  │   └── Brand editing tools (update_pattern, create_pattern, update_voice_guide) — gated on explicit user intent
  ├── Stream assistant text and tool events over SSE
  └── On save_creation: validation hooks run, iteration record written, UI refreshed via HMR
```

System prompt layering is in `canvas/src/server/agent-system-prompt.ts`. The Brand Brief is assembled in `canvas/src/server/brand-brief.ts` from `voice_guide_docs`, `brand_patterns`, and `brand_assets`.

## Brand Data Loading

Brand data lives in SQLite (`canvas/fluid.db`), managed through the app's UI pages. The creative agent is **brand-agnostic** — all prompts are generic; brand identity is runtime data from the DB.

**DB tables:** `voice_guide_docs`, `brand_patterns`, `brand_assets`, `templates`, `template_design_rules`, `context_map`, `context_log`

**Weight system** — rules carry weights 1-100:
- 81-100 = must follow (brand-critical)
- 51-80 = should follow (strong preference)
- 21-50 = recommended (flexible)
- 1-20 = nice-to-have

**Hard rules** — patterns with weight ≥ 81 are treated as non-negotiable constraints in the Brand Brief.

## Template System

Templates use Jonathan's standard format:
1. **Live HTML** — the actual rendered output
2. **Slot schema** — structured content slots (headline, subline, CTA, images)
3. **Annotations** — FIXED / FLEXIBLE / OPTIONAL per element
4. **Dimensions** — native pixel size (1080x1080, 1200x627, 816x1056)

Social templates have TypeScript configs in `canvas/src/lib/template-configs.ts` for programmatic access via the template gallery UI.

## Archetype System

Archetypes are **brandless structural layout patterns** — content skeletons stored on the filesystem (`archetypes/`), not in the database. They define spatial hierarchy and content slots without any brand expression.

### Archetypes vs Templates

| | Templates | Archetypes |
|---|---|---|
| **Storage** | Database (SQLite) | Filesystem (`archetypes/`) |
| **Brand** | Fully styled, brand-specific | Brandless, neutral placeholder |
| **Selection** | Exact match on `templateId` | Best structural fit for content type |
| **Output** | Renderable HTML + SlotSchema | Renderable HTML + SlotSchema (identical shape) |

Both produce the same output format. The agent can select either; the editor sidebar works with both.

### Content/Decorative Split

Archetypes enforce a strict separation:
- **Content (archetype-defined):** text blocks, image zones, layout structure, positioning
- **Decorative (brand-defined, applied at generation):** brushstrokes, textures, circles, gradients, logos

Each archetype includes two injection layers: `.background-layer` (z-index 0, for textures and brushstrokes) and `.foreground-layer` (z-index 10, for borders and frames). Content sits between them at z-index 2. The archetype `schema.json` sets `brush: null` — the brand layer provides all decorative transform targets.

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
| Zustand over Redux/Context | Minimal boilerplate, small stores, race condition guard built-in |
| Single creative agent, no staged pipeline | Simpler loop; lets the model plan its own steps; one context window per creation |
| MCP via stdio, not TCP | No external service; integrates with external agents' context |
| Brand-agnostic system prompt | No brand hardcoded; Brand Brief is runtime DB data |
| Hard rules extraction | Weight ≥ 81 patterns treated as non-negotiable constraints |
| HMR push on data changes | Server sends custom Vite HMR event after writes; `useFileWatcher` refreshes UI |
| Archetypes on filesystem, not DB | Structural patterns are code artifacts; version-controlled, not user-editable data |
| `archetypeId` not `templateId` | Avoids collision with `TEMPLATE_SCHEMAS` lookup in `resolveSlotSchemaForIteration()` |
| Background/content/foreground split | Archetypes define layout only; `brush: null` defers all decoration to the agent |
| Components as patterns | No runtime include/partial system; components are reference HTML for copy-paste composition |
