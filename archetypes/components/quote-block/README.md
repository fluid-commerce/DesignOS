# quote-block

## What it is

A pull quote with attribution — the primary pattern for posts centered on a specific person's statement or testimonial.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Quote text | text | `.quote-text` | Quote |
| Attribution | text | `.quote-attribution` | Attribution |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".quote-text",        "label": "Quote",       "mode": "pre",  "rows": 5 },
  { "type": "text", "sel": ".quote-attribution",  "label": "Attribution", "mode": "text", "rows": 1 }
]
```

## When to Use

- Post centers on a specific person's statement or insight
- The quote is verbatim and stands on its own without heavy context
- Testimonial, client story, or thought-leader content

## When NOT to Use

- Generic brand messaging without a named speaker
- Cases where the speaker's face is the focal point (use avatar-attribution with quote-block together)
- Multi-quote comparisons (split into separate posts or use metric-row for comparison data)

## Archetype Appearances

Composes into: testimonial, quote, thought-leader
