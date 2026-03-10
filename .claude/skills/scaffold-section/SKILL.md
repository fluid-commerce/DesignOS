---
name: scaffold-section
description: "Generate a Gold Standard .liquid section skeleton with pre-filled schema. Use when creating a new website section."
user-invocable: true
invoke: slash
---

# Scaffold Section

Generate a Gold Standard .liquid section skeleton with pre-filled schema and content slot markers.

## Usage

```bash
node tools/scaffold.cjs <section-name>
```

Example:
```bash
node tools/scaffold.cjs hero-banner
```

## Output Structure

The scaffold generates a `.liquid` file with:

1. **Schema block** — Pre-filled with Gold Standard required settings:
   - Section name and class
   - Color scheme picker
   - Padding top/bottom controls
   - Content-for-header flag
   - Block types with presets

2. **Content slots** — Marked with `<!-- SLOT: slot-name -->` comments where you insert custom content:
   - `<!-- SLOT: heading -->` — Section heading
   - `<!-- SLOT: body -->` — Main content area
   - `<!-- SLOT: media -->` — Image/video placement
   - `<!-- SLOT: cta -->` — Call-to-action buttons

3. **CSS stub** — Scoped styles using section ID with brand token variables

## After Scaffolding

1. Fill in content slots with brand-compliant markup
2. Customize schema settings for section-specific needs
3. Run validation: `node tools/schema-validation.cjs <output-file>`
4. The scaffold passes schema validation from the start — your customizations should too

## Reference

See `brand/website-section-specs.md` for Gold Standard rules and `patterns/index.html` for building block code.
