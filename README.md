# Fluid DesignOS

AI-powered creative workspace for generating brand-correct marketing assets. Describe what you need in natural language; a single creative agent produces pixel-ready HTML — social posts, website sections, one-pagers, carousels — that looks and sounds like your brand.

## Quick Start

```bash
cd canvas && npm install && npm run dev
```

- **Canvas app:** http://localhost:5174/app/
- **Template library:** http://localhost:5174/

Required environment variables (`.env` at repo root):
- `ANTHROPIC_API_KEY` — required for generation
- `VITE_FLUID_DAM_TOKEN` — optional, for DAM picker integration

## How It Works

1. Type a prompt in the chat sidebar (e.g., "announce our Series A funding")
2. A single creative agent reads the brand DB, picks an archetype, and writes self-contained HTML
3. The agent calls `save_creation`; the server writes the iteration to `.fluid/campaigns/{cId}/{creationId}/{slideId}/{iterationId}.html`
4. Validation hooks run; results stream back to the UI over SSE
5. Dashboard shows your campaign with mosaic previews — drill down to slides and iterations
6. Annotate, edit slots, mark winners, ask the agent to revise

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.6, Zustand 5, Vite 6 |
| Backend | Vite middleware plugin (no Express) |
| Database | SQLite (better-sqlite3, WAL mode) |
| AI | Anthropic SDK with tool use, SSE streaming |
| Testing | Vitest (unit) + Playwright (E2E) |

## Project Structure

```
canvas/                        # The app (React + Vite + SQLite)
  src/
    App.tsx                    # Main app shell + navigation state machine
    components/                # React components (CampaignDashboard, ChatSidebar, etc.)
    store/                     # Zustand stores (campaign, chat, editor)
    server/
      watcher.ts               # Vite plugin: all API routes + file watcher + HMR
      agent.ts                 # Creative agent: tool-use loop + SSE streaming
      agent-tools.ts           # Agent tool implementations (brand read, creation save)
      agent-system-prompt.ts   # Tier 1 rules + dynamic UI context
      brand-brief.ts           # Assembles Tier 2 Brand Brief from DB
      chat-routes.ts           # /api/chats/* handlers
      db-api.ts                # Campaign/Creation/Slide/Iteration CRUD
      brand-seeder.ts          # Seeds DB from voice-guide/ + pattern-seeds/
    lib/
      db.ts                    # SQLite singleton (WAL, FK constraints)
      campaign-types.ts        # TypeScript interfaces for the data model
    __tests__/                 # Vitest tests (real SQLite, no mocking)
  mcp/
    server.ts                  # MCP server (stdio) — push_asset tool
  fluid.db                     # SQLite database (gitignored)
  vite.config.ts

tools/                         # CLI validators (brand-compliance, dimension-check, etc.)
assets/                        # Brand assets (SVGs, fonts, textures, logos, photos)
archetypes/                    # Brandless structural layout patterns
  SPEC.md                      # Authoritative format specification
  components/                  # Reusable design component patterns
voice-guide/                   # Brand voice docs (seeded into DB on first run)
pattern-seeds/                 # Visual design token/pattern docs (seeded into DB)
templates/                     # Template library (social/, gold-standard/, one-pagers/)
.fluid/                        # Runtime output (generated HTML)
```

## Data Model

```
Campaign
  └── Creation  (single deliverable — "Instagram Post", "LinkedIn Carousel")
       └── Slide  (one page; carousels have multiple)
            └── Iteration  (one generated version)
                 └── Annotation  (pin or sidebar note)
```

## Brand Data

All brand data lives in SQLite, managed through the app UI — there are no brand files to read from disk.

- **Voice Guide** — voice rules, messaging frameworks, identity docs
- **Patterns** — foundations (colors, typography) and rules (layout, brushstrokes, opacity, etc.) with weights
- **Assets** — fonts, images, brand elements, decorations; served at `/fluid-assets/`
- **Templates** — reference templates with per-template design rules
- **Settings** — model/profile configuration

**Sharing brand data between teammates:**
```bash
node tools/db-export.cjs          # Export DB → canvas/seed-data.json (commit to git)
node tools/db-import.cjs --merge  # Import seed-data.json into local DB
```

## Generation

A single creative agent runs the full loop. There are no staged sub-pipelines.

- System prompt = Tier 1 (universal rules) + Tier 2 (Brand Brief assembled from DB) + UI context
- Agent has tools for: brand discovery (voice guide, patterns, assets, templates, archetypes), creation editing (save_creation, edit_creation, save_as_template), and preview rendering
- Output streams to the UI over SSE; `save_creation` commits the iteration to SQLite + disk

## CLI Tools

```bash
node tools/brand-compliance.cjs <file>                   # Validate HTML against brand rules
node tools/dimension-check.cjs <file> --target <type>    # Check dimensions
node tools/schema-validation.cjs <file>                  # Validate .liquid against Gold Standard schema
node tools/scaffold.cjs <section-name>                   # Generate .liquid skeleton
node tools/db-export.cjs                                 # Export DB → canvas/seed-data.json
node tools/db-import.cjs [--merge]                       # Import seed-data.json into DB
```

## Testing

```bash
cd canvas
npm test                    # Run all unit tests
npm test -- db.test         # Run specific test file
npm run test:watch
```

Uses Vitest with real SQLite — no mocking. Each test gets an isolated temp DB via `FLUID_DB_PATH`.

## MCP Server

Registered in `.mcp.json`, runs as a stdio process. The only tool is `push_asset`, which creates an Iteration record and writes HTML to the canonical path. Used for external Claude Code sessions that want to push generated output into the canvas.

```bash
npx tsx canvas/mcp/server.ts
```

## Agent Instructions

See [AGENTS.md](./AGENTS.md) for the full architecture reference, conventions, and rules for AI agents working in this repo.
