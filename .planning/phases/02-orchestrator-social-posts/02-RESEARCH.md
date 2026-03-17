# Phase 2: Orchestrator + Social Posts - Research

**Researched:** 2026-03-10
**Domain:** Claude Code orchestrator-subagent architecture, social post generation, template library
**Confidence:** HIGH

## Summary

This phase builds the core orchestrator-subagent pipeline that takes a single prompt and produces a brand-correct social post as validated HTML/CSS. The implementation leverages Claude Code's native subagent system (`.claude/agents/` markdown files with YAML frontmatter) for the pipeline stages, and a skill (`.claude/skills/fluid-social/SKILL.md`) for the slash command entry point. The architecture is sequential: copy -> layout -> styling -> spec-check -> fix loop, with each subagent communicating via files on disk in `.fluid-working/`.

The project already has strong foundations from Phase 1: 12 brand docs organized by subagent role, 3 scaffolded subagent contracts in `.claude/agents/`, 7 CLI validation tools, a Brand Pattern Library with copy-pasteable code, and a PostToolUse hook for auto-validation. The main work is: (1) upgrading the 3 existing subagent stubs into full production agents plus adding a spec-check agent, (2) building the orchestrator skill that chains them, (3) creating 7 social post templates in Jonathan's format (3 exist in Reference/, 4 new), and (4) implementing the fix loop with severity-based routing.

**Primary recommendation:** Build the orchestrator as a `context: fork` skill that spawns subagents sequentially via the Agent tool, writing intermediate artifacts to `.fluid-working/` and running CLI validation tools deterministically before the holistic spec-check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single slash command: `/fluid-social "topic or brief"` -- agent infers platform, product, archetype, and accent color from the prompt
- Optional flags: `--platform`, `--product`, `--variations N`, `--ref path/to/post.html`, `--template archetype-name`, `--debug`
- Default platform: Instagram (1080x1080). LinkedIn requires `--platform linkedin`
- `--ref` flag for explicit file reference, natural language references also work
- `--template` flag forces close adherence to template structure; without it, templates are 5-star references only
- `--variations N` generates multiple distinct takes (default: 1)
- Output saved to `./output/` directory in current working directory
- Sequential pipeline: copy -> layout -> styling -> spec-check -> (fix loop if needed)
- Copy must finish first -- layout decisions depend on headline length, text volume, tagline presence
- Subagents communicate via files on disk in `.fluid-working/` directory: copy.md, layout.html, styled.html, spec-report.json, final.html
- Orchestrator prints status updates as each subagent completes
- Working directory cleaned up after successful generation; `--debug` preserves it
- 7 archetypes total in `templates/social/`: quote, app-highlight, partner-alert (existing), plus problem-first, stat/proof, manifesto/brand-voice, feature-spotlight (new)
- Templates live in `templates/social/`, not Reference/
- 4 new templates built from the 28 existing generated examples in Reference/ as source material
- Spec-check uses CLI tools (brand-compliance.cjs, dimension-check.cjs) for deterministic checks + spec-check subagent for holistic review
- Severity mapped to weight system: 81-100 = blocking, 51-80 = warning, 1-50 = info
- Only blocking issues (81-100) trigger the fix loop
- Fix routing: re-run the failing subagent with spec-check feedback, not a separate fix agent
- Hard cap: 3 fix iterations, then escalate with best attempt + remaining issues

