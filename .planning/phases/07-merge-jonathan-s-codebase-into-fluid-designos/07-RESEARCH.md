# Phase 7: Merge Jonathan's Codebase into Fluid DesignOS - Research

**Researched:** 2026-03-12
**Domain:** Full-stack React/Vite/Zustand app merger — data layer (SQLite), UI rebuild (drill-down navigation, content editor), agent orchestration (campaign/carousel), and agent team parallelization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Model & Persistence**
- SQLite for all metadata via better-sqlite3 (sync, no ORM). Thin API layer — agents and MCP tools go through endpoints, not direct file writes.
- HTML variations stay on disk, referenced by path in the database. SQLite owns the Campaign > Asset > Frame > Iteration hierarchy, annotations, statuses, and baseline diff tracking.
- Start fresh — no migration of existing `.fluid/working/` session data. Old sessions are archived/accessible but not converted to the new model.
- Data hierarchy: Campaign > Asset > Frame > Iteration. Frames are sub-items within an asset (carousel slides, or a single frame for single-image assets). Each Frame has its own independent iteration history. Only AI generations create new iterations; manual edits modify in-place. Baseline diff tracking stores AI-generated original vs user-modified state per iteration.

**Navigation & App Shell**
- Unified dashboard — campaigns are the primary organizing unit. Single view with filter/sort by content type, not separate tabs per content type. No sub-tabs (Templates / Creations / Campaigns).
- Collapsible sidebars — left sidebar (AI chat) and right sidebar (content editor) can both collapse to icons. Default: left open, right closed until an iteration is selected. User controls screen real estate.
- Full-size previews at every drill-down level — not thumbnail grids. Reuse the existing VariationGrid component pattern (iframes at native dimensions in a responsive grid) at every level: campaigns show assets, assets show frames, frames show iterations.
- Breadcrumb navigation at top for jumping to any level (Campaign / Asset / Frame 3 / v2). Back button for one-level-up.
- Templates live inside the 'New' creation flow — not a persistent top-level section. Template gallery appears when creating a new asset (+ button or AI prompt). Follows the existing Gallery > Customizer path pattern.
- No brand reference bar.
- Header mirrors Jonathan's visual design — his typography, spacing, badge style, and overall polish as the reference.

**Content Editor & Template System**
- Keep iframe sandboxing — templates and AI-generated assets render in iframes (existing AssetFrame pattern).
- Layout subagent emits slot schema — the layout subagent writes a field definition schema (selectors, field types, labels) alongside the HTML output. The right sidebar reads this schema to build its editor fields. Post-processing extracts current values from the iframe via those selectors. Applies to BOTH template-based and AI-generated assets.
- Feature parity between templates and AI-generated assets — same editing experience regardless of how the asset was created.
- Developer-curated, locked templates — Jonathan's 8 templates are source of truth for social media. Users create FROM templates but can't modify template definitions.
- Jonathan's UI patterns faithfully preserved — right sidebar content slot fields, photo repositioning (Fit/Fill + focus point), brush/transform controls (one movable element, SVG overlay with drag/rotate/scale), carousel slide selector, export actions (JPG, WebP, HTML).

**Campaign & Multi-Channel Generation**
- Full multi-channel campaigns — campaign creation includes channel selection across Instagram, LinkedIn, Blog, One Pager. System generates options across all selected channels.
- Campaign orchestrator skill — new top-level skill (e.g., /fluid-campaign) takes a brief, decomposes into per-channel generation tasks, dispatches to existing skill pipelines (fluid-social, fluid-one-pager, etc.). One prompt generates everything.
- 5 fixed option slots per channel — matching Jonathan's UI design. Empty slots are fine.
- DAM integration: merge everything Jonathan has built — both UI elements (Fluid DAM indicator, Browse Assets button, file attachment flow) AND any backend/integration code.
- Carousel support — multi-frame assets with per-frame iteration history. Slide selector in right sidebar for quick frame switching.

### Claude's Discretion

- Exact SQLite schema design and data access layer implementation
- Breadcrumb transition animations (or lack thereof)
- Sidebar collapse/expand animations and icon design
- Carousel navigation UX details (prev/next, keyboard support, page indicators)
- Export implementation specifics (html2canvas configuration, quality settings)
- How the brief-to-prompt bridge works (Jonathan's "Generate Prompt" → Chey's skill pipeline)
- Error states, loading skeletons, empty states throughout the drill-down

