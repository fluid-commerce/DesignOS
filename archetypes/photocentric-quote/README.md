# photocentric-quote

**Platform:** Instagram Portrait (1080 × 1350)

## What it is

A full-width hero photo occupies the upper 56% of the canvas; the lower 44% presents a bold pull-quote with attribution on a dark content field. The photo provides emotional context; the quote delivers the message.

## Structural pattern

The photo fills the upper zone (1080 × 760px) with `object-fit: cover`. The lower zone starts at y=780px and contains a large decorative quotation mark, the quote text set at ~52px, and an attribution line near the bottom. The two zones are clearly delineated — no text overlaps the photo, ensuring legibility without a darkening overlay.

## Content type fit

- Founder / executive spotlight quotes
- Client testimonials with client photos
- Team member spotlight cards
- Partner or influencer quote posts

## When to use

- When you have a strong portrait or lifestyle photo that contextualizes the quote
- When the quote is attributed to a specific named person
- When emotional resonance from the photo is needed to give the quote weight

## When NOT to use

- When no strong photo asset exists (use `typographic-quote` instead)
- When the quote is anonymous or from a public figure without a brand asset
- When the quote exceeds ~150 characters (text panel gets crowded)

## Components

- Photo hero panel (upper zone) + quote panel (lower zone)
