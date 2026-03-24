# minimal-statement

## Purpose

Maximum whitespace, single bold statement. The entire visual weight of the post rests on one powerful line of text, vertically centered in the frame. A quiet supporting line anchors the bottom. Nothing else competes.

## When to Use

- Provocative opinions or contrarian takes
- Brand values statements
- Inspirational positioning lines
- Posts that need to stop the scroll through silence, not noise
- Any single idea strong enough to carry the frame alone

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.headline` | text | The primary bold statement (96px, vertically centered) |
| `.subtext` | text | Optional one-line supporting context (anchored to bottom) |

## Example Topics

- "STOP OPTIMIZING FOR VANITY METRICS"
- "THE BEST BRIEF IS THE ONE YOU THROW AWAY"
- "BRAND IS NOT WHAT YOU SAY. IT'S WHAT YOU DO."

## Layout Notes

- Headline: 96px bold, left 100px, top 50% with translateY(-60%) — slightly above center
- Subtext: 24px muted, bottom 120px — whisper to the headline's shout
- Width constraint: 880px for headline — prevents runaway line lengths
- No photo, no stats, no portrait — intentionally stripped back
- Decorative layer (brand brushstrokes) is the only visual complexity allowed
