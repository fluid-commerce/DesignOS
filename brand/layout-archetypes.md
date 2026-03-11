# Layout Archetypes — Layout Agent Context

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

## Overview (Weight: 85)

Six proven layout types for social posts. Each has been validated through 10+ iterations. Choose based on content type and message intent.

## A. Full-Bleed Headline (Weight: 85)

Massive text fills the frame. Maybe one line of body copy or an FLFont tagline below. Circle sketch wraps a key word. Brushstrokes frame the edges.

**When to use:** Brand statements, problem declarations, emotional hooks

**Specs:**
- Headline: 82-100px+ (Instagram), fills most of the frame
- Body copy: 1-2 sentences max, if any
- One idea per post — the headline IS the post
- Brushstrokes: 2, framing edges (top-right + bottom-left default)
- Circle sketch: wrapping one key word in headline

**Element placement (Weight: 80):**
- Headline centered or left-aligned, upper 60% of frame
- FLFont tagline below headline
- Footer pinned to bottom

## B. Headline + Diagram Card (Weight: 80)

Top half: big headline. Bottom half: a dark card with structured content — flow diagrams, terminal-style data, step comparisons.

**When to use:** Technical differentiators, before/after, process explanations

**Specs:**
- Card background: `rgba(255,255,255,0.03)` with `rgba(255,255,255,0.06)` border
- Card content: monospace or structured data aesthetic
- Headline above card: 82px Instagram

**Element placement (Weight: 80):**
- Headline in upper 40%
- Diagram card in lower 50%
- Footer below card

## C. Giant Stat Hero (Weight: 80)

Oversized number (200px+) dominates the top. Headline and body copy below provide context.

**When to use:** Proof points, reframes, "the number you're not tracking" angles

**Specs:**
- Stat number: 200px+ (Instagram), dominant visual element
- Headline below stat: standard size
- Body copy: 1-2 sentences of context
- Circle sketch: around the stat number

**Element placement (Weight: 75):**
- Giant stat centered, upper 40%
- Headline + body centered below
- Brushstrokes: bottom grounding or edge framing

## D. Pull Quote / Manifesto (Weight: 80)

Large quotation mark as a visual anchor. Quote text at 50-52px. Attribution in FLFont below. Decorative circle sketch floating behind.

**When to use:** Company voice, emotional storytelling, thought leadership

**Specs:**
- Quote text: 50-52px (Instagram)
- Attribution: FLFont below quote
- Quotation mark: large, accent color, visual anchor

**Element placement (Weight: 75):**
- Quote centered or left-aligned
- Quotation mark top-left, oversized
- Circle sketch behind quote text
- Heavy brush framing both sides for manifesto variant

## E. Two-Column — LinkedIn Landscape Only (Weight: 75)

Left: headline + short body. Right: supporting visual element (diagram card, checklist, comparison).

**When to use:** Educational content, feature comparisons, checkout UX stories

**Specs:**
- Only works at 1200x627 landscape format (Weight: 90)
- Left column: ~55% width, headline + body
- Right column: ~45% width, visual element
- Never use on Instagram square format

**Element placement (Weight: 80):**
- Clear vertical divide between columns
- Left column text top-aligned
- Right column visual centered vertically

## F. Centered Manifesto (Weight: 75)

Everything centered. Watermark text repeating in the background at 4% opacity. Heavy brush framing on both sides. Emotional, brand-building.

**When to use:** Mission statements, campaign anchors, "Every Transaction Matters"

**Specs:**
- All text centered
- Background watermark: repeating text at ~4% opacity
- Brushstrokes: heavy framing, both sides (use sparingly — manifesto posts only)
- Tone: emotional, declarative

**Element placement (Weight: 75):**
- Content vertically centered in frame
- Brushstrokes: both-sides "curtain" framing
- Watermark text behind content layer

## General Layout Rules (Weight: 85)

### Headline-dominant, not information-dense (Weight: 90)
Social posts are not one-pagers. The headline IS the post. Body copy supports it; it doesn't carry the message. If you can't read the headline at phone size in 2 seconds, it's too much.

### One idea per post (Weight: 85)
Don't try to say everything. Each post makes one claim, one emotional hit, one proof point.

### No stat cards or data grids on social (Weight: 80)
Too dense for a scroll-stopping social format. Save structured data for sales collateral. See [social-post-specs.md](social-post-specs.md) for dimension constraints.

## Related Docs

- See [design-tokens.md](design-tokens.md) for spacing values, card backgrounds, and opacity rules
- See [social-post-specs.md](social-post-specs.md) for dimension constraints per platform
- See [voice-rules.md](voice-rules.md) for which messaging patterns suit which layout
- See [asset-usage.md](asset-usage.md) for brushstroke placement strategies
