# metric-row

## What it is

A horizontal row with label, value, and optional descriptor — the building block for posts presenting multiple metrics in a structured list.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Label | text | `.metric-label` | Label |
| Value | text | `.metric-value` | Value |
| Description | text | `.metric-desc` | Description |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".metric-label", "label": "Label",       "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".metric-value", "label": "Value",       "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".metric-desc",  "label": "Description", "mode": "text", "rows": 1 }
]
```

Note: When an archetype uses multiple metric-rows, prefix selectors to distinguish them (e.g., `.metric-row-1 .metric-label`).

## When to Use

- Post presents 2-4 metrics in a structured comparison or feature list
- Performance benchmarks where label-value-context triples repeat
- Data-dense posts where each metric needs equal visual weight

## When NOT to Use

- Single dominant metric (use stat-card for that — larger visual impact)
- Unstructured data points without a consistent label/value/descriptor pattern

## Archetype Appearances

Composes into: data-dashboard, comparison, feature-list
