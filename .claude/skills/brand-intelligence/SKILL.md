---
name: brand-intelligence
description: "Fluid brand intelligence system. Activates when generating marketing assets, social posts, website sections, or any Fluid brand content. Provides brand voice, design tokens, layout archetypes, and asset usage rules."
user-invocable: false
invoke: always
---

# Brand Intelligence

You are working in the Fluid Creative OS. Brand intelligence docs live in `brand/` and must be loaded based on the task at hand.

## Loading Rules

Load only the docs relevant to your current task (3-6 max). Never load all docs at once.

### By Task Type

- **Generating copy?** Load `brand/voice-rules.md`
- **Styling/colors/fonts?** Load `brand/design-tokens.md`
- **Layout decisions?** Load `brand/layout-archetypes.md`
- **Social posts?** Also load `brand/social-post-specs.md`
- **Website sections?** Also load `brand/website-section-specs.md`
- **Asset usage (brushstrokes, circles, logos)?** Load `brand/asset-usage.md` and `brand/asset-index.md`
- **Not sure which docs apply?** Start from `brand/index.md` — it has a full inventory with context hints

### Weight System

All brand rules have numeric weights (1-100):
- **81-100 (brand-critical):** Must follow. Violations are errors.
- **51-80 (strong preference):** Should follow. Violations are warnings.
- **21-50 (flexible):** Recommended. Violations are informational.
- **1-20 (optional):** Nice-to-have. Violations are hints.

When rules conflict, higher weight wins. When weights are equal, the more specific rule wins.

### Validation

After generating HTML or .liquid output, run the appropriate CLI tool:
- `.html` files: `node tools/brand-compliance.cjs <file>`
- `.liquid` files: `node tools/schema-validation.cjs <file>`
- Dimension checks: `node tools/dimension-check.cjs <file> --target <type>`

Fix all errors (weight >= 81) before delivering output.
