# Fluid DesignOS

AI-powered creative workspace for generating brand-correct marketing assets. Operators describe what they need in natural language; a single creative agent produces pixel-ready HTML (social posts, website sections, one-pagers, carousels) that looks and sounds like the configured brand.

## Quick Start

```bash
cd canvas && npm install && npm run dev
```

- **Canvas app:** http://localhost:5174/app/
- **Template library:** http://localhost:5174/
- **Brand assets served at:** `/fluid-assets/*`

## Running Locally — Claude Authentication

The agent runtime uses `@anthropic-ai/claude-agent-sdk`. Two auth paths are supported:

**Option A — API key (CI + production):**
```bash
# Add to .env at repo root (or export in your shell)
ANTHROPIC_API_KEY=sk-ant-...
```

**Option B — Claude CLI login (local dev, one-time setup):**
```bash
# Install the Claude CLI if not already present, then:
claude login
# Follow the OAuth flow. Credentials are saved to ~/.claude/.credentials.json
# No API key provisioning needed; the SDK picks up the session automatically.
```

API key takes precedence if both are set. `GET /api/health` returns `anthropic: 'ok'`
for either path.

## Other Environment Variables

- `VITE_FLUID_DAM_TOKEN` — optional, for DAM picker integration
- `GEMINI_API_KEY` — required for AI image generation (generate_image tool)
- `FLUID_AGENT_MODEL` — override the Claude model (default: `claude-sonnet-4-6`)
- `FLUID_DISPATCH_TRUSTED` — set to `true` to bypass ask-first tool permission prompts
- `FLUID_DAILY_COST_CAP_USD` — daily spend cap for image generation (default: `10.00`)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.6, Zustand 5, Vite 6 |
| Backend | Vite middleware plugin (no Express) |
| Database | SQLite (better-sqlite3, WAL mode) |
| AI | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) with MCP tool servers, SSE streaming |
| Testing | Vitest + Playwright |
| Styling | Plain CSS (no Tailwind in the app itself) |

## Project Structure

```
canvas/                        # The app (React + Vite + SQLite)
  src/
    App.tsx                    # Main app shell + navigation state machine
    components/                # React components (CampaignDashboard, ChatSidebar, etc.)
    store/
      campaign.ts              # Nav state machine + data cache + race-condition guard
      chat.ts                  # Chat sessions + SSE streaming + tool-call UI
      editor.ts                # Slot editing UI state
    server/
      watcher.ts               # Vite plugin: all API routes + file watcher + HMR
      agent.ts                 # Creative agent: tool-use loop + SSE streaming + cancellation
      agent-tools.ts           # Agent tool implementations
      agent-system-prompt.ts   # Tier 1 rules + UI context layering
      brand-brief.ts           # Assembles Tier 2 Brand Brief from DB
      chat-routes.ts           # /api/chats/* handlers
      db-api.ts                # Campaign/Creation/Slide/Iteration CRUD
      brand-seeder.ts          # Seeds DB from voice-guide/ + pattern-seeds/
      render-engine.ts         # Playwright render for agent self-critique
      validation-hooks.ts      # Post-save validation
      observability.ts         # Chat event logging
    lib/
      db.ts                    # SQLite singleton (WAL, FK constraints)
      campaign-types.ts        # TypeScript interfaces for the data model
      template-configs.ts      # Template metadata + slot schemas
    hooks/                     # useFileWatcher, useRouteSync, useAssets, …
    __tests__/                 # Vitest tests (real SQLite, no mocking)
  mcp/
    server.ts                  # MCP server (stdio) — push_asset tool
    tools/push-asset.ts        # Sole MCP tool implementation
  fluid.db                     # SQLite database (gitignored)
  vite.config.ts               # Base /app/, fluidWatcherPlugin, port 5174

tools/                         # CLI validation tools (Node.js CommonJS)
assets/                        # Brand assets (SVGs, fonts, textures, logos, photos)
archetypes/                    # Brandless structural layout patterns (filesystem, not DB)
  SPEC.md                      # Authoritative format specification
  components/                  # Reusable design component patterns (pattern.html + README)
  {archetype-slug}/            # One dir per archetype (index.html + schema.json + README)
templates/                     # Template library (social/, gold-standard/, one-pagers/)
pattern-seeds/                 # Clean markdown pattern files (seeded into DB)
patterns/                      # Legacy visual pattern page (archival — DB is source of truth)
voice-guide/                   # Brand voice docs (seeded into DB)
feedback/                      # Agent-written usage data for learning loop
Reference/                     # Archival source material (NEVER load directly)
skills/marketing/              # Marketing domain skills (distributed globally via sync.sh)

.claude/
  skills/                      # Claude Code skills (brand-intelligence, brand-compliance-check, …)
  settings.json                # Permissions + PostToolUse validation hooks

.fluid/                        # Runtime output (generated HTML + working files)
  campaigns/{cId}/{creationId}/{slideId}/{iterationId}.html   # Canonical output paths
  working/{sessionId}/         # Scratch space

.planning/                     # GSD project management (roadmap, phases, state) — gitignored
.mcp.json                      # MCP server registration (stdio)
```

