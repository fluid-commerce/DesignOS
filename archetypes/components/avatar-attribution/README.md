# avatar-attribution

## What it is

A small photo paired with name, title, and optional social handle — the attribution block for posts featuring a real person.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Photo | image | `.avatar img` | Photo |
| Name | text | `.avatar-name` | Name |
| Title | text | `.avatar-title` | Title |
| Handle | text | `.avatar-handle` | Handle |

## SlotSchema Snippet

```json
[
  { "type": "image", "sel": ".avatar img",    "label": "Photo",  "dims": "64 x 64px" },
  { "type": "text",  "sel": ".avatar-name",   "label": "Name",   "mode": "text", "rows": 1 },
  { "type": "text",  "sel": ".avatar-title",  "label": "Title",  "mode": "text", "rows": 1 },
  { "type": "text",  "sel": ".avatar-handle", "label": "Handle", "mode": "text", "rows": 1 }
]
```

Note: `.avatar img` selector pattern allows `imageLayoutSel()` to automatically derive `.avatar` as the draggable frame target.

## When to Use

- Post attributes content to a specific person with their photo
- Testimonials, employee spotlights, partner announcements
- Quote blocks that need speaker identity reinforced visually (pair with quote-block)

## When NOT to Use

- Anonymous data or brand-level messaging without a named person
- Cases where only a name is needed without a photo (inline text attribution is sufficient)

## Archetype Appearances

Composes into: testimonial, quote, employee-spotlight
