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
- [ ] **Phase 3: Website Sections + One-Pagers** - Extend proven orchestrator to .liquid sections and sales collateral
- [ ] **Phase 4: Canvas + Iteration** - React app for viewing, annotating, and comparing asset variations with MCP agent bridge
- [ ] **Phase 5: Learning Loop** - Feedback ingestion that reads iteration trajectories and updates brand rules
- [ ] **Phase 6: Marketing Skills Integration** - Deep integration of 30 marketing domain skills into subagent system

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
- [ ] 03-01-PLAN.md — Empirical research of Fluid theme pipeline + Gold Standard doc decomposition
- [ ] 03-02-PLAN.md — Mode-aware agent upgrades (section + one-pager) + hero section proof-of-concept
- [ ] 03-03-PLAN.md — 11 remaining section templates + section gallery + /fluid-theme-section orchestrator
- [ ] 03-04-PLAN.md — 5 one-pager templates + one-pager gallery + /fluid-one-pager orchestrator

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
- [ ] 04-04-PLAN.md — Launcher skill (/fluid-design-OS), scripts, and end-to-end verification

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
**Plans**: 4 plans

Plans:
- [x] 04.1-01-PLAN.md — Winner UX overhaul (star toggle, auto-reject removal, smart iterate unblock)
- [ ] 04.1-02-PLAN.md — File watcher hardening + skill path audit + canvas-active sentinel
- [ ] 04.1-03-PLAN.md — Generation engine (CLI spawn + SSE streaming + stream parser + generation store)
- [ ] 04.1-04-PLAN.md — Canvas control plane UI (template gallery, customizer, prompt sidebar, App layout)

### Phase 5: Learning Loop
**Goal**: The system improves over time by reading documented iteration trajectories and updating brand rules, templates, and skills accordingly
**Depends on**: Phase 4 (needs trajectory data from canvas)
**Requirements**: META-01, META-02
**Success Criteria** (what must be TRUE):
  1. Running the feedback ingestion skill on a completed iteration trajectory produces specific, actionable updates to brand docs or templates (not vague suggestions)
  2. The system distinguishes asset-specific feedback (applied automatically) from systemic brand changes (flagged for human approval before applying)
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Feedback ingestion engine (session discovery, signal extraction, pattern clustering, proposal generation)
- [ ] 05-02-PLAN.md — Slash command skills (/feedback-ingest approval walkthrough + /fluid-design-os-feedback capture)

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
- [ ] 06-01-PLAN.md — Copy 30 marketing skills + interactive skill-map.json curation
- [ ] 06-02-PLAN.md — Update orchestrator delegation + sync.sh distribution + brand/index.md

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 4.1 > 5 > 6
(Phase 4 depends on Phase 2, not Phase 3 -- Phases 3 and 4 could run in parallel)
(Phase 6 depends on Phase 2 -- can run in parallel with Phases 3-5)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Brand Intelligence + Foundation | 3/3 | Complete   | 2026-03-10 |
| 2. Orchestrator + Social Posts | 3/3 | Complete   | 2026-03-10 |
| 3. Website Sections + One-Pagers | 1/4 | In Progress|  |
| 4. Canvas + Iteration | 3/4 | In Progress | - |
| 4.1 Canvas Polish & Integration Hardening | 3/4 | In Progress|  |
| 5. Learning Loop | 1/2 | In Progress|  |
| 6. Marketing Skills Integration | 0/2 | Not started | - |
