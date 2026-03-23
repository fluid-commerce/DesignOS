# cta-pill

## What it is

A call-to-action or tagline element — a pill-shaped container with a primary action text and optional supporting subtext.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| CTA text | text | `.cta-text` | CTA Text |
| CTA subtext | text | `.cta-sub` | CTA Subtext |

## SlotSchema Snippet

```json
[
  { "type": "text", "sel": ".cta-text", "label": "CTA Text",    "mode": "text", "rows": 1 },
  { "type": "text", "sel": ".cta-sub",  "label": "CTA Subtext", "mode": "text", "rows": 1 }
]
```

Note: The pill border and border-radius can be adjusted per archetype to render as a plain text tagline or a bordered pill button depending on context.

## When to Use

- Post ends with a direct call to action or memorable tagline
- Brand voice statement that closes a post ("Every transaction gets its best shot.")
- Feature announcement with an availability note

## When NOT to Use

- When the post leads with the CTA — save it for closing elements
- When the text is a full sentence of body copy (use body-text instead)

## Archetype Appearances

Composes into: manifesto, problem-first, app-highlight
