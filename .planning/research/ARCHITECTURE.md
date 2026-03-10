# Architecture Research

**Domain:** AI-powered branded marketing skill system (Claude Code / Cursor)
**Researched:** 2026-03-10
**Confidence:** HIGH

Evidence base: direct analysis of GSD v1.22.4 (Tier 4 orchestrated skill), the `~/.agents/` distribution system already running on this machine, 47 existing skills, and the project vision documents. This is not speculative -- the foundational patterns are battle-tested in the user's own environment.

## System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: DISTRIBUTION                              │
│  sync.sh  |  git repo  |  install script  |  CLAUDE.md generation    │
├───────────────────────────────────────────────────────────────────────┤
│                    LAYER 3: CANVAS + ITERATION                        │
│  React preview app  |  MCP server  |  Trajectory docs  |  Feedback   │
├───────────────────────────────────────────────────────────────────────┤
│                    LAYER 2: ASSET SKILLS (Orchestrators)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Website  │  │ Social   │  │ One-Page │  │ Deck/    │             │
│  │ Section  │  │ Post     │  │          │  │ Video    │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │              │              │                  │
│  Each orchestrator spawns:                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────┐            │
│  │  Copy  │ │ Layout │ │ Style  │ │ Spec-chk │ │  Fix  │            │
│  └────────┘ └────────┘ └────────┘ └──────────┘ └───────┘            │
├───────────────────────────────────────────────────────────────────────┤
│                    LAYER 1: BRAND INTELLIGENCE                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │ Voice + Copy │ │ Design Token │ │ Pattern Lib  │                  │
│  │ Rules (.md)  │ │ Specs (.md)  │ │ (HTML + .md) │                  │
│  └──────────────┘ └──────────────┘ └──────────────┘                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │ Template Lib │ │ Brand Assets │ │ Gold Std     │                  │
│  │ (HTML+spec)  │ │ (SVG/PNG)    │ │ (decomposed) │                  │
│  └──────────────┘ └──────────────┘ └──────────────┘                  │
├───────────────────────────────────────────────────────────────────────┤
│                    FOUNDATION: CLI + HOOKS                            │
│  fluid-tools.cjs  |  Shell hooks  |  Validation scripts              │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Brand Intelligence docs** | Single source of truth for all brand rules, tokens, voice, patterns | Read by every subagent (each reads only its slice) |
| **Asset Orchestrator skills** | One per asset type. Routes work to subagents, collects results, runs validation loop | Spawns subagents, calls CLI tools, reads templates |
| **Subagent pool** (Copy, Layout, Style, Spec-check, Fix) | Single-concern agents with fresh context windows | Read brand intelligence slice + template refs |
| **Template Library** | 5-star reference examples in Jonathan's format (HTML preview + spec table + creation instructions) | Read by Layout and Style subagents |
| **Brand Pattern Library** | Visual HTML documentation of every brand building block at multiple sizes | Read by Style subagent, used for spec-check validation |
| **CLI tool** (`fluid-tools.cjs`) | Deterministic operations: scaffolding, validation, state, template filling | Called by orchestrators and hooks |
| **Shell hooks** | Pre-commit / post-generate validation: schema checks, dimension checks, color compliance | Run automatically, report pass/fail |
| **Canvas app** | React app for viewing, annotating, comparing asset variations | Receives assets via MCP, sends annotations back |
| **Canvas MCP server** | Bridge between agents and canvas app | Agents push assets, receive structured feedback |
| **Distribution layer** | `sync.sh` + git repo structure for installation | Generates CLAUDE.md entries, copies commands |

## Recommended Project Structure

