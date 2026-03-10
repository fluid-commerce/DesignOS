# Feature Research

**Domain:** AI-powered branded marketing asset generation skill system (Claude Code / Cursor)
**Researched:** 2026-03-10
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (System Doesn't Work Without These)

Features that are structurally required. If any of these are missing, the system fails to deliver its core value: "brand-correct assets from the first prompt."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Brand intelligence layer** (modular .md files) | Without brand knowledge embedded in agent context, every output is generic. This IS the system. | MEDIUM | Wiki-linked .md files organized so subagents grab only what they need. Design tokens, voice rules, layout archetypes, typography specs. Must be decomposed small enough for focused context windows. |
| **Orchestrator skill per asset type** | Single-agent approach causes context overload and inconsistent results (validated by team experience). Subagent architecture with fresh context per concern is required. | HIGH | One slash command per asset type (e.g., `/fluid:social-post`, `/fluid:website-section`). Each spawns copy, layout, styling, spec-check subagents. Uses Claude Code `context: fork` for isolation. |
| **Copy subagent with brand voice** | Copy is the first thing people notice as "off brand." Generic AI copy is the #1 complaint with AI-generated marketing. | MEDIUM | Loads brand voice docs only: lead with pain, one sentence one idea, name specific scenarios, make it human, FLFont taglines. Must understand Fluid's messaging hierarchy (Connect, Payments, Analytics pillars). |
| **Styling subagent with design tokens** | Without strict token enforcement, colors drift, fonts get substituted, spacing becomes inconsistent. | MEDIUM | Loads color palette (7 colors), typography system (NeueHaasDisplay + FLFont), spacing/layout rules. Implements against tokens, not aesthetic judgment. |
| **Spec-check / validation subagent** | Brand compliance must be verified, not assumed. This is the quality gate that makes "close-to-final from first prompt" possible. | MEDIUM | Validates against brand rules, returns structured issues. Runs after initial generation, before presenting to user. Can trigger fix agents for auto-correction. |
| **Brand asset repository** | Brushstrokes, circle sketches, logos, fonts must be accessible to all skills. Without these, agents can't produce branded visuals. | LOW | Organized directory of SVGs, PNGs, font files. Already partially exists (7 brushstrokes, 2 circle sketches, 3 logos, 1 frame mark). Needs indexing and access docs. |
| **Template library as 5-star references** | Without reference examples, agents hallucinate layouts and visual treatments. Templates ground the output in proven patterns. | MEDIUM | Jonathan's spec format: live preview + content slot specs + creation instructions. Not constraints (agents can adapt) but anchors. Social posts, website sections, one-pagers each need their own template sets. |
| **Social post skill** (Instagram 1080x1080, LinkedIn 1200x627/1340x630) | Social content is the highest-volume, highest-frequency asset type. This is where the system proves itself daily. | HIGH | HTML/CSS output. Must handle dimension variants. References template library and design guide. Already has 28+ iteration examples to learn from. |
| **Website section skill** (.liquid, Gold Standard compliant) | Lane's workflow depends on this. Gold Standard schema is complex (13 font sizes, 13 colors, 5 weights, complete button/layout/container settings). | HIGH | Must output valid .liquid with proper schema. Gold Standard docs need decomposition into focused files (schema-rules, template-patterns, button-system, validation, theme-tokens). |
| **Shell scripts/hooks for deterministic operations** | Validation, scaffolding, and compliance checking are deterministic -- Claude is unreliable at these. CLI tools handle them correctly every time. | MEDIUM | Template scaffolding, schema validation, brand compliance checks, asset dimension validation. Following GSD pattern of CLI tools for deterministic work. |
| **Cross-platform compatibility** (Claude Code + Cursor) | Team uses both. A system that only works in one is a non-starter. | LOW | sync.sh pattern already established. Skills with frontmatter invoke types work in both. .mdc rules for Cursor, CLAUDE.md injection for Claude Code. |
| **Installation and setup** | If another team member can't install it, the system dies with its creator. | LOW | Git repo with clear README. `install.sh` or equivalent. Document both human and agent setup paths. |

### Differentiators (Competitive Advantage / Quality Leap)

Features that transform this from "a collection of marketing skills" into "a system that gets better over time." These are what make it proprietary and valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Canvas iteration tool** (React app + MCP server) | Structured iteration with documented trajectories is how the system learns. Without it, feedback evaporates between sessions. No existing tool does this for agent-generated marketing assets. | HIGH | View asset, annotate, generate variations side-by-side, document progression from first prompt to final. MCP server lets agents push assets to canvas and receive annotations back. Chey says "pretty simple overall -- for internal use." |
| **Feedback ingestion meta-skill** | The learning loop. Takes documented iteration trajectories and updates brand rules/templates/skills. This is what makes the system get better over time instead of staying static. | HIGH | Reads canvas trajectories (what was tried, what was chosen, why). Updates brand intelligence files, adjusts templates, refines voice rules. This is the "continuous training" Chey described. |
| **Variation generation meta-skill** | Designers need options, not single outputs. Generating 3-5 variations for comparison is how real creative processes work. | MEDIUM | Spawns multiple generation runs with controlled parameter variation (different layouts, different copy angles, different color emphasis). Presents all for comparison. |
| **Brand Pattern Library** (visual HTML documentation) | Agents need to see (and reference) exactly how brand building blocks look at different sizes. Text descriptions of visual patterns are insufficient. | MEDIUM | Single HTML page showing every brand pattern rendered at multiple sizes with explanations. Circles, underlines, FLFont patterns, brushstrokes, footer structure. Jonathan's spec format (live preview + specs + instructions) applied to every building block. |
| **Layout subagent with archetype knowledge** | Fluid has specific layout patterns (full-bleed headline, headline + diagram card, giant stat hero, pull quote, two-column, centered manifesto). A layout agent that knows these produces structurally correct assets. | MEDIUM | Loads layout archetypes only. Makes spatial arrangement decisions. Separates layout from styling -- different concerns, different expertise. |
| **One-pager skill** (sales collateral) | Fills a gap between social posts and website sections. Sales team needs branded collateral that isn't a full web page. | MEDIUM | HTML/CSS output. Existing Live Editor one-pager as strong reference. Combines copy, layout, and brand assets into print-ready HTML. |
| **Decomposed Gold Standard documentation** | Gold Standard as a monolith overwhelms context windows. Decomposed into focused files, subagents can grab exactly what they need. This pattern applies to all large reference docs. | LOW | schema-rules.md, template-patterns.md, button-system.md, validation.md, theme-tokens.md. Each small enough for a single subagent's context. |
| **Model profile system** (cost-optimized agent assignment) | Not every subagent needs the most expensive model. Copy and layout decisions need strong reasoning; validation can use lighter models. Saves money without sacrificing quality. | LOW | Following GSD pattern: Opus for planning/copy, Sonnet for execution/styling, Haiku for validation/extraction. Configurable per skill. |
| **Dynamic context injection** (`!`command`` syntax) | Skills that pull in live data (current brand assets list, latest template versions, git status) before Claude sees the prompt produce more accurate output. | LOW | Shell commands in skill frontmatter run before prompt delivery. Used for injecting current asset inventories, template lists, or recent design decisions. |

### Anti-Features (Deliberately NOT Building)

Features that seem valuable but create problems. These are explicit boundaries.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-brand support** | "Make it reusable for other brands" | Premature abstraction. Optimizing for Fluid's specific needs is the priority. Generic brand systems produce generic output. | Design clean architecture (modular brand intelligence) so it COULD adapt later, but don't build the abstraction layer now. |
| **GUI skill builder / no-code configuration** | "Make it easy for non-technical team members to create skills" | Skills are prompt engineering. A GUI adds complexity without adding quality. The team has agents that can create skills for them. | Document skill creation patterns well. Use meta-skills to help agents create new skills. |
| **Real-time collaborative editing** | "Multiple people editing the same asset simultaneously" | Massive complexity for internal use by 5 people. Google Docs already exists for text collaboration. | Canvas tool handles sequential iteration. Share generated HTML files for feedback. |
| **AI image generation integration** (Gemini, DALL-E, Midjourney) | "Generate images for social posts and one-pagers" | Image generation APIs produce generic visuals that don't match Fluid's brand. The brand uses specific brushstrokes, circle sketches, and photography -- not AI-generated imagery. | Use the existing brand asset repository (real brushstrokes, real circle sketches). For photography, use actual photos. AI-generated imagery is an anti-pattern for brand consistency. |
| **Approval workflow / role-based access** | "Marketing manager approves before publish" | Over-engineering for a 5-person team. Adds process overhead without matching team reality. | Canvas iteration documents trajectory. Slack/verbal approval is fine at this scale. |
| **Automated publishing / distribution to platforms** | "Post directly to Instagram/LinkedIn from the system" | Coupling to platform APIs adds maintenance burden and fragility. Platforms change APIs frequently. The value is in generation, not distribution. | Generate assets. Manual upload to platforms (or use existing scheduling tools like Buffer/Later). |
| **Template WYSIWYG editor** | "Drag-and-drop template builder" | Templates are HTML/CSS. A WYSIWYG editor adds a translation layer that produces worse code than an agent writing directly. | Templates are code. Agents edit code. Jonathan's format (preview + specs + instructions) is the builder. |
| **Importing existing 46 marketing skills as-is** | "We already have these skills, just use them" | Generic skills don't know Fluid. They produce generic output. The whole point is Fluid-specific intelligence. | Ingest knowledge FROM those skills INTO Fluid-specific skills. Extract patterns and frameworks, embed with Fluid brand context. |
| **Perfect brand guidelines before building** | "Let's nail down the brand first, then build the system" | Brand direction is iterative. Multiple sources exist (site, deck, build prompt). Waiting for perfection means never shipping. | Build the system so brand intelligence is easily updatable. Ship with current knowledge, refine through iteration. The canvas + feedback loop IS the brand refinement process. |

## Feature Dependencies

```
Brand Intelligence Layer (.md files)
    |
    +--requires--> Brand Asset Repository (fonts, brushstrokes, logos)
    |
    +--enables---> Copy Subagent (loads voice rules)
    |              Layout Subagent (loads archetypes)
    |              Styling Subagent (loads design tokens)
    |              Spec-Check Subagent (loads brand rules)
    |
    +--enables---> Template Library (references brand patterns)
                       |
                       +--enables--> Social Post Skill (uses templates as references)
                       |             Website Section Skill (uses templates + Gold Standard)
                       |             One-Pager Skill (uses templates)
                       |
                       +--enables--> Variation Generation (creates template variants)

Orchestrator Architecture (command routing + subagent spawning)
    |
    +--requires--> Brand Intelligence Layer (subagents need content to load)
    +--requires--> Shell Scripts/Hooks (validation, scaffolding)
    +--enables---> All Asset Skills (social, website, one-pager)

Canvas Iteration Tool
    +--requires--> At least one working Asset Skill (needs assets to display)
    +--enables---> Feedback Ingestion Meta-Skill (needs trajectories to learn from)

Feedback Ingestion Meta-Skill
    +--requires--> Canvas Iteration Tool (source of trajectories)
    +--requires--> Brand Intelligence Layer (target of updates)
    +--enables---> System improvement loop (continuous learning)

Shell Scripts / CLI Tools
    +--independent-- (can be built early, used by everything)
    +--enables--> Schema Validation
    +--enables--> Brand Compliance Checks
    +--enables--> Template Scaffolding
    +--enables--> Asset Dimension Validation

Brand Pattern Library (visual HTML docs)
    +--requires--> Brand Asset Repository (renders actual assets)
    +--requires--> Brand Intelligence Layer (documents the rules)
    +--enhances--> All Subagents (visual reference for what patterns look like)

Gold Standard Decomposition
    +--requires--> Existing Gold Standard docs (source material)
    +--enables--> Website Section Skill (focused context for subagents)

Cross-Platform (Claude Code + Cursor)
    +--requires--> sync.sh or equivalent distribution mechanism
    +--enables--> All skills (accessible in both environments)

Slide Deck Integration
    +--requires--> Existing Slidev system (don't rebuild)
    +--requires--> Brand Intelligence Layer
    +--deferred--> Phase 2+ (existing system works, integrate later)

Video Integration
    +--requires--> Existing Remotion system (don't rebuild)
    +--requires--> Brand Intelligence Layer
    +--deferred--> Phase 2+ (existing system works, integrate later)
```

### Dependency Notes

- **Brand Intelligence Layer is the foundation.** Every other feature depends on it. Build first.
- **Orchestrator architecture is the second foundation.** Without subagent routing, no asset skill can work properly.
- **Shell scripts/CLI tools are independent.** Can be built in parallel with brand intelligence.
- **Canvas + Feedback Ingestion form a closed loop.** Canvas requires at least one working asset skill; feedback ingestion requires canvas. Build canvas after first asset skill ships.
- **Slide deck and video integration are deferred.** Existing systems work. Integration is Phase 2+ work.
- **Template Library and Brand Pattern Library enhance quality** but aren't blockers for initial generation. Build the first asset skill with inline references, then formalize into library.

## MVP Definition

### Launch With (v1)

The minimum viable system that proves the core value: "brand-correct assets from first prompt."

- [ ] **Brand Intelligence Layer** -- modular .md files for design tokens, voice rules, layout archetypes, typography (decomposed, wiki-linked)
- [ ] **Brand Asset Repository** -- organized, indexed, accessible (brushstrokes, circles, logos, fonts)
- [ ] **Orchestrator architecture** -- command routing + subagent spawning pattern established for one asset type
- [ ] **Social Post Skill** -- the first complete orchestrated skill (copy + layout + styling + spec-check subagents)
- [ ] **Template Library (social posts)** -- Jonathan's templates formalized in spec format as 5-star references
- [ ] **Shell scripts for validation** -- dimension checking, basic brand compliance (color values, font names)
- [ ] **Cross-platform distribution** -- works in Claude Code and Cursor via sync.sh

**Why social posts first:** Highest frequency asset (daily), fastest iteration cycle (minutes not hours), 28+ existing examples to learn from, clear success criteria (looks branded, correct dimensions, strong copy).

### Add After Validation (v1.x)

Features to add once the social post skill proves the architecture works.

- [ ] **Website Section Skill** -- Gold Standard .liquid sections (trigger: Lane needs it for site build)
- [ ] **Gold Standard Decomposition** -- focused .md files for schema-rules, template-patterns, etc. (trigger: website section skill needs it)
- [ ] **Canvas Iteration Tool** -- React app for viewing, annotating, comparing variations (trigger: team is iterating on assets and needs structured feedback capture)
- [ ] **Variation Generation** -- spawn multiple generation runs for comparison (trigger: canvas is working, designers want options)
- [ ] **One-Pager Skill** -- sales collateral generation (trigger: sales team requests branded one-pagers)
- [ ] **Brand Pattern Library** -- visual HTML documentation of all brand building blocks (trigger: subagents need visual references, not just text descriptions)
- [ ] **Model profile system** -- cost-optimized agent assignment (trigger: token costs become a concern)

### Future Consideration (v2+)

Features to defer until the core system is proven and the team is using it daily.

- [ ] **Feedback Ingestion Meta-Skill** -- learn from canvas trajectories (defer: needs enough trajectory data to be meaningful)
- [ ] **Slide Deck Integration** -- connect to existing Slidev system (defer: system works independently, integration is additive)
- [ ] **Video Integration** -- connect to existing Remotion system (defer: system works independently, integration is additive)
- [ ] **MCP server for canvas** -- bidirectional agent-canvas communication (defer: requires canvas to be stable first)
- [ ] **Meta-skill for skill authoring** -- agents that improve the skill system itself (defer: system needs to be stable before meta-improvement)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Brand Intelligence Layer | HIGH | MEDIUM | P1 |
| Brand Asset Repository | HIGH | LOW | P1 |
| Orchestrator Architecture | HIGH | HIGH | P1 |
| Social Post Skill | HIGH | HIGH | P1 |
| Template Library (social) | HIGH | MEDIUM | P1 |
| Shell Scripts / Validation | MEDIUM | MEDIUM | P1 |
| Cross-Platform Distribution | HIGH | LOW | P1 |
| Website Section Skill | HIGH | HIGH | P2 |
| Gold Standard Decomposition | MEDIUM | LOW | P2 |
| Canvas Iteration Tool | HIGH | HIGH | P2 |
| Variation Generation | MEDIUM | MEDIUM | P2 |
| One-Pager Skill | MEDIUM | MEDIUM | P2 |
| Brand Pattern Library | MEDIUM | MEDIUM | P2 |
| Model Profile System | LOW | LOW | P2 |
| Feedback Ingestion | HIGH | HIGH | P3 |
| Slide Deck Integration | LOW | MEDIUM | P3 |
| Video Integration | LOW | MEDIUM | P3 |
| Canvas MCP Server | MEDIUM | HIGH | P3 |
| Meta-Skill Authoring | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the system doesn't prove its value without these
- P2: Should have, add as the architecture stabilizes and team adoption grows
- P3: Nice to have, future consideration after daily use is established

## Competitor / Reference Analysis

| Feature | ai-marketing-claude (Zubair) | marketingskills (Haines) | Superpowers (obra) | Fluid Creative OS (ours) |
|---------|------------------------------|--------------------------|---------------------|--------------------------|
| Brand intelligence | Basic brand voice extraction from website analysis | None -- generic marketing frameworks | None -- software development only | Deep, modular, Fluid-specific brand knowledge embedded at every level |
| Subagent orchestration | 5 parallel agents for audit scoring | None -- single-skill invocation | Subagent-driven development with code review | Per-asset-type orchestrator spawning specialized subagents (copy, layout, styling, spec-check) |
| Asset generation | No -- analyzes and reports, doesn't generate assets | No -- provides frameworks and guidelines | No -- software development only | Yes -- generates HTML/CSS social posts, .liquid sections, HTML one-pagers |
| Iteration workflow | None | None | Brainstorming + plan revision cycle | Canvas tool with trajectory documentation + feedback ingestion loop |
| Template system | None | Reference frameworks in skill files | Plan templates for task decomposition | 5-star reference templates in Jonathan's spec format (preview + slots + instructions) |
| Validation / compliance | Scoring rubric (0-100) for website analysis | None | TDD + verification-before-completion | Shell scripts for deterministic brand compliance, schema validation, dimension checking |
| Learning loop | None | None | None | Feedback ingestion meta-skill updates brand rules from iteration trajectories |
| Distribution | install.sh + Git repo | Install script | CLAUDE.md installation | sync.sh pattern (Claude Code + Cursor), Git repo |

**Key differentiators for Fluid Creative OS:**
1. **Actually generates assets** -- competitors analyze and advise; we produce branded HTML/CSS/Liquid
2. **Deep brand embedding** -- not generic marketing intelligence; Fluid-specific at every layer
3. **Structured learning loop** -- canvas + feedback ingestion means the system improves over time
4. **Subagent separation of concerns** -- copy, layout, styling, validation as independent agents with focused context

## Sources

- Claude Code Skills documentation: https://code.claude.com/docs/en/skills (HIGH confidence -- official docs)
- Claude Code Skills 2.0 features: https://medium.com/@richardhightower/claude-code-agent-skills-2-0-from-custom-instructions-to-programmable-agents-ab6e4563c176 (MEDIUM confidence)
- Superpowers framework: https://github.com/obra/superpowers (HIGH confidence -- primary source)
- ai-marketing-claude: https://github.com/zubair-trabzada/ai-marketing-claude (HIGH confidence -- primary source)
- marketingskills: https://github.com/coreyhaines31/marketingskills (MEDIUM confidence)
- GSD skill architecture: analyzed from building-systematized-claude-skills.md reference document (HIGH confidence -- first-party)
- AI brand management platforms: https://www.frontify.com/en/guide/ai-tools-for-brand-management (MEDIUM confidence -- industry overview)
- AI brand compliance: https://www.puntt.ai/blog/brand-compliance-best-practices-2026 (MEDIUM confidence)
- Existing Fluid reference materials: 28+ social post iterations, Jonathan's template library, social post design guide (HIGH confidence -- first-party)

---
*Feature research for: Fluid Creative OS -- AI-powered branded marketing asset generation skill system*
*Researched: 2026-03-10*
