# body-text

## What it is

A body copy block for 1-3 sentences of supporting explanation — the supporting text that follows headlines, stats, or quotes.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Body copy | text | `.body-copy` | Body Copy |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".body-copy", "label": "Body Copy", "mode": "pre", "rows": 4 }
]
```

Note: `mode: "pre"` preserves line breaks and whitespace so agents can write multi-line copy that renders correctly without relying on browser word wrap only.

## When to Use

- Post needs supporting explanation below a headline, stat, or quote
- 1-3 sentence elaboration that adds context without becoming the visual anchor
- Nearly every archetype — body-text is the most reused component in the library

## When NOT to Use

- Very long copy (4+ sentences) — consider splitting the post or reducing copy
- When a stat or headline already conveys the full message without elaboration

## Archetype Appearances

Composes into: stat-hero-single, problem-first, manifesto, feature-spotlight (and most other archetypes)
