# Fluid Creative OS

AI skill system for generating brand-correct Fluid marketing assets (social posts, website sections, one-pagers).

## Brand Intelligence

Brand intelligence lives in `brand/`. Load role-specific docs, not the full set. Maximum 3-6 docs per task.

**Role mapping:**
- **Copy work** -> `brand/voice-rules.md` (voice principles, pain-point messaging, FLFont taglines)
- **Styling work** -> `brand/design-tokens.md` (colors, fonts, spacing, opacity)
- **Layout work** -> `brand/layout-archetypes.md` (validated layout types with dimensions)
- **Social posts** -> also load `brand/social-post-specs.md`
- **Website sections** -> also load `brand/website-section-specs.md`
- **Asset usage** -> `brand/asset-usage.md` and `brand/asset-index.md`
- **Unsure which docs?** -> Start from `brand/index.md`

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
Brand intelligence (voice guide docs, design tokens, patterns) lives in the DB as the source of truth.

## Pattern Library

Copy-pasteable code for brand building blocks in `patterns/index.html`. Reference this for circles, brushstrokes, FLFont patterns, footer structure, and button styles.

## Setup

See `install.md` for installation instructions (agent-followable, step-by-step).

## Important

- Do NOT duplicate brand doc content in prompts; point to and load the docs
- Original source material in `Reference/` is archival only; never load directly
- `feedback/` directory is for agents to write usage data back (Phase 5 learning loop)
