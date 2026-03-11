# Requirements: Fluid Creative OS

**Defined:** 2026-03-10
**Core Value:** An agent using this system produces assets that look and sound like Fluid made them from the very first prompt

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Brand Intelligence

- [x] **BRAND-01**: Brand intelligence layer with modular .md files organized so subagents grab only what they need (3-6 docs max per subagent)
- [x] **BRAND-02**: Design tokens documented (7 colors with hex, 4 font families with weights, spacing system, border radius values, opacity patterns)
- [x] **BRAND-03**: Copy voice rules documented (lead with pain, one sentence one idea, name specific scenarios, make it human, FLFont taglines land the takeaway)
- [x] **BRAND-04**: Layout archetypes documented (full-bleed headline, headline + diagram card, giant stat hero, pull quote, two-column, centered manifesto)
- [x] **BRAND-05**: Brand asset repository organized and indexed (7 brushstrokes, 2 circle sketches, logos, fonts) with usage rules per asset
- [x] **BRAND-06**: Brand Pattern Library — HTML page rendering every building block at multiple sizes with technical specs (circles, underlines, FLFont patterns, brushstrokes, footer structure)
- [x] **BRAND-07**: All brand docs wiki-linked so agents can navigate from any entry point to related context
- [x] **BRAND-08**: Template elements annotated as FIXED/FLEXIBLE/OPTIONAL to prevent rigid copying or off-brand drift

### Orchestrator Architecture

- [x] **ORCH-01**: Orchestrator skill pattern established — one slash command per asset type, spawns specialized subagents with fresh context
- [x] **ORCH-02**: Copy subagent loads only voice rules and messaging docs, produces copy in Fluid brand voice
- [x] **ORCH-03**: Layout subagent loads only layout archetypes and dimensions, produces structural arrangement
- [x] **ORCH-04**: Styling subagent loads only design tokens and asset-specific specs, implements against tokens (no aesthetic guessing)
- [x] **ORCH-05**: Spec-check subagent validates output against brand rules, returns structured list of issues with severity
- [x] **ORCH-06**: Fix subagent receives spec-check issues and corrects them, re-validates until passing
- [x] **ORCH-07**: Subagent contracts defined — what goes in (context files), what comes out (structured output), max iterations before escalating

### Social Posts

- [x] **SOCL-01**: Social post skill generates Instagram posts (1080x1080px) as self-contained HTML/CSS
- [x] **SOCL-02**: Social post skill generates LinkedIn posts (1200x627px and 1340x630px) as self-contained HTML/CSS
- [x] **SOCL-03**: Social posts use one accent color per post (orange for pain, blue for trust, green for success, purple for premium)
- [x] **SOCL-04**: Social posts include consistent footer structure (flag icon + We-Commerce wordmark left, Fluid dots right)
- [x] **SOCL-05**: Social posts use brushstroke textures from brand assets with proper blend mode (screen), opacity (0.10-0.25), and edge-bleed rules
- [x] **SOCL-06**: Social posts use circle sketch for word emphasis only (not decorative), hue-shifted to match accent color
- [x] **SOCL-07**: Social posts reference template library as 5-star examples but adapt, not copy verbatim

### Website Sections

- [x] **SITE-01**: Website section skill generates valid .liquid files with proper schema structure
- [x] **SITE-02**: Gold Standard documentation decomposed into focused .md files (schema-rules, template-patterns, button-system, validation, theme-tokens)
- [x] **SITE-03**: Every text element in schema has 6 settings (family, size mobile, size desktop, weight, color, content)
- [x] **SITE-04**: Every button has 7 settings (show, text, url, style, color, size, weight) using btn utility class system
- [x] **SITE-05**: Section and container settings complete (background, padding, border radius)
- [x] **SITE-06**: No hard-coded colors, spacing, or border radius — all use CSS variables/utility classes
- [x] **SITE-07**: Generated sections pass Gold Standard validation checklist

### One-Pagers

- [x] **PAGE-01**: One-pager skill generates sales collateral as self-contained HTML/CSS
- [x] **PAGE-02**: One-pagers use Fluid brand elements (brushstrokes, side labels, FLFont taglines, comparison tables, stat strips)
- [x] **PAGE-03**: One-pagers are print-ready (letter size, proper margins, @page rules)

### Template Library

- [x] **TMPL-01**: Template library in Jonathan's format — live HTML preview + content slot specs + creation instructions
- [x] **TMPL-02**: Social post templates covering core archetypes (testimonial/quote, app highlight, partner alert, and 3+ more)
- [x] **TMPL-03**: One-pager templates with content slot specs
- [x] **TMPL-04**: Templates include per-element annotations (FIXED/FLEXIBLE/OPTIONAL)

### Canvas & Iteration

- [x] **CANV-01**: Bare MVP canvas tool — React app that displays multiple HTML asset variations side-by-side on one page
- [x] **CANV-02**: Canvas supports text annotations/comments on each variation
- [x] **CANV-03**: Canvas documents iteration trajectory (initial → variations → selected winner → further iterations → final)
- [x] **CANV-04**: MCP server so agents can push generated assets to canvas and receive annotations back
- [x] **CANV-05**: Variation generation — skill that produces multiple variations of an asset for comparison in canvas

### Meta / System Development