```
fluid-creative-os/                          # Git repo root
├── sync.sh                                 # Distribution: installs into ~/.agents/
├── install.sh                              # First-time setup (fonts, assets, deps)
│
├── skills/                                 # All skill definitions
│   ├── fluid-brand/                        # invoke: always — brand intelligence loader
│   │   └── SKILL.md
│   ├── fluid-website-section/              # invoke: slash — /fluid:website-section
│   │   └── SKILL.md
│   ├── fluid-social-post/                  # invoke: slash — /fluid:social-post
│   │   └── SKILL.md
│   ├── fluid-one-pager/                    # invoke: slash — /fluid:one-pager
│   │   └── SKILL.md
│   └── fluid-iterate/                      # invoke: slash — /fluid:iterate
│       └── SKILL.md
│
├── orchestration/                          # Workflow engine (installed to ~/.claude/fluid/)
│   ├── workflows/                          # Step-by-step orchestration scripts
│   │   ├── generate-website-section.md
│   │   ├── generate-social-post.md
│   │   ├── generate-one-pager.md
│   │   ├── iterate-asset.md
│   │   └── ingest-feedback.md
│   ├── templates/                          # Output format templates
│   │   ├── social-post-output.md
│   │   ├── website-section-output.md
│   │   └── one-pager-output.md
│   └── references/                         # Decision guides for edge cases
│       ├── subagent-roles.md               # Subagent definitions + model profiles
│       ├── validation-rules.md             # What spec-check looks for
│       └── iteration-patterns.md           # How to handle feedback
│
├── brand/                                  # Brand Intelligence Layer
│   ├── voice/                              # Copy rules
│   │   ├── tone-and-principles.md          # Lead with pain, one idea per sentence...
│   │   ├── messaging-framework.md          # Pain → Solution → Proof structure
│   │   ├── vocabulary.md                   # Preferred terms, banned terms
│   │   └── flfont-rules.md                 # When/how to use FLFont
│   ├── design/                             # Visual rules
│   │   ├── tokens.md                       # Colors, typography, spacing
│   │   ├── layout-archetypes.md            # Full-bleed headline, stat hero, etc.
│   │   ├── button-system.md                # Button variants, states, sizes
│   │   └── container-patterns.md           # Section widths, padding rules
│   ├── patterns/                           # Brand Pattern Library source
│   │   ├── circles-and-underlines.md       # FLFont annotation patterns
│   │   ├── brushstrokes.md                 # Where/how to use brushstroke assets
│   │   └── build-pattern-library.md        # Instructions for rendering HTML gallery
│   ├── gold-standard/                      # Decomposed Gold Standard
│   │   ├── schema-rules.md                 # 13 font sizes, 13 colors, 5 weights
│   │   ├── template-patterns.md            # .liquid template structure
│   │   ├── theme-tokens.md                 # Shopify theme token mapping
│   │   └── validation-checklist.md         # What makes a section Gold Standard
│   └── assets/                             # Binary brand assets
│       ├── brushstrokes/                   # SVG/PNG brushstroke files
│       ├── circles/                        # Circle sketch assets
│       ├── logos/                           # We-Commerce / Fluid logos
│       └── fonts/                          # NeueHaasDisplay, FLFont
│
├── templates/                              # 5-star reference library
│   ├── social/                             # Social post templates (Jonathan format)
│   │   ├── instagram-1080x1080/
│   │   │   ├── template-01.html            # Live preview
│   │   │   └── template-01-spec.md         # Slot specs + creation instructions
│   │   └── linkedin-1200x627/
│   │       ├── template-01.html
│   │       └── template-01-spec.md
│   ├── website/                            # Website section templates
│   │   ├── hero-section/
│   │   │   ├── example.liquid
│   │   │   └── spec.md
│   │   └── feature-grid/
│   │       ├── example.liquid
│   │       └── spec.md
│   └── one-pager/                          # One-pager templates
│       ├── template-01.html
│       └── template-01-spec.md
│
├── bin/                                    # CLI tooling
│   ├── fluid-tools.cjs                     # Main CLI entry point
│   └── lib/
│       ├── validate.cjs                    # Schema, dimension, color validation
│       ├── scaffold.cjs                    # Template scaffolding
│       ├── state.cjs                       # Iteration state management
│       └── brand-check.cjs                 # Brand compliance checks
│
├── hooks/                                  # Shell hooks for deterministic checks
│   ├── validate-schema.sh                  # Check .liquid schema completeness
│   ├── validate-dimensions.sh              # Check asset dimensions
│   └── validate-colors.sh                  # Check color values against tokens
│
├── canvas/                                 # Iteration tool (Phase 3+)
│   ├── app/                                # React app
│   └── mcp-server/                         # MCP bridge
│
└── integrations/                           # Existing system adapters
    ├── slidev-adapter.md                   # How to invoke existing deck system
    └── remotion-adapter.md                 # How to invoke existing video system
```