### Claude's Discretion
- Exact subagent contract formats (what goes into each .fluid-working/ file)
- How the orchestrator routes fix issues to the correct subagent
- Spec-check report JSON structure
- Working directory naming/cleanup strategy
- How natural language template/reference matching works internally
- Naming convention for output files

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-01 | Orchestrator skill pattern -- one slash command per asset type, spawns specialized subagents with fresh context | Skill with `context: fork` + Agent tool for subagent delegation. Existing `.claude/agents/` stubs provide foundation. |
| ORCH-02 | Copy subagent loads only voice rules and messaging docs, produces copy in Fluid brand voice | Existing `copy-agent.md` stub loads `brand/voice-rules.md` + `brand/social-post-specs.md`. Needs structured output format for `.fluid-working/copy.md`. |
| ORCH-03 | Layout subagent loads only layout archetypes and dimensions, produces structural arrangement | Existing `layout-agent.md` stub loads `brand/layout-archetypes.md` + `brand/social-post-specs.md`. Output goes to `.fluid-working/layout.html`. |
| ORCH-04 | Styling subagent loads only design tokens and asset-specific specs, implements against tokens | Existing `styling-agent.md` stub loads `brand/design-tokens.md` + `brand/asset-usage.md`. Output goes to `.fluid-working/styled.html`. |
| ORCH-05 | Spec-check subagent validates output against brand rules, returns structured list of issues with severity | New agent combining CLI tools (deterministic) + holistic review. Output: `spec-report.json` with pass/fail per rule. |
| ORCH-06 | Fix subagent receives spec-check issues and corrects them, re-validates until passing | Not a separate agent -- orchestrator re-runs the failing subagent with spec-check feedback appended to its prompt. 3-iteration cap. |
| ORCH-07 | Subagent contracts defined -- what goes in, what comes out, max iterations before escalating | Contract formats are Claude's discretion. Research provides recommended structures below. |
| SOCL-01 | Social post skill generates Instagram posts (1080x1080px) as self-contained HTML/CSS | Default platform. Dimension enforced by `dimension-check.cjs --target instagram`. Templates use `body { width: 1080px; height: 1080px; }`. |
| SOCL-02 | Social post skill generates LinkedIn posts (1200x627px and 1340x630px) as self-contained HTML/CSS | Triggered by `--platform linkedin`. Two valid dimensions in `dimension-check.cjs`. Templates exist at 1340x630 (t3-partner-alert). |
| SOCL-03 | Social posts use one accent color per post (orange for pain, blue for trust, green for success, purple for premium) | Copy agent infers mood -> accent color mapping from `social-post-specs.md`. Weight 95, brand-critical. |
| SOCL-04 | Social posts include consistent footer structure | Footer structure documented in `asset-usage.md` (Weight 95). Pattern Library has copy-pasteable footer code. |
| SOCL-05 | Social posts use brushstroke textures with proper blend mode (screen), opacity (0.10-0.25), edge-bleed | `asset-usage.md` Weight 90-95. Seven brushstroke PNGs in `assets/brushstrokes/`. base.css has `.brush` class with `mix-blend-mode: screen`. |
| SOCL-06 | Social posts use circle sketch for word emphasis only, hue-shifted to match accent color | `asset-usage.md` Weight 90. Six circle mask PNGs in `assets/circles/masks/`. Use CSS `mask-image` + `backgroundColor` per Pattern Library. |
| SOCL-07 | Social posts reference template library as 5-star examples but adapt, not copy verbatim | Default behavior: study templates, generate fresh. `--template` flag overrides to close adherence. |
| TMPL-01 | Template library in Jonathan's format -- live HTML preview + content slot specs + creation instructions | Reference template system exists at `Reference/Brand reference material/Templates/Social Post Templates/`. Format: index.html with iframe previews + spec tables + "To Create a New Version" instructions. |
| TMPL-02 | Social post templates covering core archetypes (testimonial/quote, app highlight, partner alert, and 3+ more) | 3 existing templates (quote, app-highlight, partner-alert) in Reference. 4 new ones derived from 28 generated examples. Total: 7 archetypes. |
</phase_requirements>

## Standard Stack

### Core

| Component | Type | Purpose | Why Standard |
|-----------|------|---------|--------------|
| `.claude/skills/fluid-social/SKILL.md` | Claude Code Skill | Slash command entry point `/fluid-social` | Native Claude Code skill system; supports `$ARGUMENTS`, `context: fork`, frontmatter config |
| `.claude/agents/*.md` | Claude Code Subagents | Specialized pipeline stages (copy, layout, styling, spec-check) | Native subagent system; isolated context, tool restrictions, skill preloading |
| `.fluid-working/` | Temp directory | Inter-subagent communication via files | Disk-based handoff avoids context window bloat; `--debug` preserves for inspection |
| `tools/brand-compliance.cjs` | CLI (existing) | Deterministic brand rule validation | Already built in Phase 1; JSON stdout + human stderr dual output |
| `tools/dimension-check.cjs` | CLI (existing) | Dimension validation | Already built in Phase 1; supports `--target instagram\|linkedin_landscape` |
| `brand/*.md` | Brand docs (existing) | Subagent context loading | 12 role-specific docs under 6KB each; wiki-linked; weight system |
| `patterns/index.html` | Pattern Library (existing) | Copy-pasteable brand building blocks | Footer, brushstrokes, circles, FLFont patterns all ready to reference |

