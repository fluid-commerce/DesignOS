# Pitfalls Research

**Domain:** AI-powered branded marketing asset generation skill system (subagent orchestration, brand compliance, template libraries, iteration workflows)
**Researched:** 2026-03-10
**Confidence:** HIGH (domain-specific pitfalls sourced from project context, practitioner reports, and ecosystem research)

## Critical Pitfalls

### Pitfall 1: Context Flooding Subagents Instead of Context Precision

**What goes wrong:**
The system loads every brand document, design token file, and template reference into each subagent, recreating the exact "context overload" problem that motivated the subagent architecture in the first place. Subagent output quality degrades as context volume increases -- token usage explains 80% of performance variance in agent tasks.

**Why it happens:**
Fear of missing context. When building a brand compliance system, the instinct is "the agent needs ALL the brand rules to produce brand-correct output." But subagents work best with focused, minimal context that matches their specific concern.

**How to avoid:**
- Each subagent gets ONLY the `.md` files relevant to its concern (copy agent gets voice rules only, styling agent gets design tokens only, spec-check agent gets validation rules only)
- Cap reference material per subagent to 3-5 focused documents maximum
- Use the wiki-linking structure in Brand Intelligence to let docs reference each other without loading everything
- Test output quality with progressively less context -- find the minimum viable context per subagent role

**Warning signs:**
- Subagent responses start contradicting themselves or mixing concerns (layout advice in copy output)
- Token consumption per asset generation is unusually high
- Subagents produce generic output that doesn't reflect the specific brand rules they were given
- Main agent context window fills up from subagent return summaries

**Phase to address:**
Phase 1 (Brand Intelligence Layer) -- the document decomposition and organization must be designed for subagent consumption from day one. Wrong structure here cascades through everything.

---

### Pitfall 2: Treating Subagents as Implementation Workers Instead of Context Collectors

**What goes wrong:**
Assigning full implementation tasks to subagents (e.g., "generate the complete HTML/CSS for this social post") instead of using them as specialized information gatherers that return condensed summaries back to the orchestrator. This causes excessive token consumption, slower performance, and the orchestrator losing coherence as it tries to merge large outputs from multiple subagents.

**Why it happens:**
The GSD-inspired orchestrator pattern (plan, review, execute, verify) maps naturally to "each subagent does its piece and we assemble." But Claude Code subagents are designed as an information-gathering army -- they explore, summarize, and return concise findings. The main agent (or orchestrator) should do the actual synthesis.

**How to avoid:**
- Design subagent roles as advisors, not builders: copy subagent returns "here's the copy" (small output), layout subagent returns "use two-column with pull quote" (recommendation), styling subagent returns "apply these specific tokens" (specification)
- The orchestrator assembles the final asset using subagent recommendations
- Keep subagent return payloads small and structured -- summaries, not full implementations
- Only the spec-check/fix cycle should touch the actual generated artifact

**Warning signs:**
- Subagents returning large HTML/CSS blocks that the orchestrator struggles to merge
- Orchestrator context window filling up rapidly
- Conflicting implementations between subagents (copy agent's HTML structure vs layout agent's HTML structure)
- Total generation time per asset exceeding 3-4 minutes

**Phase to address:**
Phase 2 (Asset Skills Layer / Orchestrator Design) -- the subagent contract (what goes in, what comes out) must be defined before building any asset-specific skills.

---

### Pitfall 3: Monolithic Brand Documentation That Can't Evolve

**What goes wrong:**
Brand intelligence gets encoded as a set of static, comprehensive documents that are correct on day one but become increasingly stale as brand direction evolves. The Gold Standard workflow, social post design guide, and brand voice rules all exist as separate artifacts with no mechanism for coordinated updates. When the brand shifts (which the project explicitly acknowledges will happen), individual documents get updated while others lag behind, creating contradictory brand instructions.

**Why it happens:**
Chey's team has multiple brand sources (wecommerce.com, deck system, fluid-website-build-prompt.md, social post iterations) that aren't fully reconciled yet. The temptation is to write a comprehensive "source of truth" document, but the brand is still iterating. A monolithic document becomes a maintenance burden that nobody keeps current.

