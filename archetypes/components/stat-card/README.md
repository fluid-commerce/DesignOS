# stat-card

## What it is

A big number paired with a descriptive label and optional context note — the primary pattern for posts that lead with a compelling metric.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Stat value | text | `.stat-number` | Stat Value |
| Stat label | text | `.stat-label` | Stat Label |
| Context note | text | `.stat-context` | Context |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".stat-number",  "label": "Stat Value",  "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".stat-label",   "label": "Stat Label",  "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".stat-context", "label": "Context",     "mode": "text", "rows": 1 }
]
```

## When to Use

- Post leads with a single compelling metric that needs visual dominance
- The number is surprising, impressive, or counterintuitive
- Context note clarifies what the number represents (e.g., "Across all PSP integrations")

## When NOT to Use

- Posts that lead with emotion or narrative before data
- Multiple stats of equal weight (use metric-row for those)
- Stats that require more than one sentence of context (consider body-text + eyebrow-headline instead)

## Archetype Appearances

Composes into: stat-hero-single, data-dashboard, quarterly-report
