# photo-bg-overlay

## Purpose

Full-bleed photography with text overlaid on a gradient scrim. The image fills the entire 1080x1080 frame; a bottom-up gradient darkens the lower portion to make white text readable over any photo.

## When to Use

- Visual storytelling where imagery is the emotional hook
- Event promotion and moment-capture posts
- Lifestyle and brand identity content
- Product-in-context shots where the product IS the visual
- Any post where the photo communicates more than text alone

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.photo img` | image | Full-bleed background photo (1080 x 1080px) |
| `.headline` | text | 4–8 word headline rendered over the photo |
| `.subtext` | text | 1–2 sentence supporting line below the headline |
| `.category span` | text | Vertical side label (e.g. `INSIGHT`, `PRODUCT`, `STORY`) |

## Example Topics

- Product launch hero shot: "THE TOOL TEAMS ACTUALLY WANT TO USE"
- Event recap: "WHAT 200 MARKETERS TAUGHT US IN ONE AFTERNOON"
- Brand story: "THE FUTURE OF COMMERCE IS ALREADY HERE"

## Layout Notes

- Photo: absolute, inset 0 — fills entire frame
- Overlay: bottom-to-top gradient darkens lower 60% for text legibility
- Headline: 72px bold, bottom 280px — sits on top of gradient
- Subtext: 24px, bottom 180px
- Category: vertical text, upper-right corner — optional contextual tag
- Background: #111 fallback when no image is provided
