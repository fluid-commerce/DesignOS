# Phase 12: Post-API Migration Cleanup & Audit - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit the full codebase for CLI-era artifacts, dead code, and stale infrastructure left over from the CLI-to-API migration. Slim project-level skill files to behavioral contracts (strip embedded brand data). Update CLI validation tools to read from DB instead of static rules.json. Remove dead CLI generation paths, stale MCP tools, unused imports, orphaned phase directories, and stale tests. Verify infrastructure coherence — API pipeline, DB schema, brand seeder, MCP server, skill files, and validation tools should tell a consistent story with no contradictions. Clean up STATE.md to reflect current reality.

</domain>

<decisions>
## Implementation Decisions

### Dead Code Scope
- **Remove CLI generation path entirely**: Delete all `claude -p` spawning code from watcher.ts and any supporting utilities. API is the only generation path — no fallback, no escape hatch
- **Audit MCP tools individually**: Check which of the 6 canvas-era MCP tools (push_asset, read_annotations, read_statuses, read_history, iterate_request, iterate) are actually called by anything. Remove only confirmed dead tools, keep any that are still referenced
- **Delete orphaned phase directories**: Remove .planning/phases/ directories that don't correspond to any current roadmap phase (10-voice-guide-db-backed..., 11-patterns-db-backed..., 12-templates-db-backed...)
- **Cleanup aggressiveness**: Claude's discretion — remove what's clearly dead, flag borderline cases in audit notes

### Skill File Slimming
- **Keep stage headings with behavioral instructions**: Skills retain Copy Agent / Layout Agent / Styling Agent / Spec-Check Agent sections. Strip only brand data (color hex values, template examples, font names, design token values)
- **Project-level skills only**: Only slim skill files within this project that the API pipeline reads (loaded by `loadStagePrompt` in api-pipeline.ts). Do NOT touch ~/.agents/skills/ (user-level skills shared across projects)
- **App-only generation**: Slimmed skills are optimized for the API pipeline. No requirement to work from CLI

### Validation Tool Strategy
- **Read from DB directly**: brand-compliance.cjs and other validation tools import db-api functions and query SQLite for brand rules. Single source of truth
- **Remove compile-rules.cjs and rules.json**: Delete the static compilation pipeline entirely. DB is the only source for validation rules. No fallback path
- **Other validation tools**: schema-validation.cjs, dimension-check.cjs, scaffold.cjs — evaluate whether they reference stale data sources and update accordingly

### Infrastructure Audit
- **Audit-and-fix approach**: Claude's discretion — low-risk fixes happen inline during cleanup, high-risk or ambiguous findings get flagged for review
- **STATE.md cleanup**: Update STATE.md to reflect current reality — remove stale references to old phase numbers, update current position, fix CLI-era descriptions in roadmap evolution section
- **Test audit included**: Review tests for stale CLI mocks, dead path references, tests covering removed functionality. Update or remove stale tests alongside the code they tested
- **Coherence check scope**: Contradictory data sources, stale file references in code, naming mismatches between DB schema and API routes, dead env vars, imports that reference removed modules

### Claude's Discretion
- Exact aggressiveness of dead code removal (clearly dead = remove, borderline = flag)
- Whether to produce an audit report before fixing or fix inline based on risk level
- How to restructure validation tools to import from db-api (direct import vs thin wrapper)
- Whether any MCP tools should be updated rather than removed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Architecture
- `canvas/src/server/api-pipeline.ts` — Pipeline orchestrator, loadStagePrompt, STAGE_TOOLS, brand tool definitions, stage prompt building
- `canvas/src/server/watcher.ts` — Vite middleware with /api/generate endpoint, CLI spawning code (to be removed), parseChannelHints
- `canvas/src/server/db-api.ts` — DB queries for all entities including brand intelligence functions

### Brand Intelligence
- `canvas/src/lib/db.ts` — SQLite schema definitions (voice_guide_docs, brand_patterns, brand_assets tables)
- `canvas/src/server/brand-seeder.ts` — Seeder that populates DB from filesystem on first run

### MCP Server
- `canvas/mcp/server.ts` — 6 canvas-era MCP tools to audit individually
- `.mcp.json` — MCP server configuration

### Validation Tools
- `tools/brand-compliance.cjs` — Brand validation, reads from rules.json (to be switched to DB)
- `tools/compile-rules.cjs` — Compiles brand/*.md to rules.json (to be removed)
- `tools/rules.json` — Static compiled rules (to be removed)
- `tools/schema-validation.cjs` — Liquid schema validation
- `tools/dimension-check.cjs` — Asset dimension validation

### Skill Files (Project-Level)
- Skill .md files loaded by `loadStagePrompt()` in api-pipeline.ts — identify which files are read and slim those

### State & Planning
- `.planning/STATE.md` — Project state with stale CLI-era references to clean up
- `.planning/ROADMAP.md` — Current roadmap (Phase 12 updated to new scope)

### Prior Phase Context
- `.planning/phases/11-api-pipeline-hardening-routing-context-injection-cost-ux/11-CONTEXT.md` — Phase 11 decisions (DB as brand source, pipeline architecture)
- `.planning/phases/10-anthropic-api-generation-pipeline/10-CONTEXT.md` — Phase 10 decisions (API default, CLI fallback, tool use)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **db-api.ts brand functions**: getVoiceGuideDocs(), getBrandPatterns(), getBrandAssets() — validation tools can import these directly
- **loadBrandContextFromDb()**: Single DB read for pipeline brand context — model for how validation tools should access brand data
- **brand-seeder.ts**: Seeds DB from filesystem — ensures DB is populated before validation tools query it

### Established Patterns
- **Vite middleware**: All API endpoints via Vite plugin middleware (no separate Express)
- **SQLite + better-sqlite3**: Synchronous queries, lazy getDb() initialization
- **FLUID_DB_PATH env var**: Overrides default DB path for test isolation
- **loadStagePrompt**: Reads skill files from disk via SKILL_FILES mapping — this is the function to trace for identifying which skill files to slim

### Integration Points
- **tools/*.cjs → canvas/src/server/db-api.ts**: Validation tools need to import DB functions. CJS↔ESM boundary may require attention
- **/api/generate**: After CLI removal, this endpoint only routes to runApiPipeline
- **Tests**: canvas/src/__tests__/ — audit for CLI mocks, stale fixtures, removed-code coverage

</code_context>

<specifics>
## Specific Ideas

- "Don't do anything with user-level skills (~/.agents/skills/), just slim the ones in this actual project/app that are to be used within the app"
- CLI generation path should be removed entirely — not preserved as fallback
- DB is single source of truth for both brand context (pipeline) and validation rules (CLI tools)
- Orphaned phase directories are clutter — delete them

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-post-api-migration-cleanup-audit*
*Context gathered: 2026-03-16*
