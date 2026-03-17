# Phase 12: API Pipeline Hardening — routing, context injection, cost, UX - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the API pipeline to be production-usable: route single-asset prompts to standalone creations (not 7-asset campaigns), fix HTML output paths so previews render at every drill-down level, cut token cost by pre-injecting brand context from the app's DB-backed pages instead of agent file reads, overhaul the chat sidebar to a Claude-style conversational layout with stage-by-stage narrated updates, and migrate Voice Guide/Patterns/Templates to DB-backed content so the app's brand pages become the canonical source for pipeline brand intelligence.

This phase absorbs Phase 9 (chat UI redesign) and the DB migration for brand-centric pages (Voice Guide, Patterns, Templates). Phase 4.2 (in progress) handles the Assets page DB migration separately.

</domain>

<decisions>
## Implementation Decisions

### Prompt Routing
- **Single-asset mode**: When prompt uses singular language ("a post", "an image", "one linkedin"), create a standalone Creation without a Campaign wrapper — lives in the existing Creations tab
- **Campaign mode**: When prompt says "campaign", "series", "multiple", or uses plural language, create a multi-asset Campaign with parseChannelHints driving the asset count
- **Keyword detection**: Extend parseChannelHints to detect singularity (singular vs plural language) in addition to channel hints. If no channel detected, default to Instagram
- **Creation type inference**: Detect "instagram", "linkedin", "one-pager", "social post" from prompt text. Default to Instagram if ambiguous
- **Standalone creations**: Single-asset generations go to the Creations tab (already exists from Phase 10 rename), NOT wrapped in a Campaign

### Brand Context Injection — DB as Source of Truth
- **App pages are canonical brand source**: Voice Guide, Patterns, Templates, and Assets pages in the app contain the brand-specific data (voice rules, design tokens, visual patterns, template examples, brand assets)
- **Skill .md files remain for agent behavior**: The static skill files (copy-agent, layout-agent, etc.) define HOW agents operate. Brand-specific DATA comes from the app's DB
- **DB migration in this phase**: Migrate Voice Guide, Patterns, and Templates to DB-backed content (Assets migration is Phase 4.2). This means the pipeline reads brand intelligence from the same DB the user edits in the app
- **Edit in app → pipeline uses it**: When a user edits voice rules or adds a new pattern in the app, the next generation automatically uses that updated content
- **Pipeline reads from DB/internal API at pipeline start**: Server reads brand context from DB, injects relevant slices into each stage's system prompt. Eliminates ~48 tool calls per pipeline run