- [ ] **META-01**: Feedback ingestion meta-skill — reads documented trajectories and updates brand rules/templates/skills
- [ ] **META-02**: Feedback categorization — asset-specific feedback vs. systemic brand changes (systemic requires human approval)
- [x] **META-03**: Research and incorporate Claude Skills 2.0 patterns (context: fork, allowed-tools, hooks, agent field)
- [x] **META-04**: Research Superpowers skill system and incorporate applicable patterns

### CLI Tools & Hooks

- [x] **CLI-01**: Schema validation hook — checks .liquid schema for required option counts (13 font sizes, 13 colors, 5 weights)
- [x] **CLI-02**: Brand compliance check — validates hex colors, font references, and spacing values against brand tokens
- [x] **CLI-03**: Asset dimension validation — checks generated HTML matches target dimensions
- [x] **CLI-04**: Template scaffolding — generates starter files from Gold Standard template

### Distribution

- [x] **DIST-01**: Git repo organized with clear directory structure for skills, docs, assets, tools
- [x] **DIST-02**: Installation script or clear setup instructions for both Claude Code and Cursor
- [x] **DIST-03**: Works via sync.sh pattern or equivalent for both platforms

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Integrations

- **INTG-01**: Slide deck skill wrapping existing Slidev system
- **INTG-02**: Video skill wrapping existing Remotion system
- **INTG-03**: Screen capture video tools with smart zoom/pan

### Advanced Iteration

- **ITER-01**: Full canvas tool with drag/reorder, version branching, export
- **ITER-02**: Automated trajectory analysis (patterns in what gets approved vs rejected)
- **ITER-03**: A/B testing integration for published assets

### Advanced Distribution

- **DIST-04**: Auto-update mechanism (version check + pull)
- **DIST-05**: Per-project configuration overrides

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-brand support | Premature abstraction — optimize for Fluid first |
| GUI skill builder | Skills are prompt engineering; agents can create skills |
| Real-time collaborative editing | Over-engineering for a 5-person team |
| AI image generation (DALL-E, Midjourney) | Brand uses real brushstrokes/photos, not AI imagery |
| Approval workflow / role-based access | Too much process overhead at current team size |
| Automated platform publishing | Generation is the value; manual upload to Instagram/LinkedIn is fine |
| Template WYSIWYG editor | Templates are code; agents edit code directly |
| Importing existing marketing skills as-is | Ingest knowledge, don't import generics |
| Perfect brand guidelines before building | Brand is iterative; system must adapt |
| Rebuilding Slidev deck system | Wrap existing system, don't rebuild |
| Rebuilding Remotion video system | Wrap existing system, don't rebuild |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 1 | Complete (01-01) |
| BRAND-02 | Phase 1 | Complete (01-01) |
| BRAND-03 | Phase 1 | Complete (01-01) |
| BRAND-04 | Phase 1 | Complete (01-01) |
| BRAND-05 | Phase 1 | Complete (01-01) |
| BRAND-06 | Phase 1 | Complete |
| BRAND-07 | Phase 1 | Complete (01-01) |
| BRAND-08 | Phase 1 | Complete (01-01) |
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 1 | Complete |
| CLI-04 | Phase 1 | Complete |
| DIST-01 | Phase 1 | Complete |
| DIST-02 | Phase 1 | Complete |
| DIST-03 | Phase 1 | Complete |
| META-03 | Phase 1 | Complete (01-01) |
| META-04 | Phase 1 | Complete (01-01) |
| ORCH-01 | Phase 2 | Complete |
| ORCH-02 | Phase 2 | Complete |
| ORCH-03 | Phase 2 | Complete |
| ORCH-04 | Phase 2 | Complete |
| ORCH-05 | Phase 2 | Complete |
| ORCH-06 | Phase 2 | Complete |
| ORCH-07 | Phase 2 | Complete |
| SOCL-01 | Phase 2 | Complete |
| SOCL-02 | Phase 2 | Complete |
| SOCL-03 | Phase 2 | Complete |
| SOCL-04 | Phase 2 | Complete |
| SOCL-05 | Phase 2 | Complete |
| SOCL-06 | Phase 2 | Complete |
| SOCL-07 | Phase 2 | Complete |
| TMPL-01 | Phase 2 | Complete |
| TMPL-02 | Phase 2 | Complete |
| SITE-01 | Phase 3 | Complete |
| SITE-02 | Phase 3 | Complete |
| SITE-03 | Phase 3 | Complete |
| SITE-04 | Phase 3 | Complete |
| SITE-05 | Phase 3 | Complete |
| SITE-06 | Phase 3 | Complete |
| SITE-07 | Phase 3 | Complete |
| PAGE-01 | Phase 3 | Complete |
| PAGE-02 | Phase 3 | Complete |
| PAGE-03 | Phase 3 | Complete |
| TMPL-03 | Phase 3 | Complete |
| TMPL-04 | Phase 3 | Complete |
| CANV-01 | Phase 4 | Complete |
| CANV-02 | Phase 4 | Complete |
| CANV-03 | Phase 4 | Complete |
| CANV-04 | Phase 4 | Complete |
| CANV-05 | Phase 4 | Complete |
| META-01 | Phase 5 | Pending |
| META-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after 01-01 completion*