**How to avoid:**
- Structure brand intelligence as small, single-concern `.md` files with clear ownership and last-updated dates
- Use a brand version or epoch marker -- when brand direction shifts, increment the epoch and flag all files that need review
- Design the meta-skill feedback ingestion to update brand files atomically (change one rule in one place, not scattered across 15 documents)
- Each brand file should have a header declaring its dependencies on other brand files
- Run periodic "brand coherence checks" -- a validation skill that reads all brand files and flags contradictions

**Warning signs:**
- Two brand documents giving conflicting guidance on the same topic (e.g., button styling in Gold Standard vs. social post design guide)
- Team members saying "I'm not sure which doc is the current one"
- Generated assets that look correct according to one brand file but violate another
- Brand files that haven't been updated in weeks while active iteration sessions are producing new guidance

**Phase to address:**
Phase 1 (Brand Intelligence Layer) -- the file structure, metadata conventions, and update mechanisms must support evolution from the start. The feedback ingestion meta-skill (later phase) operationalizes this, but the structure must be ready.

---

### Pitfall 4: Template Rigidity -- Either Too Strict or Too Loose

**What goes wrong:**
The system either (a) forces agents to follow templates verbatim, producing cookie-cutter assets that all look identical and can't adapt to varying content, or (b) presents templates as loose inspiration, allowing agents to drift so far from the brand that outputs are unrecognizable. This is the exact tension Chey identified: "templates as 5-star references, not constraints."

**Why it happens:**
LLMs have two failure modes with reference material. Given strict templates, they copy them exactly (the averaging effect of repeated AI generations). Given loose guidance, they hallucinate their own interpretation. Finding the middle ground requires explicit instruction about WHICH parts of a template are mandatory (brand elements, color palette, typography) and which are flexible (layout arrangement, content density, whitespace).

**How to avoid:**
- In Jonathan's spec format, explicitly annotate each element as FIXED (must appear exactly as specified), FLEXIBLE (can vary within constraints), or OPTIONAL (may be omitted)
- Include "variation examples" alongside templates showing acceptable deviations
- The spec-check subagent should validate FIXED elements strictly while allowing FLEXIBLE elements to vary
- Build 3-5 reference outputs per template showing the range of acceptable variation
- Never present a single example as "the way" -- always show the acceptable range

**Warning signs:**
- All generated social posts look nearly identical despite different content
- Generated assets using brand colors and fonts but in arrangements that feel "off-brand"
- Spec-check passing everything (too loose) or failing everything (too strict)
- Team saying "it looks AI-generated" -- the monoculture trap

**Phase to address:**
Phase 1 (Template Library / Brand Pattern Library) and Phase 2 (Spec-Check Subagent) -- templates must encode flexibility metadata, and the spec-check must understand the difference between fixed and flexible elements.

---

### Pitfall 5: The Feedback Ingestion Death Spiral

**What goes wrong:**
The meta-skill that ingests iteration feedback into brand rules/templates creates a self-reinforcing loop. Feedback from iteration sessions gets encoded as new rules. Those rules produce outputs biased toward the most recent feedback. Next iteration session adjusts based on biased output. Over time, the system converges on a narrow, over-fitted aesthetic that reflects the latest loudest feedback rather than intentional brand direction. This is the "design monoculture trap" -- each iteration pulls the system closer to what the AI thinks is correct, with distinctive design decisions getting smoothed away.

**Why it happens:**
Iteration feedback is inherently local ("make this post's headline bigger") but gets encoded as global rules ("headlines should be bigger"). Without distinguishing between asset-specific corrections and systemic brand updates, every piece of feedback becomes a permanent rule.

**How to avoid:**
- Categorize all feedback as either ASSET-SPECIFIC (applies only to this output) or SYSTEMIC (should update brand rules)
- Require human approval (Chey, Felipe, or AJ) before systemic feedback gets encoded into brand files
- Track feedback provenance -- every brand rule change should link back to the iteration session that inspired it
- Implement a "cooling period" -- systemic feedback candidates sit in a staging area for review before being committed
- Periodically review all rules added via feedback ingestion and prune over-specific ones

**Warning signs:**
- Brand rule files growing rapidly with increasingly specific micro-rules
- Outputs becoming more uniform over time rather than more consistently branded
- New asset types (e.g., first one-pager) looking weird because they're following rules derived from social post feedback
- Team feeling like "the system used to be more creative"