### Supporting

| Component | Type | Purpose | When to Use |
|-----------|------|---------|-------------|
| `templates/social/*.html` | Template files | 7 archetype templates | Referenced by subagents as 5-star examples; forced via `--template` |
| `templates/social/index.html` | Template index | Jonathan's format overview page | Live previews + content slot specs + creation instructions |
| `assets/` | Brand assets | Brushstrokes, circles, logos, fonts | Referenced by generated HTML via relative paths |
| `tools/rules.json` | Compiled rules | Static brand rule data for CLI tools | Already compiled from brand docs in Phase 1 |

### Not Needed (Don't Add)

| Temptation | Why Not |
|------------|---------|
| npm packages for HTML generation | Posts are self-contained HTML/CSS; no build step needed |
| Template engine (Handlebars, EJS) | Templates are live HTML files, not interpolated templates |
| External AI APIs | Claude Code's native Agent tool handles all subagent orchestration |
| Database for working state | File-based `.fluid-working/` is simpler and debuggable |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
.claude/
  skills/
    fluid-social/
      SKILL.md               # /fluid-social slash command entry point
  agents/
    copy-agent.md             # Upgraded from Phase 1 stub
    layout-agent.md           # Upgraded from Phase 1 stub
    styling-agent.md          # Upgraded from Phase 1 stub
    spec-check-agent.md       # NEW: validation agent
templates/
  social/
    index.html                # Jonathan's format: live previews + specs
    quote.html                # Archetype 1 (from Reference)
    app-highlight.html        # Archetype 2 (from Reference)
    partner-alert.html        # Archetype 3 (from Reference)
    problem-first.html        # Archetype 4 (NEW)
    stat-proof.html           # Archetype 5 (NEW)
    manifesto.html            # Archetype 6 (NEW)
    feature-spotlight.html    # Archetype 7 (NEW)
```

### Pattern 1: Orchestrator Skill as Entry Point

**What:** A Claude Code skill with `context: fork` that receives the user's prompt, parses flags, and orchestrates the pipeline.

**When to use:** Always -- this is the single entry point for social post generation.

**Key design:**
```yaml
---
name: fluid-social
description: Generate brand-correct Fluid social posts. Use when asked to create social media content, Instagram posts, or LinkedIn posts.
context: fork
disable-model-invocation: true
allowed-tools: Agent, Bash, Read, Write, Glob, Grep
---
```

The skill body contains:
1. Argument parsing logic (extract `--platform`, `--template`, `--variations`, `--ref`, `--debug` from `$ARGUMENTS`)
2. Pipeline orchestration instructions (spawn subagents in sequence)
3. Status reporting format ("Copy done" -> "Layout done" -> etc.)
4. Fix loop logic with 3-iteration cap
5. Output file naming and cleanup instructions

**Critical constraint:** Subagents cannot spawn other subagents. Only the orchestrator (running as main thread via `context: fork`) can use the Agent tool. This means the orchestrator must drive the entire pipeline.

### Pattern 2: Sequential Subagent Pipeline

**What:** Each pipeline stage is a subagent that reads its input from `.fluid-working/`, does its work, and writes output back.

**Flow:**
```
[User prompt] -> Orchestrator parses args
  -> Copy Agent reads prompt + brand/voice-rules.md
     -> writes .fluid-working/copy.md
  -> Layout Agent reads copy.md + brand/layout-archetypes.md
     -> writes .fluid-working/layout.html
  -> Styling Agent reads layout.html + brand/design-tokens.md + brand/asset-usage.md
     -> writes .fluid-working/styled.html
  -> Spec-Check Agent reads styled.html + runs CLI tools
     -> writes .fluid-working/spec-report.json
  -> IF issues: orchestrator re-runs failing agent with feedback
  -> Copy .fluid-working/final.html to ./output/<name>.html
```

**Each subagent receives:**
1. Its role-specific brand docs (via `skills` field preloading the `brand-intelligence` skill)
2. The user's original prompt (for context)
3. Platform/dimension constraints
4. Template reference (if `--template` specified)
5. Previous stage output (read from `.fluid-working/`)
6. Fix feedback (if in fix loop iteration)

### Pattern 3: File-Based Inter-Agent Communication

**What:** Subagents read/write structured files in `.fluid-working/` rather than passing data through the orchestrator's context.

**Recommended file formats:**

**copy.md:**
```markdown
# Copy Output