### Structure Rationale

- **`skills/`**: Thin command routers (under 50 lines each) following the GSD pattern. These are what `sync.sh` distributes to `~/.agents/skills/` and `~/.claude/commands/`.
- **`orchestration/`**: The heavy logic. Workflows define step-by-step subagent spawning sequences. Installed to `~/.claude/fluid/` and referenced via `@file` from commands.
- **`brand/`**: Deliberately decomposed into small, focused files. A copy subagent reads `voice/` files only. A styling subagent reads `design/` files only. This is the core architectural insight -- no agent reads everything.
- **`templates/`**: Separate from `brand/` because templates are reference examples, not rules. The Jonathan format (HTML preview + spec table + creation instructions) is the universal standard.
- **`bin/`**: Node.js CLI for everything deterministic. Agents call this, never do string manipulation themselves.
- **`hooks/`**: Shell scripts for automated validation. Can run as pre-commit hooks or be called by spec-check subagent.
- **`canvas/`**: Deferred to later phase. Isolated so it doesn't complicate the core skill system.

## Architectural Patterns

### Pattern 1: Orchestrator-Subagent Decomposition

**What:** Each asset type has one orchestrator skill that spawns 3-5 single-concern subagents with fresh context windows. The orchestrator stays lean (15% context budget), each subagent gets 100% fresh context loaded with only the brand intelligence files relevant to its concern.

**When to use:** Every asset generation workflow. This is the core pattern.

**Trade-offs:** More agent spawns = more API calls and latency. But output quality is dramatically better because each agent has focused context instead of everything crammed in.

**Execution flow:**
```
User: /fluid:social-post "Pain of manual reconciliation"
    |
    v
Orchestrator (social-post workflow)
    |
    |-- 1. Reads brief, selects template references
    |
    |-- 2. Spawns Copy subagent
    |       Context: voice/*.md + messaging-framework.md + brief
    |       Output: headline, body, CTA, tagline
    |
    |-- 3. Spawns Layout subagent
    |       Context: design/layout-archetypes.md + template spec + copy output
    |       Output: spatial arrangement, element sizing
    |
    |-- 4. Spawns Style subagent
    |       Context: design/tokens.md + patterns/*.md + layout output + copy output
    |       Output: complete HTML/CSS asset
    |
    |-- 5. Spawns Spec-check subagent
    |       Context: gold-standard/validation-checklist.md + tokens.md + generated asset
    |       Output: pass/fail + list of issues
    |
    |-- 6. IF issues: Spawns Fix subagent with issues + asset
    |       Context: specific brand docs for each issue + asset
    |       Output: corrected asset
    |
    v
Final asset ready for Canvas review
```

### Pattern 2: Focused Context Loading (Wiki-Link Pattern)

**What:** Brand intelligence is decomposed into many small `.md` files (10-30 files, each 50-300 lines). Each subagent's workflow specifies exactly which files to load. Files can wiki-link to each other (`See also: [[tokens.md]]`) for human navigation, but agents only load what their workflow specifies.

**When to use:** Always. This is what prevents the context overload problem.

**Trade-offs:** Requires discipline to keep files focused and avoid duplication. Changes to a rule may need updating in multiple places. Mitigate with a single-source-of-truth principle: each fact lives in exactly one file, other files reference it.

**Example of subagent context loading:**
```markdown
<!-- In workflows/generate-social-post.md -->

## Step 2: Spawn Copy Subagent

Spawn a fluid-copy subagent with:
- Read: brand/voice/tone-and-principles.md
- Read: brand/voice/messaging-framework.md
- Read: brand/voice/flfont-rules.md
- Input: The creative brief from Step 1
- Template: orchestration/templates/social-post-output.md (copy section only)
```

### Pattern 3: Templates as 5-Star References (Not Constraints)

**What:** Templates in the library are treated as ideal examples the agent should aspire to, not rigid structures it must replicate verbatim. The spec file accompanying each template documents the content slots, dimensions, and brand rules, but the agent can adapt layout, emphasis, and composition for the specific content.

