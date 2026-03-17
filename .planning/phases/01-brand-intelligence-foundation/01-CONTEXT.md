# Phase 1: Brand Intelligence + Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose Fluid's brand docs into modular, wiki-linked .md files so subagents load only what they need (3-6 docs max). Build brand asset repo with index, Brand Pattern Library (HTML code reference), CLI validation tools, repo structure with distribution scaffolding, and feedback path for future learning loop.

Research Claude Skills 2.0 and Superpowers patterns BEFORE finalizing structure — findings inform how skills consume brand docs.

</domain>

<decisions>
## Implementation Decisions

### Brand doc decomposition
- Group docs by subagent role: voice-rules.md (copy agent), design-tokens.md (styling agent), layout-archetypes.md (layout agent), etc.
- Resolve brand source conflicts during decomposition — each doc is the single source of truth. No ambiguity for agents.
- Preserve original wording from source docs — distribute content into role files, don't rewrite
- Create an orchestrator index that wiki-links to all role files, so the orchestrating agent can retrieve necessary context during planning
- Original source material stays in Reference/ as archives — agents never load them directly
- Wiki-linking: inline links with context hints ("See [design-tokens.md](design-tokens.md) for hex values and opacity rules"). Agent knows what it'll find before loading.
- Research META-03 (Claude Skills 2.0) and META-04 (Superpowers) FIRST — findings inform doc structure and skill architecture before decomposition begins

### Brand rule weight system
- Numeric weights 1-100 instead of categorical FIXED/FLEXIBLE/OPTIONAL
- Named thresholds for readability: 1-20 (optional), 21-50 (flexible), 51-80 (strong preference), 81-100 (brand-critical)
- Weights apply per-element in brand docs AND per-usage-rule on assets
- Weights are tunable over time through pattern ingestion (Phase 5 learning loop)
- CLI tool severity maps to weights: 81-100 = error, 51-80 = warning, 21-50 = info, 1-20 = hint

### Brand Pattern Library
- Essential — serves as both visual reference AND copy-pasteable code reference for agents
- HTML page(s) rendering every brand building block (circles, underlines, FLFont patterns, brushstrokes, footer structure) at multiple sizes with technical specs and code snippets

### Asset repo organization
- Single asset-index.md listing every asset with: filename, base64 thumbnail, usage rules, and per-rule weights
- Descriptive filenames: brushstroke-wide-sweep.png instead of brushstroke01.png (agent can pick by name alone)
- Top-level assets/ directory with subdirs: assets/brushstrokes/, assets/circles/, assets/logos/, assets/fonts/
- Use asset files as-is for now — no optimization/resizing in Phase 1

### CLI tools
- Node.js scripts, zero external dependencies (Node built-ins only)
- Output: structured JSON (file, line, rule, severity, message) + human-readable summary
- Severity driven by brand rule weights (81-100 = error, 51-80 = warning, etc.)
- Run as both Claude Code hooks (auto-triggered on file writes) AND manual CLI commands
- Brand compliance check validates against a compiled rules.json (extracted from brand docs), not parsing markdown at runtime
- Template scaffolding generates Gold Standard skeleton with full schema pre-filled + content slot markers — passes schema validation from the start

### Repo structure
- Standalone git repo with flat functional directories:
  - brand/ (decomposed docs)
  - assets/ (images, fonts)
  - tools/ (CLI scripts)
  - skills/ (agent skills)
  - patterns/ (HTML pattern library)
  - templates/ (starter templates)
  - feedback/ (iteration logs, approval/rejection notes — read by Phase 5)
  - Reference/ (original source material)
  - .planning/ (GSD planning)

### Distribution
- sync.sh script for installation into Claude Code (~/.claude/commands/) and Cursor (~/.cursor/skills/)
- Idempotent — re-running sync.sh re-syncs everything (same pattern as existing ~/.agents/sync.sh)
- Agent-installable — a team member can tell their agent "install Fluid Creative OS" and the agent can do the full setup autonomously. Machine-readable install instructions, not just human docs.
- Feedback path: feedback/ directory with conventions for agents to write usage data back into the repo

### Claude's Discretion
- Pattern Library structure: whether one HTML page or multiple, and how it relates to the asset index
- Specific decomposition boundaries (which paragraphs go to which role file)
- Brand conflict resolution when sources disagree — resolve and move on
- Exact file naming within brand/ directory
- Gold Standard decomposition granularity

</decisions>

<specifics>
## Specific Ideas

- "I don't want to change any of the wording, just divvy it out into subagent-role files" — preserve original source text
- "It's essential — it's not just a visual reference but an actual code reference as well" — Pattern Library must have copy-pasteable code
- Weight system (1-100) chosen specifically so rules can be "fine-tuned on an ongoing basis through pattern ingestion" — future-proofing for Phase 5
- "I want to make sure team members can tell an agent 'Install this' and it will be able to do it for them" — agent-first installation experience
- "Easy to ingest documentation from their usage of the tools/skills back into the repo" — feedback loop must be frictionless from day one

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- 13 brand image assets (7 brushstrokes, 2 circle sketches, logos/flags) in Reference/Brand reference material/Brand Assets/
- 2 fonts (FLFont Bold, Inter Variable) in Reference/Brand reference material/Templates/Social Post Templates/fonts/
- 28 generated social post HTML examples + base.css in Reference/Brand reference material/Generated Examples/Social Posts/
- 3 HTML social post templates (quote, app-highlight, partner-alert) with live preview format
- 1 one-pager HTML example with live editor

### Established Patterns
- ~/.agents/sync.sh pattern: generates skill files from source, distributes to Claude Code and Cursor
- Existing 46 marketing skills at ~/.agents/skills/ use trigger-based activation with context cascade
- GSD workflow already in place for orchestration and state management

### Integration Points
- sync.sh must distribute to both ~/.claude/commands/ and ~/.cursor/skills/
- CLI tools must work as Claude Code hooks (auto-triggered) and standalone commands
- feedback/ directory structure must be ready for Phase 5 learning loop ingestion
- Orchestrator index must support Phase 2's subagent spawning pattern

### Source Documents for Decomposition
- social-post-design-guide.md (9.6K) — primary visual design reference
- fluid-website-build-prompt.md (43.2K) — comprehensive brand direction, copy, visual specs
- GOLD_STANDARD_WORKFLOW.md (10.9K) — .liquid section development standards
- Manifesto.txt (6.8K), What-Fluid-is.txt (7.3K) — brand voice and messaging
- 7 feature-specific copy docs in Copy/Specific features/
- building-systematized-claude-skills.md (29.4K) — skill architecture reference
- project-vision-and-decisions.md (8.7K) — project context and design decisions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-brand-intelligence-foundation*
*Context gathered: 2026-03-10*
