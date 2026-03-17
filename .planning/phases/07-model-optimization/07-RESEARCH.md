# Phase 07 Research: Model Optimization

## Agent-by-Agent Analysis

### 1. Copy Agent

**Current model:** Sonnet
**Task profile:** Creative writing, brand voice interpretation, tone matching, pain-point messaging, archetype selection, accent color inference

**Analysis:**
- This is the most creatively demanding agent in the pipeline
- Must internalize voice-rules.md (pain-first framing, scenario specificity, one-idea-per-sentence)
- Infers archetype and accent color from prompt context — requires judgment
- Fix loop copy fixes need to understand subtle tone feedback ("make it more urgent", "less salesy")
- Marketing skill integration (copywriting, social-content) adds complexity

**Recommendation: Keep Sonnet** — possibly the one agent where Opus would actually help, but Sonnet has proven sufficient for brand voice. Haiku would likely produce generic, flat copy that fails spec-check tone reviews.

**Risk of downgrade to Haiku:** HIGH — copy quality is the most visible output quality signal. Generic copy = failed holistic review = fix loop = MORE total tokens spent.

---

### 2. Layout Agent

**Current model:** Sonnet
**Task profile:** Read copy.md → match archetype to layout type → output structural HTML with positioned containers and SLOT comments

**Analysis:**
- This is essentially a template-matching task
- Input: archetype name from copy.md + platform dimensions
- Output: one of ~6 known layout patterns (Full-Bleed Headline, Headline+Card, Giant Stat, etc.)
- The layout archetypes are well-documented in brand/layout-archetypes.md
- No creative judgment needed — it's "if archetype=X, use layout pattern Y"
- SLOT comment system is mechanical (HEADLINE, BODY, TAGLINE, CIRCLE, BRUSHSTROKE_1/2, FOOTER)
- maxTurns: 10 but typically completes in 2-3 turns

**Recommendation: Downgrade to Haiku** — this is the clearest candidate. The task is well-constrained, the output format is documented, and the decision tree is simple. Haiku can follow structured instructions and produce templated HTML.

**Risk of downgrade to Haiku:** LOW — layout is the most mechanical step. If Haiku misses a SLOT comment, spec-check catches it and the fix is trivial. Worst case: one fix iteration.

---

### 3. Styling Agent

**Current model:** Sonnet
**Task profile:** Read copy.md + layout.html → fill SLOT content → apply design tokens → embed fonts → add brushstrokes/circles → build footer → output self-contained HTML/CSS

**Analysis:**
- Most complex agent by instruction volume (longest agent definition)
- Must correctly apply design tokens (specific hex values, font sizes, spacing)
- Brushstroke placement requires understanding of `mix-blend-mode: screen`, opacity ranges
- Circle sketch recoloring uses `mask-image` + `backgroundColor` (NOT hue-rotate — common failure mode)
- Font embedding via base64 @font-face
- Must reference patterns/index.html for brand building blocks
- Integrates multiple inputs (copy.md content, layout.html structure, design tokens, asset paths)

**Recommendation: Keep Sonnet** — the styling agent has the highest instruction complexity and the most opportunities for subtle errors (wrong blend mode, incorrect opacity, hue-rotate instead of mask-image). Sonnet's instruction following is needed here.

**Risk of downgrade to Haiku:** MEDIUM-HIGH — styling errors are the #1 source of spec-check failures. A cheaper model that generates more fix iterations is a false economy.

---

### 4. Spec-Check Agent

**Current model:** Sonnet
**Task profile:** Run 3 CLI tools → parse JSON output → perform 8 holistic review checks → write structured spec-report.json

**Analysis:**
- Deterministic phase: run `node tools/brand-compliance.cjs`, `node tools/dimension-check.cjs`, `node tools/schema-validation.cjs` and capture output
- Holistic phase: review styled.html against 8 categories, assign severity scores
- Output is structured JSON with specific schema (blocking_issues, warnings arrays)
- The holistic review requires reading HTML and comparing against brand rules
- However, the comparison criteria are well-documented (each category has clear pass/fail criteria)

**Recommendation: Split approach — Haiku for deterministic, Sonnet for holistic**

Actually, since we can't split a single agent, the practical recommendation:

**Recommendation: Keep Sonnet** — the holistic review component requires reading HTML and making brand judgment calls. While the CLI portion is mechanical, the holistic portion needs real comprehension. A missed blocking issue means bad output ships; a false positive means unnecessary fix loops.

**Alternative: Downgrade to Haiku with tighter prompting** — if we make the holistic review criteria more explicit (checklists instead of judgment), Haiku could handle it. This would require refactoring the spec-check-agent.md instructions. Worth testing in Phase 07-02.

**Risk of downgrade to Haiku:** MEDIUM — false negatives (missed issues) let bad output through. False positives (over-flagging) create unnecessary fix loops. Both cost more than just running Sonnet.

---

### 5. Orchestrator (fluid-social, fluid-one-pager, fluid-theme-section)

**Current model:** Inherits parent (typically Opus)
**Task profile:** Parse arguments → create session directory → delegate to 4 agents sequentially → read intermediate files → print status → manage fix loop → copy output

**Analysis:**
- The orchestrator does NOT do creative work
- Its tasks: argument parsing, directory creation, Agent tool delegation, file reading, status printing
- Fix loop management: read spec-report.json, group issues by fix_target, re-delegate — this is procedural logic
- The orchestrator is defined as a slash command (`.claude/commands/`) not an agent definition, so it runs at the parent conversation's model level
- This is currently Opus — the most expensive model — doing what amounts to scripting work