## Data Model

```
Campaign (organizing unit — "Q1 Social Push")
  └── Creation (single deliverable — "Instagram Post", "LinkedIn Carousel")
       └── Slide (one page; carousels have multiple slides)
            └── Iteration (one generated version of that slide)
                 └── Annotation (pin or sidebar note on iteration)
```

Key fields on Iteration:
- `htmlPath` — relative path to HTML file on disk
- `generationStatus` — AI lifecycle: `pending` → `generating` → `complete`
- `status` — user review: `unmarked` | `winner` | `rejected` | `final`
- `aiBaseline` — immutable original AI values (JSON)
- `userState` — current user-edited slot values (JSON)
- `source` — `ai` (generated) or `template` (from gallery)

## Database

**Path:** `canvas/fluid.db` (override with `FLUID_DB_PATH` env var)

SQLite with WAL mode (concurrent reads from MCP + Vite), foreign keys ON.

**Tables:**
- `campaigns`, `creations`, `slides`, `iterations`, `annotations` — campaign hierarchy
- `chats`, `chat_messages` — agent conversation history
- `voice_guide_docs` — brand voice rules (seeded from `voice-guide/*.md`)
- `brand_patterns` — visual design tokens + patterns (seeded from `pattern-seeds/*.md`)
- `templates` — template definitions with slot schemas
- `template_design_rules` — per-template brand rules with weights
- `brand_assets` — asset registry (scanned from `assets/` directory)
- `campaign_assets`, `saved_assets` — per-campaign and DAM-linked assets
- `context_map`, `context_log` — brand-section routing + audit trail

**Seeding:** On first app startup, `brand-seeder.ts` populates `voice_guide_docs` from `voice-guide/*.md` and `brand_patterns` from `pattern-seeds/*.md`. Also auto-imports brand config from `canvas/seed-data.json` if present (brand data only — no user data like campaigns/creations).

**Sharing DB state between teammates:**
`fluid.db` is gitignored — each developer has their own local copy. To share brand data, templates, and design rules:

```bash
node tools/db-export.cjs                 # Export DB → canvas/seed-data.json (commit to git)
node tools/db-import.cjs [--merge]       # Import seed-data.json into local DB
```

On first startup, if `canvas/seed-data.json` exists and the DB is empty, it auto-imports. For existing DBs, run `db-import.cjs --merge` manually. If things are broken, delete `canvas/fluid.db` and restart — it rebuilds from seeds + seed-data.json.

**Integrity:** On every startup, `PRAGMA foreign_key_check` runs to detect and clean orphaned records automatically.

## Brand Data

Brand data lives in the SQLite database, managed through the app UI. There are NO brand files to read from disk.

**Six pages in the app manage brand data and configuration:**
- **Voice Guide** — voice rules, messaging frameworks, identity docs
- **Patterns** — two sections: Foundations (colors, typography) and Rules (layout archetypes, brushstroke rendering, circle emphasis, opacity patterns, etc.). Each pattern has a weight and optional `is_core` flag.
- **Assets** — brand assets in 4 categories: Fonts, Images, Brand Elements, Decorations. Served at `/fluid-assets/` URLs. Optional description field per asset. DAM sync auto-categorizes by mime type.
- **Templates** — reference templates with per-template design rules (scope: global-social, platform, archetype)
- **Styles** — CSS layer system and component groups
- **Settings** — context map editor for configuring which brand sections are injected per (creation_type, stage) combination. Shows token budgets and injection priorities.

**Navigation:** LeftNav with Create, My Creations, Assets, Templates, Patterns, Voice Guide, Settings (gear icon at bottom). Chat sidebar toggles independently.

Do NOT read from `brand/` files (that directory does not exist). Do NOT duplicate brand doc content in prompts.

### Weight System

Brand rules carry weights 1-100:
- **81-100** = must follow (brand-critical)
- **51-80** = should follow (strong preference)
- **21-50** = recommended (flexible)
- **1-20** = nice-to-have (optional)