**When to use:** All asset generation. The Layout and Style subagents receive template references alongside the creative brief.

**Trade-offs:** Outputs may diverge from templates, which could be a feature (fresh compositions) or a bug (off-brand). The spec-check subagent catches brand violations, while allowing creative variation in non-rule areas.

### Pattern 4: Deterministic/Generative Split

**What:** Operations that have a correct answer (schema validation, dimension checking, color value matching, template scaffolding) are handled by CLI tools and shell hooks. Operations requiring judgment (copy writing, layout decisions, visual design choices, feedback interpretation) are handled by AI skills/subagents.

**When to use:** Always. The decision rule: "Can a regex or parser determine correctness? If yes, it's a hook. If it requires judgment, it's a skill."

**Deterministic (CLI/hooks):**
```bash
# Validate .liquid schema has required options
node fluid-tools.cjs validate schema ./sections/hero.liquid

# Check social post dimensions
node fluid-tools.cjs validate dimensions ./output/post.html --target 1080x1080

# Check all colors match brand tokens
node fluid-tools.cjs validate colors ./output/post.html
```

**Generative (skills/subagents):**
- Writing headline copy that leads with pain
- Deciding which layout archetype fits the content
- Choosing where to place a brushstroke accent
- Interpreting "make it feel more urgent" feedback

### Pattern 5: Iteration Trajectory as Training Data

**What:** Every asset generation session produces a trajectory document: the initial prompt, the generated output, each round of feedback, each revision, and the final approved version. These trajectories are stored and periodically ingested by a meta-skill that updates brand rules, adds to the template library, and refines subagent instructions.

**When to use:** Canvas/iteration phase (Phase 3+). This is what makes the system improve over time.

**Data flow:**
```
Generate asset → Canvas review → Annotate → Regenerate → ... → Approve
    |                                                              |
    v                                                              v
Trajectory document (stored in .trajectories/)              Updated brand docs
    |                                                       Updated templates
    v                                                       Updated skill instructions
Meta-skill: /fluid:ingest-feedback
```

## Data Flow

### Asset Generation Flow (Primary)

```
User prompt ("Create social post about X")
    |
    v
Orchestrator skill (/fluid:social-post)
    |
    |-- Reads brief, resolves template refs
    |-- Calls: node fluid-tools.cjs scaffold social-post
    |
    v
Subagent chain (sequential, not parallel — each depends on previous)
    |
    Copy subagent ──reads──> brand/voice/*.md
        |  output: structured copy (headline, body, CTA)
        v
    Layout subagent ──reads──> brand/design/layout-archetypes.md + templates/
        |  output: spatial arrangement spec
        v
    Style subagent ──reads──> brand/design/tokens.md + brand/patterns/*.md
        |  output: complete HTML/CSS
        v
    Spec-check subagent ──reads──> brand/gold-standard/*.md
        |  output: pass/fail + issues list
        v
    [IF fail] Fix subagent ──reads──> relevant brand docs per issue
        |  output: corrected HTML/CSS
        v
Final HTML/CSS asset
    |
    v
Validation hooks (dimensions, schema, colors) — deterministic final check
    |
    v
Output to user (or push to Canvas if iteration mode)
```

### Brand Intelligence Access Pattern

```
                    ┌──────────────────────────┐
                    │    Brand Intelligence     │
                    │    (30+ .md files)        │
                    └──────────────────────────┘
                              |
            ┌─────────────────┼─────────────────┐
            |                 |                 |
     ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
     │ voice/*.md  │  │ design/*.md │  │ gold-std/   │
     │ (3-4 files) │  │ (4-5 files) │  │ (4 files)   │
     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
            |                 |                 |
     Copy subagent    Style subagent    Spec-check
     Layout subagent  Layout subagent   subagent
```

Key principle: No single subagent ever loads all 30+ brand files. Each loads 3-6 files maximum. The orchestrator itself loads zero brand files -- it only coordinates.

### Distribution Flow

```
fluid-creative-os/ repo
    |
    v
install.sh (first time) / sync.sh (updates)
    |
    ├──> ~/.agents/skills/fluid-*/SKILL.md    (skill definitions)
    ├──> ~/.claude/fluid/                      (workflows, templates, references)
    ├──> ~/.claude/commands/fluid/             (slash commands)
    ├──> ~/.claude/CLAUDE.md                   (updated with fluid-brand summary)
    └──> fonts, assets copied to accessible location
```

