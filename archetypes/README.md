# Archetype System

## What are Archetypes?

Archetypes are brandless structural patterns for social media content. They are built into the system as filesystem artifacts — not stored in the database. Each archetype is a content layout skeleton: placeholder text, neutral styling, and a SlotSchema sidecar that maps content fields to CSS selectors.

An archetype captures the **layout intent** of a post type (stat-heavy, testimonial, problem-first, etc.) without any brand expression. The brand layer is applied at generation time.

## Archetypes vs Templates

| | Templates | Archetypes |
|---|---|---|
| **Storage** | Database (SQLite) | Filesystem (`archetypes/`) |
| **Brand** | Fully styled, brand-specific | Brandless, neutral placeholder |
| **Curation** | Hand-curated by users | System-level, researcher-curated |
| **Scope** | Exact layout + exact brand expression | Structural skeleton only |
| **Selection** | Pipeline: exact match on templateId | Pipeline: best structural fit |
| **Output** | Renderable HTML + SlotSchema | Renderable HTML + SlotSchema (identical shape) |

**Both produce the same output format.** The pipeline can select a template (exact match — preserves the hand-crafted design) or an archetype (adapt + apply brand). Either way, the result is a renderable HTML file + SlotSchema for the editor sidebar. This parity is the system contract.

The pipeline routing decision (template vs archetype) is made in `canvas/src/server/api-pipeline.ts`.

## Directory Layout

```
archetypes/
├── components/                     # Reusable functional block patterns
│   ├── {component-slug}/
│   │   ├── pattern.html            # Isolated component markup + CSS
│   │   └── README.md               # Usage guidance
│   └── README.md                   # Component conventions (this system)
├── {archetype-slug}/               # One folder per archetype
│   ├── index.html                  # Brandless structural skeleton (renderable)
│   ├── schema.json                 # SlotSchema definition
│   └── README.md                   # Purpose, when to use, composition
├── SPEC.md                         # Format specification (authoritative)
└── README.md                       # This file
```

Each archetype slug maps to a content layout pattern, e.g.:
- `stat-hero-single/` — large stat value + headline + body copy
- `testimonial-portrait/` — portrait photo + quote + attribution
- `problem-first/` — bold problem statement + solution setup
- `manifesto-statement/` — values/belief declaration

## Content/Decorative Split

Archetypes define **content layout only**. The two categories are strictly separated:

**Content (archetype-defined):**
- Text blocks: headlines, body copy, stat values, labels, attribution
- Image blocks: portrait photos, product mockups, screenshots
- Layout structure: positioning, sizing, z-ordering of content zones

**Decorative (brand-defined, injected at generation):**
- Brushstrokes and texture overlays
- Circle sketches and scribble elements
- Background gradients and color fills
- Brand watermarks and logo placements

At generation time, the pipeline injects brand decorative elements into the `.decorative-zone` div and merges brand `brush`/`brushAdditional` fields into the final SlotSchema. The archetype `schema.json` always sets `brush: null` — the brand layer provides all decorative transform targets.

## Schema Contract

The authoritative TypeScript interface is at `canvas/src/lib/slot-schema.ts`.

Key contract requirements for archetypes:
- Use `archetypeId` (not `templateId`) — `templateId` keys into `TEMPLATE_SCHEMAS` in `template-configs.ts` and would cause incorrect resolution in `resolveSlotSchemaForIteration()`
- `brush` must be `null` — decorative brush selectors are brand-defined
- `collectTransformTargets(schema)` must produce a valid `TransformTarget[]` — no broken selectors

See `archetypes/SPEC.md` for the complete format specification.
