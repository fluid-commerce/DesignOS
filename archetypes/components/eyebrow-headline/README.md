# eyebrow-headline

## What it is

A small category label above a large headline — the standard opening structure for posts with a strong main statement.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Eyebrow label | text | `.eyebrow` | Eyebrow Label |
| Headline | text | `.headline` | Headline |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".eyebrow",  "label": "Eyebrow Label", "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".headline", "label": "Headline",      "mode": "text", "rows": 2 }
]
```

## When to Use

- Post has a topic category or context label that frames the main statement
- Headline needs visual anchoring with a smaller lead-in
- Any archetype where the post type is named at the top (e.g., "PAYMENT PROCESSING" above "WHILE COMPETITORS LEAVE MONEY ON THE TABLE")

## When NOT to Use

- Posts where the headline is the only text element and no context label is needed
- Stat-heavy posts where the number is more dominant than any headline text

## Archetype Appearances

Composes into: stat-hero-single, problem-first, manifesto, feature-spotlight
