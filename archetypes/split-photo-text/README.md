# split-photo-text

## Purpose

Editorial-style 50/50 split layout. Left half is a full-height photo; right half is a vertically-centered text panel with headline, body copy, and attribution. Clean, magazine-feel format that balances visual impact with substantive copy.

## When to Use

- Case studies and client success stories
- Testimonials with a human face to put to the quote
- Before/after comparisons with supporting narrative
- Product demos where a single image tells the story
- Any post needing more copy than a full-bleed layout allows

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.photo img` | image | Half-width photo, left side (540 x 1080px) |
| `.headline` | text | Bold 3–6 word headline (sits in flex column, not absolute) |
| `.body-copy` | text | 2–3 sentence supporting copy |
| `.attribution` | text | Name and title of the person quoted or referenced |

## Example Topics

- "REAL RESULTS FROM REAL BRANDS — We stopped guessing what works and started measuring it."
- "A/B TESTING CHANGED EVERYTHING — Four weeks in, conversion was up 34%."
- "HOW WE CUT CHURN IN HALF — The answer wasn't what we expected."

## Layout Notes

- Photo: absolute, left 0, top 0, 540 x 1080px — fills left half entirely
- Text panel: absolute, right 0, top 0, 540 x 1080px — flex column, justify center, 60px padding
- Headline, body-copy, attribution flow naturally inside the flex container (not absolute positioned)
- Background: #111 fills the right panel behind text
