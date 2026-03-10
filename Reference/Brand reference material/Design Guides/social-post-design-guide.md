# Fluid Social Post Design Guide

What we've learned about creating effective social posts for the Fluid / We-Commerce brand — distilled from iterating across 10+ posts, referencing the actual social samples, one-pager brand reference, and marketing messaging docs.

---

## 1. One Accent Color Per Post

Never mix accent colors within a single design. Pick one and use it everywhere — headline accents, circle sketches, FLFont labels, diagram highlights, pills, taglines.

| Color | Mood | Best For |
|-------|------|----------|
| Orange `#FF8B58` | Urgency, pain, warning | Problem-first posts, cost/loss angles |
| Blue `#42b1ff` | Technical, intelligence, trust | Manifesto quotes, architectural concepts |
| Green `#44b574` | Success, solution, proof | Stats, outcomes, "after" states |
| Purple `#c985e5` | Premium, financial, analytical | Data/math posts, CFO-facing content |

---

## 2. Headline-Dominant, Not Information-Dense

Social posts are not one-pagers. The earlier versions had stat cards, comparison tables, and data grids — that's too much for a scroll-stopping social format. The social samples made this clear:

- **Massive uppercase headlines** that fill most of the frame (82–100px+ on Instagram)
- **Minimal body copy** — one or two sentences max, if any
- **One idea per post** — don't try to say everything

The headline IS the post. Body copy supports it; it doesn't carry the message.

---

## 3. Brushstroke Texture Variety

Don't use the same brushstroke placement on every post. The brand has 7+ brushstroke textures with different shapes and energies:

- **Diagonal sweeps** (01, 07) — dynamic, upward motion
- **Compact bursts** (02) — tight accent energy
- **Tall verticals** (03, 04) — dramatic edge framing
- **Wide horizontals** (05, 06) — grounding, horizon feel

### Placement strategies:
- **Top-right + bottom-left** — the default, but vary which brushstrokes
- **Full-height edge framing** — tall verticals on left or right edge
- **Full-width top sweep** — creates a horizon/sky effect
- **Both sides** — dramatic curtain/stage framing (use sparingly, for manifesto-type posts)
- **Center-bottom** — grounding texture under content

