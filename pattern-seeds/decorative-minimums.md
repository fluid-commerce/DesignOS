Every social post requires minimum decorative treatment. A post with zero decorative elements is NEVER acceptable. (weight: 95)

## Required Minimums Per Social Post

| Element | What These Are | Min | Max | Weight |
|---------|----------------|-----|-----|--------|
| Brushstrokes | `brush-texture-01` through `brush-texture-10`, `brush-white` — paint stroke overlays placed as `<div>` elements with `background-image`, `mix-blend-mode: screen`, opacity 0.10-0.25 in the background layer | 2 | 3 | 90 |
| Circle/underline emphasis | `circle-1` through `circle-6` (circle masks), `underline-1` through `underline-3` (underline masks) — CSS mask technique wrapping a specific keyword | 1 | 2 | 85 |
| Optional texture accents | `line-049`, `line-056`, etc. (line textures), `scribble-017`, `scribble-023`, etc. (scribble textures), `x-mark-199`, `x-mark-218` (x-marks) — placed as `<div>` elements with `background-image` | 0 | 2 | 60 |

## How to discover assets

- Brushstrokes: `list_brand_assets(category="brushstrokes")` → place as `<div>` with `background-image` in the background layer
- Circles/underlines: `list_brand_assets(category="circles")` → use as CSS `mask-image` on a colored `<div>` positioned behind a keyword
- Lines/scribbles/x-marks: `list_brand_assets(category="decorations")` → place as `<div>` with `background-image`

## Anti-patterns (weight: 90)

- Text on a solid black background with NO textures, brushstrokes, or emphasis marks
- Using only text and a colored accent line with nothing else
- Empty `.background-layer` / `.decorative-zone` div with no children