**Phase to address:**
Late phase (Meta-Skills / Feedback Ingestion) -- but the categorization framework (asset-specific vs. systemic) should be designed in Phase 1 so iteration sessions from day one capture this distinction.

---

### Pitfall 6: Subagent Orchestration Loops and Runaway Costs

**What goes wrong:**
The orchestrator-subagent pattern (generate -> spec-check -> fix -> re-check) can enter infinite or near-infinite loops. Spec-check finds issues, fix agent addresses them but introduces new issues, re-check finds those, fix addresses them but reintroduces the original issues. Each cycle burns tokens and time. Early multi-agent prototypes commonly spawned excessive numbers of agents or got stuck in loops.

**Why it happens:**
Spec-check rules may conflict with each other, or the fix agent's corrections may violate a different rule than the one it's fixing. Without iteration limits and convergence tracking, the system can bounce between two states indefinitely.

**How to avoid:**
- Hard cap on fix iterations (maximum 2-3 rounds before escalating to human)
- Track whether spec-check issues are DECREASING across iterations -- if issue count isn't decreasing, stop and escalate
- Prioritize spec-check issues so the fix agent addresses the most critical ones first
- Ensure spec-check rules are tested for internal consistency before deployment
- Log total token cost per asset generation and alert when it exceeds a threshold

**Warning signs:**
- Asset generation taking more than 5 minutes
- The same spec-check issues appearing repeatedly across fix iterations
- Token costs per asset generation increasing over time
- Fix agent output oscillating between two states

**Phase to address:**
Phase 2 (Orchestrator Design / Spec-Check Subagent) -- iteration limits and convergence tracking must be built into the orchestration loop from the start.

---

### Pitfall 7: Gold Standard Decomposition That Loses Cross-Cutting Concerns

**What goes wrong:**
When decomposing the Gold Standard workflow into focused `.md` files for subagent consumption (schema-rules, template-patterns, button-system, validation, theme-tokens), cross-cutting concerns that span multiple files get lost. For example, a rule like "section backgrounds must contrast with adjacent sections" involves the layout agent (section ordering), the styling agent (background colors), and the validation agent (contrast checking). No single subagent owns this rule, so it falls through the cracks.

**Why it happens:**
Decomposition naturally creates boundaries, and cross-cutting concerns by definition span those boundaries. The more modular the documents, the higher the risk that inter-document relationships are lost.

**How to avoid:**
- Create an explicit "cross-cutting concerns" document that lists rules spanning multiple subagent domains
- The orchestrator (not subagents) should own cross-cutting validation
- Each decomposed document should have a "Related Rules" section linking to concerns in other documents
- Test decomposition quality by having a subagent generate an asset using ONLY its assigned documents, then check what brand rules it violated -- those violations reveal missing cross-cutting documentation

**Warning signs:**
- Generated assets passing all individual subagent checks but failing holistic brand review
- Team finding brand violations that "none of the checks caught"
- Subagents producing locally correct but globally inconsistent output (each section looks fine alone, page looks wrong together)