## Platform: instagram
## Accent: orange
## Archetype: problem-first

### HEADLINE
The order went through. It never reached the commission engine.

### BODY
Now you're manually fixing records while reps lose faith.

### TAGLINE
One connection. Zero 3am calls.

### CTA
(none for social)

### SIDE_LABEL
Fluid Connect

### SLIDE_NUM
(none)
```

**layout.html:** Structural HTML with positioned containers, `<!-- SLOT: name -->` comments, CSS class hooks. No inline styles -- all visual styling deferred to styling agent. Includes dimension comment `<!-- target: 1080x1080 -->`.

**styled.html:** Complete self-contained HTML/CSS file. All fonts embedded via @font-face. All brand tokens applied. Brushstrokes, circles, footer, all positioned. Ready for browser preview.

**spec-report.json:**
```json
{
  "status": "fail",
  "checks": {
    "deterministic": {
      "brand-compliance": { "errors": 0, "warnings": 1, "details": [...] },
      "dimensions": { "pass": true, "target": "1080x1080", "actual": "1080x1080" }
    },
    "holistic": {
      "layout-balance": { "pass": true, "note": "..." },
      "copy-tone": { "pass": true, "note": "..." },
      "visual-hierarchy": { "pass": false, "severity": 85, "issue": "Headline too small for full-bleed archetype", "fix_target": "styling" },
      "brushstroke-placement": { "pass": true, "note": "..." }
    }
  },
  "blocking_issues": [
    { "source": "holistic", "category": "visual-hierarchy", "severity": 85, "issue": "...", "fix_target": "styling" }
  ],
  "warnings": [...],
  "overall": "fail"
}
```

### Pattern 4: Fix Loop with Severity-Based Routing

**What:** When spec-check finds blocking issues (weight 81-100), the orchestrator re-runs the responsible subagent with the issue appended to its prompt.

**Routing logic:**
- Issues with `fix_target: "copy"` -> re-run copy-agent with feedback
- Issues with `fix_target: "layout"` -> re-run layout-agent with feedback
- Issues with `fix_target: "styling"` -> re-run styling-agent with feedback
- If fix changes copy, re-run layout and styling downstream (cascade)
- After fix, re-run spec-check to validate
- 3 iterations max, then escalate

**Escalation output:**
```
ESCALATION: 3 fix iterations exhausted.
Best attempt saved to: ./output/social-post-draft.html
Remaining issues:
  - [85] Visual hierarchy: headline font-size 68px, expected 82px+ for full-bleed
  - [90] Brushstroke edge-bleed: brushstroke03 bottom edge at 80px, should be at canvas edge