### Claude's Discretion (Context Injection)
- Whether to pre-inject all brand context at pipeline start or use per-stage internal API calls — optimize for cost and simplicity
- How to structure the brand context DB schema (reuse Phase 4.2's pattern or adapt)
- How skill .md files and DB brand content are composed into final system prompts

### Chat Sidebar UX
- **Claude-style chat layout**: Bottom input box, message bubbles scrolling up, auto-scroll on new messages — modeled after Claude's main chat interface (absorbs Phase 9 scope)
- **Server orchestrates, LLM narrates**: Server runs the fixed pipeline (copy→layout→styling→spec-check). After each stage, a lightweight Haiku call generates a 1-sentence conversational summary of what happened
- **Conversational flow**: Each stage gets a text message summarizing the result, then a badge with spinner for the next stage. No tool call noise, no streaming raw agent text
- **Example flow**:
  - "Starting your Instagram post about payment processing..."
  - [📝 Writing copy ⟳]
  - "Copy ready — headline focuses on checkout friction."
  - [🧱 Building layout ⟳]
  - "Layout done — using full-bleed headline archetype."
  - [🎨 Applying styling ⟳]
  - "Styled with blue accent (trust/authority)."
  - [✓ Running spec-check ⟳]
  - "Passed brand check. Here's your post:"
- **Haiku narrator**: After each stage completes, a quick Haiku API call generates the conversational update from stage output (~400 tokens total for all 4 stages)

### Preview Rendering
- **Currently broken for API-generated creations**: White error text on black background saying HTML not found — at every drill-down level (campaign cards, creation detail, iteration)
- **Likely htmlPath mismatch**: API pipeline writes HTML to disk but the path stored in SQLite doesn't match what `/api/iterations/:id/html` resolves. Older CLI-generated creations may still work
- **Fix required**: Ensure api-pipeline.ts output paths align with the 4-strategy fallback in the preview endpoint. Verify the full chain: pipeline writes HTML → DB stores correct htmlPath → preview endpoint resolves it → iframe renders it

### Claude's Discretion
- Exact keyword detection patterns for single vs campaign routing
- Haiku narrator prompt design
- Chat bubble styling and animation details
- DB schema design for Voice Guide, Patterns, Templates tables
- Preview path debugging approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Architecture
- `canvas/src/server/api-pipeline.ts` — Current pipeline orchestrator (runApiPipeline, runStageWithTools, loadStagePrompt, STAGE_MODELS, tool executor)
- `canvas/src/server/watcher.ts` — Vite middleware with /api/generate endpoint, parseChannelHints, buildCreationList, multi-creation routing, preview endpoint
- `canvas/src/server/db-api.ts` — DB queries for campaigns, creations, slides, iterations

### Chat Sidebar
- `canvas/src/lib/stream-parser.ts` — SSE event parsing (parseStreamEvent, StreamUIMessage types)
- `canvas/src/components/PromptSidebar.tsx` — Current sidebar UI (or equivalent chat component)

### Brand Intelligence Sources
- `brand/voice-rules.md` — Voice rules (currently file-backed, Voice Guide reads via ?raw)
- `brand/design-tokens.md` — Design tokens
- `brand/layout-archetypes.md` — Layout archetypes
- `brand/asset-usage.md` — Asset usage rules
- `patterns/index.html` — Pattern library (999KB monolith, served via /patterns/ middleware)
- `canvas/src/server/template-configs.ts` — Template metadata (code-backed)

### Prior Phase Context
- `.planning/phases/11-anthropic-api-generation-pipeline/11-CONTEXT.md` — Phase 11 decisions (API default, per-stage models, tool use, CLI fallback)
- `.planning/phases/08-ai-sidebar-to-campaign-dashboard-end-to-end/08-CONTEXT.md` — Phase 8 decisions (campaign structure, preview rendering, canonical paths)
- `.planning/phases/04.2-asset-linking-output-refactor/04.2-01-PLAN.md` — Phase 4.2 asset DB migration pattern (in progress, may inform Voice Guide/Patterns/Templates migration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **parseChannelHints()**: Regex-based channel detection in watcher.ts — extend for singularity detection
- **buildCreationList()**: Generates creation entries per channel — adapt for single-creation mode
- **stream-parser.ts**: SSE parsing — needs refactoring for new conversational message types
- **DrillDownGrid**: Iframe preview component — works once paths resolve correctly
- **Voice Guide component**: Already renders 13 markdown docs with side-tabs — needs DB backing
- **Phase 4.2 DB pattern**: brand_assets table + /api/brand-assets endpoint — reusable schema pattern for other brand pages

### Established Patterns
- **Vite middleware**: All API endpoints served via Vite plugin middleware (no separate Express server)
- **SQLite + better-sqlite3**: All persistent data in SQLite, lazy getDb() initialization
- **Server-owned metadata**: LLM never writes campaign/creation records directly
- **Per-stage model selection**: haiku for mechanical tasks, sonnet for creative (Phase 11)
- **?raw imports**: Voice Guide currently uses Vite ?raw for markdown — will be replaced by DB reads

### Integration Points
- **/api/generate**: Main entry point for routing logic changes
- **/api/iterations/:id/html**: Preview endpoint with 4-strategy path fallback — needs alignment with api-pipeline output
- **ChatSidebar / PromptSidebar**: Chat UI component — major overhaul to Claude-style layout
- **api-pipeline.ts buildStagePrompt functions**: Where brand context injection happens — swap file reads for DB reads

</code_context>

<specifics>
## Specific Ideas

- "The app's pages (Voice Guide, Patterns, Templates, Assets) are where users define the building blocks and styles of their brand — treat those as the canonical source for training the agent"
- "Skill .md files tell the agent how to operate. Brand-specific data/examples come from the app's DB content"
- "Chat sidebar should feel like Claude's main chat layout — text box at the bottom, messages scrolling up"
- "Conversational update after each stage, then a badge showing the current phase with a spinner"
- "We already have a Creations tab for showing creations not tied to a whole campaign"

</specifics>

<deferred>
## Deferred Ideas

- **Progressive loading during generation** — showing previews as individual creations complete in a multi-asset campaign (before all are done)
- **Sidebar type picker** — dropdown for creation type (IG/LI/one-pager) as alternative to prompt keyword detection
- **Campaign mode toggle button** — explicit UI toggle instead of keyword detection for campaign vs single-creation
- **Cost tracking / token usage monitoring** — track per-generation API costs
- **Auto-fallback to CLI on API failure** — user explicitly wants hard failure so issues are visible (Phase 11 decision)

</deferred>

---

*Phase: 12-api-pipeline-hardening-routing-context-injection-cost-ux*
*Context gathered: 2026-03-16*