**Phase to address:**
Phase 1 (Gold Standard Decomposition / Brand Intelligence) -- the decomposition strategy must account for cross-cutting concerns before any subagent architecture is built on top of it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding brand values instead of using design token references | Faster to write skills initially | Every brand color/font change requires updating multiple skill files | Never -- design tokens from day one |
| Single monolithic orchestrator skill per asset type | Simpler to build and debug | Impossible to reuse subagents across asset types (copy subagent for social vs. one-pager) | Only in early prototyping, refactor before second asset type |
| Skipping spec-check during development | Faster iteration on skill logic | Assets ship without brand validation, team loses trust in system quality | Only for first proof-of-concept, add spec-check before any team review |
| Inline CSS in generated HTML instead of referencing shared stylesheets | Simpler generation, self-contained outputs | Brand-wide style changes require regenerating every asset | Acceptable for social posts (standalone images), never for website sections |
| Storing iteration feedback as unstructured notes | Quick to capture during sessions | Impossible to systematically ingest; feedback ingestion meta-skill can't parse it | Never -- define feedback schema before first iteration session |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code + Cursor dual-platform support | Writing skills that depend on Claude Code-specific features (subagent spawning via `Task()`) that don't exist in Cursor | Design skill interface as markdown instructions that work in both; use platform-specific orchestration wrappers |
| Existing Slidev deck system | Trying to rebuild deck generation from scratch to match the new architecture | Wrap existing 32-layout Slidev system with a thin orchestration layer; feed it brand intelligence but don't rewrite it |
| Existing Remotion video system | Same as above -- rebuilding instead of wrapping | Create integration skills that translate brand intelligence into Remotion recipe format; existing system handles rendering |
| Jonathan's template library format | Treating template PNGs as the reference instead of the HTML + spec format | The HTML + spec table + creation instructions is the source of truth; PNGs are previews only |
| Lane's Gold Standard .liquid sections | Assuming all 111 sections are Gold Standard compliant | Audit and tag sections by compliance level; only use verified Gold Standard sections as references |
| Brand assets (brushstrokes, circles) | Referencing assets by filename without documenting usage rules | Create an asset manifest with each asset's name, purpose, acceptable contexts, and sizing constraints |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all brand reference images into subagent context | Slow generation, high token cost, Claude vision tokens expensive | Reference images by description and URL; only load actual images when visual comparison is needed | Immediately -- image tokens are 5-10x text token cost |
| Spawning all subagents in parallel without dependency ordering | Race conditions where layout subagent finishes before copy, producing layouts for wrong content length | Define dependency graph: copy first, then layout (needs content length), then styling (needs layout), then spec-check | With 3+ parallel subagents |
| Growing brand rule files without pruning | Spec-check takes longer as rule count increases; diminishing returns on micro-rules | Review and consolidate rules quarterly; distinguish "principles" (few, permanent) from "preferences" (many, evolving) | At 50+ individual validation rules |
| Canvas tool storing full HTML of every iteration variant | Storage and load times grow; comparing 10+ variants becomes unwieldy | Store diffs from baseline; lazy-load variant previews; archive old trajectories after final selection | At 20+ variants per asset |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Including API keys or internal URLs in brand intelligence `.md` files | Keys exposed in git repo shared for distribution | Brand intelligence files must never contain secrets; use environment variables for any service connections |
| Letting generated HTML reference external CDN resources without pinning versions | CDN compromise could inject malicious content into generated assets | Pin all external resource versions; prefer self-hosted brand assets |
| Storing client-specific information in shared template library | Client data leaks if repo is shared or distributed | Keep client-specific content in a separate, non-distributed directory; templates should be content-agnostic |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring the operator to specify which subagents to invoke | Non-technical team members (Felipe, AJ) can't use the system without learning its architecture | Single entry point per asset type; orchestrator handles all subagent decisions internally |
| No preview before full generation completes | Operator waits 2-4 minutes with no feedback, then gets a result they don't like | Stream intermediate results: show copy draft first, then wireframe layout, then styled output |
| Canvas tool requiring manual annotation format | Friction in iteration sessions; team reverts to Slack screenshots with drawn arrows | Support free-form text annotations pinned to visual regions; structure them for ingestion later |
| Generated assets that can't be manually edited | Team wants to tweak one headline without regenerating the whole asset | Output clean, well-commented HTML/CSS with clearly labeled content slots that humans can edit directly |

## "Looks Done But Isn't" Checklist