## Archetype System

Archetypes are **brandless structural layout patterns** — content skeletons that define spatial hierarchy without any brand expression. They live on the filesystem (`archetypes/`), not in the database.

**Key architectural norms:**
- **Brand-neutral:** No brand fonts, colors, assets, `text-transform: uppercase`, vertical side labels, or any brand convention. Casing, decoration, and styling are brand-layer decisions applied at generation time.
- **Background/content/foreground split:** Archetypes define content layout only. Two layers bracket the content: `.background-layer` (z-index 0) receives textures, brushstrokes, and gradient washes; `.foreground-layer` (z-index 10) receives borders, frames, and watermarks. Content sits between them at z-index 2.
- **`archetypeId`, not `templateId`:** Archetype schemas use `archetypeId` to avoid collision with `TEMPLATE_SCHEMAS` resolution in `template-configs.ts`. `brush` is always `null` — the brand layer provides decorative transform targets.
- **Identical output shape:** Both templates and archetypes produce renderable HTML + SlotSchema. The agent can select either; the editor sidebar works with both.
- **Components are patterns, not runtime includes:** Design components (`archetypes/components/`) are reference HTML/CSS patterns. When building an archetype, copy the markup structure and SlotSchema fields — there is no partial/import system.

See `archetypes/SPEC.md` for the authoritative format specification.

## Creative Agent

A single Anthropic tool-use loop (`canvas/src/server/agent.ts`) handles the whole flow. There are no staged sub-agents.

**Flow:**
1. User sends a message to `/api/chats/:id/messages`
2. Server builds the system prompt: Tier 1 universal rules + Tier 2 Brand Brief + UI context
3. Agent loop runs: model emits text, calls tools, reads results, continues until it's done
4. Assistant text and tool events stream to the UI over SSE (`chat_delta`, `tool_start`, `tool_result`, `creation_ready`, `done`)
5. When the agent calls `save_creation`, the server writes the iteration to SQLite + disk, runs validation hooks, and emits a `creation_ready` event

**System prompt layering (`agent-system-prompt.ts`):**
- **Tier 1 (static):** universal rules — structural HTML rules, intent gating, platform dimensions. Cacheable.
- **Tier 2 (static):** Brand Brief assembled from `voice_guide_docs`, `brand_patterns`, and `brand_assets`. Cacheable.
- **Dynamic:** current UI context (active campaign/creation/iteration). Not cached because it changes every request.

**Agent tools (`agent-tools.ts`):**
- **Brand discovery:** `list_voice_guide`, `read_voice_guide`, `list_patterns`, `read_pattern`, `list_assets`, `list_templates`, `read_template`, `list_archetypes`, `read_archetype`
- **Creation writing:** `save_creation`, `edit_creation`, `save_as_template`, `get_creation`, `get_campaign`
- **Brand editing (gated on explicit user intent):** `update_pattern`, `create_pattern`, `delete_pattern`, `update_voice_guide`, `create_voice_guide`
- **Visual self-critique:** `render_preview` (Playwright-rendered screenshot)

**Hard rules (enforced in the Tier 1 prompt, not in DB):**
- All CSS in `<style>` blocks with class selectors — never inline `style=""` attributes
- Self-contained HTML — no external CDN links or stylesheet references
- Decorative elements use `<div>` with `background-image: url()` — never `<img>` tags
- Only fonts listed in the Brand Brief's Asset Manifest are allowed
- Every creation must include a complete SlotSchema based on an archetype
- Use the background-layer / content / foreground-layer structure from archetypes

## API Endpoints

