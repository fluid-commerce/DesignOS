# Fluid Creative OS

## What This Is

A proprietary skill system for Fluid's marketing team that lets any AI agent (Claude Code or Cursor) produce brand-correct marketing assets — website sections, social posts, one-pagers, slide decks, and videos — that are close-to-final from the first prompt. The system uses a subagent architecture to avoid context overload, embeds Fluid's brand intelligence at every level, and includes an iteration workflow that continuously improves output quality over time.

## Core Value

An agent using this system produces assets that look and sound like Fluid made them — not "AI-generated marketing content" — from the very first prompt, without the operator needing to be a designer or copywriter.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Brand Intelligence layer with modular, wiki-linked `.md` files organized so subagents grab only what they need
- [ ] Brand Pattern Library — visual HTML documentation of every brand building block (circles, underlines, FLFont patterns, brushstrokes, footer structure) rendered at multiple sizes with technical specs
- [ ] Brand asset repository (brushstrokes, circle sketches, logos, fonts) organized and accessible to all skills
- [ ] Orchestrator skill architecture — one orchestrating skill per asset type that spawns specialized subagents (copy, layout, styling, spec-check, fix)
- [ ] Social post skill — generates Instagram (1080x1080) and LinkedIn (1200x627, 1340x630) posts using brand templates as 5-star references
- [ ] Social post HTML template library with Jonathan's format: live preview + content slot specs + creation instructions
- [ ] Website section skill — generates Gold Standard compliant .liquid sections with proper schema (13 font sizes, 13 colors, 5 weights, complete button/layout/container settings)
- [ ] Gold Standard documentation decomposed into focused .md files for subagent consumption (schema-rules, template-patterns, button-system, validation, theme-tokens)
- [ ] One-pager skill — generates sales collateral HTML one-pagers with Fluid branding
- [ ] Copy subagent with Fluid brand voice (lead with pain, one sentence one idea, name specific scenarios, make it human, FLFont taglines land the takeaway)
- [ ] Layout subagent that understands Fluid's layout archetypes (full-bleed headline, headline + diagram card, giant stat hero, pull quote, two-column, centered manifesto)
- [ ] Styling subagent that implements against design tokens and brand specs
- [ ] Spec-check subagent that validates output against brand rules and returns issues
- [ ] Canvas iteration tool — React app for viewing, annotating, and comparing design variations side-by-side, documenting the full trajectory from first prompt to final output
- [ ] MCP server for canvas tool — so agents can push generated assets to the canvas and receive annotations back
- [ ] Meta-skill: feedback ingestion — takes documented iteration trajectories and updates brand rules/templates/skills accordingly
- [ ] Meta-skill: variation generation — generates multiple variations of an asset for comparison
- [ ] Shell scripts/hooks for deterministic operations (template scaffolding, schema validation, brand compliance checks, asset dimension validation)
- [ ] Distribution structure — git repo organized for installation and updates by other teams
- [ ] Installation/setup documentation clear enough for both agents and humans
- [ ] Works in both Claude Code and Cursor (via sync.sh pattern or equivalent)
- [ ] Existing marketing skills knowledge ingested into Fluid-specific skills (not used as-is)
- [ ] Slide deck integration — leverage existing Fluid Payments deck system (32 Slidev layouts, Three.js, GSAP, design tokens)
- [ ] Video integration — leverage existing Remotion system (recipe-driven, auto-transcription, face detection)

### Out of Scope

- Building the video system from scratch — existing Remotion system is a starting point, integrate don't rebuild
- Building the deck system from scratch — existing Slidev system is a starting point, integrate don't rebuild
- Replacing the existing wecommerce.com site — this system generates assets for it, doesn't replace it
- Mobile app development — this is a CLI/agent skill system, not a mobile product
- Multi-brand support — this is Fluid-specific (though architecture should be clean enough to adapt)
- Perfect brand guidelines on day one — brand direction is iterative, system must adapt

## Context

### Team
- **Chey** — system architecture and skill design lead
- **Felipe, AJ** — design iteration and feedback
- **Lane** — .liquid/theme development, Gold Standard workflow
- **Jonathan** — Figma-to-HTML templates, brand asset curation

### Existing Systems to Build On
- **46 marketing skills** at `~/.agents/skills/` — context cascade pattern, trigger-based activation
- **UI/UX Pro Max** — design intelligence with searchable reference (67 styles, 96 palettes, 57 font pairings)
- **GSD** — subagent orchestration, state management, verification loops
- **Fluid Payments Marketing Deck** — 32 Slidev layouts, Three.js, GSAP, film grain, complete design tokens
- **Remotion video system** — recipe-driven video generation, auto-transcription, face detection, word-level captions
- **Lane Fluid Sandbox** — 111 .liquid sections, Gold Standard workflow, brand assets
- **Jonathan's template library** — HTML templates with live preview + spec format
- **Social post design guide** — documented brand preferences from iteration sessions
- **fluid-website-build-prompt.md** — page-by-page copy and visual direction for new brand

### Reference Materials
All reference materials organized at `Reference/`:
- `Brand reference material/Copy/` — manifesto, features, problem statements
- `Brand reference material/Brand Assets/` — brushstrokes, circle sketches, logos
- `Brand reference material/Design Guides/` — social post design guide
- `Brand reference material/Generated Examples/` — social posts, one-pagers
- `Brand reference material/Templates/` — Jonathan's template library
- `Brand reference material/Website/` — Gold Standard workflow, build prompt, site analysis
- `Skills reference material/` — skill architecture guide
- `Context/` — project vision, brain dump, design decisions

### Research Items
- Claude Skills 2.0 — latest skill capabilities and patterns
- Superpowers skill system — reportedly works well alongside GSD

## Constraints

- **Platform**: Must work in both Claude Code and Cursor IDE
- **Distribution**: Must be installable from a git repo with clear setup instructions
- **Brand**: Design tokens and voice rules must be easily updatable as brand evolves
- **Context window**: No single agent should receive all documentation — subagent architecture with focused context is required
- **Existing work**: Must integrate with (not replace) existing Slidev deck and Remotion video systems

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Subagent architecture over single-agent | Context overload degrades output quality. Fresh context per concern = better results. | — Pending |
| Ingest marketing skills, don't import | Generic skills don't know Fluid. Fluid-specific skills with ingested knowledge perform better. | — Pending |
| Templates as references, not constraints | Agents should consider templates as 5-star examples but adapt, not copy verbatim | — Pending |
| Canvas tool for iteration | Need structured way to compare, annotate, and document the path from first prompt to final output | — Pending |
| Brand direction is iterative | Multiple brand sources exist (site, deck, build prompt). System must adapt as brand solidifies. | — Pending |
| Skills vs hooks split | Deterministic operations (validation, scaffolding) as hooks. Generative work (copy, design) as skills. | — Pending |
| Jonathan's spec format as standard | Live preview + slot specs + creation instructions for ALL templates/examples | — Pending |
| Decompose Gold Standard into focused files | Subagents need small, focused references — not monolithic docs | — Pending |

---
*Last updated: 2026-03-10 after initialization*
