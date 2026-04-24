# vintage-scrapbook

**Platform:** Instagram Portrait (1080 × 1350)

## What it is

A 2×2 photo grid fills the entire canvas with 12px gutters. Two small metadata labels (collection name, season/subtitle) sit in the lower-left corner over the grid. Photography is the primary visual message.

## Structural pattern

The CSS grid fills the full 1080×1350px canvas with four equal cells (~534×663px each), separated by 12px gutters that render as the background layer color. A dark overlay sits in the lower-left corner where the collection name (bold, 26px) and season/subtitle (lighter, 20px) are positioned at bottom:52px and bottom:24px respectively. The text is legible against any photo content due to its bottom anchor position.

## Content type fit

- Collection or product launch grid posts
- Brand moodboard or aesthetic reveal
- Event or experience recap posts
- "Our world" multi-shot brand storytelling

## When to use

- When you have 4 visually cohesive photos that tell a story together
- When the images have consistent color temperature and lighting
- When photography IS the brand message

## When NOT to use

- When photos have inconsistent lighting (the grid makes inconsistency obvious)
- When a text message needs primary prominence
- When only 1–2 images are available

## Components

- Full-canvas 2×2 CSS grid + bottom-left metadata overlay
