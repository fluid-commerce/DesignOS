---
name: brand-intelligence
description: Loads brand context from the Fluid DesignOS database for any brand-related task
invoke: always-active
---

# Brand Intelligence

Brand data lives in the canvas SQLite database (`canvas/fluid.db`), managed through the app UI (Voice Guide, Patterns, Assets, Templates pages). There are no brand files on disk to read.

## Accessing Brand Data

The canvas app must be running (`cd canvas && npm run dev`) so the HTTP API is available.

HTTP endpoints:

- `GET /api/voice-guide` — list all voice guide docs
- `GET /api/voice-guide/:slug` — read one voice guide doc
- `GET /api/brand-patterns` — list all patterns (filterable by `?category=`)
- `GET /api/brand-patterns/:slug` — read one pattern
- `GET /api/brand-assets` — list all assets (filterable by `?category=`)
- `GET /api/brand-assets/serve/:name` — fetch asset bytes
- `GET /api/templates` — list templates with slot schemas

SQLite tables (for direct `sqlite3 canvas/fluid.db` queries):

- `voice_guide_docs` — voice rules and identity
- `brand_patterns` — visual design tokens + pattern rules (with weights)
- `brand_assets` — fonts, images, decorations (with URL-ready filenames)
- `templates`, `template_design_rules` — reference templates

## Role-Based Loading

Load only what you need (3-6 sections max):

| Task Type | Start With |
|-----------|------------|
| Copy / messaging | `GET /api/voice-guide` |
| Visual styling | `GET /api/brand-patterns?category=design-tokens` + `GET /api/brand-assets` |
| Layout / structure | `GET /api/brand-patterns?category=archetypes` |
| Spec validation | `node tools/brand-compliance.cjs <file>` |

## Weight System

Brand rules carry weights 1-100:
- **81-100** = must follow (brand-critical)
- **51-80** = should follow (strong preference)
- **21-50** = recommended (flexible)
- **1-20** = nice-to-have (optional)

## Important

- Do NOT read from `brand/` files — they do not exist.
- Do NOT duplicate brand doc content in your prompts; reference it via the API.
- The canvas's own creative agent has richer in-process tools (see `canvas/src/server/agent-tools.ts`). This skill is for external Claude Code sessions working in the repo.