```

### Pattern 5: Template as 5-Star Reference

**What:** Templates exist as live HTML files that subagents study but don't copy verbatim. The `--template` flag switches to close-adherence mode.

**Default mode (no --template flag):**
- Orchestrator tells subagents: "Study the templates in `templates/social/` to understand the brand's visual language. Generate a fresh composition."
- Subagents read template files to learn patterns but create new HTML

**Template-follow mode (--template quote):**
- Orchestrator tells subagents: "Follow the structure of `templates/social/quote.html` closely. Replace content slots but preserve layout, sizing, and visual relationships."
- Layout agent mirrors the template's structure
- Styling agent preserves the template's CSS patterns

### Anti-Patterns to Avoid

- **Passing full HTML through the orchestrator's context**: Use file paths, not file contents, in agent delegation messages. The orchestrator says "read .fluid-working/styled.html" not "here is the 200-line HTML".
- **Making spec-check a subagent of a subagent**: Subagents cannot spawn subagents. Spec-check must be called directly by the orchestrator.
- **Building a custom fix agent**: The decision is to re-run the failing subagent with feedback, not create a separate fixer.
- **Referencing assets from Reference/**: Reference/ is build-time source material only. Generated posts reference `assets/` paths.
- **Loading all brand docs**: Each subagent loads only its 2-4 contracted docs. The `skills` frontmatter field preloads the `brand-intelligence` skill which teaches the agent how to load docs selectively.
- **Using hue-rotate for circle recoloring**: The brand docs specify CSS `mask-image` + `backgroundColor` approach. The old `hue-rotate()` approach is in some generated examples but is deprecated per asset-usage.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand rule validation | Custom rule-checking logic in subagents | `node tools/brand-compliance.cjs` | Already handles 50+ rules with weight-based severity; dual JSON/human output |
| Dimension validation | Inline size checking | `node tools/dimension-check.cjs --target instagram` | Extracts dimensions from HTML comments, body styles, or CSS; compares against rules.json |
| Font embedding | Dynamic font loading | Copy @font-face blocks from existing templates/base.css | Two fonts: flfontbold.ttf and Inter-VariableFont.ttf; paths are stable |
| Footer structure | Fresh footer HTML each time | Copy from `patterns/index.html` Pattern Library | Footer is FIXED (Weight 95); same 3 elements every time |
| Brushstroke CSS | Custom blend mode logic | `.brush` class from base.css pattern | `mix-blend-mode: screen`, `position: absolute`, `pointer-events: none`, `z-index: 1` |
| Accent color selection | LLM guessing | Mapping table in social-post-specs.md | Orange=pain, Blue=trust, Green=success, Purple=premium (Weight 95) |

**Key insight:** Phase 1 built extensive infrastructure specifically for Phase 2 to consume. The CLI tools, brand docs, pattern library, and base.css are all designed to be consumed by subagents.

## Common Pitfalls

### Pitfall 1: Context Window Bloat in Orchestrator
**What goes wrong:** Orchestrator passes full file contents between stages, filling its context and causing compaction.
**Why it happens:** Natural instinct is to include output in the delegation message.
**How to avoid:** Always reference files by path. The orchestrator says "The copy agent has written to .fluid-working/copy.md. Read that file." not "Here is the copy: [200 lines]".
**Warning signs:** Orchestrator starts forgetting earlier pipeline stages or producing truncated output.

### Pitfall 2: Subagent Tries to Spawn Subagent
**What goes wrong:** A subagent (e.g., styling agent) tries to use the Agent tool to call another agent.
**Why it happens:** Claude Code subagents cannot spawn other subagents -- this is a platform constraint.
**How to avoid:** Only the orchestrator (running via `context: fork` as main thread, or better, as the top-level agent) delegates to subagents. All subagent definitions should NOT include `Agent` in their `tools` list.
**Warning signs:** "Agent tool not available" errors in subagent execution.

### Pitfall 3: Asset Paths Break When Output Moves
**What goes wrong:** Generated HTML references `assets/brushstrokes/brushstroke-diagonal-sweep.png` but the output file is saved to `./output/` in the user's project, not the skill system directory.
**Why it happens:** Relative paths resolve differently depending on where the HTML file is opened.
**How to avoid:** Generated HTML must use absolute paths or paths relative to a known root. Two options: (a) embed assets as base64 data URIs for fully self-contained files, or (b) use paths relative to the skill system root and document that the file should be opened from that location. Decision: self-contained HTML with embedded assets is most portable.
**Warning signs:** Posts open in browser with broken brushstroke/logo/font images.

### Pitfall 4: Hue-Rotate vs Mask-Image for Circles
**What goes wrong:** Generated code uses `filter: hue-rotate()` for circle sketch recoloring.
**Why it happens:** The generated examples in Reference/ and base.css use the old hue-rotate approach.
**How to avoid:** Brand docs (asset-usage.md) specify CSS `mask-image` + `backgroundColor` as the current approach. Subagents should follow brand docs, not legacy examples.
**Warning signs:** Circle sketch colors look slightly off (hue-rotate is imprecise for accent matching).

### Pitfall 5: Templates Referenced at Runtime from Reference/
**What goes wrong:** Subagents try to load templates from `Reference/Brand reference material/Templates/...`.
**Why it happens:** That's where the source material lives today.
**How to avoid:** Templates must be copied/adapted into `templates/social/` (the runtime location). Reference/ is archival only per CLAUDE.md. The orchestrator and subagents should never read from Reference/.
**Warning signs:** Orchestrator loads 50KB+ files from deeply nested Reference paths.

### Pitfall 6: Fix Loop Cascade Not Handled
**What goes wrong:** A copy fix changes headline length, but layout and styling aren't re-run, so the final output has a layout that doesn't fit the new headline.
**Why it happens:** Fix loop only re-runs the failing agent, not downstream agents.
**How to avoid:** When a copy fix is applied, the orchestrator must cascade: re-run layout and styling with the updated copy. This counts as one fix iteration (not three).
**Warning signs:** Final output has text overflow, misaligned elements, or layout breaks after a copy fix.

## Code Examples

### Orchestrator Skill Entry Point (SKILL.md)

```yaml
---
name: fluid-social
description: Generate brand-correct Fluid social posts from a simple prompt. Creates Instagram (1080x1080) or LinkedIn (1200x627/1340x630) posts with the full brand treatment.
context: fork
disable-model-invocation: true
argument-hint: "topic or brief" [--platform instagram|linkedin] [--template archetype] [--variations N] [--ref path] [--debug]
allowed-tools: Agent, Bash, Read, Write, Glob, Grep, Edit
---