### Deferred Ideas (OUT OF SCOPE)

- Expanding brush/transform to multiple elements — currently one movable element per template. Post-merger enhancement.
- AI-generated templates — templates are developer-curated only for now.
- Per-asset-type Frame naming — use "Frames" universally. Custom naming (slides, pages, etc.) is post-merger.
- Multi-user / collaboration — single user scope for the merger.
- New export formats — stick with JPG, WebP, HTML for now.
- Template customization by users — duplicate and modify templates is a post-merger feature.
</user_constraints>

---

## Summary

Phase 7 is the largest phase in the project — a full merger of Jonathan's polished content-creation UI (template library, content editor, campaign system, carousels) into Chey's existing React/Vite/Zustand canvas app. The existing app handles AI generation, iteration tracking, and MCP integration well, but lacks campaign hierarchy, the right-sidebar content editor, carousel support, and the visual polish of Jonathan's system.

The phase requires five parallel workstreams: (1) SQLite data layer replacing the current file-based session model, (2) drill-down navigation UI replacing the current flat session list, (3) content editor right sidebar (porting Jonathan's field-schema system to TypeScript/React), (4) AI agent enhancements (campaign orchestrator, slot-schema emission, carousel generation), and (5) API layer rewiring (MCP tools, Vite middleware endpoints all switch from file paths to SQLite). These workstreams have a natural dependency order: data layer must come before API layer, API layer before UI, but the content editor and agent enhancements can run in parallel with the UI work.

The phase should be executed using Claude agent teams with 4 teammates operating in well-scoped file domains. The lead coordinates, teammates own: (A) data/API layer, (B) navigation/app-shell UI, (C) content editor right sidebar, and (D) agent orchestration enhancements. Teammate A must complete the SQLite schema and API stubs before B and C begin their data-consuming work.

**Primary recommendation:** Plan as a 4-wave sequence: Wave 0 (SQLite schema + API stubs), Wave 1 (parallel UI + editor + agent work), Wave 2 (integration wiring), Wave 3 (export + DAM + campaign orchestrator skill). Execute Waves 1-2 with agent teams.

---

## Standard Stack

### Core (all already in canvas/package.json — no new installs required for most)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.x (latest) | SQLite persistence layer | Sync API, fastest Node.js SQLite binding, no async complexity in middleware |
| react | ^19.0.0 | UI framework | Already installed |
| zustand | ^5.0.0 | Client state | Already installed — extend stores for campaign/frame/iteration |
| vite | ^6.0.0 | Dev server + middleware | Already installed — API endpoints via configureServer |
| @modelcontextprotocol/sdk | ^1.27.1 | MCP server | Already installed — rewire tools to SQLite |
| html2canvas | (bundled in Jonathan's templates) | JPG/WebP export | Already used in Jonathan's editor.js via postMessage pattern |

### New Installation Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.x | SQLite persistence | Sync reads in Vite middleware (no async hell), WAL mode for concurrent reads |
| @types/better-sqlite3 | ^7.x | TypeScript types | Required for type safety |

**Installation:**
```bash
cd /Users/cheyrasmussen/Fluid-DesignOS/canvas
npm install better-sqlite3 @types/better-sqlite3
```

### Supporting (Jonathan's codebase, no npm install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| html2canvas | bundled in templates | Iframe-to-image capture | Export feature only — keep Jonathan's postMessage pattern |
| jszip | bundled | ZIP download | HTML code export — keep as-is |
| @fluid-commerce/dam-picker | in Jonathan's package.json | DAM asset integration | Wire up DAM UI — check if npm installable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | Prisma + SQLite | Prisma adds ORM complexity; better-sqlite3 sync API is simpler for Vite middleware |
| better-sqlite3 | native Node.js sqlite module | Native is experimental (--experimental-sqlite flag), not production-ready as of March 2026 |
| Zustand stores | React Context | Zustand already established in codebase; Context would be regression |
| iframe sandboxing (keep) | direct DOM rendering | Iframes provide CSS isolation, html2canvas compatibility, and are proven in both systems |

---

## Architecture Patterns

### Recommended Project Structure (new additions to canvas/src/)

```
canvas/
├── src/
│   ├── components/
│   │   ├── (existing)
│   │   ├── Breadcrumb.tsx           # campaign/asset/frame/iteration navigation
│   │   ├── CampaignGrid.tsx         # top-level campaign list (reuses VariationGrid pattern)
│   │   ├── DrillDownGrid.tsx        # generic grid for each drill-down level
│   │   ├── ContentEditor.tsx        # right sidebar: slot fields, photo, brush, export
│   │   ├── SlotField.tsx            # text/image/divider field components
│   │   ├── PhotoReposition.tsx      # Fit/Fill + focus point drag
│   │   ├── BrushTransform.tsx       # SVG overlay for one movable element
│   │   └── CarouselSelector.tsx     # slide tabs in right sidebar
│   ├── store/
│   │   ├── (existing)
│   │   ├── campaign.ts              # campaign/asset/frame/iteration Zustand store
│   │   └── editor.ts                # selected iteration + content slot state
│   ├── lib/
│   │   ├── (existing)
│   │   ├── db.ts                    # better-sqlite3 singleton + schema init
│   │   ├── slot-schema.ts           # TypeScript port of Jonathan's field config format
│   │   └── campaign-types.ts        # Campaign, Asset, Frame, Iteration interfaces
│   └── server/
│       ├── watcher.ts               # extend with /api/campaigns/* routes
│       └── db-api.ts                # all DB read/write logic (server-only)
├── mcp/
│   ├── server.ts                    # rewire tools to use SQLite API
│   └── tools/
│       ├── push-asset.ts            # rewrite: creates Frame + Iteration in DB
│       └── (other tools rewired)
└── fluid.db                         # SQLite database file (gitignored)
```

### Pattern 1: better-sqlite3 Database Singleton

**What:** Single database connection opened once, reused across all middleware requests. WAL mode for concurrent reads from MCP server and Vite API simultaneously.

**When to use:** Every server-side data access in the Vite middleware and MCP server.

```typescript
// Source: better-sqlite3 official docs + community pattern
// canvas/src/lib/db.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../fluid.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');      // concurrent reads
    _db.pragma('foreign_keys = ON');       // enforce referential integrity
    _db.pragma('synchronous = NORMAL');    // safe + faster than FULL
    initSchema(_db);
  }
  return _db;
}
```

### Pattern 2: SQLite Schema for Campaign Hierarchy

**What:** Five tables encoding Campaign > Asset > Frame > Iteration with baseline diff tracking. HTML stays on disk; only paths stored.

**When to use:** This IS the data layer for Phase 7.

```sql
-- Recommended schema (Claude's discretion on exact column design)

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,           -- nanoid, e.g. 'cmp_abc123'
  title TEXT NOT NULL,
  channels TEXT NOT NULL,        -- JSON array: ["instagram", "linkedin"]
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,           -- nanoid
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL,      -- 'instagram', 'linkedin-landscape', 'one-pager' etc.
  frame_count INTEGER NOT NULL DEFAULT 1,  -- 1 for single-frame, N for carousel
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,           -- nanoid
  asset_id TEXT NOT NULL REFERENCES assets(id),
  frame_index INTEGER NOT NULL,  -- 0-based slide index
  created_at INTEGER NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS iterations (
  id TEXT PRIMARY KEY,           -- nanoid
  frame_id TEXT NOT NULL REFERENCES frames(id),
  iteration_index INTEGER NOT NULL,  -- display order
  html_path TEXT NOT NULL,           -- relative path to HTML file on disk
  slot_schema TEXT,                  -- JSON: field definition schema from layout subagent
  ai_baseline TEXT,                  -- JSON: original AI-generated slot values (for diff tracking)
  user_state TEXT,                   -- JSON: current user-modified slot values
  status TEXT NOT NULL DEFAULT 'unmarked',  -- 'winner' | 'rejected' | 'final' | 'unmarked'
  source TEXT NOT NULL DEFAULT 'ai',       -- 'ai' | 'template'
  template_id TEXT,                  -- set when source='template'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (frame_id) REFERENCES frames(id)
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  iteration_id TEXT NOT NULL REFERENCES iterations(id),
  type TEXT NOT NULL,            -- 'pin' | 'sidebar'
  author TEXT NOT NULL DEFAULT 'human',
  text TEXT NOT NULL,
  x REAL,                        -- percentage 0-100 (pin only)
  y REAL,                        -- percentage 0-100 (pin only)
  created_at INTEGER NOT NULL,
  FOREIGN KEY (iteration_id) REFERENCES iterations(id)
);
```

### Pattern 3: Slot Schema — TypeScript Port of Jonathan's Field Config

**What:** Jonathan's JS field config objects ported to TypeScript interfaces. The layout subagent emits this schema as JSON alongside HTML output. The right sidebar reads it to render editor fields.

**When to use:** Every AI-generated asset and every template shares this schema contract.

```typescript
// Source: Adapted from Jonathan's editor.js TEMPLATES config
// canvas/src/lib/slot-schema.ts

export type FieldMode = 'text' | 'pre' | 'br';

export interface TextField {
  type: 'text';
  sel: string;          // CSS selector in template HTML
  label: string;
  mode: FieldMode;
  rows?: number;
}

export interface ImageField {
  type: 'image';
  sel: string;          // CSS selector for <img> element
  label: string;
  dims?: string;        // e.g. '353 × 439px' (display hint)
}

export interface DividerField {
  type: 'divider';
  label: string;        // carousel section separator, e.g. 'Slide 01 — Cover'
}

export type SlotField = TextField | ImageField | DividerField;

export interface SlotSchema {
  templateId?: string;  // set for template-based assets
  width: number;
  height: number;
  fields: SlotField[];
  brush?: string | null;  // CSS selector for movable element (one per template)
  brushLabel?: string;
  carouselCount?: number; // number of slides (undefined for single-frame)
}
```

### Pattern 4: DrillDownGrid Component (Reuse VariationGrid Pattern)

**What:** Parameterized grid component reused at all four levels of the hierarchy. At each level it renders a grid of iframes + action buttons.

**When to use:** Campaign list, Asset list, Frame list, Iteration list — all use this component.

```typescript
// Conceptual interface — implementation is Claude's discretion
interface DrillDownGridProps<T> {
  items: T[];
  renderItem: (item: T) => { html: string; name: string; platform: string };
  onSelect: (item: T) => void;
  emptyState: React.ReactNode;
}
```

### Pattern 5: Vite Middleware API Extension

**What:** Add `/api/campaigns/*` routes to the existing `configureServer` middleware in `watcher.ts`. All DB calls are synchronous (better-sqlite3 sync API), so no async issues.

**When to use:** All new campaign/asset/frame/iteration CRUD operations.

```typescript
// Pattern established in existing watcher.ts:
srv.middlewares.use(async (req, res, next) => {
  if (!req.url?.startsWith('/api/')) return next();
  const db = getDb();

  if (req.url === '/api/campaigns' && req.method === 'GET') {
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(campaigns));
    return;
  }
  // ... more routes
  next();
});
```

### Pattern 6: Collapsible Sidebar State

**What:** Both sidebars can independently collapse to icon strip. Stored in Zustand (not URL) since it's transient UI state.

**When to use:** Left AI chat sidebar and right content editor sidebar.

```typescript
// In canvas/src/store/editor.ts (new store)
interface EditorStore {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  selectedIterationId: string | null;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  selectIteration: (id: string | null) => void;
}
```

### Anti-Patterns to Avoid

- **Direct file writes from LLM/MCP tools:** Keep the established pattern — server owns all writes atomically, LLM never writes metadata directly.
- **ORM over better-sqlite3:** No Prisma, no Drizzle. The sync API is the whole point; an ORM adds async complexity for no benefit here.
- **Separate Express server:** All API endpoints stay in the Vite `configureServer` middleware. Adding Express creates a second process and port-management overhead.
- **Rebuilding the iframe sandboxing pattern:** Iframes are locked. The html2canvas export, CSS isolation, and postMessage pattern are proven and must be kept.
- **Storing HTML in SQLite:** HTML variations stay on disk as files. SQLite stores paths, metadata, and slot state. Storing large HTML blobs in SQLite defeats the purpose.
- **Re-implementing the brush/transform in a new library:** Jonathan's SVG overlay approach with corner handles and center-rotation is the reference. Port it to React/TypeScript, don't replace it with a drag library.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite in Node.js | custom file-based JSON DB | better-sqlite3 | Concurrent reads, transactions, ACID guarantees, WAL mode |
| Image export from iframe | canvas-to-image from scratch | html2canvas (already in Jonathan's templates) | Handles CORS, cross-origin fonts, CSS transforms; postMessage pattern already proven |
| Iframe communication | custom event system | postMessage (Jonathan's proven pattern) | Works across origins, handles sandboxed iframes correctly |
| UUID generation | custom ID scheme | nanoid (already in package.json) | Already installed, URL-safe, collision-resistant |
| Drag/resize for brush transform | a drag library (react-dnd, etc.) | Port Jonathan's SVG overlay directly | His implementation is ~200 lines, handles rotation-aware scaling correctly, no new dependency needed |
| ZIP download for HTML export | custom ZIP | jszip (Jonathan has it) | Already tested in his codebase |

**Key insight:** Jonathan's vanilla JS implementations are the spec AND the implementation reference. Port them to TypeScript/React; don't replace them with different libraries. The patterns work; the only change is the environment.

---

## Common Pitfalls

### Pitfall 1: SQLite WAL Mode + Vite Hot Reload
**What goes wrong:** The `fluid.db` file gets multiple connections opened across hot reloads, potentially causing locking errors.
**Why it happens:** Vite HMR re-executes module code, creating new Database instances, but the old connection isn't closed first.
**How to avoid:** Use a module-level singleton with a guard (`if (_db) return _db`). Set `_db` to null only on explicit cleanup. Add `fluid.db` and `fluid.db-wal` and `fluid.db-shm` to `.gitignore`.
**Warning signs:** `SQLITE_BUSY` errors in console on hot reload.

### Pitfall 2: Iframe Scaling vs PostMessage Coordinate Space
**What goes wrong:** Brush/transform SVG overlay coordinates don't align with iframe content when the iframe is CSS-scaled.
**Why it happens:** The iframe renders at native dimensions (e.g., 1080×1080) and is visually scaled via CSS `transform: scale(N)`. Mouse events hit the scaled bounding box, but the postMessage updates use native coordinates inside the iframe.
**How to avoid:** Jonathan's existing `computeScale()` and the coordinate-division pattern (`clientX / scale`) handles this. Port this math exactly.
**Warning signs:** Brush drag handle appearing at wrong position; elements jumping on drop.

### Pitfall 3: Slot Schema for AI-Generated Assets
**What goes wrong:** AI-generated HTML doesn't have predictable CSS selectors for the slot schema to reference.
**Why it happens:** The layout subagent generates HTML freely; there's no convention about selector names until one is established.
**How to avoid:** The layout subagent must emit a `slot_schema.json` alongside every HTML file. Define the contract (selector naming conventions, required fields) before agents are updated. The existing `context-bundler.ts` pattern is a reference for how agents structure their output metadata.
**Warning signs:** Right sidebar renders empty because schema selectors don't match actual HTML.

### Pitfall 4: Campaign Orchestrator Dispatching to Existing Skills
**What goes wrong:** Campaign orchestrator skill calls `fluid-social`, `fluid-one-pager` etc. but the generated assets land in wrong directories or aren't registered in the DB.
**Why it happens:** Existing skills write to `.fluid/working/{sessionId}/` but the new model needs them to create Frames + Iterations in the SQLite DB.
**How to avoid:** The campaign orchestrator must pass a `campaignId` and `assetId` via environment variable or CLI arg to child skills. Child skills need to call the SQLite API to register their output, not just write files.
**Warning signs:** Generated campaign HTML exists on disk but doesn't appear in the campaign grid.

### Pitfall 5: Right Sidebar State vs Selected Iteration
**What goes wrong:** Right sidebar shows stale content when user navigates between iterations quickly.
**Why it happens:** Loading iteration state is async (fetch from API); rapid navigation can leave the sidebar showing the previous iteration's data.
**How to avoid:** Use the same `_requestId` debounce pattern already in `sessions.ts` (race condition guard) when loading iteration state.
**Warning signs:** Sidebar shows "old" data; clicking different iterations doesn't update editor fields.

### Pitfall 6: `better-sqlite3` Native Module in Vite
**What goes wrong:** Vite tries to bundle `better-sqlite3` as a client module and fails because it's a native Node.js addon.
**Why it happens:** `better-sqlite3` uses a `.node` binary extension; it cannot run in the browser.
**How to avoid:** All `better-sqlite3` imports must live in server-only files (`watcher.ts`, `db.ts`, `db-api.ts`). Never import `db.ts` from a React component. Add it to Vite's `optimizeDeps.exclude` if needed:
```typescript
// vite.config.ts
optimizeDeps: { exclude: ['better-sqlite3'] }
```
**Warning signs:** Build error "cannot import native module"; browser console errors about `fs` module.

---

## Code Examples

### better-sqlite3 Transaction Pattern
```typescript
// Source: better-sqlite3 docs pattern (verified HIGH confidence)
const insertCampaignWithAssets = db.transaction((campaign, assets) => {
  const insertCampaign = db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAsset = db.prepare(
    'INSERT INTO assets (id, campaign_id, title, asset_type, frame_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertCampaign.run(campaign.id, campaign.title, JSON.stringify(campaign.channels), Date.now(), Date.now());
  for (const asset of assets) {
    insertAsset.run(asset.id, campaign.id, asset.title, asset.type, asset.frameCount, Date.now());
  }
});
// Atomic: commits if no exception, rolls back if any insert fails
insertCampaignWithAssets(campaignData, assetsArray);
```

### PostMessage Pattern (Port of Jonathan's editor.js)
```typescript
// Source: Jonathan's editor.js injectListener() — porting to React ref pattern
// In ContentEditor.tsx
const iframeRef = useRef<HTMLIFrameElement>(null);

const updateSlotField = (sel: string, value: string, mode: FieldMode) => {
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'tmpl', sel, value, mode },
    '*'
  );
};

const updateImageField = (sel: string, objectFit: string, objectPosition: string) => {
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'tmpl', sel, action: 'imgStyle', objectFit, objectPosition },
    '*'
  );
};
```

### better-sqlite3 WAL Init (Standard Setup)
```typescript
// Source: well-established community pattern for WAL + FK
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
```

### Agent Team Lead Prompt Template
```text
// Source: code.claude.com/docs/en/agent-teams (HIGH confidence)
Create an agent team to implement Phase 7 of the Fluid Design OS merger.
Spawn 4 teammates with distinct file ownership:
- Teammate A: data layer — canvas/src/lib/db.ts, canvas/src/lib/campaign-types.ts,
  canvas/src/server/db-api.ts, and all /api/campaigns/* routes in watcher.ts
- Teammate B: navigation UI — canvas/src/store/campaign.ts, canvas/src/components/Breadcrumb.tsx,
  canvas/src/components/DrillDownGrid.tsx, canvas/App.tsx (routing logic only)
- Teammate C: content editor — canvas/src/store/editor.ts,
  canvas/src/components/ContentEditor.tsx, canvas/src/components/SlotField.tsx,
  canvas/src/components/PhotoReposition.tsx, canvas/src/components/BrushTransform.tsx,
  canvas/src/components/CarouselSelector.tsx
- Teammate D: agents + MCP — .agents/skills/fluid-campaign/ (new),
  updates to fluid-social and fluid-one-pager skills for slot schema emission,
  canvas/mcp/server.ts, canvas/mcp/tools/*.ts rewiring to SQLite API

Require plan approval from Teammate A before they make any changes.
Teammates B and C must wait for Teammate A to complete the DB schema and API stubs
before beginning their data-consuming work.
```

---

## Agent Teams — How to Run This Phase

This is the most important section for the planner. Phase 7 is a large cross-layer change that genuinely benefits from agent team parallelization. The official docs confirm (HIGH confidence): agent teams are best for "new modules or features where teammates can each own a separate piece without stepping on each other."

### When to Use Agent Teams vs Subagents

| Criterion | Agent Teams | Subagents |
|-----------|------------|-----------|
| Inter-agent communication needed | Yes — B and C need to know what A built | No — use subagents |
| File domains are clean and non-overlapping | Yes — strict file ownership per wave | No — use single session |
| Independent exploration in parallel | Yes (Wave 1) | No |
| Sequential tasks | No — use single session | Yes |

**Phase 7 recommendation:** Use agent teams for Waves 1-2 (parallel implementation). Use single session for Wave 0 (schema design, must be done atomically) and Wave 3 (integration testing).

### Enabling Agent Teams
```json
// Add to settings.json (one-time, not per-session)
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Agent teams are experimental as of March 2026. Known limitations relevant to this phase:
- No session resumption for in-process teammates — if you need to resume, spawn new teammates
- Task status can lag — check manually if a task appears stuck
- One team per session — clean up before starting a new team
- Teammates cannot spawn their own teams (no nested teams)

### Team Structure for Phase 7

**Team size:** 4 teammates + 1 lead = 5 sessions
**Token cost:** ~4x a single session for wave 1 — justified by ~3x faster execution of a large phase

**Strict file ownership prevents conflicts:**

| Teammate | Owns | Blocked by |
|----------|------|------------|
| A: Data/API | `db.ts`, `db-api.ts`, `campaign-types.ts`, `/api/campaigns/*` in watcher.ts, DB schema | Nothing — starts first |
| B: Navigation UI | `campaign.ts` store, `Breadcrumb.tsx`, `DrillDownGrid.tsx`, App.tsx routing | A must provide: DB types + API route signatures |
| C: Content Editor | `editor.ts` store, `ContentEditor.tsx`, `SlotField.tsx`, `PhotoReposition.tsx`, `BrushTransform.tsx`, `CarouselSelector.tsx` | A must provide: Iteration type + slot schema types |
| D: Agents + MCP | `fluid-campaign/` skill, MCP tool rewiring, slot schema contract | A must provide: API endpoints for push_asset replacement |

**Coordination points:**
- Teammate A publishes a `WAVE0-CONTRACTS.md` file in the phase dir when API stubs are done. B, C, D read this before implementing.
- Use `message` (not `broadcast`) to notify specific teammates when unblocking work is done.

### Wave Structure

```
Wave 0 (single session, ~2 hours):
  - SQLite schema design and migration
  - TypeScript types for Campaign/Asset/Frame/Iteration
  - API stub signatures (routes defined, return shapes documented)
  - MCP tool signatures (what push_asset v2 looks like)
  - WAVE0-CONTRACTS.md published

Wave 1 (agent team, parallel, ~3 hours):
  - Teammate A: Full DB API implementation (all CRUD routes)
  - Teammate B: Drill-down navigation + breadcrumbs + collapsible sidebars
  - Teammate C: Content editor (all of Jonathan's right sidebar rebuilt in React)
  - Teammate D: Slot schema contract + layout subagent update + MCP rewire

Wave 2 (agent team or single session, ~2 hours):
  - Integration: wire B + C to A's API
  - Wire D's slot schema output to C's ContentEditor
  - Campaign orchestrator skill connects to B's campaign grid
  - End-to-end flow test: generate campaign → see in grid → select iteration → edit in sidebar

Wave 3 (single session, ~1 hour):
  - Export (JPG, WebP, HTML) — port html2canvas pattern
  - DAM integration UI merge
  - Campaign orchestrator skill final wiring
  - Cleanup: remove old .fluid/working/ session model from UI (archive, don't delete)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage JSON (Jonathan's system) | SQLite via better-sqlite3 | Phase 7 decision | Concurrent read safety, ACID, no LLM fragility |
| Flat session list UI | Campaign > Asset > Frame > Iteration drill-down | Phase 7 | Organizes work around campaigns, not sessions |
| Sessions = single generation round | Iterations per Frame | Phase 7 | Enables per-frame independent history |
| No right-sidebar editor | Content slot editor with schema-driven fields | Phase 7 | Full manual editing parity with template-based workflow |
| Single-asset generation | Multi-channel campaign generation | Phase 7 | One prompt → full campaign across all channels |

**Deprecated/outdated after Phase 7:**
- `.fluid/working/{sessionId}/` file structure: archived, no longer the primary data store
- Flat `sessions` Zustand store: replaced by `campaign` store with drill-down hierarchy
- MCP `push_asset` writing to `.fluid/working/`: rewired to SQLite API

---

## Open Questions

1. **`@fluid-commerce/dam-picker` npm availability**
   - What we know: Jonathan's package.json references it; the DAM UI elements are in his HTML/JS
   - What's unclear: Whether this package is publicly available on npm or private to Fluid's org
   - Recommendation: Check `npm info @fluid-commerce/dam-picker` before Wave 0. If private/unavailable, scaffold the UI as a "coming soon" placeholder with the correct HTML structure but no functionality.

2. **Slot schema for AI-generated assets — LLM instruction format**
   - What we know: Layout subagent must emit slot_schema.json alongside HTML. The schema format is defined in this research.
   - What's unclear: Whether the current layout subagent (Haiku) can reliably emit well-formed JSON schemas with correct CSS selectors that match its own HTML output.
   - Recommendation: Test the slot schema instruction on 3 sample generations before committing the ContentEditor to depend on it. Have a fallback: if no schema is emitted, ContentEditor shows "No editable slots (AI-generated)" gracefully.

3. **File path convention for HTML variations**
   - What we know: HTML stays on disk, path in DB. Current model: `.fluid/working/{sessionId}/round-{N}/{variationId}.html`
   - What's unclear: Whether the new model should use a parallel directory structure (e.g., `.fluid/campaigns/{campaignId}/assets/{assetId}/frames/{frameId}/iterations/{iterationId}.html`) or reuse the existing session-based layout with DB tracking layered on top.
   - Recommendation: New directory structure matches the data model. Cleaner mental model. The old `.fluid/working/` sessions remain accessible (not deleted) as archived legacy data.

4. **Wave 0 schema vs the existing annotations table**
   - What we know: Annotations currently live in `.fluid/working/{sessionId}/annotations.json`. In the new model they should be in the SQLite `annotations` table.
   - What's unclear: The existing annotation schema has `variationPath` (file path). In the new model, annotations reference `iteration_id`. This is a type-safe migration.
   - Recommendation: Wave 0 must explicitly design the annotation table to reference `iteration_id`, not paths. The MCP `read_annotations` tool gets updated in Wave 1/Teammate D.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 (already installed) |
| Config file | vitest.config embedded in vite.config.ts via `test:` key |
| Quick run command | `cd canvas && npx vitest run --reporter=verbose` |
| Full suite command | `cd canvas && npx vitest run` |

### Phase Requirements → Test Map

| Area | Behavior | Test Type | File |
|------|----------|-----------|------|
| DB schema | Tables create correctly; FK constraints enforced | unit | `canvas/src/__tests__/db.test.ts` — Wave 0 |
| Campaign CRUD | Create/read/update campaigns via API | unit | `canvas/src/__tests__/campaign-api.test.ts` — Wave 1 |
| Slot schema | Schema parses correctly; selectors map to field types | unit | `canvas/src/__tests__/slot-schema.test.ts` — Wave 1 |
| PostMessage | Field updates reach iframe via postMessage | unit (jsdom) | `canvas/src/__tests__/content-editor.test.ts` — Wave 1 |
| MCP tools rewire | push_asset creates DB records | unit | `canvas/mcp/__tests__/tools.test.ts` — extend existing |
| Drill-down nav | Breadcrumb renders correct path | unit (React) | `canvas/src/__tests__/Breadcrumb.test.tsx` — Wave 1 |
| Export | JPG/WebP export via html2canvas postMessage | manual | Manual test only (html2canvas requires real browser) |

### Sampling Rate
- **Per task commit:** `cd canvas && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd canvas && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `canvas/src/__tests__/db.test.ts` — covers DB schema creation + FK constraints
- [ ] `canvas/src/__tests__/campaign-api.test.ts` — covers CRUD for all 4 hierarchy levels
- [ ] `canvas/src/__tests__/slot-schema.test.ts` — covers TypeScript slot schema types
- [ ] `canvas/src/lib/db.ts` — the singleton itself (new file)

---

## Sources

### Primary (HIGH confidence)
- [code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams) — Agent teams architecture, how to enable, team/teammate structure, best practices, limitations
- Jonathan's `editor.js` (`Reference/Context/Jonathan's Codebase/editor.js`) — TEMPLATES config, field types, postMessage IPC, brush/transform, export pattern — direct inspection
- Existing `canvas/src/` codebase — direct inspection of VariationGrid, AssetFrame, watcher.ts API patterns, Zustand store patterns, MCP server
- `Reference/Context/project-merger/` — All 14 merger planning documents, direct inspection

### Secondary (MEDIUM confidence)
- [npmjs.com/package/better-sqlite3](https://www.npmjs.com/package/better-sqlite3) — Current version, WAL mode, sync API pattern (WebFetch returned 403; confirmed via WebSearch summary)
- [WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Sync transaction pattern, pragma usage

### Tertiary (LOW confidence — validate before implementation)
- WebSearch for `@fluid-commerce/dam-picker` availability — not verified; check with `npm info` before Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries already in package.json; better-sqlite3 is the standard sync SQLite choice for Node.js middleware
- Architecture patterns: HIGH — directly derived from existing codebase patterns and Jonathan's working implementation
- SQLite schema: MEDIUM — schema design is Claude's discretion per CONTEXT.md; structure follows the data hierarchy decisions exactly; exact column design is flexible
- Agent teams: HIGH — sourced directly from official Claude Code docs
- Pitfalls: HIGH — derived from direct code inspection of existing codebase + known Node.js + Vite patterns

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (agent teams feature is experimental; re-check docs if planning > 30 days out)