## Build Order (Dependencies)

This is the critical section for roadmap implications. Components have hard dependencies.

### Dependency Graph

```
Brand Intelligence (Layer 1)
    |
    ├──> CLI Tools (Foundation)  [no dependency on brand, but needed by Layer 2]
    |
    v
Asset Orchestrators (Layer 2)  [requires Layer 1 + Foundation]
    |
    ├──> Website Section skill
    ├──> Social Post skill
    ├──> One-Pager skill
    |
    v
Canvas + Iteration (Layer 3)  [requires working Layer 2 to have assets to iterate]
    |
    v
Distribution (Layer 4)  [requires everything to be working]
    |
    v
Deck/Video Integration  [can happen in parallel with Layer 3+, since adapting existing systems]
Meta-skills (feedback ingestion)  [requires Canvas to produce trajectories]
```

### Suggested Build Phases

| Phase | What | Why This Order |
|-------|------|----------------|
| **1. Brand Intelligence + Foundation** | Decompose brand docs into focused .md files. Build `fluid-tools.cjs` with validation commands. Set up repo structure. | Everything depends on this. Without focused brand docs, subagents can't work. Without CLI tools, validation is unreliable. |
| **2. First Asset Skill (Social Posts)** | Build the orchestrator pattern with social posts first. All 5 subagent types. Shell hooks for validation. | Social posts are the simplest asset type (single HTML file, fixed dimensions, no schema). Proves the orchestrator-subagent pattern before tackling more complex assets. |
| **3. Website Sections + One-Pagers** | Apply proven pattern to .liquid sections (Gold Standard) and HTML one-pagers. | Now the pattern is proven. Website sections are the highest-priority asset but also the most complex (Shopify schema, Gold Standard rules). Building social first de-risks this. |
| **4. Canvas + Iteration** | React app, MCP server, trajectory documentation. | Requires working asset generation to have something to iterate on. This is where the system starts improving itself. |
| **5. Integration + Distribution** | Deck/video adapters. Install script. Documentation. Meta-skills for feedback ingestion. | Only makes sense once the core system works well. Distribution requires stability. |

### Why Social Posts Before Website Sections

Website sections are listed as higher priority in the vision doc, but they are significantly more complex:
- Shopify `.liquid` templating with schema DSL
- 13 font sizes, 13 colors, 5 weights in settings schema
- Gold Standard compliance rules
- Theme token integration
- Section-specific settings vs. block-level settings

Social posts are self-contained HTML/CSS files with fixed dimensions. Building them first proves the entire orchestrator-subagent-validation pipeline at lower complexity, then the same proven pattern handles the harder website sections.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Brand Context

**What people do:** Load all brand docs into every subagent "just in case."
**Why it's wrong:** This is the exact problem the project is solving. Context overload degrades output quality, increases token cost, and makes agents produce generic rather than focused results.
**Do this instead:** Each subagent's workflow specifies exactly which 3-6 brand files to load. If a subagent needs information from a file not in its set, the file should be decomposed further.

### Anti-Pattern 2: Orchestrator Does the Work

**What people do:** The orchestrator skill tries to generate copy, choose layout, and apply styling all in one pass.
**Why it's wrong:** Defeats the purpose of subagent architecture. The orchestrator's context fills up, quality drops, and you're back to the single-agent problem.
**Do this instead:** Orchestrator is a router. Under 100 lines of logic. It reads the brief, spawns subagents, collects results, and runs the validation loop. It never generates content itself.

### Anti-Pattern 3: Templates as Rigid Molds

**What people do:** Build templates that the agent must fill in slot-by-slot, like a form.
**Why it's wrong:** Produces repetitive, formulaic output. Every social post looks identical. Agents can't adapt to content that doesn't fit the mold.
**Do this instead:** Templates are 5-star references with documented specs. The agent studies the template, understands the brand rules it embodies, and produces original compositions that follow those rules. The spec-check subagent catches brand violations, not template deviations.

### Anti-Pattern 4: Validation in the Agent

