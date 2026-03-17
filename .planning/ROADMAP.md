# Roadmap: Fluid Creative OS

## Overview

This roadmap delivers a complete AI skill system that generates brand-correct Fluid marketing assets from simple prompts. It starts with brand intelligence (the foundation everything reads from), proves the orchestrator-subagent pattern with social posts (simplest asset, most examples), extends to website sections and one-pagers, adds structured iteration tooling, and closes with a learning loop that improves the system over time. Each phase delivers a complete, usable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Brand Intelligence + Foundation** - Decomposed brand docs, asset repo, CLI validation tools, repo structure, and distribution scaffolding (completed 2026-03-10)
- [x] **Phase 2: Orchestrator + Social Posts** - Orchestrator-subagent pattern proven end-to-end with social post generation (completed 2026-03-10)
- [x] **Phase 3: Website Sections + One-Pagers** - Extend proven orchestrator to .liquid sections and sales collateral (completed 2026-03-10)
- [x] **Phase 4: Canvas + Iteration** - React app for viewing, annotating, and comparing asset variations with MCP agent bridge (completed 2026-03-12, 04-04 superseded by Phase 7 merge)
- [x] **Phase 4.1: Canvas Polish & Integration Hardening** - Star-based winner UX, headless CLI generation, template gallery, prompt sidebar, file watcher hardening (completed 2026-03-11)
- [x] **Phase 4.2: Asset Linking & Output Refactor** - Replace base64 inlining with URL-linked assets, shared brand folder, Vite static serving, ZIP export (completed 2026-03-16)
- [x] **Phase 5: Learning Loop** - Feedback ingestion that reads iteration trajectories and updates brand rules (completed 2026-03-11)
- [x] **Phase 6: Marketing Skills Integration** - Deep integration of 30 marketing domain skills into subagent system (completed 2026-03-11)
- [x] **Phase 7: Merge Jonathan's Codebase** - Rebuild Jonathan's content creation tool inside Chey's React/Vite/Zustand canvas app (completed 2026-03-12)
- [x] **Phase 8: AI Sidebar to Campaign Dashboard End-to-End** - Bridge sidebar generation to campaign dashboard with multi-asset creation, preview rendering, canonical paths (completed 2026-03-13)
- [x] **Phase 9: App Navigation Overhaul** - Icon left nav, collapsible chat sidebar, Voice Guide viewport (completed 2026-03-13)
- [x] **Phase 10: Anthropic API Generation Pipeline** - Direct Anthropic API calls replacing CLI-spawned generation, 4-stage pipeline with tool use and SSE streaming (completed 2026-03-16)
- [x] **Phase 11: API Pipeline Hardening + DB-Backed Brand Intelligence** - Single-asset routing, preview path fixes, token cost reduction via DB brand context, Claude-style chat UX, migrate Voice Guide/Patterns/Templates to DB (completed 2026-03-16)
- [x] **Phase 12: Post-API Migration Cleanup & Audit** - Audit for CLI-era dead code, slim skill .md files, update CLI tools to read from DB, verify infrastructure coherence (completed 2026-03-17)
- [ ] **Phase 13: DAM Sync** - Sync layer between Fluid DAM and local DB, DAM as upstream source of truth

## Phase Details

### Phase 1: Brand Intelligence + Foundation
**Goal**: Every subagent can load focused, accurate brand context (3-6 docs) and the system has working validation tools, repo structure, and cross-platform distribution
**Depends on**: Nothing (first phase)
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, BRAND-07, BRAND-08, CLI-01, CLI-02, CLI-03, CLI-04, DIST-01, DIST-02, DIST-03, META-03, META-04
**Success Criteria** (what must be TRUE):
  1. A subagent spawned for "copy" work can navigate wiki-linked brand docs to find voice rules, messaging, and example copy without loading design tokens or layout specs
  2. A subagent spawned for "styling" work can navigate to design tokens (colors, fonts, spacing) and asset-specific specs without loading copy or layout docs
  3. Running the brand compliance CLI check against a sample HTML file reports specific violations (wrong hex color, missing font family, hard-coded spacing) with file and line references
  4. Running the schema validation hook against a .liquid file reports missing options (font sizes, colors, weights) with counts
  5. A fresh clone of the repo can be installed in both Claude Code and Cursor following the setup instructions, with skills appearing and responding to triggers
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Repo structure, brand doc decomposition, and asset organization
- [x] 01-02-PLAN.md — CLI validation tools, compiled rules.json, and Brand Pattern Library
- [x] 01-03-PLAN.md — Distribution system (sync.sh), skills, hooks, and installation docs

