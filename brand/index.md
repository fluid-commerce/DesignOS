# Fluid Creative OS — Brand Intelligence Index

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

## What This Is

This repo contains Fluid / We-Commerce's brand intelligence, decomposed into modular docs that subagents load selectively. No agent should ever load all docs at once — pick the 2-4 files relevant to your role.

## Agent Loading Notes

These docs are designed for the Skills 2.0 `skills` field. Each file is a self-contained context package under 6KB that a subagent can preload as skill content:

- **Copy agent** loads [voice-rules.md](voice-rules.md) for copy principles, pain-first messaging, FLFont tagline rules, and Authenticity Advantage thesis. Also references [elevator-pitches.md](elevator-pitches.md) for approved pitch language.
- **Styling agent** loads [design-tokens.md](design-tokens.md) for hex values, font stacks, spacing, and opacity rules
- **Layout agent** loads [layout-archetypes.md](layout-archetypes.md) for 6 layout types with dimensional specs and element placement
- **Any agent working with assets** loads [asset-usage.md](asset-usage.md) for brushstroke blend modes, circle sketch rules, and footer structure
- **Social post agent** loads [social-post-specs.md](social-post-specs.md) for dimensions, typography scale, and accent color system
- **Website section agent** loads [website-section-specs.md](website-section-specs.md) for Gold Standard schema rules and button system
- **Strategy agent** loads [messaging-frameworks.md](messaging-frameworks.md) for 8 strategic frameworks and recommended campaign direction
- **Sales enablement agent** loads [audience-personas.md](audience-personas.md) + [objection-handling.md](objection-handling.md) for persona messaging and switching-fear strategies
- **Campaign agent** loads [messaging-frameworks.md](messaging-frameworks.md) + [elevator-pitches.md](elevator-pitches.md) for framework selection and pitch language

Brand docs ARE the spec — subagents cannot generate without loading them first (Superpowers pattern).

## Brand Doc Inventory

| File | Target Role | What's Inside | ~Size |
|------|------------|---------------|-------|
| [voice-rules.md](voice-rules.md) | Copy agent | Voice principles, messaging patterns, FLFont tagline rules | ~3KB |
| [design-tokens.md](design-tokens.md) | Styling agent | Colors (social + website), fonts, spacing, opacity, radius | ~4KB |
| [layout-archetypes.md](layout-archetypes.md) | Layout agent | 6 layout types with specs, placement rules, when to use | ~3KB |
| [asset-usage.md](asset-usage.md) | Any visual agent | Brushstroke, circle, logo, font usage rules with weights | ~3KB |
| [social-post-specs.md](social-post-specs.md) | Social post agent | Dimensions, typography scale, footer, accent colors, background | ~4KB |
| [website-section-specs.md](website-section-specs.md) | Website agent | Gold Standard schema, button system, section/container settings | ~3KB |
| [messaging-frameworks.md](messaging-frameworks.md) | Strategy agent | 8 strategic frameworks, recommended direction (Authenticity Advantage), deployment strategy | ~5KB |
| [audience-personas.md](audience-personas.md) | Sales enablement agent | CEO, CTO, VP Sales, COO persona messaging maps with lead-with points | ~4KB |
| [objection-handling.md](objection-handling.md) | Sales enablement agent | "Switching is scary" playbook (4 strategies) + FOMO messaging (4 types) | ~4KB |
| [elevator-pitches.md](elevator-pitches.md) | Campaign agent | Pitches by length (5s, 15s, 30s), "What Fluid IS in one breath" distillation | ~4KB |
| [asset-index.md](asset-index.md) | Asset lookup | All 15 assets with paths, usage summary, original filenames | ~2KB |

## Weight System

Every brand rule carries a numeric weight (1-100) with named thresholds:

| Range | Label | CLI Severity | Meaning |
|-------|-------|-------------|---------|
| 1-20 | Optional | hint | Nice to have, skip freely |
| 21-50 | Flexible | info | Follow when practical |
| 51-80 | Strong preference | warning | Deviate only with reason |
| 81-100 | Brand-critical | error | Must follow — defines the brand |

Weights are tunable over time through the feedback/ directory and Phase 5 learning loop.

## Related Docs

- See [asset-index.md](asset-index.md) for the complete asset inventory with file paths
- See [voice-rules.md](voice-rules.md) for the brand voice foundation all copy derives from
- See [design-tokens.md](design-tokens.md) for the visual foundation all styling derives from