**Recommendation: This is the biggest optimization opportunity**

The orchestrator doesn't need Opus. However, the orchestrator runs as the main conversation, not as a subagent, so we can't pin its model in frontmatter.

**Options:**
1. **Convert orchestrators to agent definitions** with `model: sonnet` — then invoke them from the main conversation as a single Agent call. The main conversation stays Opus for user interaction, but the orchestrator pipeline runs on Sonnet.
2. **User switches to Sonnet before running** — `/model sonnet` then `/fluid-social ...` — but this requires user action and means the whole conversation drops to Sonnet.
3. **Add `model: "sonnet"` to orchestrator Agent calls** — the orchestrator IS the main conversation, so this doesn't apply directly. But if we wrap the orchestrator as a subagent (option 1), this works.

**Best approach: Option 1** — wrap the orchestrator logic into an agent definition (e.g., `social-orchestrator-agent.md`) with `model: sonnet`. The slash command becomes a thin wrapper that launches the orchestrator agent.

---

## Recommended Model Assignment

| Agent | Current | Recommended | Rationale |
|-------|---------|-------------|-----------|
| Orchestrator | Opus (inherited) | **Sonnet** (via agent wrapper) | Procedural delegation, no creative reasoning needed |
| copy-agent | Sonnet | **Sonnet** (keep) | Creative writing, brand voice — needs strong instruction following |
| layout-agent | Sonnet | **Haiku** | Template matching, mechanical HTML output |
| styling-agent | Sonnet | **Sonnet** (keep) | Complex CSS composition, multiple input integration |
| spec-check-agent | Sonnet | **Sonnet** (keep, test Haiku in 07-02) | Holistic review requires judgment; explore Haiku with tighter prompting later |

## Expected Impact

### Cost Reduction
- **Layout agent Sonnet → Haiku:** ~80% cost reduction on layout step (Haiku is ~25x cheaper than Sonnet per token)
- **Orchestrator Opus → Sonnet:** ~80% cost reduction on orchestration overhead (Opus is ~5x Sonnet)
- **Estimated overall pipeline cost reduction:** 40-60% (orchestrator is the biggest token consumer due to reading all intermediate files)

### Latency Reduction
- **Layout agent:** Haiku responds ~3-5x faster than Sonnet — saves 5-15 seconds per run
- **Orchestrator as Sonnet:** Sonnet generates faster than Opus — saves time on every orchestrator turn (argument parsing, status updates, fix loop logic)
- **Estimated overall pipeline time reduction:** 30-50%

### Quality Risk
- **Layout agent on Haiku:** Low risk. Well-constrained output format. Spec-check catches errors.
- **Orchestrator on Sonnet:** Minimal risk. The orchestrator follows a rigid script. No creative judgment needed.
- **Net quality expectation:** Parity. Fix loop serves as safety net.

## Implementation Approach

### Phase 07-01: Safe Downgrades (low risk)
1. Downgrade layout-agent to Haiku
2. Wrap orchestrators as Sonnet-pinned agent definitions
3. Run 5 test generations across social/one-pager/theme-section
4. Compare spec-check pass rates, fix iteration counts, output quality

### Phase 07-02: Explore Further (medium risk)
1. Test spec-check-agent on Haiku with tightened prompting (explicit checklists)
2. Test copy-agent on Sonnet vs Opus for complex prompts (manifesto, thought leadership)
3. Evaluate whether fix loop iterations increase with model downgrades
4. Decision: keep or revert based on data

## Key Risks

1. **Haiku layout agent may miss SLOT comments** — mitigated by spec-check validation
2. **Sonnet orchestrator may handle edge cases worse than Opus** — mitigated by well-structured slash command instructions
3. **Wrapping orchestrator as agent adds nesting** — main conversation → orchestrator agent → subagents. Need to verify Agent-within-Agent still works correctly (orchestrator agent needs Agent tool access)

### Risk #3 Deep Dive: Agent Nesting

The current anti-pattern rule says "NEVER let a subagent use the Agent tool." But the orchestrator IS the thing that delegates to subagents. If we wrap the orchestrator as an agent:

- Main conversation → orchestrator-agent (Sonnet) → copy-agent, layout-agent, etc.
- The orchestrator-agent would need `Agent` in its tools list
- This means a subagent calling Agent — which violates the current anti-pattern

**Resolution options:**
a. **Allow Agent tool for orchestrator-level agents only** — update the anti-pattern to say "subagents (copy, layout, styling, spec-check) must not use Agent tool" rather than blanket "no subagent Agent use"
b. **Keep orchestrator in main conversation but add explicit `model` overrides in Agent calls** — the orchestrator stays at parent level but each Agent delegation includes `model: "haiku"` or `model: "sonnet"` explicitly
c. **Use model override in Agent calls from the slash command** — the slash command delegates one Agent call with the full orchestrator prompt and `model: "sonnet"`

**Option (b) is simplest and safest.** No architectural change to orchestrator structure. Just add `model` parameters to existing Agent calls in the slash command instructions. The orchestrator still runs at parent level (Opus when user is on Opus), but each subagent is explicitly pinned regardless.

**Revised recommendation:** Don't wrap orchestrator as agent. Instead:
- Add explicit `model: "haiku"` to layout-agent Agent calls in all orchestrators
- Add explicit `model: "sonnet"` to copy-agent, styling-agent, spec-check-agent Agent calls (making the frontmatter default redundant but explicit)
- Accept that the orchestrator runs at parent model level — this is actually fine because the orchestrator's token usage is relatively small compared to subagents
