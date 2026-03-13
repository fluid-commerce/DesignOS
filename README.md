# Fluid Creative OS

AI skill system for generating brand-correct marketing assets from text prompts. Type a prompt, get a multi-asset campaign with social posts, LinkedIn cards, and one-pagers that look and sound like Fluid made them.

## Quick Start

```bash
cd canvas
npm install
npm run dev
# Open http://localhost:5174/app/
```

The canvas app runs at `/app/`. Jonathan's template library is served at `/`.

## What This Does

1. **You type a prompt** in the sidebar (e.g., "announce our Series A funding")
2. **Subagents spawn in parallel** — one per asset, each loading brand docs for their role
3. **HTML files land on disk** at `.fluid/campaigns/{campaignId}/{assetId}/{frameId}/{iterationId}.html`
4. **File watcher detects changes**, creates SQLite records, pushes HMR updates to the browser
5. **Dashboard shows your campaign** with mosaic previews, drill-down to individual assets, frames, and iterations
6. **You iterate** — annotate, edit slots, mark winners, generate new rounds

## Project Structure

```
.
├── canvas/              # React/Vite app (UI, server, database)
│   ├── src/
│   │   ├── App.tsx              # Main app shell + navigation state machine
│   │   ├── components/          # 26 React components (DrillDownGrid, CampaignDashboard, etc.)
│   │   ├── store/               # Zustand stores (campaign, editor, annotations)
│   │   ├── server/
│   │   │   ├── watcher.ts       # Vite middleware: API routes + file watcher + template serving
│   │   │   └── db-api.ts        # SQLite CRUD (campaigns, assets, frames, iterations)
│   │   ├── lib/
│   │   │   ├── db.ts            # Database singleton (WAL mode, FK constraints)
│   │   │   ├── campaign-types.ts # TypeScript types for the data model
│   │   │   ├── preview-utils.ts  # Iframe preview URL construction
│   │   │   └── template-configs.ts # Template metadata + slot schemas
│   │   └── mcp/
│   │       └── server.ts        # MCP server for agent-canvas communication
│   ├── fluid.db                 # SQLite database (gitignored)
│   └── vite.config.ts
│
├── brand/               # Brand intelligence docs (13 files, role-specific)
│   ├── index.md                 # Navigation + weight system
│   ├── voice-rules.md           # Copy voice, pain-first messaging, FLFont taglines
│   ├── design-tokens.md         # Colors, fonts, spacing, opacity scales
│   ├── layout-archetypes.md     # 6 validated layout types with dimensions
│   ├── asset-usage.md           # Brushstroke blend modes, circle rules, footer structure
│   ├── social-post-specs.md     # Instagram/LinkedIn dimensions + typography
│   ├── website-section-specs.md # Gold Standard .liquid schema
│   ├── asset-index.md           # Asset inventory with paths
│   └── ...                      # Messaging, personas, objections, pitches
│
├── tools/               # CLI validation
│   ├── brand-compliance.cjs     # Validate HTML against brand rules
│   ├── schema-validation.cjs    # Check .liquid schema completeness
│   ├── dimension-check.cjs      # Verify output dimensions by asset type
│   └── scaffold.cjs             # Generate Gold Standard .liquid skeleton
│
├── templates/           # Template library (HTML + .liquid)
│   ├── social/                  # Social post templates (8)
│   ├── gold-standard/           # .liquid section templates (11)
│   ├── one-pagers/              # Sales collateral templates
│   └── assets/textures/         # 65+ PNG textures (brush, circles, scribbles)
│
├── patterns/            # Copy-pasteable brand building blocks (index.html)
├── assets/              # Brand assets (SVG brushstrokes, fonts, logos, photos)
├── .fluid/              # Runtime output (campaigns/ + working/)
├── .planning/           # GSD project management artifacts
└── CLAUDE.md            # Agent instructions (brand doc loading rules)
```

## Brand Intelligence

Brand docs in `brand/` are modular. Agents load only what they need:

| Task | Load These |
|------|-----------|
| Copy work | `voice-rules.md` |
| Styling work | `design-tokens.md` |
| Layout work | `layout-archetypes.md` |
| Social posts | + `social-post-specs.md` |
| Website sections | + `website-section-specs.md` |
| Visual assets | + `asset-usage.md`, `asset-index.md` |

Max 3-6 docs per subagent. Rules carry weights (81-100 = must follow, 51-80 = should follow, 21-50 = flexible).

## Validation

Run after generating output:

```bash
node tools/brand-compliance.cjs <file>     # Check colors, fonts, spacing
node tools/schema-validation.cjs <file>    # Validate .liquid schema
node tools/dimension-check.cjs <file> --target instagram  # Check dimensions
```

## Database

SQLite with WAL mode. Campaign hierarchy: **Campaign > Asset > Frame > Iteration**.

- HTML lives on disk at `.fluid/campaigns/`
- Metadata lives in SQLite (`canvas/fluid.db`)
- `generationStatus` tracks AI lifecycle (pending/generating/complete)
- `userState` stores slot edits made in ContentEditor

Tests use `FLUID_DB_PATH` env var for isolation — never write to the production database.

## Team

- **Chey** — Project lead, AI orchestration, brand system architecture
- **Jonathan** — Template library UI, texture/asset curation, editor tooling, serving infrastructure

## Status

35/36 plans executed (94% complete). Core generation pipeline is functional. Remaining:
- Phase 4.2: Asset linking refactor (base64 -> URL-linked assets)
- Phase 4.3: Install process safety
- Phase 9: Conversational chat UI