### Rules:
- Use `mix-blend-mode: screen` (they're white on black)
- Opacity between 0.10–0.25 — never overpowering
- Slight rotation adds organic feel
- 2 brushstrokes per post is standard; 3 for dramatic/manifesto posts
- **Any cut-off edge of a brushstroke must land at the canvas edge** — never let a brush trail end mid-canvas (e.g. `bottom: 80px` leaves a visible hard edge floating in space). Push it to the edge (`bottom: -10px` or further) so the natural fade bleeds off the canvas. This is the difference between intentional texture and visual clutter.

---

## 4. Hand-Drawn Circle Sketches as Emphasis

The blue circle sketch (`circle sketch 1.png`) is a signature brand element — visible in every social sample. Use it **only to highlight specific words or numbers** in headlines:

- **Around key words** in headlines for emphasis (like "commission engine", "Frankenstein", "credit", "82%")
- **Hue-shifted** via CSS `filter: hue-rotate()` to match the post's accent color
- **Never used as purely decorative floats** — every circle sketch should visually wrap a specific word or data point. Floating circles behind content add visual noise without adding meaning.

### Sizing:
- Size the circle to tightly wrap the target word(s): 280–400px width for 1–2 words
- Always slightly rotated (5–15deg) — never perfectly horizontal
- Opacity 0.5–0.7 — visible enough to emphasize, not so strong it overpowers the text

---

## 5. Footer Structure (Consistent Across All Posts)

Three elements, always the same:

```
[Flag icon]  |  [We-Commerce wordmark]          [Fluid dots + "fluid"]
└─ left ──────────────────────────────────────────────── right ─┘
```

- **Left:** `We-Commerce Flags.png` + separator + `We-Commerce Logos.png`
- **Right:** `Frame 3.png` (fluid dots mark)
- Subtle, never competing with the content
- Instagram: `padding: 22px 68px`
- LinkedIn: `padding: 18px 72px`

---

## 6. Side Labels and Slide Numbers

From the social samples:

- **Side label** — vertical rotated text on the right edge, uppercase, letter-spaced, ~35% opacity. Content: product name or category ("Fluid Connect", "Fluid Payments", "Insights", "We-Commerce")
- **Slide number** — top-right corner, `01/05` format, ~40% opacity. Use when posts are part of a series.

---

## 7. Layout Archetypes That Work

### A. Full-Bleed Headline
Massive text fills the frame. Maybe one line of body copy or an FLFont tagline below. Circle sketch wraps a key word. Brushstrokes frame the edges.
> Best for: Brand statements, problem declarations, emotional hooks

### B. Headline + Diagram Card
Top half: big headline. Bottom half: a dark card (`rgba(255,255,255,0.03)` background) with structured content — flow diagrams, terminal-style data, step comparisons.
> Best for: Technical differentiators, before/after, process explanations

### C. Giant Stat Hero
Oversized number (200px+) dominates the top. Headline and body copy below provide context.
> Best for: Proof points, reframes, "the number you're not tracking" angles

### D. Pull Quote / Manifesto
Large quotation mark as a visual anchor. Quote text at 50–52px. Attribution in FLFont below. Decorative circle sketch floating behind.
> Best for: Company voice, emotional storytelling, thought leadership

### E. Two-Column (LinkedIn Landscape)
Left: headline + short body. Right: supporting visual element (diagram card, checklist, comparison). Only works at 1200x627.
> Best for: Educational content, feature comparisons, checkout UX stories

### F. Centered Manifesto
Everything centered. Watermark text repeating in the background at 4% opacity. Heavy brush framing on both sides. Emotional, brand-building.
> Best for: Mission statements, campaign anchors, "Every Transaction Matters"

---

## 8. Copy Principles for Social

Pulled from the marketing messaging docs and refined through iteration:

1. **Lead with pain, not features.** "The order went through. It never reached the commission engine." — not "Fluid Connect offers real-time bidirectional sync."

2. **One sentence, one idea.** Short. Dramatic. Let the big claim land before building on it.

3. **Name specific scenarios.** "They're at a red light. The moment passes." — not "Mobile checkout is important."

4. **Make it human.** The mom at 11:47pm. The rep who lost credit. Groceries. Dance lessons. Never abstract.

5. **FLFont taglines land the takeaway.** The handwritten font signals confidence and personality. Use it for the one line you want remembered: "One connection. Zero 3am calls." / "Every transaction gets its best shot."

6. **Never explain the product in a social post.** Create curiosity. The product page does the explaining.

---

## 9. Technical Specs

### Dimensions
- **Instagram:** 1080 x 1080px (square)
- **LinkedIn:** 1200 x 627px (landscape)

### Typography Scale (Instagram)
- Headline: 82–100px (NeueHaasDisplay Black 900)
- Headline accent/answer: 82px (same weight, accent color)
- Body copy: 22–24px (NeueHaasDisplay Light 300)
- FLFont tagline: 26–32px
- Side label: 11px, letter-spacing 0.15em
- Slide number: 13px
- Footer text: 14–16px

### Typography Scale (LinkedIn)
- Headline: 52–62px
- Body copy: 16–18px
- FLFont tagline: 20–24px

### Colors
- Background: `#000` (pure black, not `#191919`)
- Text: `#ffffff`
- Body copy: `rgba(255,255,255,0.45)`
- Dimmed/secondary: `rgba(255,255,255,0.25)`
- Card backgrounds: `rgba(255,255,255,0.03)`
- Card borders: `rgba(255,255,255,0.06)`

### Fonts
- **NeueHaasDisplay** — Black (900), Bold (700), Medium (500), Light (300)
- **FLFont** — Bold (700) — handwritten accent font

---

## 10. What Didn't Work (Lessons Learned)

- **Stat cards and data grids on social** — too dense. Works on one-pagers, not in a feed. Save structured data for sales collateral.
- **Multiple accent colors** — looked busy and unfocused. One color = one mood = one message.
- **Generic CSS-generated brushstrokes** — using a single repeated brush image with rotation felt templated. The actual brand assets (7 unique brushstrokes) create much more visual variety.
- **CSS mask circles** — technically worked but looked thin and mechanical. The actual hand-drawn circle sketch PNGs from the brand kit have weight, texture, and imperfection that match the social samples.
- **Dark gray backgrounds (`#191919`)** — the one-pager uses this, but social posts need pure black for contrast in feeds. The social samples all use `#000`.
- **Information-dense layouts on Instagram** — the square format punishes complexity. If you can't read the headline at phone size in 2 seconds, it's too much.
- **Decorative circle sketches floating behind content** — circles used as ambient background texture (halos, floats behind quotes) just add visual noise. Circle sketches should only wrap specific words — that's what makes them feel intentional and editorial rather than chaotic.
- **Brushstrokes with cut-off edges mid-canvas** — when a brushstroke's hard edge ends 80px above the bottom (or 60px from a side), the abrupt cutoff looks like a rendering error. Always push brushstrokes so their cut-off edges bleed off the canvas. The organic fade should be visible; the hard edge should not.
- **Too much content on one-pagers** — the temptation to include every detail (capability strips, long body paragraphs, explanatory text above comparison tables) makes the page feel cramped. Let the key elements breathe. A comparison table doesn't need a paragraph explaining what it already shows.