# Fluid Social Post Generator

You are the Fluid social post orchestrator. You take a brief/topic and produce
a brand-correct social post through a sequential subagent pipeline.

## Step 1: Parse Arguments

Parse $ARGUMENTS for:
- Main prompt (everything not a flag)
- --platform: instagram (default) or linkedin
- --template: archetype name (quote, app-highlight, partner-alert, problem-first, stat-proof, manifesto, feature-spotlight)
- --variations: number of variations (default: 1)
- --ref: path to reference post
- --debug: preserve working directory

## Step 2: Set Up Working Directory
...
```

### Subagent Definition (spec-check-agent.md)

```yaml
---
name: spec-check-agent
description: Validates Fluid social post output against brand rules. Runs deterministic CLI checks and holistic visual review. Returns structured pass/fail report.
model: sonnet
tools: Read, Bash, Glob, Grep
skills:
  - brand-intelligence
maxTurns: 15
---

# Fluid Spec-Check Agent

You validate social post HTML against Fluid brand standards.

## Step 1: Deterministic Checks

Run CLI tools on the target file:
- `node tools/brand-compliance.cjs .fluid-working/styled.html --context social`
- `node tools/dimension-check.cjs .fluid-working/styled.html --target <platform>`

Parse JSON stdout from each tool.

## Step 2: Holistic Review

Read the HTML file and evaluate:
- Layout balance (does it match the archetype?)
- Copy tone (does it sound like Fluid?)
- Visual hierarchy (headline dominant, not information-dense?)
- Brushstroke placement (2 per post, edge-bleed, variety?)
- Circle sketch usage (emphasis-only, wrapping specific words?)
- Footer structure (correct elements, correct padding?)
- Accent color consistency (one color throughout?)

## Step 3: Write Report

Write structured JSON to .fluid-working/spec-report.json...
```

### Jonathan's Template Format (index.html structure)

```html
<!-- Each template entry in templates/social/index.html -->
<div class="template-row">
  <div>
    <div class="template-meta">
      <span class="t-num">04</span>
      <span class="t-name">Problem-First / Pain Post</span>
    </div>
    <div class="canvas-outer">
      <iframe src="problem-first.html" scrolling="no"></iframe>
    </div>
  </div>
  <div class="spec">
    <p class="desc">Massive pain-point headline fills the frame. Orange accent
    throughout. Circle sketch wraps key pain word. Body copy: one sentence
    pivoting to the implication. FLFont tagline at bottom.</p>

    <div class="spec-label">Content Slots</div>
    <table>
      <thead><tr><th>Slot</th><th>Spec</th><th>Color</th></tr></thead>
      <tbody>
        <tr><td>{{HEADLINE}}</td><td>NeueHaas 900 / 82-100px / lh 0.92 / uppercase / fills frame</td><td>White + Orange accent words</td></tr>
        <tr><td>{{BODY}}</td><td>NeueHaas 300 / 22px / 1-2 sentences max</td><td>rgba(255,255,255,0.45)</td></tr>
        <tr><td>{{TAGLINE}}</td><td>FLFont Bold / 26-32px / sentence case</td><td>Orange</td></tr>
        <tr><td>{{CIRCLE}}</td><td>circle mask / 280-400px / wraps one pain word</td><td>Orange via mask-image</td></tr>
        <tr><td>{{BRUSHSTROKES}}</td><td>2x / screen blend / 0.10-0.25 opacity / edge-bleed</td><td>White</td></tr>
      </tbody>
    </table>

    <div class="spec-label">To Create a New Version</div>
    <table>
      <tbody>
        <tr><td>1.</td><td>Choose a pain scenario from voice-rules.md</td></tr>
        <tr><td>2.</td><td>Write headline: state the pain, one idea</td></tr>
        <tr><td>3.</td><td>Pick which word gets the circle emphasis</td></tr>
        <tr><td>4.</td><td>Body: one sentence pivoting to implication</td></tr>
        <tr><td>5.</td><td>FLFont tagline: benefit + contrast pattern</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `filter: hue-rotate()` for circle recoloring | CSS `mask-image` + `backgroundColor` | Phase 1 brand doc update | More accurate accent color matching; all 6 circle masks are white PNGs |
