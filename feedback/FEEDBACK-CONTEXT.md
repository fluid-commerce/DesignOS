# Overnight Loop Operator Context
Last updated: 2026-03-25

## Priority Issues (from latest human review — 2026-03-25, 18 assets, avg 3.2/5)

1. **CRITICAL:** 12/18 creations had ZERO decorative elements (brushstrokes, circles, textures). Posts are "just text on solid black background." Nobody would stop scrolling. The styling agent has 60+ decorative assets available but rarely uses them.
2. **HIGH:** ~8/18 archetype selection failed — copy.md outputs "Archetype: unknown" or uses names that don't match filesystem slugs. Layout falls back to generic text-on-black.
3. **HIGH:** ~6/18 too much empty black space. Headlines and body copy too small for the 1080px canvas. Content doesn't fill the frame.
4. **MEDIUM:** FLFont tagline consistently rendered at 26-32px — barely visible. Should be 36-48px on Instagram.
5. **MEDIUM:** Decorative lines/underlines placed arbitrarily in space rather than emphasizing specific text.
6. **LOW:** Footer inconsistency — sometimes only spans one column, "fluid.app" text appearing, different structure per post.
7. **LOW:** Archetype placeholder text leaking into final output ("Annual report highlights").

## What To Watch For This Run

- Are decorative minimums being met? (at least 2 brushstrokes + at least 1 circle/underline per social post)
- Is archetype selection working? (every copy.md has a valid `Archetype:` line matching a real filesystem slug)
- Are headlines at least 72px on Instagram? Is FLFont at least 36px?
- Are footers spanning full canvas width?
- Are decorative lines/underlines positioned on actual text, not floating in space?
- Are photo slots filled and sized correctly (object-fit: cover, at least 45% width in split layouts)?

## Baseline Metrics (2026-03-25 Cycle 1)

- First-pass spec-check: 39%
- Average human score: 3.2/5
- Decorative element usage: ~10% of posts (2/18 had any)
- Archetype selection success: ~56% (10/18 had valid archetype)
- Posts where spec-check caught font naming: 44% (8/18)

## Operator Notes

Focus on social posts (Instagram + LinkedIn) for now. One-pagers need more work but are lower priority. The biggest single improvement would be getting decorative elements into every post — that alone could move the score from 3.2 to 4.0+.
