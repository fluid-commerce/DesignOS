# Phase 2: Orchestrator + Social Posts - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator types a single prompt and receives a brand-correct social post (Instagram or LinkedIn) as validated HTML/CSS, generated through the full orchestrator-subagent pipeline. Includes the orchestrator skill, all subagent contracts, social post templates (7 archetypes), and the spec-check + fix loop.

</domain>

<decisions>
## Implementation Decisions

### Orchestrator invocation
- Single slash command: `/fluid-social "topic or brief"` — agent infers platform, product, archetype, and accent color from the prompt
- Optional flags for specificity: `--platform`, `--product`, `--variations N`, `--ref path/to/post.html`, `--template archetype-name`, `--debug`
- Default platform: Instagram (1080x1080). LinkedIn requires `--platform linkedin`
- `--ref` flag for explicit file reference, but natural language references also work ("make it like the 3AM server fire post")
- `--template` flag forces the agent to follow a template's structure closely; natural language also works ("use the partner alert template"). Without it, templates are 5-star references only (adapt, not copy — per SOCL-07)
- `--variations N` generates multiple distinct takes (default: 1)
- Output saved to `./output/` directory in current working directory

### Subagent pipeline flow
- Sequential pipeline: copy → layout → styling → spec-check → (fix loop if needed)
- Copy must finish first — layout decisions depend on headline length, text volume, tagline presence
- Subagents communicate via files on disk in `.fluid-working/` directory:
  - `copy.md` — copy agent output
  - `layout.html` — layout agent output
  - `styled.html` — styling agent output
  - `spec-report.json` — spec-check output
  - `final.html` — after fixes pass
- Orchestrator prints status updates as each subagent completes ("✓ Copy done" → "✓ Layout done" → etc.)
- Working directory cleaned up after successful generation; `--debug` flag preserves it

### Template usage strategy
- Default mode: 5-star references — agent studies templates to understand visual language, then generates fresh HTML
- Template-follow mode: `--template quote` or natural language forces close adherence to that template's structure
- 7 archetypes total in `templates/social/`:
  - quote (existing)
  - app-highlight (existing)
  - partner-alert (existing)
  - problem-first / pain post (new — maps to orange accent, "3AM server fire" style)
  - stat / proof post (new — maps to green accent, giant stat hero)
  - manifesto / brand voice (new — maps to blue accent, centered bold statement)
  - feature spotlight (new — single feature capability with visual diagram)
- Templates live in `templates/social/`, not Reference/. Reference/ is build-time source material only — never loaded by the system at runtime.
- 4 new templates built from the 28 existing generated examples in Reference/ as source material

### Fix loop + escalation
- Spec-check uses CLI tools (brand-compliance.cjs, dimension-check.cjs) for deterministic checks + spec-check subagent for holistic review (layout balance, copy tone, visual hierarchy)
- Severity mapped to existing weight system: 81-100 = blocking (must fix), 51-80 = warning (fix if iterations remain), 1-50 = info (log but don't fix)
- Only blocking issues (81-100) trigger the fix loop
- Fix routing: re-run the failing subagent with spec-check feedback (copy issues → re-run copy agent, styling issues → re-run styling agent), not a separate fix agent
- Hard cap: 3 fix iterations, then escalate
- Escalation: output the best attempt so far + remaining issues list. Operator can manually fix or re-run with different input.

### Claude's Discretion
- Exact subagent contract formats (what goes into each .fluid-working/ file)
- How the orchestrator routes fix issues to the correct subagent
- Spec-check report JSON structure
- Working directory naming/cleanup strategy
- How natural language template/reference matching works internally
- Naming convention for output files

</decisions>

<specifics>
## Specific Ideas

- "I'd like it so single slash command works just fine, but there are also flags that can be used for added specificity" — power when you want it, simplicity when you don't
- "--ref flag is great, but we should make sure that plain language works as well based on context" — agent should understand "make it like the partner alert" without needing a file path
- "I see Reference/ as just being what we're referencing to build the skills system — that folder won't be part of the system itself" — clear separation between build-time sources and runtime assets
- Templates as 5-star references by default, but with the ability to force template-following via flag or natural language

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- 12 brand docs in `brand/` — each under 6KB, organized by subagent role (voice-rules.md, design-tokens.md, layout-archetypes.md, social-post-specs.md, asset-usage.md, etc.)
- `brand/index.md` — orchestrator index with wiki-links and agent loading notes per role
- 7 CLI tools in `tools/` — brand-compliance.cjs, dimension-check.cjs, schema-validation.cjs, compile-rules.cjs, scaffold.cjs, rules.json, validate-on-write.sh
- `patterns/index.html` — Brand Pattern Library with copy-pasteable code for all brand building blocks
- 3 existing HTML templates in Reference/ (quote, app-highlight, partner-alert) — source material for templates/social/
- 28 generated social post examples in Reference/ — source material for new archetype templates

### Established Patterns
- Brand weight system (1-100) with CLI severity mapping — spec-check can reuse this directly
- PostToolUse hook runs validate-on-write.sh on Write/Edit — auto-validation already in place
- Skills use `fluid-` namespace prefix when distributed via sync.sh
- Subagent contracts scaffolded in Phase 1 (01-03) — defines inputs/outputs per subagent role

### Integration Points
- sync.sh distributes skills to `~/.claude/commands/` and `~/.cursor/skills/`
- CLI tools callable from subagents for deterministic validation
- `brand/index.md` agent loading notes define which docs each subagent should load
- Output directory (`./output/`) needs to work regardless of which project the operator is in

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-orchestrator-social-posts*
*Context gathered: 2026-03-10*
