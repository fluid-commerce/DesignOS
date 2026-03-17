# Fluid Creative OS

AI skill system for generating brand-correct marketing assets (social posts, website sections, one-pagers).

## Brand Data

Brand data lives in the app's SQLite database (`canvas/.fluid/fluid.db`), managed through the app UI pages:

- **Voice Guide** — Voice rules, messaging frameworks, brand identity docs
- **Patterns** — Design tokens (colors, typography, spacing), visual patterns (brushstrokes, circles, textures)
- **Assets** — Brand assets (fonts, images, logos, textures) with /fluid-assets/ URLs
- **Templates** — Reference templates with design rules

Agents access brand context at runtime via pipeline tools (`list_brand_sections`, `read_brand_section`, `list_brand_assets`). The DB is seeded on first app startup.

Do NOT read from `brand/` files — that directory does not exist. All brand data is in the DB.

## Weight System

Brand rules carry weights 1-100. Enforcement thresholds:
- **81-100** = must follow (brand-critical)
- **51-80** = should follow (strong preference)
- **21-50** = recommended (flexible)
- **1-20** = nice-to-have (optional)

## CLI Tools

Validation tools live in `tools/`. Run after generating output:
- `node tools/brand-compliance.cjs <file>` — validate HTML against brand rules (reads brand colors from SQLite DB)
- `node tools/schema-validation.cjs <file>` — validate .liquid files against Gold Standard schema
- `node tools/dimension-check.cjs <file> --target <type>` — check dimensions
- `node tools/scaffold.cjs <section-name>` — generate Gold Standard .liquid skeleton

Note: Validation tools read brand data from the SQLite database (`canvas/.fluid/fluid.db`).
The app must be run at least once to seed the database before validation tools will work fully.

## Pattern Library

Copy-pasteable code for brand building blocks in `patterns/index.html`. Reference this for circles, brushstrokes, FLFont patterns, footer structure, and button styles.

## Setup

See `install.md` for installation instructions (agent-followable, step-by-step).

## Important

- Do NOT duplicate brand doc content in prompts; use DB tools to load brand data
- Original source material in `Reference/` is archival only; never load directly
- `feedback/` directory is for agents to write usage data back (Phase 5 learning loop)
