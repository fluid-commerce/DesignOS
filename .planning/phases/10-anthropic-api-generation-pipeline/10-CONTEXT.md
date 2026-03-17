# Phase 11: Anthropic API Generation Pipeline - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Direct conversation with user

<domain>
## Phase Boundary

Replace the current CLI-spawned `claude -p` generation with direct Anthropic API calls from the Vite server. The full orchestrator pipeline (copy → layout → styling → spec-check → fix loop) runs server-side via the `@anthropic-ai/sdk`, with tool use enabling agents to read brand docs, write files, and validate output. Streaming responses are forwarded to the chat sidebar via SSE.

The CLI `claude -p` path is preserved as an explicit fallback — only activated when specifically requested (e.g., query param or config flag). Default behavior must always use the API so it's immediately obvious during testing if the API path isn't working.

</domain>

<decisions>
## Implementation Decisions

### Pipeline Architecture
- Full pipeline: copy → layout → styling → spec-check → fix loop (max 3 iterations), all via Anthropic API
- Each stage is a separate API call with its own system prompt derived from the existing skill .md files
- Per-stage model selection: haiku for layout (mechanical/template matching), sonnet for creative stages (copy, styling), sonnet for spec-check
- Server orchestrates the pipeline — not the LLM chaining via Agent tool

### API Integration
- `@anthropic-ai/sdk` (Node.js) integrated into the Vite server middleware
- Reads `ANTHROPIC_API_KEY` from environment (user confirms key is in local env)
- Streaming API responses forwarded to chat sidebar via existing SSE infrastructure

### Tool Use
- API agents get tool definitions for: reading brand docs, reading patterns, writing HTML output, running brand-compliance validation, reading/writing working files
- Server implements tool executor that handles tool calls and returns results
- Tools give agents dynamic context loading rather than stuffing everything into prompts upfront

### Skill-to-Prompt Conversion
- Existing skill .md files (copy-agent, layout-agent, styling-agent, spec-check-agent) become system prompts for API calls
- Same files, different loading mechanism — server reads from disk and injects into API call
- Designed so Phase 14 (DB-backed brand intelligence) can swap the read path to DB queries later

### CLI Fallback
- Old `claude -p` code preserved but gated behind explicit flag (`?engine=cli` or similar)
- Default is always API — must be clear during testing when API isn't working
- Not a graceful auto-fallback; deliberate opt-in only

### Claude's Discretion
- Exact tool schema definitions and naming
- How skill .md files are parsed/transformed into system prompts (full content vs. extracted sections)
- SSE event format for streaming API responses (can reuse existing format or adapt)
- Error handling, retry logic, timeout configuration
- How the orchestrator tracks pipeline state between stages
- File output paths and working directory structure (may reuse existing .fluid/working/ pattern)

</decisions>

<specifics>
## Specific Ideas

- Reuse existing SSE infrastructure from the `claude -p` generation path — adapt rather than rebuild
- The generation endpoint (`/api/generate`) is the natural place to swap in API calls
- Brand docs currently live as flat files — read them the same way skills do today, just inject into API prompts
- Consider a thin abstraction over the generation engine so swapping between API and CLI is a config change, not a code rewrite
- User wants this to be iterative — expect testing and adjustment cycles. Don't over-engineer the first pass.

</specifics>

<deferred>
## Deferred Ideas

- DB-backed brand intelligence (Phases 11-15 in memory — would become Phases 12-16 or later)
- Auto-fallback to CLI on API failure (user explicitly wants hard failure so issues are visible)
- Multi-model routing optimization (start with simple per-stage assignment, optimize later)
- Cost tracking / token usage monitoring
- Caching of brand doc reads between pipeline stages

</deferred>

---

*Phase: 11-anthropic-api-generation-pipeline*
*Context gathered: 2026-03-16 via direct conversation*
