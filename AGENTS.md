# Fluid Creative OS

AI-powered creative workspace for generating brand-correct marketing assets. Operators describe what they need in natural language; the system produces pixel-ready HTML (social posts, website sections, one-pagers, carousels) that looks and sounds like Fluid made it.

## Quick Start

```bash
cd canvas && npm install && npm run dev
```

- **Canvas app:** http://localhost:5174/app/
- **Template library:** http://localhost:5174/
- **Brand assets served at:** `/fluid-assets/*`

Environment variables (`.env` at repo root):
- `ANTHROPIC_API_KEY` — required for generation
- `VITE_FLUID_DAM_TOKEN` — optional, for DAM picker integration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.6, Zustand 5, Vite 6 |
| Backend | Vite middleware plugin (no Express) |
| Database | SQLite (better-sqlite3, WAL mode) |
| AI | Anthropic SDK, Model Context Protocol (MCP) |
| Testing | Vitest + Playwright |
| Styling | Plain CSS (no Tailwind in the app itself) |

## Project Structure

```
canvas/                        # The app (React + Vite + SQLite)
  src/
    App.tsx                    # Main app shell + navigation state machine
    components/                # React components (CampaignDashboard, DrillDownGrid, etc.)
    store/                     # Zustand stores (campaign.ts, editor.ts, generation.ts)
    server/
      watcher.ts               # Vite plugin: all API routes + file watcher + HMR
      api-pipeline.ts          # Anthropic SDK integration, generation pipeline
      db-api.ts                # Campaign/Creation/Slide/Iteration CRUD
      brand-seeder.ts          # Seeds DB from voice-guide/*.md + pattern-seeds/*.md
    lib/
      db.ts                    # SQLite singleton (WAL, FK constraints)
      campaign-types.ts        # TypeScript interfaces for data model
      template-configs.ts      # Template metadata + slot schemas
    hooks/                     # useFileWatcher, useGenerationStream, useAssets
    __tests__/                 # 29 test files (Vitest, real SQLite, no mocking)
  mcp/
    server.ts                  # MCP server (stdio) for agent-canvas communication
    tools/                     # push-asset (active), read-annotations/statuses/history (legacy)
  fluid.db                     # SQLite database (production)
  vite.config.ts               # Base /app/, fluidWatcherPlugin, port 5174

tools/                         # CLI validation + verification tools (Node.js CommonJS)
assets/                        # Brand assets (SVGs, fonts, textures, logos, photos)
templates/                     # Template library (social/, gold-standard/, one-pagers/)
pattern-seeds/                 # Clean markdown pattern files (seeded into DB)
patterns/                      # Legacy visual pattern page (archival — DB is source of truth)
voice-guide/                   # Brand voice docs (13 .md files, seeded into DB)
feedback/                      # Agent-written usage data for learning loop
Reference/                     # Archival source material (NEVER load directly)
skills/marketing/              # 30+ marketing domain skills for subagent use

.agents/skills/                # Project-scoped agent skills (fluid-campaign orchestrator)
.claude/
  agents/                      # Subagent definitions (copy, layout, styling, spec-check)
  skills/                      # Claude Code skills (brand-intelligence, fluid-social, etc.)
  settings.json                # Permissions + PostToolUse validation hooks

.fluid/                        # Runtime output (generated HTML + working files)
  campaigns/{cId}/{creationId}/{slideId}/{iterationId}.html   # Canonical output paths
  working/{sessionId}/         # Scratch space during generation

.planning/                     # GSD project management (roadmap, phases, state)
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
- `voice_guide_docs` — brand voice rules (seeded from `voice-guide/*.md`)
- `brand_patterns` — visual design tokens + patterns (seeded from `pattern-seeds/*.md`)
- `templates` — template definitions with slot schemas
- `template_design_rules` — per-template brand rules with weights
- `brand_assets` — asset registry (scanned from `assets/` directory)
- `campaign_assets`, `saved_assets` — per-campaign and DAM-linked assets
- `context_map` — maps (creation_type, stage) to brand sections for smart context injection
- `context_log` — audit trail of what brand context was injected per generation

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

**Four pages in the app manage brand data:**
- **Voice Guide** — voice rules, messaging frameworks, identity docs
- **Patterns** — design tokens (colors, typography, spacing), visual patterns (brushstrokes, circles, textures)
- **Assets** — brand assets (fonts, images, logos) served at `/fluid-assets/` URLs
- **Templates** — reference templates with design rules

**Agents access brand context via pipeline tools:**
- `list_brand_sections(category?)` — discover available brand docs
- `read_brand_section(slug)` — load a specific brand doc from DB
- `list_brand_assets(category?)` — list available brand assets with URLs

Do NOT read from `brand/` files (that directory does not exist). Do NOT duplicate brand doc content in prompts.

### Weight System

Brand rules carry weights 1-100:
- **81-100** = must follow (brand-critical)
- **51-80** = should follow (strong preference)
- **21-50** = recommended (flexible)
- **1-20** = nice-to-have (optional)

## Generation Pipeline

When a user submits a prompt via the sidebar, the system:

1. Parses prompt for channel hints (instagram, linkedin, etc.)
2. Pre-creates Campaign + Creation + Slide + Iteration records in SQLite
3. Runs parallel subagents per creation through a 4-stage pipeline:

```
copy → layout → styling → spec-check (→ fix if needed)
```

4. Each stage uses Anthropic API with tool use (read_file, write_file, brand tools)
5. Writes final HTML to `.fluid/campaigns/{cId}/{creationId}/{slideId}/{iterationId}.html`
6. Pushes HMR event to browser; React refreshes automatically

**Model assignments:**
- **Copy:** Sonnet (creative writing, brand voice)
- **Layout:** Haiku (structural, cost-optimized — spec-check catches errors)
- **Styling:** Sonnet (complex CSS composition)
- **Spec-check:** Sonnet (holistic brand judgment)

**Smart context injection:** The `context_map` table maps (creation_type, pipeline_stage) to specific brand sections. Agents receive pre-loaded brand context instead of discovering it via tools. Token budgets: Copy ~8K, Layout ~6K, Styling ~10K. Per-section cap (60% of budget) prevents any single section from monopolizing the injection. Safety caps truncate oversized sections.

**Hard rules extraction:** Brand patterns with weight ≥ 81 are automatically parsed and promoted to system prompt directives (injected into layout/styling stages as `## Hard Rules (NON-NEGOTIABLE)`). This ensures the model treats critical brand rules as constraints, not suggestions.

**Asset manifest pre-injection:** The styling stage receives a pre-built manifest of all brand asset URLs (fonts, brushstrokes, logos) in the system prompt. Eliminates the need for agents to call `list_brand_assets` and prevents wrong URL format guessing.

**Campaign copy accumulator:** In-memory tracker prevents headline/tagline repetition across creations within the same campaign. Each copy agent receives prior creations' headlines and taglines as negative examples.

**Micro-fix loop:** Before spinning up full API-based fix agents, the pipeline attempts regex-based fixes for simple violations (wrong background color, non-brand font families). Saves ~$0.03 and ~15s per fix.

**Design DNA:** For social posts, layout and styling stages receive Design DNA (visual compositor contract + platform rules + archetype notes + HTML exemplar) in the system prompt. Injected once — not duplicated in the user prompt.

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
| `/api/generate` | POST | Start generation (SSE stream) |
| `/api/templates` | GET, POST | List/create templates |
| `/` | GET | Template library (static HTML) |
| `/app/*` | GET | React canvas app |
| `/fluid-assets/*` | GET | Brand assets |

**HTML serving** uses a 4-strategy fallback: stored path → .fluid/ relative → canonical path → templates fallback. After loading, the server rewrites asset paths, injects `<base href>`, applies `userState` slot values, and adds postMessage listener for live editing.

## MCP Server

Registered in `.mcp.json`, runs as stdio process (`npx tsx canvas/mcp/server.ts`).

**Active tool:** `push_asset` — creates Iteration record + writes HTML to canonical path. This is the primary write path for agents pushing generated output to the canvas.

**API base:** `http://localhost:5174` (override with `MCP_API_BASE` env)

## Subagent Architecture

Four subagent roles defined in `.claude/agents/`:

| Agent | Model | Input | Output |
|-------|-------|-------|--------|
| **copy-agent** | Sonnet | prompt, mode, platform | `{working_dir}/copy.md` with headline, body, tagline, CTA |
| **layout-agent** | Haiku | copy.md, layout archetypes, specs | `{working_dir}/layout.html` with positioned containers + SLOT comments |
| **styling-agent** | Sonnet | copy.md, layout.html, brand tokens | `{working_dir}/styled.html` — fully styled HTML/CSS |
| **spec-check-agent** | Sonnet | styled.html, brand rules | Pass/fail report with fix directives |

Each creation gets its own subagent with fresh context — no cross-contamination between assets.

## CLI Tools

Validation tools in `tools/`. Run after generating output:

```bash
node tools/brand-compliance.cjs <file>              # Validate HTML against brand rules (colors, fonts)
node tools/schema-validation.cjs <file>              # Validate .liquid against Gold Standard schema
node tools/dimension-check.cjs <file> --target <type> # Check dimensions (instagram, linkedin_landscape, linkedin_tall)
node tools/scaffold.cjs <section-name>               # Generate Gold Standard .liquid skeleton
node tools/db-export.cjs                             # Export DB to canvas/seed-data.json (brand data only)
node tools/db-import.cjs [--merge] [--force]         # Import seed-data.json into DB
node tools/verify-context-sizes.cjs                  # Check pattern sizes + simulate pipeline token usage
node tools/feedback-ingest.cjs [--dry-run]           # Analyze feedback, generate proposals
node tools/simulate-pipeline.cjs "<prompt>"           # Run full pipeline from CLI (see Pipeline Simulation below)
node tools/simulate-pipeline.cjs --prompt "..." --dry-run  # Set up DB records + dirs only (no API calls)
node tools/simulate-pipeline.cjs --batch prompts.txt --report report.json  # Batch test
```

Note: Validation tools read from the SQLite database. The app must run at least once to seed the DB.

## Pipeline Simulation

To test the generation pipeline at scale without the browser UI, use `simulate-pipeline.cjs` or run manual agent-based simulations.

### Using the CLI harness

```bash
# Single prompt — runs the real pipeline with Anthropic API calls
node tools/simulate-pipeline.cjs "Create an Instagram post about Fluid Connect"

# Dry-run — creates DB records + filesystem only, for manual agent simulation
node tools/simulate-pipeline.cjs --prompt "Launch a campaign for Payments" --dry-run

# Batch — read prompts from file, run each, output JSON report
node tools/simulate-pipeline.cjs --batch test-prompts.txt --report results.json
```

The CLI harness uses the **exact same code paths** as the app: `parseChannelHints()` for routing, `createCampaign/Creation/Slide/Iteration` for DB records, `runApiPipeline()` for the 4-stage pipeline, and `brand-compliance.cjs` for spec-check. The only difference is no SSE streaming to a browser.

### Agent-based simulation (manual)

When simulating without API calls (spawning subagents as the pipeline stages), follow these rules:

1. **File paths:** HTML output goes to `{PROJECT_ROOT}/.fluid/campaigns/{campaignId}/{creationId}/{slideId}/{iterationId}.html` — NOT inside `canvas/`. The app resolves `html_path` relative to the project root.

2. **DB records:** Use the `--dry-run` mode of simulate-pipeline.cjs to create proper DB records, or create them manually with nanoid IDs, millisecond timestamps, and correct foreign keys (campaign → creation → slide → iteration).

3. **Brand context:** Agents in the real pipeline access brand data via tools (`list_brand_assets`, `read_brand_section`, etc.) that return exact URLs and formatted content. When simulating, either:
   - Query the SQLite DB directly (`sqlite3 canvas/fluid.db "SELECT ..."`)
   - Or use the `--dry-run` output which lists working directories where you can dump context files

4. **Spec-check:** Run `node tools/brand-compliance.cjs <file> --context social|website` after each generation. Social posts must use context `social` (enforces #000 bg). One-pagers use `website` (allows #050505).

5. **DB finalization:** After generation, update `iterations.generation_status` from `pending` to `complete`.

### What to evaluate

When reviewing simulation output, check:

- **Brand compliance** — run the validator, track pass/fail rates by creation type
- **Copy quality** — voice guide adherence, body length (IG: 1-2 sentences, LI: 2-3), tagline variety within campaigns, stat-proof headlines (must be numbers not sentences)
- **Styling quality** — background color (#000 for social), asset URL format (/api/brand-assets/serve/{name} with no subdirs/extensions), font fallbacks (sans-serif only), position:absolute for social layout
- **Routing accuracy** — single vs campaign detection, channel inference, DB record correctness
- **Campaign coherence** — tagline/headline diversity across posts, accent color variety, archetype variety

### Test prompt battery

Good prompts for comprehensive testing (covers all products, platforms, archetypes, and edge cases):

```
Create an Instagram post about Fluid Connect — how it eliminates the 3am integration fire drills
Launch a campaign for Fluid Payments — emphasize the 6x retry logic
Make me a one-pager about FairShare
just a linkedin post about why WeCommerce exists
Instagram post for Checkout
Create a series of posts about Blitz Week for both Instagram and LinkedIn
Generate multiple posts about Droplets across Instagram
an instagram post with an employee spotlight format
posts about Builder
Create an Instagram post about the competitive advantage of direct selling over D2C brands
3 instagram posts and a one-pager for Corporate Tools
just make something cool about Fluid
```

## Testing

```bash
cd canvas
npm test                    # Run all tests
npm test -- db.test         # Run specific test file
npm run test:watch          # Watch mode
```

- Uses Vitest with real SQLite (no mocking)
- Each test gets an isolated temp DB via `FLUID_DB_PATH` env var
- 29 test files covering components, API, DB, brand context, routing

## State Management

**Zustand stores** in `canvas/src/store/`:
- `campaign.ts` — navigation state machine + data cache + race condition guard (`_requestId` counter)
- `editor.ts` — slot editing mode + modified values
- `generation.ts` — generation status, progress, errors

**HMR integration:** Server sends `fluid:file-change` custom Vite event → `useFileWatcher` hook refreshes store (debounced 200ms, paused during generation).

## Key Conventions

- **Canonical HTML paths:** `.fluid/campaigns/{campaignId}/{creationId}/{slideId}/{iterationId}.html`
- **Working directory during generation:** `.fluid/working/{sessionId}/`
- **Asset URLs in HTML:** Use `/fluid-assets/...` (server rewrites `../../assets/` automatically)
- **IDs:** nanoid-generated (e.g., `cmp_xxx`, `cre_xxx`, `sld_xxx`, `itr_xxx`)
- **No Express:** All backend routes are Vite middleware in `watcher.ts`
- **No Tailwind in app:** Plain CSS. (Tailwind only appears in generated output HTML)

## Important Rules

- Do NOT read from `brand/` files — that directory does not exist. All brand data is in the DB.
- Do NOT duplicate brand doc content in prompts; use DB tools to load brand data.
- `Reference/` is archival only — never load directly.
- `feedback/` is for agents to write usage data back (learning loop).
- `voice-guide/*.md` and `pattern-seeds/*.md` are seed sources — the DB is the live copy.
- Pattern content is clean markdown with code snippets — never raw HTML or base64. All assets referenced via `/api/brand-assets/serve/` URLs.
- `seed-data.json` contains brand config only (no campaigns/creations/slides/iterations). User data stays local to each developer's DB.
- The app must be running (`npm run dev`) for MCP tools and API endpoints to work.
