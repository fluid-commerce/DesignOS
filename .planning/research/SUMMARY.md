# Project Research Summary

**Project:** Fluid Creative OS
**Domain:** AI-powered branded marketing asset generation skill system (Claude Code / Cursor)
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

Fluid Creative OS is an AI agent skill system that generates brand-correct marketing assets (social posts, website sections, one-pagers) from simple prompts. The proven approach for this domain is an orchestrator-subagent architecture where each asset type has a dedicated orchestrator that spawns single-concern subagents (copy, layout, styling, spec-check) with focused context windows. This is not speculative -- the foundational patterns (GSD orchestration, sync.sh distribution, skill frontmatter) are already battle-tested on this machine with 47 existing skills. The core insight is that brand intelligence must be decomposed into small, focused markdown files (3-6 per subagent) rather than loading everything into one context window.

The recommended approach is to build brand intelligence first (modular .md files for voice, design tokens, layout archetypes, patterns), then prove the orchestrator-subagent pattern with social posts (simplest asset type, highest iteration frequency, 28+ existing examples), then extend to website sections and one-pagers. The stack is deliberately lightweight: pure markdown + shell for skills, Node.js CJS for CLI tooling, TypeScript + MCP SDK for the canvas server, React + Vite for the preview app. No frameworks, no databases, no deployment infrastructure -- this is a local development tool.

The top risks are context flooding subagents (recreating the overload problem), treating subagents as implementation workers instead of advisors, and template rigidity that produces cookie-cutter output. All three are mitigated by architectural discipline in Phase 1: decompose brand docs correctly, define subagent contracts clearly, and annotate templates with FIXED/FLEXIBLE/OPTIONAL metadata. The feedback ingestion loop (later phase) carries a secondary risk of over-fitting brand rules to recent feedback, which requires human approval gates before systemic brand changes.

## Key Findings

### Recommended Stack

The stack splits cleanly into four layers with minimal dependencies between them. The skill system itself requires zero runtime dependencies (pure markdown + shell). CLI tooling follows the GSD pattern of single `.cjs` entry points. The canvas tool is the only component requiring npm packages.

**Core technologies:**
- **Node.js 24.x LTS + TypeScript 5.9.x**: Runtime for CLI tools and MCP server -- current LTS with maintenance through Apr 2028
- **React 19.2.x + Vite 7.3.x**: Canvas preview app only -- chosen because team already knows React from Remotion
- **@modelcontextprotocol/sdk 1.27.x**: MCP server for canvas tool -- official SDK, stdio transport, no web framework needed
- **Zod 4.3.x**: Schema validation for skill configs and MCP inputs -- required by MCP SDK
- **Bash/Zsh + sync.sh**: Distribution layer -- already proven, extend don't replace
- **zustand 5.x**: Canvas app state -- lightweight, no boilerplate, right-sized for a preview tool

**Critical "do not use" items:** Next.js/Remix (unnecessary SSR), Electron (200MB+ bloat for a browser tool), Docker for MCP servers (adds latency for zero benefit), SSE transport (deprecated), Storybook (overkill for previewing generated HTML).

### Expected Features

**Must have (table stakes -- system fails without these):**
- Brand intelligence layer (modular .md files for tokens, voice, patterns, archetypes)
- Orchestrator-subagent architecture (command routing + fresh context per subagent)
- Copy, styling, and spec-check subagents with focused brand context
- Social post skill (Instagram 1080x1080, LinkedIn 1200x627/1340x630)
- Template library in Jonathan's format (HTML preview + spec table + creation instructions)
- Shell scripts for deterministic validation (dimensions, schema, color compliance)
- Cross-platform distribution (Claude Code + Cursor via sync.sh)
- Brand asset repository (indexed brushstrokes, circles, logos, fonts)

**Should have (differentiators):**
- Canvas iteration tool (React app + MCP server for structured feedback)
- Website section skill (Gold Standard .liquid sections)
- Variation generation (3-5 options per prompt)
- Brand pattern library (visual HTML documentation of building blocks)
- Layout subagent with archetype knowledge
- One-pager skill (sales collateral)
- Model profile system (cost-optimized agent assignment)

**Defer to v2+:**
- Feedback ingestion meta-skill (needs trajectory data first)
- Slidev deck integration (existing system works independently)
- Remotion video integration (existing system works independently)
- Meta-skill for skill authoring (system must stabilize first)

**Explicitly NOT building:** Multi-brand support, GUI skill builder, real-time collaboration, AI image generation, approval workflows, automated publishing, template WYSIWYG editor.

### Architecture Approach

Four-layer architecture: Foundation (CLI + hooks) supports Layer 1 (brand intelligence), which supports Layer 2 (asset orchestrators with subagents), which supports Layer 3 (canvas + iteration), topped by Layer 4 (distribution). The critical architectural decision is that subagents are advisors, not builders -- they return concise recommendations (copy text, layout selection, token specifications) and the orchestrator assembles the final artifact. Subagent execution is sequential (copy -> layout -> style -> spec-check) because each depends on the previous output.

