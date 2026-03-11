# Social Post Specs — Social Post Agent Context

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

## Dimensions (Weight: 95)

| Platform | Size | Aspect |
|----------|------|--------|
| Instagram | 1080 x 1080px | Square |
| LinkedIn | 1200 x 627px | Landscape |
| LinkedIn (alt) | 1340 x 630px | Landscape |

## Typography Scale — Instagram (Weight: 90)

| Element | Size | Font | Weight | Case |
|---------|------|------|--------|------|
| Headline | 82-100px | NeueHaasDisplay | Black 900 | UPPERCASE |
| Headline accent/answer | 82px | NeueHaasDisplay | Black 900, accent color | UPPERCASE |
| Body copy | 22-24px | NeueHaasDisplay | Light 300 | Sentence |
| FLFont tagline | 26-32px | FLFont Bold | 700 | Sentence |
| Side label | 11px | NeueHaasDisplay | letter-spacing 0.15em | UPPERCASE |
| Slide number | 13px | NeueHaasDisplay | — | — |
| Footer text | 14-16px | NeueHaasDisplay | — | — |

## Typography Scale — LinkedIn (Weight: 90)

| Element | Size | Font | Weight | Case |
|---------|------|------|--------|------|
| Headline | 52-62px | NeueHaasDisplay | Black 900 | UPPERCASE |
| Body copy | 16-18px | NeueHaasDisplay | Light 300 | Sentence |
| FLFont tagline | 20-24px | FLFont Bold | 700 | Sentence |

## Accent Color System (Weight: 95)

One accent color per post. Pick based on content mood. See [design-tokens.md](design-tokens.md) for hex values.

| Color | Mood | Best For |
|-------|------|----------|
| Orange `#FF8B58` | Urgency, pain, warning | Problem-first posts, cost/loss angles |
| Blue `#42b1ff` | Technical, intelligence, trust | Manifesto quotes, architectural concepts |
| Green `#44b574` | Success, solution, proof | Stats, outcomes, "after" states |
| Purple `#c985e5` | Premium, financial, analytical | Data/math posts, CFO-facing content |

Use accent color everywhere in the post: headline accents, circle sketches, FLFont labels, diagram highlights, pills, taglines. (Weight: 90)

## Background Rules (Weight: 95)

- Background: `#000` (pure black, not `#191919` or any dark gray)
- The social samples all use pure black for maximum contrast in feeds
- Dark gray backgrounds (`#191919`) are for the one-pager/website, not social

## Footer Structure (Weight: 95)

```
[Flag icon]  |  [We-Commerce wordmark]          [Fluid dots + "fluid"]
 left                                                          right
```

- Left: `wecommerce-flags.png` + separator + `wecommerce-logos.png`
- Right: `frame-3-fluid-dots.png`
- Instagram padding: `22px 68px` (Weight: 85)
- LinkedIn padding: `18px 72px` (Weight: 85)
- Subtle, never competing with content

See [asset-usage.md](asset-usage.md) for detailed footer asset rules.

## Uppercase Patterns (Weight: 90)

All-caps (`text-transform: uppercase`) is used selectively. Each context has its own letter-spacing treatment.

| Element | Letter-Spacing | Size | Notes |
|---------|---------------|------|-------|
| Headlines | `-0.03em` (tight) | 82-100px+ | Massive, fills the frame. Tight tracking creates density and impact. |
| Headline accents | `-0.03em` (tight) | Same as headline | Accent-colored words within headlines. Same treatment. |
| Side labels | `0.15em` (wide) | 11px | Vertical rotated text on right edge. ~35% opacity. |
| Pills / tags | `0.08em` (wide) | 10px | Small tag-like elements. Card background + border. |
| Context labels | `0.1em` (wide) | 11-18px | Stat descriptions, cost labels, status indicators. Dimmed (~30% opacity). |

**NOT uppercase:**
- Body copy (sentence case, Light 300)
- FLFont taglines (sentence case, handwritten feel)
- Sub-text / FLFont callouts (sentence case)

**The rule:** Large display text gets tight negative tracking. Small functional text gets wide positive tracking. Both are uppercase, but the letter-spacing inverts based on size.

## Side Labels and Slide Numbers (Weight: 60)

- **Side label** — vertical rotated text on right edge, uppercase, letter-spaced, ~35% opacity. Content: product name or category ("Fluid Connect", "Fluid Payments", "Insights", "We-Commerce")
- **Slide number** — top-right corner, `01/05` format, ~40% opacity. Use when posts are part of a series.

## What Didn't Work — Lessons Learned (Weight: 85)

These patterns have been tested and rejected:

- **Stat cards and data grids on social** — too dense. Works on one-pagers, not in a feed. (Weight: 85)
- **Multiple accent colors in one post** — looked busy and unfocused. (Weight: 95)
- **Generic CSS-generated brushstrokes** — use the actual 7 brand asset PNGs for variety. (Weight: 90)
- **CSS mask circles** — looked thin and mechanical. Use the hand-drawn circle sketch PNGs. (Weight: 90)
- **Dark gray backgrounds** — social needs pure black for contrast. (Weight: 95)
- **Information-dense layouts on Instagram** — square format punishes complexity. (Weight: 85)
- **Decorative circle sketches floating behind content** — circles must wrap specific words only. (Weight: 90)
- **Brushstrokes with cut-off edges mid-canvas** — always bleed off the canvas edge. (Weight: 85)

## Related Docs

- See [design-tokens.md](design-tokens.md) for full color values and opacity patterns
- See [voice-rules.md](voice-rules.md) for copy principles and FLFont tagline patterns
- See [layout-archetypes.md](layout-archetypes.md) for which layout to use per content type
- See [asset-usage.md](asset-usage.md) for brushstroke blend modes, circle sketch hue-shift, footer assets
