# stat-hero-single

**Archetype ID:** stat-hero-single
**Platform:** Instagram Square (1080 x 1080)
**Structural pattern:** One giant stat (number + unit) occupies 40% of canvas height; headline below; body copy at bottom.

## What it is

A stat-dominant social post layout where a single large metric anchors the visual hierarchy — the number IS the hook.

## When to use

- Post leads with a single compelling metric (acceptance rate, revenue growth, conversion lift)
- The number itself is the hook — it should be visually dominant
- Supporting text explains why the number matters

## When NOT to use

- Post leads with a problem or emotion before revealing data
- Multiple stats of equal importance (use data-dashboard instead)
- The stat needs a chart or visual comparison to be meaningful

## Content type

Data-driven proof point, performance metric, achievement milestone

## Components used

- stat-card (stat-number, context-label)
- eyebrow-headline (headline)
- body-text (body-copy)

## Slots

| Slot | Type | Selector | Description |
|------|------|----------|-------------|
| Context Label | text | .context-label | Descriptor above stat (e.g., "Approval rate across all PSPs") |
| Stat Value | text | .stat-number | The giant metric (e.g., "94%") |
| Headline | text | .headline | Supporting statement about the stat's meaning |
| Body Copy | text | .body-copy | 1-2 sentences of supporting explanation |

## Design notes

- The vertical side category label (present in the branded stat-proof template) is omitted here — it is a Fluid brand convention, not a structural layout element. The brand layer applies it at generation time.
- Casing (uppercase vs sentence case) is a brand decision, not an archetype decision. No `text-transform: uppercase` is applied in the skeleton.

## Reference

Derived from `templates/social/stat-proof.html` (branded version with Fluid assets).