**Major components:**
1. **Brand Intelligence** (30+ .md files) -- single source of truth, decomposed so no subagent reads more than 3-6 files
2. **Asset Orchestrators** (one per asset type) -- lean routers that spawn subagents and run validation loops, never generate content themselves
3. **Subagent Pool** (copy, layout, style, spec-check, fix) -- reusable across asset types, each with focused context contracts
4. **CLI Tooling** (fluid-tools.cjs) -- deterministic operations: validation, scaffolding, state management
5. **Shell Hooks** -- automated validation: schema checks, dimension checks, color compliance
6. **Canvas App** (Phase 4) -- React preview with iframe sandboxing, MCP bridge for agent communication
7. **Distribution Layer** -- sync.sh + install.sh for cross-platform installation

### Critical Pitfalls

1. **Context flooding subagents** -- Cap each subagent at 3-5 focused documents. Test output quality with progressively less context to find the minimum viable set. Wrong structure in Phase 1 cascades through everything.
2. **Subagents as implementation workers** -- Subagents return summaries and recommendations (under 500 tokens), not full HTML/CSS blocks. The orchestrator assembles the final artifact. Getting this wrong is a HIGH-cost recovery (foundational architecture change).
3. **Template rigidity** -- Annotate every template element as FIXED/FLEXIBLE/OPTIONAL. Include 3-5 variation examples per template. Spec-check validates brand rules, not template conformity.
4. **Orchestration loops and runaway costs** -- Hard cap of 3 fix iterations. Track whether issue count decreases across iterations. Alert when token cost per asset exceeds threshold.
5. **Gold Standard decomposition losing cross-cutting concerns** -- Create an explicit cross-cutting concerns document. Orchestrator owns holistic validation, not individual subagents.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Brand Intelligence + Foundation
**Rationale:** Everything depends on correctly decomposed brand docs and CLI tooling. This is the architectural foundation -- if brand files are structured wrong, every subagent built on top suffers.
**Delivers:** 30+ modular .md brand files (voice, design tokens, layout archetypes, patterns, Gold Standard decomposition), brand asset repository with manifest, fluid-tools.cjs with validation commands, shell hooks, repo structure, sync.sh integration.
**Addresses:** Brand intelligence layer, brand asset repository, shell scripts/validation, cross-platform distribution, Gold Standard decomposition.
**Avoids:** Context flooding (by designing docs for subagent consumption from day one), monolithic brand documentation (by structuring for evolution), cross-cutting concern gaps (by creating explicit cross-cutting document).

### Phase 2: Social Post Skill (First Orchestrator)
**Rationale:** Social posts are the simplest asset type (single HTML file, fixed dimensions, no Shopify schema) with the highest iteration frequency and 28+ existing examples. Proves the entire orchestrator-subagent-validation pipeline at lower complexity before tackling website sections.
**Delivers:** Complete social post generation from prompt to validated HTML/CSS. Orchestrator pattern proven. All 5 subagent roles defined and working. Template library (social posts) in Jonathan's format.
**Uses:** Node.js CLI tools, shell validation hooks, brand intelligence docs, template library.
**Implements:** Orchestrator-subagent pattern, focused context loading, deterministic/generative split, templates as 5-star references.
**Avoids:** Subagents as implementation workers (by defining subagent contracts upfront), orchestration loops (by building iteration caps from the start), template rigidity (by adding FIXED/FLEXIBLE/OPTIONAL annotations).

### Phase 3: Website Sections + One-Pagers
**Rationale:** The orchestrator-subagent pattern is now proven with social posts. Website sections are the highest-complexity asset (Shopify .liquid, Gold Standard schema, theme tokens) and benefit from lessons learned in Phase 2. One-pagers share enough structure to build alongside.
**Delivers:** Website section generation (.liquid, Gold Standard compliant), one-pager generation (HTML/CSS sales collateral), expanded template library.
**Addresses:** Website section skill, one-pager skill, Gold Standard compliance.
**Avoids:** Gold Standard decomposition gaps (cross-cutting concerns doc already exists from Phase 1).

### Phase 4: Canvas + Iteration
**Rationale:** Requires working asset generation to have something to iterate on. This is where structured feedback capture begins, enabling the system to improve over time.
**Delivers:** React canvas app for preview/annotation, variation generation (3-5 options per prompt), trajectory documentation format, brand pattern library (visual HTML docs).
**Uses:** React 19 + Vite 7 + zustand, react-frame-component for iframe sandboxing, @modelcontextprotocol/sdk for MCP server.
**Implements:** Canvas app architecture, MCP server for agent-canvas bridge, iteration trajectory pattern.

