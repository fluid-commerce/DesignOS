11 brand brush textures. Always use `mix-blend-mode: screen` and opacity 0.10-0.25. Edges must bleed off canvas — never cut mid-frame.

## Available Assets

| Asset | Description | Weight |
|-------|-------------|--------|
| `brush-texture-01` through `brush-texture-10` | Varied brush stroke textures — discover via `list_brand_assets(category="brushstrokes")` | 75 |
| `brush-white` | Large white brush stroke for bold overlays | 75 |

## Usage Rules

- **ALWAYS** use `mix-blend-mode: screen` (weight: 95)
- Opacity: `0.10-0.25` — subtle at 0.10-0.15, dramatic at 0.20-0.25 (weight: 90)
- Edges must bleed off canvas, never cut mid-frame (weight: 85)
- Every social post MUST contain at least 2 brushstrokes in the background layer. A post with ZERO brushstrokes is a brand failure. (weight: 95)
- 2 per post standard, 3 max for manifesto (weight: 90)
- Slight rotation for organic feel (weight: 50)

## Placement Strategies

| Strategy | Best For | When |
|----------|----------|------|
| Top-right + bottom-left | Default for most posts | Standard diagonal framing |
| Full-height edge framing | Dramatic, editorial posts | Tall vertical brushstrokes |
| Full-width top sweep | Horizon/sky effect | Wide horizontal brushstrokes |
| Both sides (curtain) | Manifesto posts only (sparingly) | Any tall verticals |
| Center-bottom grounding | Under content, stability | Bottom grounding brushstrokes |

```css
/* Brushstroke positioning pattern */
.brushstroke {
  position: absolute;
  mix-blend-mode: screen;
  opacity: 0.15;          /* 0.10-0.15 subtle, 0.20-0.25 dramatic */
  pointer-events: none;
  z-index: 1;
}

/* Top-right placement (bleed off edge) */
.brushstroke-top-right {
  top: -20px;
  right: -30px;
  width: 500px;
  transform: rotate(5deg);
}

/* Bottom-left placement (bleed off edge) */
.brushstroke-bottom-left {
  bottom: -20px;
  left: -30px;
  width: 500px;
  transform: rotate(-8deg);
}

/* HTML usage — always reference assets from DB */
<div class="post" style="position: relative; overflow: hidden;">
  <img class="brushstroke brushstroke-top-right"
       src="/api/brand-assets/serve/brush-texture-01"
       alt="" aria-hidden="true">
  <img class="brushstroke brushstroke-bottom-left"
       src="/api/brand-assets/serve/brush-texture-03"
       alt="" aria-hidden="true">
  <!-- Content here -->
</div>
```