| `.claude/commands/*.md` for slash commands | `.claude/skills/*/SKILL.md` | Claude Code 2025-2026 | Skills support frontmatter, `context: fork`, `agent` field, supporting files |
| Monolithic agent prompt | Specialized subagents in `.claude/agents/` | Claude Code subagent system | Isolated context, tool restrictions, model selection, skill preloading |
| Localhost Figma MCP asset URLs | Local `assets/` directory with named files | Phase 1 asset organization | Templates reference `assets/brushstrokes/brushstroke-*.png` not `localhost:3845` URLs |

**Deprecated/outdated:**
- `Reference/Brand reference material/Templates/Social Post Templates/` templates use Figma MCP localhost URLs for assets -- these must be replaced with local `assets/` paths in `templates/social/`
- `base.css` hue-rotate circle classes (`.circle-sketch-orange`, etc.) -- replaced by mask-image approach
- Any reference to loading brand docs from `Reference/` -- that directory is archival only

## Open Questions

1. **Self-contained HTML vs relative asset paths**
   - What we know: Generated posts need to render in a browser. Assets live in `assets/` within the skill system.
   - What's unclear: If the output file is saved to `./output/` in the user's project directory, relative paths to `assets/` will break.
   - Recommendation: Embed small assets (logos, fonts) as base64 data URIs. For larger brushstroke PNGs (up to 232KB each), either: (a) embed as base64 (adds ~300KB per post but fully portable), or (b) copy required assets alongside the output file. Recommend option (a) for maximum portability -- a single HTML file that works anywhere.

2. **Natural language template/reference matching**
   - What we know: User can say "make it like the 3AM server fire post" and the agent should find the right reference.
   - What's unclear: How robust this matching needs to be. The orchestrator could search filenames, or read template descriptions.
   - Recommendation: The orchestrator reads `templates/social/index.html` (which has description text for each template) and uses fuzzy matching against the user's prompt. For Reference/ examples (like "3AM server fire"), the system shouldn't access Reference/ at runtime. Instead, template descriptions should reference common shorthand names.

3. **Variations mode implementation**
   - What we know: `--variations N` should generate multiple distinct takes.
   - What's unclear: Should variations run as parallel subagent pipelines or sequential?
   - Recommendation: Sequential for v1 (simpler, avoids file conflicts in `.fluid-working/`). Use numbered subdirectories: `.fluid-working/v1/`, `.fluid-working/v2/`, etc. Output: `./output/social-post-1.html`, `./output/social-post-2.html`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash + Node.js CLI tools (no test framework -- validation is via existing CLI tools) |