All routes served from Vite middleware (`canvas/src/server/watcher.ts`):

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/campaigns` | GET, POST | List/create campaigns |
| `/api/campaigns/:id` | GET, PATCH | Read/update campaign |
| `/api/campaigns/:cId/creations` | GET | List creations in campaign |
| `/api/creations/:id/slides` | GET | List slides in creation |
| `/api/slides/:id/iterations` | GET | List iterations in slide |
| `/api/iterations/:id` | GET, PATCH | Read/update iteration |
| `/api/iterations/:id/html` | GET | Serve iteration HTML (with path fallback + slot application) |
| `/api/iterations/:id/status` | PATCH | Update review status |
| `/api/chats` | GET, POST | List/create chats |
| `/api/chats/:id` | GET, DELETE | Read/delete chat |
| `/api/chats/:id/messages` | POST | Send message (SSE stream of agent output) |
| `/api/chats/:id/cancel` | POST | Cancel in-flight generation |
| `/api/context-map` | GET, POST, PUT/:id, DELETE/:id | CRUD for brand-section routing |
| `/api/context-log` | GET | Audit trail of injected context per generation |
| `/api/templates` | GET, POST | List/create templates |
| `/api/uploads/chat-image` | POST | Upload image to chat |
| `/` | GET | Template library (static HTML) |
| `/app/*` | GET | React canvas app |
| `/fluid-assets/*` | GET | Brand assets |

**HTML serving** uses a 4-strategy fallback: stored path → `.fluid/` relative → canonical path → templates fallback. After loading, the server rewrites asset paths, injects `<base href>`, applies `userState` slot values, and adds a postMessage listener for live editing.

## MCP Server

Registered in `.mcp.json`, runs as stdio process (`npx tsx canvas/mcp/server.ts`).

**Tool:** `push_asset` — creates Iteration record + writes HTML to canonical path. Used by external Claude Code sessions that want to push generated output into the canvas from outside the app.

The canvas's own creative agent does NOT go through MCP — it calls its tool set directly in the same process.

**API base:** `http://localhost:5174` (override with `MCP_API_BASE` env)

## CLI Tools

Validation tools in `tools/`:

```bash
node tools/brand-compliance.cjs <file>                   # Validate HTML against brand rules
node tools/schema-validation.cjs <file>                  # Validate .liquid against Gold Standard schema
node tools/dimension-check.cjs <file> --target <type>    # Check dimensions (instagram, linkedin_landscape, linkedin_tall)
node tools/scaffold.cjs <section-name>                   # Generate Gold Standard .liquid skeleton
node tools/validate-archetypes.cjs                       # Validate archetype SPEC conformance
node tools/db-export.cjs                                 # Export DB → canvas/seed-data.json (brand data only)
node tools/db-import.cjs [--merge] [--force]             # Import seed-data.json into DB
node tools/verify-context-sizes.cjs                      # Check pattern sizes
node tools/feedback-ingest.cjs [--dry-run]               # Analyze feedback, generate proposals
```

Validators read from the SQLite database. The app must run at least once to seed the DB.

## Testing

```bash
cd canvas
npm test                    # Run all tests
npm test -- db.test         # Run specific test file
npm run test:watch          # Watch mode
```

- Uses Vitest with real SQLite (no mocking)
- Each test gets an isolated temp DB via `FLUID_DB_PATH` env var
- Tests cover components, API, DB, brand context, routing

## State Management

**Zustand stores** in `canvas/src/store/`:
- `campaign.ts` — navigation state machine + data cache + race condition guard (`_requestId` counter)
- `chat.ts` — active chat + message stream + tool-call UI + cancellation
- `editor.ts` — slot editing mode + modified values

**HMR integration:** Server sends `fluid:file-change` custom Vite event → `useFileWatcher` hook refreshes store (debounced 200ms, paused during generation).

## Key Conventions

- **Canonical HTML paths:** `.fluid/campaigns/{campaignId}/{creationId}/{slideId}/{iterationId}.html`
- **Working directory:** `.fluid/working/{sessionId}/`
- **Asset URLs in HTML:** use `/fluid-assets/...` (server rewrites `../../assets/` automatically)
- **IDs:** nanoid-generated (e.g., `cmp_xxx`, `cre_xxx`, `sld_xxx`, `itr_xxx`)
- **No Express:** all backend routes are Vite middleware in `watcher.ts`
- **No Tailwind in app:** plain CSS. (Tailwind only appears in generated output HTML)

## Important Rules

- Do NOT read from `brand/` files — that directory does not exist. All brand data is in the DB.
- Do NOT duplicate brand doc content in prompts; the Brand Brief is assembled from the DB.
- `Reference/` is archival only — never load directly.
- `archetypes/SPEC.md` is the authoritative format reference for building archetypes. Do not invent format conventions — follow the spec.
- Archetypes must be 100% brand-neutral: no `text-transform: uppercase`, no rotated side labels, no brand fonts/colors/assets. Casing and decoration are brand-layer decisions.
- `feedback/` is for agents to write usage data back (learning loop).
- `voice-guide/*.md` and `pattern-seeds/*.md` are seed sources — the DB is the live copy.
- Pattern content is clean markdown with code snippets — never raw HTML or base64. All assets referenced via `/api/brand-assets/serve/` URLs.
- `seed-data.json` contains brand config only (no campaigns/creations/slides/iterations). User data stays local to each developer's DB.
- The app must be running (`npm run dev`) for the chat agent, MCP push_asset, and API endpoints to work.