### Phase 5: Integration + Learning Loop
**Rationale:** Only makes sense once the core system works well and daily use generates enough trajectory data. Distribution requires stability. Feedback ingestion requires accumulated trajectories.
**Delivers:** Feedback ingestion meta-skill, Slidev deck adapter, Remotion video adapter, install script, model profile system, full documentation.
**Avoids:** Feedback ingestion death spiral (by requiring human approval for systemic brand changes, categorizing feedback as asset-specific vs. systemic).

### Phase Ordering Rationale

- **Brand intelligence before any skills** because every subagent reads brand docs -- wrong decomposition here means rebuilding every skill later
- **Social posts before website sections** because social posts prove the orchestrator pattern at lower complexity (HTML vs .liquid + schema + Gold Standard)
- **Canvas after two asset types** because iteration tooling has no value without assets to iterate on, and having both social + website skills provides diverse test cases
- **Integrations last** because Slidev and Remotion already work independently -- integration is additive, not blocking
- **Feedback ingestion last** because it requires accumulated trajectory data AND carries the highest risk (death spiral) -- the team needs experience with the system before automating brand rule updates

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Brand Intelligence):** The Gold Standard decomposition needs careful analysis of the actual Gold Standard documents to identify cross-cutting concerns. Also need to audit which of the 111 existing sections are actually Gold Standard compliant.
- **Phase 2 (Orchestrator Design):** The subagent contract design (what goes in, what comes out, advisor vs. builder role) is the most consequential architecture decision. Needs prototyping and testing before committing.
- **Phase 3 (Website Sections):** Shopify .liquid templating with schema DSL is a niche domain. Gold Standard compliance rules are complex (13 font sizes, 13 colors, 5 weights). Needs domain-specific research.

Phases with standard patterns (skip research-phase):
- **Phase 4 (Canvas):** React + Vite + iframe sandboxing is well-documented. MCP server with official SDK has clear examples. Standard web app development.
- **Phase 5 (Integration):** Wrapping existing systems (Slidev, Remotion) with thin adapter skills is straightforward orchestration.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against npm/official docs. Versions pinned to current stable. React chosen because team already uses it for Remotion. |
| Features | HIGH | Feature landscape derived from direct project context (vision doc, team decisions, existing 28+ social post iterations). Competitor analysis confirms differentiation. |
| Architecture | HIGH | Core patterns (orchestrator-subagent, GSD skill tiers, sync.sh distribution) are already running on this machine. Architecture extends proven patterns, not speculative. |
| Pitfalls | HIGH | Sourced from practitioner reports on subagent misuse, AI feedback loops, and brand compliance challenges. Project-specific risks (Gold Standard complexity, brand evolution) drawn from first-party context. |

**Overall confidence:** HIGH

### Gaps to Address

- **Subagent contract design:** Research identifies advisor-vs-builder as critical but does not prescribe exact input/output schemas. Phase 2 planning needs to prototype and test subagent contracts before committing.
- **Gold Standard audit:** The 111 existing .liquid sections have unknown compliance levels. An audit is needed before using them as references for the website section skill.
- **Brand reconciliation:** Multiple brand sources exist (wecommerce.com, deck, build prompt, social iterations) that are not fully reconciled. Phase 1 must address this or accept that brand intelligence will evolve through the iteration loop.
- **Claude Code vs. Cursor orchestration parity:** Subagent spawning (Task/fork) works differently in Claude Code vs. Cursor. Skills need platform-agnostic instruction design with platform-specific orchestration wrappers.
- **Template variation range:** Research recommends 3-5 variation examples per template, but the existing template library may not have enough examples yet. Phase 1 may need to generate additional reference variations.

## Sources

### Primary (HIGH confidence)
- GSD v1.22.4 at `~/.claude/get-shit-done/` -- orchestration patterns, skill tiers, CLI conventions
- `~/.agents/sync.sh` distribution system -- verified running on this machine
- Project vision document at `Reference/Context/project-vision-and-decisions.md` -- stakeholder decisions
- Existing 47 skills at `~/.agents/skills/` -- proven skill patterns
- Jonathan's template library at `Reference/Brand reference material/Templates/` -- template format
- npm: @modelcontextprotocol/sdk v1.27.x, React v19.2, Vite v7.3, TypeScript v5.9, Zod v4.3 -- all verified stable
- Claude Code Skills docs: https://code.claude.com/docs/en/skills

### Secondary (MEDIUM confidence)
- Claude Code subagent best practices (claudekit.cc, pubnub.com) -- subagent design patterns
- AI Agent Report (composio.dev) -- context flooding and "Dumb RAG" patterns
- AI feedback loop analysis (murphytrueman.com, mojotech.com) -- design monoculture trap
- Brand compliance best practices (puntt.ai, frontify.com) -- brand governance patterns
- Competitor skill systems (ai-marketing-claude, marketingskills, Superpowers) -- feature landscape

### Tertiary (LOW confidence)
- FastMCP as alternative MCP framework -- only relevant if official SDK proves insufficient
- Vite 8 beta (Rolldown) -- not recommended now, revisit Q2 2026
- Commander.js for CLI -- only relevant if CLI grows beyond 20+ commands

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