**What people do:** Ask the AI agent to check its own output against brand rules ("Did you use the correct hex values?").
**Why it's wrong:** Agents are unreliable at self-verification, especially for deterministic checks. They'll say "yes" when the answer is "no."
**Do this instead:** Deterministic checks go to CLI tools and shell hooks. The spec-check subagent handles judgment-based validation (does this feel on-brand?) while `fluid-tools.cjs validate` handles rule-based validation (are the colors correct?).

### Anti-Pattern 5: Parallel Subagent Execution for Sequential Work

**What people do:** Spawn Copy, Layout, and Style subagents in parallel to save time.
**Why it's wrong:** Layout depends on knowing the copy (headline length affects layout). Style depends on knowing both copy and layout. Parallel execution means each agent works with incomplete information.
**Do this instead:** Copy -> Layout -> Style is sequential. Only independent operations (e.g., generating multiple variations) should be parallel.

## Integration Points

### External Systems

| System | Integration Pattern | Notes |
|--------|---------------------|-------|
| Existing 47 skills (`~/.agents/skills/`) | Fluid skills coexist alongside. `sync.sh` handles both. | Fluid skills are namespaced `fluid-*` to avoid collisions. Existing skills are not modified. |
| GSD orchestration | Fluid uses GSD-inspired patterns but is independent. | Fluid's `fluid-tools.cjs` is separate from `gsd-tools.cjs`. No runtime dependency. |
| Slidev deck system | Adapter skill that wraps existing deck system with Fluid brand context. | Don't rebuild. Write a `fluid-deck` skill that loads Fluid brand tokens and calls existing Slidev system. |
| Remotion video system | Adapter skill that wraps existing video system with Fluid brand context. | Same approach. `fluid-video` skill loads brand context, delegates to existing Remotion recipes. |
| Shopify theme (`wecommerce.com`) | Generated `.liquid` sections are designed to drop into the existing theme. | Gold Standard compliance ensures compatibility. Validate with `fluid-tools.cjs validate schema`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Orchestrator <-> Subagent | Task/Agent tool spawn with structured input/output | Subagent receives file paths to read + structured brief. Returns structured output per template. |
| Skill <-> CLI tool | Bash `node fluid-tools.cjs <command>` | CLI returns JSON or writes to file. Agent reads result. |
| Agent <-> Canvas | MCP server protocol | Agent calls MCP tool to push asset. Canvas sends back structured annotations. |
| Brand docs <-> Skills | `@file` references in workflows | Workflows specify exact file paths. Agent reads them via Read tool. |

## Scaling Considerations

This is an internal team tool, not a consumer product. "Scaling" means:

| Concern | Current (Fluid team) | Future (multiple teams) |
|---------|---------------------|------------------------|
| Brand count | 1 (Fluid) | Architecture supports one repo per brand. Not multi-tenant by design. |
| Asset types | 5 (website, social, one-pager, deck, video) | Add new orchestrator skill per type. Pattern is repeatable. |
| Template volume | ~10-20 templates | Template library grows organically. No architectural limit. |
| Brand doc volume | ~30 files | If files grow beyond 300 lines, decompose further. Monitor subagent context usage. |
| Team members | 5 | Distribution via git. `install.sh` handles onboarding. |

The first bottleneck will be brand doc freshness -- keeping 30+ files in sync as the brand evolves. The meta-skill for feedback ingestion (Phase 5) addresses this by automating updates from iteration trajectories.

## Sources

- Direct analysis of GSD v1.22.4 at `~/.claude/get-shit-done/` (HIGH confidence)
- `~/.agents/sync.sh` distribution system (HIGH confidence -- running on this machine)
- Project vision document at `Reference/Context/project-vision-and-decisions.md` (HIGH confidence -- primary stakeholder input)
- Skill architecture guide at `Reference/Skills reference material/building-systematized-claude-skills.md` (HIGH confidence -- documented from working system)
- Existing 47 skills at `~/.agents/skills/` (HIGH confidence -- verified on filesystem)
- Jonathan's template format at `Reference/Brand reference material/Templates/Social Post Templates/` (HIGH confidence -- files present)

---
*Architecture research for: Fluid Creative OS*
*Researched: 2026-03-10*