### Phase 2: Orchestrator + Social Posts
**Goal**: An operator can type a single prompt and receive a brand-correct social post (Instagram or LinkedIn) as validated HTML/CSS, generated through the full orchestrator-subagent pipeline
**Depends on**: Phase 1
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, ORCH-07, SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05, SOCL-06, SOCL-07, TMPL-01, TMPL-02
**Success Criteria** (what must be TRUE):
  1. Running the social post skill with a topic prompt produces a complete HTML/CSS file at the correct dimensions (1080x1080 for Instagram, 1200x627 or 1340x630 for LinkedIn) that opens in a browser and looks like a finished asset
  2. The generated post uses the correct accent color for its content type, includes the standard footer structure, applies brushstroke textures with proper blend mode and opacity, and uses circle sketch for emphasis only
  3. The orchestrator spawns separate subagents for copy, layout, styling, and spec-check -- each loading only its contracted context files -- and the spec-check subagent returns a structured pass/fail report
  4. When spec-check finds issues, the fix subagent corrects them and re-validates, with a hard cap of 3 fix iterations before escalating to the operator
  5. Social post templates exist in Jonathan's format (live HTML preview + content slot specs + creation instructions) covering at least 6 archetypes
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Social post template library (7 archetypes + index in Jonathan's format)
- [x] 02-02-PLAN.md — Subagent contracts (copy, layout, styling, spec-check agents)
- [x] 02-03-PLAN.md — Orchestrator skill (/fluid-social pipeline + fix loop + verification)

### Phase 3: Website Sections + One-Pagers
**Goal**: The proven orchestrator pattern extends to generate Gold Standard compliant .liquid website sections and print-ready one-pager sales collateral
**Depends on**: Phase 2
**Requirements**: SITE-01, SITE-02, SITE-03, SITE-04, SITE-05, SITE-06, SITE-07, PAGE-01, PAGE-02, PAGE-03, TMPL-03, TMPL-04
**Success Criteria** (what must be TRUE):
  1. Running the website section skill produces a valid .liquid file whose schema includes all required settings (13 font sizes, 13 colors, 5 weights per text element; 7 settings per button; section/container background, padding, border radius) with zero hard-coded values
  2. The generated .liquid section passes the Gold Standard validation checklist and the schema validation CLI hook without errors
  3. Running the one-pager skill produces a self-contained HTML/CSS file that renders at letter size with proper margins, uses Fluid brand elements (brushstrokes, side labels, FLFont taglines), and is ready for PDF export
  4. One-pager and website section templates exist with content slot specs and per-element FIXED/FLEXIBLE/OPTIONAL annotations
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Empirical research of Fluid theme pipeline + Gold Standard doc decomposition
- [x] 03-02-PLAN.md — Mode-aware agent upgrades (section + one-pager) + hero section proof-of-concept
- [x] 03-03-PLAN.md — 11 remaining section templates + section gallery + /fluid-theme-section orchestrator
- [x] 03-04-PLAN.md — 5 one-pager templates + one-pager gallery + /fluid-one-pager orchestrator

### Phase 4: Canvas + Iteration
**Goal**: The team can view, compare, annotate, and document the iteration path from first prompt to final output for any generated asset
**Depends on**: Phase 2 (needs working asset generation; Phase 3 not required)
**Requirements**: CANV-01, CANV-02, CANV-03, CANV-04, CANV-05
**Success Criteria** (what must be TRUE):
  1. Opening the canvas app in a browser displays multiple HTML asset variations side-by-side, each rendered in an isolated iframe at its native dimensions
  2. A team member can add text annotations to any variation, and those annotations persist across page reloads
  3. The canvas displays the full iteration trajectory for an asset (initial prompt result, variations, selected winner, refinements, final) as a navigable timeline
  4. An agent can push a newly generated asset to the canvas via MCP and read back annotations, without the operator manually copying files
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Canvas app scaffold, shared types, session sidebar, variation grid with iframe rendering
- [x] 04-02-PLAN.md — MCP stdio server with 5 agent tools (push, read annotations/statuses/history, iterate)
- [x] 04-03-PLAN.md — Annotation system (spatial pins + sidebar notes) and iteration timeline
- [x] 04-04-PLAN.md — Launcher skill (/fluid-design-OS), scripts, and end-to-end verification (superseded by Phase 7 merge)

### Phase 04.1: Canvas Polish & Integration Hardening (INSERTED)

**Goal:** Transform the canvas from a passive viewer into a self-contained creative workspace: star-based winner UX, headless CLI generation via `claude -p` with streaming output, template gallery with live previews and customization, prompt sidebar with real-time agent stream display, hardened file watcher auto-discovery, and skill path routing audit
**Depends on:** Phase 4
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05, POL-06, POL-07, POL-08, POL-09
**Success Criteria** (what must be TRUE):
  1. Star icon toggles winner status without auto-rejecting other variations
  2. Single-variation sessions can iterate without explicit winner selection; multi-variation requires a starred winner
  3. New sessions appear in canvas automatically without browser refresh
  4. Canvas drives generation via headless `claude -p` CLI with streaming output displayed in left sidebar
  5. Template gallery shows live HTML previews; user can customize and generate from templates
  6. All skills route output to .fluid/working/{sessionId}/ when canvas is active, preserving backward-compatible ./output/ copying when canvas is inactive
**Plans**: 5 plans

Plans:
- [x] 04.1-01-PLAN.md — Winner UX overhaul (star toggle, auto-reject removal, smart iterate unblock)
- [x] 04.1-02-PLAN.md — File watcher hardening + skill path audit + canvas-active sentinel
- [x] 04.1-03-PLAN.md — Generation engine (CLI spawn + SSE streaming + stream parser + generation store)
- [x] 04.1-04-PLAN.md — Canvas control plane UI (template gallery, customizer, prompt sidebar, App layout)
- [x] 04.1-05-PLAN.md — Preview rendering and test data cleanup

### Phase 04.2: Asset Linking & Output Refactor (INSERTED)

**Goal:** Replace inline base64-encoded images/fonts in generated HTML with URL-linked assets served via Vite, reducing variation file sizes from 2-3MB to ~50KB, eliminating E2BIG workarounds, and establishing a shared brand assets folder and per-session assets folder in the repo
**Depends on:** Phase 4.1
**Requirements**: ASSET-01, ASSET-02, ASSET-03, ASSET-04
**Success Criteria** (what must be TRUE):
  1. Generated HTML files reference brand assets (logos, fonts, brush textures) via `/assets/brand/` URLs instead of inline base64, and those assets load correctly in the canvas iframes
  2. Vite serves a static `/assets/` route pointing to the repo's assets directory, with brand assets cached across variations
  3. Per-session non-brand images (custom photos, generated graphics) are saved to `assets/sessions/{sessionId}/` and referenced by URL
  4. Variation HTML files are under 100KB (down from 2-3MB), and the canvas can display 6+ variations simultaneously without tab crashes
**Plans**: 2 plans

Plans:
- [x] 04.2-01-PLAN.md — DB schema (brand_assets/campaign_assets), asset scanner, /api/brand-assets endpoint, /fluid-campaigns/ middleware, ZIP export, agent prompt updates
- [x] 04.2-02-PLAN.md — CreationFrame srcDoc-to-src switch, ExportActions ZIP download, VersionGrid/type updates, test updates

### Phase 5: Learning Loop
**Goal**: The system improves over time by reading documented iteration trajectories and updating brand rules, templates, and skills accordingly
**Depends on**: Phase 4 (needs trajectory data from canvas)
**Requirements**: META-01, META-02
**Success Criteria** (what must be TRUE):
  1. Running the feedback ingestion skill on a completed iteration trajectory produces specific, actionable updates to brand docs or templates (not vague suggestions)
  2. The system distinguishes asset-specific feedback (applied automatically) from systemic brand changes (flagged for human approval before applying)
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Feedback ingestion engine (session discovery, signal extraction, pattern clustering, proposal generation)
- [x] 05-02-PLAN.md — Slash command skills (/feedback-ingest approval walkthrough + /fluid-design-os-feedback capture)

### Phase 6: Marketing Skills Integration
**Goal**: 30 marketing domain skills (~/.agents/skills/) become composable intelligence that subagents automatically load based on task type — giving copy, layout, styling, and spec-check agents deep marketing expertise (CRO, SEO, copywriting, psychology, analytics) alongside brand context
**Depends on**: Phase 2 (needs working orchestrator-subagent pattern; can run in parallel with Phases 3-5)
**Requirements**: MKTG-01, MKTG-02, MKTG-03, MKTG-04, MKTG-05
**Success Criteria** (what must be TRUE):
  1. Subagents spawned for social posts, website sections, and one-pagers automatically load 3-6 relevant marketing skills based on task type without operator intervention
  2. A copy subagent generating a landing page hero section applies CRO principles (value prop clarity, headline effectiveness) and psychological hooks from the skills library, not just brand voice
  3. Marketing skill loading follows the same weight/role-mapping pattern as brand docs — focused loading, not dump-everything
  4. Skills are composable: an operator can override or extend the default skill set for a task type
  5. The system has a skill-to-task mapping registry that documents which skills load for which asset types and subagent roles
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Copy 30 marketing skills + interactive skill-map.json curation
- [x] 06-02-PLAN.md — Update orchestrator delegation + sync.sh distribution + brand/index.md

### Phase 7: Merge Jonathan's Codebase into Fluid DesignOS
**Goal**: Rebuild Jonathan's content creation tool (template library, content editor, campaign management, carousel support, DAM integration) inside Chey's existing React/Vite/Zustand canvas app, creating a unified creative workspace where AI generation and manual editing share the same interface and data model
**Depends on**: Phase 6
**Requirements**: MRGR-01, MRGR-02, MRGR-03, MRGR-04, MRGR-05, MRGR-06, MRGR-07, MRGR-08, MRGR-09, MRGR-10, MRGR-11, MRGR-12, MRGR-13, MRGR-14, MRGR-15, MRGR-16, MRGR-17
**Success Criteria** (what must be TRUE):
  1. SQLite database stores campaign hierarchy (Campaign > Asset > Frame > Iteration) with HTML variations on disk referenced by path
  2. Unified dashboard shows campaigns as primary organizing unit with drill-down to assets, frames, and iterations using full-size iframe previews
  3. Right sidebar content editor with schema-driven slot fields provides identical editing experience for template-based and AI-generated assets
  4. Jonathan's 8 templates ported as locked TypeScript configs with complete slot schemas
  5. MCP tools rewired from file access to SQLite API
  6. Campaign orchestrator skill generates across multiple channels from a single brief
  7. Brush/transform, photo repositioning, carousel support, and export (JPG/WebP/HTML) all functional
**Plans**: 7 plans

Plans:
- [x] 07-01-PLAN.md — Wave 0: SQLite schema, TypeScript types, slot schema port, database API
- [x] 07-02-PLAN.md — Teammate A: Vite middleware API endpoints for campaign hierarchy
- [x] 07-03-PLAN.md — Teammate B: Navigation UI (dashboard, drill-down, breadcrumbs, app shell)
- [x] 07-04-PLAN.md — Teammate C: Content editor right sidebar (slot fields, photo, brush, carousel, export)
- [x] 07-05-PLAN.md — Teammate D: MCP tool rewiring + template config port
- [x] 07-06-PLAN.md — Wave 2: Integration wiring (App.tsx, template flow, file watcher)
- [x] 07-07-PLAN.md — Wave 3: Campaign orchestrator skill, DAM integration, 5-slot channel UI

### Phase 8: AI Sidebar to Campaign Dashboard End-to-End
**Goal**: A prompt in the AI sidebar creates a multi-asset campaign in SQLite with canonical HTML paths, spawns parallel subagents for each asset, and the campaign dashboard shows iframe previews at every navigation level — bridging the final gap between generation and visualization
**Depends on**: Phase 7
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07
**Success Criteria** (what must be TRUE):
  1. Typing a prompt in the sidebar creates a Campaign with 7 Assets (3 Instagram + 3 LinkedIn + 1 one-pager) by default, with channel hints in the prompt narrowing the set
  2. Server pre-creates all records BEFORE spawning agents; generated HTML lands at .fluid/campaigns/{cId}/{aId}/{fId}/{iterId}.html
  3. Campaign dashboard cards show 2x2 mosaic iframe previews; asset and frame cards show full iframe previews
  4. Sidebar detects campaign context and offers "Add to existing campaign" mode
  5. Auto-navigate to campaign view on generation completion
  6. Per-asset status badges show pending/generating/complete
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — Schema migration (generationStatus), type updates, db-api helpers
- [x] 08-02-PLAN.md — /api/generate multi-asset refactor, parallel subagent spawning, canonical paths, new API endpoints
- [x] 08-03-PLAN.md — Iframe previews at all levels, campaign mosaic, sidebar campaign integration
- [x] 08-04-PLAN.md — Gap closure: fix mosaic response unwrap + render StatusBadge on asset cards

### Phase 9: App Navigation Overhaul — Icon Left Nav + Collapsible Chat Sidebar (completed 2026-03-13)

**Goal:** Replace the current flat layout with a slim icon-based left nav (Create, Templates, Patterns, Voice Guide) that controls the main viewport, reposition the AI chat sidebar between the left nav and viewport as a collapsible panel (toggled via bottom nav icon), and add Voice Guide as a new markdown-rendering viewport with vertical side-tabs for 13 brand knowledge docs
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, NAV-07, NAV-08
**Depends on:** Phase 8
**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md — Core layout overhaul: store extension, LeftNav, ChatSidebar, AppShell rewrite, viewport switching
- [x] 09-02-PLAN.md — Voice Guide (markdown renderer + side-tabs), patterns middleware, test updates, visual checkpoint

**Post-phase:** Deep nomenclature rename (Asset→Creation, Frame→Slide, Variation→Version), NavTab campaigns→create with Campaigns/Creations sub-tabs, template iframe path fix, DB migration

### Phase 10: Anthropic API Generation Pipeline (completed 2026-03-16)

**Goal:** Replace CLI-spawned `claude -p` generation with direct Anthropic API calls from the Vite server, running the full orchestrator pipeline (copy -> layout -> styling -> spec-check -> fix loop) with tool use, streaming responses to the chat sidebar via SSE. CLI path preserved as explicit fallback only.
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07
**Depends on:** Phase 9
**Plans:** 2 plans

Plans:
- [x] 10-01-PLAN.md — SDK install, tool schemas, tool executor, skill-to-prompt loader, SSE helpers
- [x] 10-02-PLAN.md — Pipeline orchestrator (4-stage + fix loop), engine routing in /api/generate, integration tests

### Phase 11: API Pipeline Hardening + DB-Backed Brand Intelligence

**Goal:** Fix the API pipeline to be production-usable: route single-asset prompts to standalone creations (not 7-asset campaigns), fix HTML output paths so previews render, cut token cost ~50% by pre-injecting brand context from DB instead of agent file reads, overhaul chat sidebar to Claude-style conversational layout with stage-by-stage narrated updates, and migrate Voice Guide/Patterns/Templates to DB-backed content so the app's brand pages become the canonical source for pipeline brand intelligence. Absorbs former Phase 9 (chat UI redesign) scope.
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06
**Depends on:** Phase 10
**Plans:** 4/4 plans complete

Plans:
- [x] 11-01-PLAN.md — Prompt routing (single vs campaign) + preview path fix (iteration ID mismatch)
- [x] 11-02-PLAN.md — DB schema + seeder + API endpoints for Voice Guide and Patterns, VoiceGuide DB switch
- [x] 11-03-PLAN.md — Brand context injection from DB into pipeline stage prompts
- [x] 11-04-PLAN.md — Claude-style chat sidebar UX + Haiku stage narrator + stage badge components

### Phase 12: Post-API Migration Cleanup & Audit

**Goal:** Audit the full codebase for CLI-era artifacts, dead code, and stale infrastructure left over from the CLI-to-API migration. Update CLI validation tools to read from DB instead of static `rules.json`. Remove dead CLI generation paths, stale tests, unused imports, and orphaned planning directories. Slim project-level skill .md files to behavioral contracts (strip embedded brand data). Verify infrastructure coherence -- API pipeline, DB schema, brand seeder, MCP server, skill files, and validation tools should tell a consistent story with no contradictions.
**Depends on:** Phase 11
**Plans:** 3/3 plans complete

Plans:
- [ ] 12-01-PLAN.md — CLI dead code removal from watcher.ts (iterate + campaign spawn paths) + stale test cleanup
- [ ] 12-02-PLAN.md — Validation tools DB migration (brand-compliance.cjs reads SQLite) + orphan directory cleanup + STATE.md update
- [ ] 12-03-PLAN.md — Pre-existing test failure fixes, skill file slimming (strip brand data), MCP tool audit, stale reference sweep, CLAUDE.md update

### Phase 13: DAM Sync

**Goal:** Sync layer between Fluid DAM and local DB so DAM is the upstream source of truth for brand assets. Local DB caches DAM content for offline/fast access; changes in DAM propagate downstream.
**Depends on:** Phase 12
**Plans:** 0 plans

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 4.1 > 4.2 > 5 > 6 > 7 > 8 > 9 > 10 > 11 > 12 > 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Brand Intelligence + Foundation | 3/3 | Complete | 2026-03-10 |
| 2. Orchestrator + Social Posts | 3/3 | Complete | 2026-03-10 |
| 3. Website Sections + One-Pagers | 4/4 | Complete | 2026-03-10 |
| 4. Canvas + Iteration | 4/4 | Complete | 2026-03-12 |
| 4.1 Canvas Polish & Integration Hardening | 5/5 | Complete | 2026-03-11 |
| 4.2 Asset Linking & Output Refactor | 2/2 | Complete | 2026-03-16 |
| 5. Learning Loop | 2/2 | Complete | 2026-03-11 |
| 6. Marketing Skills Integration | 2/2 | Complete | 2026-03-11 |
| 7. Merge Jonathan's Codebase | 7/7 | Complete | 2026-03-12 |
| 8. AI Sidebar to Campaign Dashboard E2E | 4/4 | Complete | 2026-03-13 |
| 9. App Navigation Overhaul | 2/2 | Complete | 2026-03-13 |
| 10. Anthropic API Generation Pipeline | 2/2 | Complete | 2026-03-16 |
| 11. API Pipeline Hardening + DB Brand Intelligence | 4/4 | Complete | 2026-03-16 |
| 12. Post-API Migration Cleanup & Audit | 3/3 | Complete   | 2026-03-17 |
| 13. DAM Sync | 0/? | Not Started | |
