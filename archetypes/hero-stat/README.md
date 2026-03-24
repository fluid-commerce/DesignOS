# hero-stat

## Purpose

Bold stat-driven layout where a single large number anchors the entire composition. The stat takes up the top third of the frame, supported by a descriptive label, a punchy headline, and a brief supporting line.

## When to Use

- Performance milestones (conversion rates, growth percentages, revenue numbers)
- KPI announcements and quarterly wins
- Before/after comparisons expressed as a single metric
- Any post where the number IS the story

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.stat-number` | text | The primary metric — large and bold (e.g. `94%`, `2.4x`, `$1.2M`) |
| `.stat-label` | text | Short descriptor below the stat (e.g. `CONVERSION RATE`) |
| `.headline` | text | 3–6 word headline that contextualizes the stat |
| `.subtext` | text | 1–2 sentence supporting line (shown at bottom) |

## Example Topics

- "94% approval rate — while competitors leave money on the table"
- "3x faster onboarding after switching to automated flows"
- "$2.1M recovered revenue in Q3 through retry logic"

## Layout Notes

- Stat number: 260px, top 190px — dominates the upper frame
- Stat label: uppercase, 28px, directly below the number
- Headline: 82px bold, sits in the middle zone
- Subtext: 24px muted, anchored to bottom
- Background: neutral #111 — brand color layer applied at generation time
