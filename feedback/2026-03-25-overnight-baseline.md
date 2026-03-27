# Overnight Loop Baseline — 2026-03-25

First overnight pipeline simulation run. 8 cycles over ~7 hours on Raspberry Pi.

## Run Summary

- **Duration:** 06:53 — 14:08 (7h 15m)
- **Total creations processed:** ~45
- **Total pipeline stages executed:** ~180+
- **Cycles:** 8 (active through C5, converged C6-C8)
- **Spec-check pass rate:** 100% after fix loops

## Cycle Timeline

| Cycle | Time | Action | Creations | First-Pass Rate |
|-------|------|--------|-----------|----------------|
| 1 | 06:53 | Baseline full batch | 18 | 39% |
| 2 | 08:29 | +3 prompt rules (font, opacity, photo) | 1 validation | — |
| 3 | 09:09 | Validation batch | 6 | 83% |
| 4 | 10:08 | Full 12-prompt batch | 12 | 75% |
| 5 | 11:08 | +1 prompt rule (expanded bg) | 4 targeted | BG fixed |
| 6 | 12:08 | Monitoring batch | 3 | 33%* |
| 7 | 13:08 | Heartbeat test | 1 | — |
| 8 | 14:08 | Converged — skip | 0 | — |

## Prompt Fixes Shipped (4 total)

All in `canvas/src/server/api-pipeline.ts` `buildStylingPrompt()` NON-NEGOTIABLE section:

1. **FONT NAMING** (C2) — "@font-face family name MUST be 'NeueHaas', NOT 'Inter'" → eliminated 44% font error rate (8/18)
2. **BODY COPY OPACITY** (C2) — "exactly rgba(255,255,255,0.45)" → reduced 22% to residual (4/18)
3. **PHOTO SLOTS** (C2) — "keep <img> for photos, don't replace with div" → eliminated broken images (3/4)
4. **EXPANDED BACKGROUND** (C5) — "check ALL background declarations, not just body" → eliminated nested bg errors (2/18)

## Issue Resolution

| Issue | C1 Baseline | Final Status |
|-------|-------------|-------------|
| Font naming ("Inter") | 44% (8/18) | 0% |
| Body copy opacity | 22% (4/18) | ~20% residual |
| Photo slot broken | 75% (3/4) | 0% |
| Background non-black | 11% (2/18) | 0% |
| Word count overrun | occasional | occasional (spec-check catches) |

## Human Review (post-loop)

Average score: **3.2/5** across 18 assets.

The loop successfully fixed spec-check-detectable issues (fonts, colors, opacity, photo tags) but did NOT address the dominant quality problem: **visual boredom**. 12/18 creations had zero decorative elements despite 60+ available assets. The loop's eval harness and art director rubric were not calibrated to catch this.

See: `feedback/2026-03-25-overnight-review-human.md` for full per-asset review.

## Lessons for Next Run

1. Eval harness needs decorative element checks
2. Art director rubric was too template-literal (comparing layout structure, not brand feel)
3. Loop converged too early (C5) and did nothing for C6-C8 — need two-tier action model
4. Loop had no awareness of operator priorities — need FEEDBACK-CONTEXT.md
5. Archetype selection unreliable — ~44% of creations had no valid archetype signal
