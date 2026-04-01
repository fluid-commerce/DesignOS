FLFont + NeueHaas + Inter across all deliverables.

## Font Mapping

| Display Name | CSS font-family | File | Context | Weight |
|---|---|---|---|---|
| FLFont Bold | `flfontbold` | flfontbold.ttf | Social — taglines | 95 |
| NeueHaasDisplay | `NeueHaas` | Inter-VariableFont.ttf (proxy) | Social — headlines, body | 90 |
| Inter | `Inter` | Inter-VariableFont.ttf | Body, UI text | 80 |

## Font Fallbacks (weight: 90)

NEVER use `cursive`, `Georgia`, `Times New Roman`, `serif`, or `"Inter"` as font-family fallback values. The ONLY acceptable generic fallback is `sans-serif`. Example: `font-family: 'flfontbold', sans-serif;` — NOT `font-family: 'flfontbold', cursive;`.

## Canvas Fill — Social Posts Only (weight: 85)

For Instagram and LinkedIn posts, content must fill at least 60% of the canvas area. Vast empty black space with tiny centered text is a design failure. (weight: 85)

Minimum headline sizes for social posts:
- Instagram: 72px minimum, 88-128px preferred
- LinkedIn: 52px minimum, 62-82px preferred

For social posts, the archetype's font sizes are MINIMUMS, not maximums. Scale UP to fill the frame. (weight: 85)

Note: One-pagers follow standard document typography — these minimums do NOT apply.

## Category/Eyebrow Labels (weight: 75)

- Font: NeueHaas Medium (500), text-transform: uppercase
- Letter-spacing: 0.12-0.18em, font-size: 11-14px
- Color: rgba(255,255,255,0.45) — editorial small-caps feel