| Config file | None -- CLI tools are self-contained |
| Quick run command | `node tools/brand-compliance.cjs <file> --context social && node tools/dimension-check.cjs <file> --target instagram` |
| Full suite command | `bash -c 'for f in output/*.html; do node tools/brand-compliance.cjs "$f" --context social; node tools/dimension-check.cjs "$f" --target instagram; done'` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORCH-01 | Slash command produces output | smoke | `/fluid-social "test topic"` then check `./output/` for HTML file | N/A (manual via Claude Code) |
| ORCH-02 | Copy output has all required slots | manual-only | Verify `.fluid-working/copy.md` has HEADLINE, BODY, TAGLINE sections | N/A |
| ORCH-03 | Layout output has proper structure | manual-only | Verify `.fluid-working/layout.html` has positioned containers | N/A |
| ORCH-04 | Styling output passes brand compliance | unit | `node tools/brand-compliance.cjs .fluid-working/styled.html --context social` | Existing |
| ORCH-05 | Spec-check produces structured report | unit | `cat .fluid-working/spec-report.json \| node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` | N/A |
| ORCH-06 | Fix loop corrects blocking issues | smoke | Run with known-bad input, verify fix iterations < 4 | N/A (manual) |
| ORCH-07 | Contracts are documented | manual-only | Verify each agent .md file has inputs/outputs/limits documented | N/A |
| SOCL-01 | Instagram dimensions correct | unit | `node tools/dimension-check.cjs output/post.html --target instagram` | Existing |
| SOCL-02 | LinkedIn dimensions correct | unit | `node tools/dimension-check.cjs output/post.html --target linkedin_landscape` | Existing |
| SOCL-03 | Single accent color used | unit | `node tools/brand-compliance.cjs output/post.html --context social` (checks for multiple accent colors) | Existing |
| SOCL-04 | Footer structure present | unit | `node tools/brand-compliance.cjs output/post.html --context social` (checks footer elements) | Existing |
| SOCL-05 | Brushstroke blend mode correct | unit | `node tools/brand-compliance.cjs output/post.html --context social` | Existing |
| SOCL-06 | Circle sketch emphasis-only | manual-only | Visual inspection required | N/A |
| SOCL-07 | Templates as reference not copy | manual-only | Compare output HTML structure against template; should differ | N/A |
| TMPL-01 | Template index in Jonathan's format | manual-only | Open `templates/social/index.html` in browser; verify iframe previews + specs | N/A |
| TMPL-02 | 7 archetype templates exist | unit | `ls templates/social/*.html \| wc -l` should be 8 (7 templates + index) | N/A (Wave 0) |

### Sampling Rate
- **Per task commit:** `node tools/brand-compliance.cjs <latest-output> --context social && node tools/dimension-check.cjs <latest-output> --target instagram`
- **Per wave merge:** Generate one Instagram and one LinkedIn post end-to-end; run both CLI tools on each
- **Phase gate:** Full end-to-end generation for all 7 archetypes; all pass brand compliance and dimension checks

### Wave 0 Gaps
- [ ] `templates/social/` directory -- needs to be created with 7 template files + index.html
- [ ] `templates/social/index.html` -- Jonathan's format index page
- [ ] `.claude/skills/fluid-social/SKILL.md` -- orchestrator skill
- [ ] `.claude/agents/spec-check-agent.md` -- new spec-check subagent
- [ ] Upgrade `.claude/agents/copy-agent.md` -- expand from stub to full contract
- [ ] Upgrade `.claude/agents/layout-agent.md` -- expand from stub to full contract
- [ ] Upgrade `.claude/agents/styling-agent.md` -- expand from stub to full contract

## Sources

### Primary (HIGH confidence)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Full subagent system: frontmatter fields, tool restrictions, skills preloading, hooks, isolation, patterns
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/slash-commands) - Skill system: `context: fork`, `$ARGUMENTS`, `disable-model-invocation`, agent field, supporting files
- Project brand docs (`brand/*.md`) - All 12 docs read; weights, specs, and rules verified
- Project CLI tools (`tools/*.cjs`) - brand-compliance.cjs, dimension-check.cjs source code verified
- Existing subagent stubs (`.claude/agents/*.md`) - 3 stubs with contracts examined
- Reference templates (`Reference/Brand reference material/Templates/`) - 3 templates + index.html format examined
- Generated examples (`Reference/Brand reference material/Generated Examples/Social Posts/`) - 28 examples + base.css examined

### Secondary (MEDIUM confidence)
- Jonathan's template format inferred from existing `index.html` -- format is: iframe preview + content slot table + creation instructions table

### Tertiary (LOW confidence)
- Self-contained HTML via base64 embedding recommendation -- needs size/performance testing with 7 brushstroke PNGs (combined ~778KB)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components are either existing (Phase 1) or native Claude Code features with official docs
- Architecture: HIGH - sequential pipeline is explicitly locked in CONTEXT.md; file-based communication pattern is standard
- Subagent system: HIGH - verified against official Claude Code documentation (March 2026)
- Template format: HIGH - existing reference templates provide exact format to replicate
- Pitfalls: HIGH - derived from actual codebase examination (asset paths, hue-rotate deprecation, Reference/ separation)
- Asset portability: MEDIUM - base64 embedding recommendation needs validation for performance

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- brand docs and Claude Code subagent system are established)
