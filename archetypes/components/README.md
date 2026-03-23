# Design Components

## What is a Component?

A **design component** is a mid-level functional block — a meaningful content unit that can appear in multiple archetype layouts. Components sit between atomic elements (a text label) and full archetypes (a complete 1080x1080 layout).

**A component is independently meaningful to a user.** "Add a stat card" makes sense. "Add a text label" does not. The distinction: a component delivers a complete content idea, not just a single presentational element.

## Granularity Rules

Before extracting something as a component, it must pass all three checks:

1. **Cross-archetype reuse** — appears in at least 2 different archetype layouts
2. **Field count** — has 2–4 content fields (a single text field is too atomic; 6+ fields is a full archetype)
3. **Independent meaning** — a user can describe it in a sentence without referencing the surrounding layout

**Examples that qualify:**
- `stat-card/` — a stat value + label + optional context note (3 fields; used in stat-hero, quarterly-report, comparison)
- `testimonial-block/` — a pull quote + attribution name + attribution title (3 fields; used in quote, social-proof, comparison)
- `portrait-caption/` — a portrait photo + name + title (3 fields; used in quote, employee-spotlight, partner-announcement)

**Examples that do NOT qualify:**
- A single headline text field — too atomic (1 field)
- A "category side label" — too atomic (1 field)
- A complete stat-hero layout — too large (becomes a full archetype)

## File Format

Each component lives in its own subdirectory:

```
components/
└── {component-slug}/
    ├── pattern.html    # Isolated markup + CSS (renderable in a browser)
    └── README.md       # Usage documentation
```

### pattern.html

An isolated HTML+CSS file showing the component in a neutral context. Requirements:
- Self-contained — renders in a browser as-is (no external imports)
- Neutral styling — grayscale, `font-family: sans-serif`, no brand colors
- Realistic dimensions — sized to match how it appears in archetypes
- Placeholder content in all fields — never empty

### README.md (per component)

Each component README must cover:

1. **What it is** — one-sentence definition
2. **Content fields** — list of fields with types and labels
3. **SlotSchema snippet** — JSON fields array excerpt showing exactly how to define these fields in an archetype schema.json
4. **When to use** — content types that fit this component
5. **When NOT to use** — cases where a different component or inline structure is better
6. **Archetype appearances** — list of archetypes that compose this component

## Important: Patterns, Not Runtime Includes

Components are HTML/CSS patterns for **reference and composition** — not runtime includes or partial templates. When building an archetype:

- Study the component `pattern.html` for the markup structure
- Copy the relevant SlotSchema field snippet into the archetype `schema.json`
- Incorporate the component's CSS into the archetype's `<style>` block directly

There is no partial/composable schema system. Each archetype defines its full `schema.json` independently. Components are documentation patterns that reduce design inconsistency — they are not runtime dependencies.
