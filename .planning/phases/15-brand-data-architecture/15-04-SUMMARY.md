---
phase: 15-brand-data-architecture
plan: "04"
subsystem: brand-data-architecture
tags: [templates-db, mcp-tools, ui-consistency, subtitles, empty-states, paid-ads]
dependency_graph:
  requires:
    - 15-01 (PatternsScreen)
    - 15-02 (Assets recategorization)
    - 15-03 (TemplatesScreen rewrite)
  provides:
    - DB-backed templates table with specs, slots, design rules
    - MCP tools: list_templates, read_template, list_brand_patterns, read_brand_pattern, list_voice_guide, read_voice_guide
    - Enhanced list_brand_assets with description field
    - Consistent UI header/tab pattern across all brand pages
    - Paid Ads template category
  affects:
    - canvas/src/components/TemplatesScreen.tsx
    - canvas/src/components/PatternsScreen.tsx
    - canvas/src/components/AssetsScreen.tsx
    - canvas/src/server/api-pipeline.ts
    - canvas/src/server/db-api.ts
    - canvas/src/server/brand-seeder.ts
    - canvas/src/server/watcher.ts
    - canvas/src/lib/db.ts
tech_stack:
  added: []
  patterns:
    - DB-backed template specs with JSON content_slots and extra_tables columns
    - Shared SpecTable component with fixed column widths and Chip badges
    - Tabbed carousel slide specs
    - Dedicated list/read MCP tool pairs per brand data type
key_files:
  created:
    - canvas/src/lib/db.ts (templates table)
  modified:
    - canvas/src/components/TemplatesScreen.tsx
    - canvas/src/components/PatternsScreen.tsx
    - canvas/src/components/AssetsScreen.tsx
    - canvas/src/server/api-pipeline.ts
    - canvas/src/server/db-api.ts
    - canvas/src/server/brand-seeder.ts
    - canvas/src/server/watcher.ts
decisions:
  - Templates store specs as JSON (content_slots, extra_tables) — flexible schema for varying template types
  - All slots use consistent {{TOKEN}} format across social, paid-ad, one-pager, and carousel templates
  - "To Create a New Version" removed — human-only instructions not useful to agents
  - Instagram ad moved from social to paid-ad category with dedicated tab
  - Carousel slide specs stored as extra_tables with "Slide NN" label pattern, rendered as tabs in UI
  - Dedicated MCP tools per brand data type instead of generic list_brand_sections for everything
  - Shared SpecTable component enforces fixed column widths (22%/62%/16%) and Chip badges across all templates
  - UI headers aligned to My Creations tab pattern (fixed header bar, compact uppercase tabs)
metrics:
  duration: "session"
  completed: "2026-03-18"
  tasks_completed: 2
  files_modified: 8
---

# Phase 15 Plan 04: Polish Pass + DB-Backed Templates + MCP Tools

Originally scoped as subtitles and empty states, this plan expanded significantly based on user direction to give all brand pages the same data architecture treatment.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add subtitles and empty states to all four brand pages | 9b320f0 | VoiceGuide.tsx, PatternsScreen.tsx, AssetsScreen.tsx, TemplatesScreen.tsx |
| 2+ | DB-backed templates, MCP tools, UI consistency | 20d15ca, 531da27, ea13eef | 8 files across db, api, seeder, and UI |

## What Was Built

### DB-Backed Templates
- New `templates` table with full spec data (id, type, name, layout, dims, description, content_slots as JSON, extra_tables as JSON)
- 12 templates seeded: 6 social, 1 paid-ad, 5 one-pager
- API routes: GET/PUT `/api/db-templates` with type filtering and individual template access
- All slots use consistent `{{TOKEN}}` format

### TemplatesScreen Pixel-Perfect Rewrite
- Side-by-side layout: scaled iframe preview (left) + spec panel (right), matching old templates/index.html design
- Three tabs: Social / Paid Ads / One-Page in header bar
- Hover overlay with Full Size, New from Template (dropdown with Edit/Create with AI), Download ZIP
- Carousel template has tabbed per-slide specs
- Per-template design rules from DB shown inline in spec panel
- Social Media Design Rules collapsible panel above social listings
- Shared SpecTable component with fixed column widths and Chip color badges
- All text fields inline-editable with optimistic save

### MCP Tools for Agent Access
- `list_templates` / `read_template` — template specs with design rules
- `list_brand_patterns` / `read_brand_pattern` — visual patterns by category
- `list_voice_guide` / `read_voice_guide` — brand voice documents
- Enhanced `list_brand_assets` — now includes description field
- Stage-appropriate tool availability (copy gets voice+templates, styling gets everything)

### UI Consistency
- PatternsScreen header aligned to fixed bar pattern
- AssetsScreen category tabs moved to fixed header bar with matching style
- All brand pages follow same header/content split pattern

## Self-Check: PASSED
- All 12 templates seeded and serving from DB
- MCP tools responding correctly for all four brand data types
- Consistent {{TOKEN}} slot format across all template types
- Fixed column widths in all spec tables
- TypeScript compilation: 0 new errors