- [ ] **Brand Intelligence Layer:** Docs exist but haven't been tested with actual subagent consumption -- verify each doc produces correct output when used as the sole reference for its subagent role
- [ ] **Template Library:** Templates render correctly but lack the FIXED/FLEXIBLE/OPTIONAL annotations -- verify each template element has explicit flexibility metadata
- [ ] **Spec-Check Subagent:** Catches obvious violations (wrong colors) but misses cross-cutting concerns (section flow, content hierarchy) -- verify against a curated list of known "tricky" brand violations
- [ ] **Copy Subagent:** Produces copy that sounds good in isolation but doesn't match the specific layout it will be placed in (too long for the card, wrong tone for the section type) -- verify copy + layout integration, not just copy alone
- [ ] **Orchestrator Skill:** Works for the happy path but has no error handling for subagent failures -- verify behavior when a subagent returns garbage or times out
- [ ] **Canvas Tool:** Displays assets but doesn't capture structured feedback metadata -- verify that iteration sessions produce machine-parseable feedback, not just human-readable notes
- [ ] **Distribution Layer:** Installs but doesn't handle updates cleanly -- verify that updating the skill system doesn't overwrite local customizations or break existing workflows
- [ ] **Design Token References:** Skills reference token names but tokens aren't actually resolved at generation time -- verify generated HTML uses actual values, not unresolved token references

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context flooding subagents | LOW | Audit and trim context per subagent role; no architecture changes needed |
| Monolithic brand documentation | MEDIUM | Decompose existing docs into smaller files; update all skill references; takes 1-2 days per major document |
| Template rigidity (too strict) | LOW | Add flexibility annotations to existing templates; update spec-check rules |
| Feedback ingestion death spiral | HIGH | Audit all ingested rules, revert to baseline brand rules, re-ingest only validated systemic feedback; can lose weeks of iteration progress |
| Orchestration loops | LOW | Add iteration caps and convergence tracking; purely additive change to existing orchestration |
| Cross-cutting concern gaps | MEDIUM | Create cross-cutting concerns document, add orchestrator-level validation; requires re-testing all asset generation flows |
| Subagents as implementation workers | HIGH | Requires redesigning subagent contracts and orchestrator assembly logic; foundational architecture change |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context flooding subagents | Phase 1: Brand Intelligence | Test each subagent role with only its assigned docs; measure output quality vs. context volume |
| Subagents as implementation workers | Phase 2: Orchestrator Design | Subagent outputs are summaries/recommendations under 500 tokens; orchestrator produces final artifact |
| Monolithic brand documentation | Phase 1: Brand Intelligence | Each `.md` file covers exactly one concern; files have last-updated dates and dependency headers |
| Template rigidity | Phase 1: Template Library | Each template has FIXED/FLEXIBLE/OPTIONAL annotations; 3+ variation examples per template |
| Feedback ingestion death spiral | Phase 4: Meta-Skills | All ingested feedback tagged as ASSET-SPECIFIC or SYSTEMIC; systemic changes require human approval |
| Orchestration loops | Phase 2: Orchestrator Design | Hard cap of 3 fix iterations; convergence tracking logs show decreasing issue counts |
| Cross-cutting concern gaps | Phase 1: Gold Standard Decomposition | Explicit cross-cutting concerns document exists; orchestrator validates holistic brand coherence |

## Sources

- [Claude Code Subagents: Common Mistakes & Best Practices](https://claudekit.cc/blog/vc-04-subagents-from-basic-to-deep-dive-i-misunderstood) -- practitioner report on subagent misuse patterns
- [Best practices for Claude Code subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) -- subagent design patterns
- [The 2025 AI Agent Report: Why AI Pilots Fail in Production](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) -- "Dumb RAG" and context flooding
- [Single-Responsibility Agents vs Multi-Agent Workflows](https://www.epam.com/insights/ai/blogs/single-responsibility-agents-and-multi-agent-workflows) -- agent specialization patterns
- [The AI feedback loop: When design systems train the models that critique them](https://blog.murphytrueman.com/p/the-ai-feedback-loop) -- design monoculture trap
- [AI Feedback Loops: When "Faster" Development Turns Against You](https://www.mojotech.com/blog/ai-feedback-loops-when-faster-software-development-quietly-turns-against-you/) -- invisible drift
- [Brand Compliance: Best Practices for 2026](https://www.puntt.ai/blog/brand-compliance-best-practices-2026) -- brand governance patterns
- [AI for Brand Management: Governance, Consistency & Scale](https://www.frontify.com/en/guide/ai-for-brand-management) -- brand compliance automation
- [Context Management with Subagents in Claude Code](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code) -- context precision strategies
- [A Taxonomy of Prompt Defects in LLM Systems](https://arxiv.org/html/2509.14404v1) -- structured analysis of prompt failure modes
- Project context: `.planning/PROJECT.md` and `Reference/Context/project-vision-and-decisions.md` -- Fluid Creative OS project-specific decisions and constraints

---
*Pitfalls research for: AI-powered branded marketing asset generation skill system*
*Researched: 2026-03-10*
