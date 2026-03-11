# Design Tokens — Styling Agent Context

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

## Color System (Weight: 95)

### Accent Colors (Weight: 95)

| Color | Hex | Mood | Best For |
|-------|-----|------|----------|
| Orange | `#FF8B58` | Urgency, pain, warning | Problem-first posts, cost/loss angles, CTAs |
| Blue | `#42b1ff` | Technical, intelligence, trust | Manifesto quotes, architectural concepts, links |
| Green | `#44b574` | Success, solution, proof | Stats, outcomes, "after" states, confirmation |
| Purple | `#c985e5` | Premium, financial, analytical | Data/math posts, CFO-facing content |

**One accent color per design (Weight: 95)** — never mix accent colors within a single design. Pick one and use it everywhere: headline accents, circle sketches, FLFont labels, diagram highlights, pills, taglines, CTAs.

These four accent colors are used across all contexts — social posts, website, presentations, and any other brand output.

### Neutrals (Weight: 90)

| Token | Hex / Value | Usage |
|-------|-------------|-------|
| Background (pure black) | `#000` | Social post backgrounds — pure black, NOT dark gray (Weight: 95) |
| Background (near-black) | `#050505` / `#0a0a0a` | Website page backgrounds |
| Background (section) | `#111` / `#161616` | Website section backgrounds |
| Text primary (white) | `#ffffff` | Primary text on dark backgrounds (Weight: 90) |
| Text primary (warm) | `#f5f0e8` | Body text on website — warm off-white (Weight: 90) |
| Text secondary | `#888` | Supporting text (Weight: 80) |
| Body copy overlay | `rgba(255,255,255,0.45)` | Body copy on social posts (Weight: 85) |
| Dimmed/secondary overlay | `rgba(255,255,255,0.25)` | Dimmed text on social posts (Weight: 80) |
| Card backgrounds | `rgba(255,255,255,0.03)` | Subtle card fills (Weight: 80) |
| Card borders | `rgba(255,255,255,0.06)` | Subtle card outlines (Weight: 75) |
| Borders/dividers | `#1a1a1a` / `#222` | Grid lines, separators (Weight: 75) |

See [voice-rules.md](voice-rules.md) for how accent colors map to emotional messaging context.

## Font System (Weight: 90)

| Display Name | CSS font-family | Actual File | Usage | Weight: |
|-------------|----------------|-------------|-------|---------|
| FLFont Bold | `flfontbold` | `assets/fonts/flfontbold.ttf` | Taglines, emphasis, handwritten accent | 95 |
| NeueHaasDisplay | `NeueHaas` | `assets/fonts/Inter-VariableFont.ttf` (dev proxy) | Headlines, body (social) — Black 900, Bold 700, Medium 500, Light 300 | 90 |
| Inter | `Inter` | `assets/fonts/Inter-VariableFont.ttf` | Body text, UI text | 80 |
| Syne | `Syne` | (web font) | Display/headline on website — ExtraBold 800 | 90 |
| DM Sans | `DM Sans` | (web font) | Body copy on website | 80 |
| Space Mono | `Space Mono` | (web font) | Labels, data, metadata, eyebrow text on website | 75 |

**Social posts use NeueHaasDisplay + FLFont.** Website uses Syne + DM Sans + Space Mono. Do not cross-pollinate without reason.

## Uppercase Patterns (Weight: 90)

All-caps (`text-transform: uppercase`) is used selectively. Letter-spacing inverts based on size: large display text gets tight negative tracking, small functional text gets wide positive tracking.

| Element | Letter-Spacing | Size | Context |
|---------|---------------|------|---------|
| Headlines | `-0.03em` | 82-100px+ | Massive, fills the frame (Weight: 95) |
| Headline accents | `-0.03em` | Same as headline | Accent-colored words (Weight: 95) |
| Side labels | `0.15em` | 11px | Vertical rotated, ~35% opacity (Weight: 80) |
| Pills / tags | `0.08em` | 10px | Card background + border (Weight: 75) |
| Context labels | `0.1em` | 11-18px | Stat descriptions, ~30% opacity (Weight: 75) |
| Eyebrow text (website) | `0.1em` | Small | Space Mono, brand blue (Weight: 80) |

**NOT uppercase:** Body copy, FLFont taglines, sub-text callouts — all sentence case.

See [social-post-specs.md](social-post-specs.md) for full uppercase pattern details with examples.

## Spacing System (Weight: 75)

Social post padding:
- Instagram footer: `padding: 22px 68px` (Weight: 85)
- LinkedIn footer: `padding: 18px 72px` (Weight: 85)

Website spacing uses CSS variables: `var(--space-*)` — never hard-code pixel values.

## Opacity Patterns (Weight: 85)

| Element | Opacity | Weight: |
|---------|---------|---------|
| Brushstrokes | 0.10-0.25 | 90 |
| Circle sketches | 0.5-0.7 | 85 |
| Side labels | ~0.35 | 70 |
| Slide numbers | ~0.40 | 70 |
| Ghost background text | ~0.04-0.06 | 65 |

## Border Radius (Weight: 60)

Social posts: sharp corners, no border radius. The aesthetic is editorial, not friendly.

Website: uses `var(--radius-*)` CSS variables — 8 options from `rounded-none` to `rounded-3xl`.

## Related Docs

- See [voice-rules.md](voice-rules.md) for how accent colors map to emotional messaging context
- See [social-post-specs.md](social-post-specs.md) for social-specific token usage and typography scale
- See [website-section-specs.md](website-section-specs.md) for CSS variable patterns and utility classes
- See [asset-usage.md](asset-usage.md) for brushstroke opacity and blend mode rules
