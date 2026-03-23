# image-block

## What it is

An image with an optional caption — the primary pattern for posts that include a product shot, screenshot, or real photo.

## Content Fields

| Field | Type | Selector | Label |
|-------|------|----------|-------|
| Photo | image | `.image-frame img` | Photo |
| Caption | text | `.image-caption` | Caption |

## SlotSchema Snippet

```json
[
  { "type": "image", "sel": ".image-frame img", "label": "Photo",   "dims": "variable" },
  { "type": "text",  "sel": ".image-caption",   "label": "Caption", "mode": "text", "rows": 1 }
]
```

Note: `.image-frame img` selector pattern allows `imageLayoutSel()` to automatically derive `.image-frame` as the draggable frame target.

## When to Use

- Post includes a product shot, app screenshot, or real editorial photo
- Image is the visual anchor and text supports it
- Feature spotlight where showing > telling

## When NOT to Use

- Pure text posts — no meaningful image to show
- Stat-heavy posts where the number is the visual anchor
- When the image is a person's portrait and attribution is needed (use avatar-attribution instead)

## Archetype Appearances

Composes into: app-highlight, photo-text-split, feature-spotlight
