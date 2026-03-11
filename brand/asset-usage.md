# Asset Usage Rules — Visual Agent Context

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

See [asset-index.md](asset-index.md) for the complete inventory of all 15 assets with file paths and original filenames.

## Brushstrokes (Weight: 90)

### Blend mode: `mix-blend-mode: screen` (Weight: 95)
Brushstrokes are white on black — screen blend mode makes them layer correctly over dark backgrounds.

### Opacity: 0.10-0.25 (Weight: 90)
Never overpowering. Texture, not focal point. 0.10-0.15 for subtle background texture, 0.20-0.25 for more dramatic framing.

### Edge-bleed rule (Weight: 85)
Any cut-off edge of a brushstroke must land at the canvas edge — never let a brush trail end mid-canvas. Push it to the edge (`bottom: -10px` or further) so the natural fade bleeds off the canvas. A hard edge floating in space (e.g., `bottom: 80px`) looks like a rendering error.

### Count per post (Weight: 80)
2 brushstrokes per post is standard. 3 for dramatic/manifesto posts. Never more than 3.

### Rotation (Weight: 50)
Slight rotation adds organic feel. Not required but recommended.

### Placement strategies (Weight: 70)
- **Top-right + bottom-left** — the default, but vary which brushstrokes
- **Full-height edge framing** — tall verticals (vertical-double-block, vertical-edge-sweep) on left or right edge
- **Full-width top sweep** — creates a horizon/sky effect
- **Both sides** — dramatic curtain/stage framing (use sparingly, for manifesto-type posts)
- **Center-bottom** — grounding texture under content (bottom-grounding)

### Variety rule (Weight: 75)
Don't use the same brushstroke placement on every post. The brand has 7 brushstroke textures with different shapes and energies. Mix them:
- **Diagonal sweeps** (diagonal-sweep, diagonal-upward) — dynamic, upward motion
- **Compact burst** (compact-burst) — tight accent energy
- **Tall verticals** (vertical-double-block, vertical-edge-sweep) — dramatic edge framing
- **Wide horizontals** (horizontal-wide, bottom-grounding) — grounding, horizon feel

## Circle Sketches (Weight: 90)

### Emphasis-only usage (Weight: 90)
Use circle sketches ONLY to highlight specific words or numbers in headlines. Around key words like "commission engine", "Frankenstein", "credit", "82%". Never used as purely decorative floats — every circle sketch should visually wrap a specific word or data point. Floating circles behind content add visual noise without adding meaning.

### Color matching via CSS mask (Weight: 85)
Use white PNG masks with `mask-image` and set `backgroundColor` to any accent color. This replaces the old `hue-rotate()` approach. See the Pattern Library for implementation examples.

### Sizing (Weight: 75)
280-400px width for 1-2 words. Size the circle to tightly wrap the target word(s).

### Rotation (Weight: 70)
Always slightly rotated (5-15deg) — never perfectly horizontal.

### Opacity: 0.5-0.7 (Weight: 80)
Visible enough to emphasize, not so strong it overpowers the text.

### NOT decorative (Weight: 90)
CSS mask circles look thin and mechanical. The actual hand-drawn circle sketch PNGs from the brand kit have weight, texture, and imperfection that match the social samples. Use the real assets, not CSS approximations.

## Footer Structure (Weight: 95)

Three elements, always the same across all social posts:

```
[Flag icon]  |  [We-Commerce wordmark]          [Fluid dots + "fluid"]
 left                                                          right
```

- **Left:** `wecommerce-flags.png` + separator + `wecommerce-logos.png`
- **Right:** `frame-3-fluid-dots.png` (Fluid dots mark)
- Subtle, never competing with the content
- See [social-post-specs.md](social-post-specs.md) for platform-specific footer padding

## Fonts (Weight: 90)

### FLFont Bold for taglines only (Weight: 90)
The handwritten font signals confidence and personality. Use exclusively for tagline lines and emphasis text. Never for body copy or headlines. See [voice-rules.md](voice-rules.md) for tagline patterns.

### NeueHaasDisplay for social headlines and body (Weight: 85)
Available in Black (900), Bold (700), Medium (500), Light (300). Use Black for headlines, Light for body copy on social posts.

## Related Docs

- See [asset-index.md](asset-index.md) for file paths and original filename mapping
- See [design-tokens.md](design-tokens.md) for color values used with hue-shift and accent matching
- See [social-post-specs.md](social-post-specs.md) for footer padding values per platform
- See [layout-archetypes.md](layout-archetypes.md) for brushstroke placement per layout type
