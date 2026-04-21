# Archetype Format Specification v1.0

This document is the authoritative reference for implementing archetypes. Phase 19 implementers should follow this spec without consulting any other document for format decisions.

---

## Section 1: Overview

An archetype is a **brandless structural layout pattern** for social media content. Each archetype captures the layout intent of a post type (stat-heavy, testimonial, problem-first, etc.) without any brand expression.

**Each archetype = one directory under `archetypes/` containing exactly 3 files:**

```
archetypes/{archetype-slug}/
├── index.html    # Brandless structural skeleton (renderable in browser)
├── schema.json   # SlotSchema definition
└── README.md     # Purpose, structural pattern, when to use
```

**Core principle:** Archetypes define CONTENT LAYOUT ONLY. Decorative elements (brushstrokes, textures, circle sketches) are brand-defined and injected at generation time by the pipeline. The archetype skeleton is fully renderable without any brand assets — it shows layout structure with placeholder text and neutral styling.

---

## Section 2: File Structure

### `index.html` — Structural Skeleton

A self-contained, renderable HTML file. Purpose: show the content layout structure with realistic placeholder text and neutral styling.

Requirements:
- Renders in a browser at the exact target dimensions
- Uses placeholder text in all content elements (never empty divs)
- Uses neutral styling: grayscale, `font-family: sans-serif`, no brand URLs
- Contains `<!-- SLOT: {class-name} -->` HTML comments before each content element
- Contains `.background-layer` and `.foreground-layer` divs for brand decorative injection
- All CSS in a single `<style>` block in `<head>` — no inline styles, no external stylesheets

### `schema.json` — SlotSchema Definition

A JSON file matching the `SlotSchema` TypeScript interface from `canvas/src/lib/slot-schema.ts` exactly.

Requirements:
- Contains `archetypeId` field (not `templateId`)
- Contains `width`, `height`, and `fields` array
- `brush` is always `null`
- Every `sel` value in `fields` has a matching CSS class in `index.html`

### `README.md` — Archetype Documentation

Covers:
1. **What it is** — one-sentence description of the layout pattern
2. **Structural pattern** — describe the visual hierarchy (e.g., "dominant stat number anchors the layout, supporting text descends below")
3. **Content type fit** — what kinds of posts this archetype is designed for
4. **When to use** — specific scenarios where this layout excels
5. **When NOT to use** — cases where another archetype is better
6. **Components** — list of design components (from `archetypes/components/`) this archetype composes

---

## Section 3: HTML Conventions

### Document Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    /* All CSS here — no external stylesheets, no inline styles */
  </style>
</head>
<body>
  <!-- BACKGROUND LAYER: brand fills with textures, brushstrokes -->
  <div class="background-layer"></div>

  <!-- SLOT: {first-content-class} -->
  <div class="{first-content-class}">Placeholder text</div>
  <!-- SLOT: {second-content-class} -->
  ...

  <!-- FOREGROUND LAYER: brand fills with borders (footer, header, etc.) -->
  <div class="foreground-layer"></div>
</body>
</html>
```

### Body Dimensions

```css
body {
  width: 1080px;   /* or target platform width */
  height: 1080px;  /* or target platform height */
  overflow: hidden;
  position: relative;
  margin: 0;
  padding: 0;
  font-family: sans-serif;   /* brand font injected at generation */
  background: #111;           /* neutral dark — brand background applied at generation */
}
```

Target dimensions by platform:
- Instagram Square: `1080 × 1080`
- LinkedIn Landscape: `1200 × 627`

### Background / Foreground Layers

Every archetype has two injection layers that bracket the content:

- `.background-layer` — first element in `<body>`, sits **behind** content (`z-index: 0`). The pipeline injects textures, brushstrokes, gradient washes, and background imagery here.
- `.foreground-layer` — last element in `<body>`, sits **in front of** content (`z-index: 10`). The pipeline injects borders, frames, header/footer bars, and watermarks here.

```html
<body>
  <!-- BACKGROUND LAYER: brand fills with textures, brushstrokes -->
  <div class="background-layer"></div>

  <!-- ... content elements (z-index: 2) ... -->

  <!-- FOREGROUND LAYER: brand fills with borders (footer, header, etc.) -->
  <div class="foreground-layer"></div>
</body>
```

With corresponding CSS:

```css
.background-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.foreground-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}
```

Archetypes must NOT include any decorative CSS — both layers stay empty in the archetype skeleton. All content elements use `z-index: 2`, placing them between the two layers.

### Content Element Rules

All content elements:
- Use `position: absolute` with explicit `px` values (no `%` for positioning in archetypes)
- Have a unique CSS class matching the `sel` value in `schema.json`
- Must contain placeholder text — never empty (prevents layout collapse, helps implementers see the layout)
- Carry a `<!-- SLOT: {class-name} -->` HTML comment immediately before the element

### Color Convention

Use this neutral color scheme (brand colors applied at generation):

```css
/* Primary text */
color: #ffffff;

/* Secondary / body text */
color: rgba(255, 255, 255, 0.45);

/* Tertiary labels */
color: rgba(255, 255, 255, 0.5);
```

Do NOT use brand-specific hex values in archetype HTML.

### Typography Convention

```css
font-family: sans-serif;   /* Brand font family injected at generation */
font-weight: 700;           /* Bold for headlines — numeric weights preferred */
font-weight: 400;           /* Regular for body copy */
```

Do NOT use named weights like `font-weight: bold` — always numeric.

---

## Section 4: schema.json Rules

### Required Shape

The `schema.json` must match the `SlotSchema` interface from `canvas/src/lib/slot-schema.ts`:

```typescript
export interface SlotSchema {
  templateId?: string;          // DO NOT USE — use archetypeId instead
  width: number;
  height: number;
  fields: SlotField[];
  brush?: string | null;        // MUST be null for archetypes
  brushLabel?: string;          // omit for archetypes
  brushAdditional?: ...;        // omit for archetypes
  carouselCount?: number;       // omit for single-frame archetypes
}
```

### archetypeId Field

Use `archetypeId` (not `templateId`). This distinction is critical:

- `templateId` keys into the `TEMPLATE_SCHEMAS` map in `canvas/src/lib/template-configs.ts`
- If a schema has `templateId`, `resolveSlotSchemaForIteration()` may resolve it against the wrong template config
- `archetypeId` is metadata-only — it identifies the archetype for logging/debugging but does not trigger template resolution

```json
{
  "archetypeId": "stat-hero-single",
  "width": 1080,
  "height": 1080,
  ...
}
```

### brush: null

The `brush` field MUST be `null` for all archetypes. Decorative brush selectors are brand-defined and merged by the pipeline at generation time.

```json
"brush": null
```

### Field Types

Each field in `fields` follows one of these shapes:

**Text field:**
```json
{
  "type": "text",
  "sel": ".headline",
  "label": "Headline",
  "mode": "text",
  "rows": 2
}
```

- `mode`: `"text"` (single-line feel), `"pre"` (multi-line preserving whitespace), `"br"` (line breaks)
- `rows`: textarea height hint — 1 for short labels, 2 for headlines, 4–5 for body copy

**Image field:**
```json
{
  "type": "image",
  "sel": ".photo img",
  "label": "Portrait Photo",
  "dims": "353 x 439px"
}
```

- `sel`: use `.{container} img` pattern (e.g., `.photo img`) so `imageLayoutSel()` derives `.photo` as the draggable frame
- `frameSel`: optional explicit frame selector — only needed when the auto-derivation from `sel` would produce the wrong element
- `dims`: display dimension hint for the editor sidebar

**Divider field (carousel only):**
```json
{
  "type": "divider",
  "label": "Slide 01 — Cover"
}
```

For single-frame archetypes, never use `"type": "divider"`.

### Full JSON Example: `stat-hero-single`

```json
{
  "archetypeId": "stat-hero-single",
  "width": 1080,
  "height": 1080,
  "fields": [
    { "type": "text", "sel": ".category span", "label": "Side Label",    "mode": "text", "rows": 1 },
    { "type": "text", "sel": ".context-label", "label": "Context Label", "mode": "text", "rows": 1 },
    { "type": "text", "sel": ".stat-number",   "label": "Stat Value",    "mode": "text", "rows": 1 },
    { "type": "text", "sel": ".headline",      "label": "Headline",      "mode": "text", "rows": 2 },
    { "type": "text", "sel": ".body-copy",     "label": "Body Copy",     "mode": "pre",  "rows": 4 }
  ],
  "brush": null
}
```

---

## Section 5: Content/Decorative Split

This split is the fundamental design principle of the archetype system.

### Content (archetype-defined)

Everything that carries meaning for a specific post:

| Category | Examples |
|----------|---------|
| Text blocks | Headlines, body copy, stat values, labels, attribution, CTAs |
| Image blocks | Portrait photos, product mockups, screenshots, logos |
| Layout structure | Positioning, sizing, z-ordering of content zones |

### Decorative (brand-defined, injected at generation)

Everything that expresses visual brand identity:

| Category | Examples |
|----------|---------|
| Brushstrokes | Ink washes, paint textures applied as overlays |
| Circle sketches | Hand-drawn circle emphasis elements |
| Background elements | Gradients, color fills, texture overlays |
| Brand marks | Watermarks, logo placements |

### Generation Time Injection Sequence

At generation time, the creative agent follows this sequence for archetypes:

1. **Read** `archetypes/{slug}/index.html` as the structural skeleton (via `read_archetype`)
2. **Read** `archetypes/{slug}/schema.json` for content field definitions
3. **Inject** brand decorative elements into `.background-layer` (textures, brushstrokes) and `.foreground-layer` (borders, frames) in the HTML
4. **Apply** brand fonts, colors, and background styling to content elements
5. **Merge** brand `brush` / `brushAdditional` fields into the final iteration SlotSchema (overriding the archetype's `null` value)
6. **Write** final renderable HTML + final SlotSchema to the iteration record (via `save_creation`)

The final SlotSchema that reaches the editor sidebar is the *merged* schema — it has all archetype content fields plus brand brush fields. This is the editor sidebar parity guarantee: template-based and archetype-based iterations both produce a complete SlotSchema with content + decorative transform targets.

---

## Section 6: CSS Selector Convention

### Use Flat Class Selectors

```css
/* Good — flat, readable */
.headline { ... }
.stat-number { ... }
.body-copy { ... }

/* Avoid — nested, fragile */
.content > .text-zone .headline { ... }
```

### Image Container Pattern

For image fields, use a container div + `img` pattern:

```html
<!-- SLOT: photo -->
<div class="photo">
  <img src="data:image/png;base64,..." alt="">
</div>
```

```json
{ "type": "image", "sel": ".photo img", "label": "Portrait Photo", "dims": "353 x 439px" }
```

The `.photo img` selector pattern allows `imageLayoutSel()` in `slot-schema.ts` to automatically derive `.photo` as the draggable frame target (the whole div moves when repositioning, not just the `<img>` element).

For placeholder images in archetype HTML, use a 1x1 pixel base64 PNG or a neutral solid-color SVG — not external URLs.

### SLOT Comments

Every content element must have a `<!-- SLOT: {class} -->` comment immediately before it:

```html
<!-- SLOT: headline -->
<div class="headline">YOUR HEADLINE HERE</div>

<!-- SLOT: stat-number -->
<div class="stat-number">94%</div>
```

The comment class name must match the CSS selector class (without the `.` prefix).

### What NOT to Use

- **No `data-slide` prefixes** — those are for carousel templates only (see `t7-carousel` and `t8-quarterly-stats` in `template-configs.ts`)
- **No BEM** — avoid `.block__element--modifier` naming
- **No utility classes** — avoid Tailwind-style class names
- **No CSS frameworks** — plain semantic class names only

---

## Section 7: Compatibility Checklist

Every archetype must pass all checks before being merged:

- [ ] `schema.json` parses as valid JSON (use `JSON.parse()` — no trailing commas)
- [ ] `schema.json` has `archetypeId` (string), `width` (number), `height` (number), `fields` (array), `brush: null`
- [ ] `schema.json` does NOT have a `templateId` field
- [ ] Every `field.sel` in `schema.json` has a matching CSS class in `index.html`
- [ ] Every `<!-- SLOT: -->` comment in `index.html` has a matching field in `schema.json`
- [ ] `index.html` renders in a browser at the target dimensions showing placeholder content
- [ ] `collectTransformTargets(schema)` produces a valid `TransformTarget[]` with correct kinds — run manually or write a one-line test
- [ ] No brand asset URLs in `index.html` (no external image URLs, no `/fluid-assets/` paths)
- [ ] No inline styles in `index.html` (all styling in `<style>` block)
- [ ] All content elements have placeholder text (not empty)
- [ ] `.background-layer` div present at top of `<body>` and `.foreground-layer` div present at bottom of `<body>`
- [ ] Placeholder images use base64 or SVG data URIs — no external URLs

### Quick collectTransformTargets Verification

Run this in Node.js against your `schema.json`:

```js
const schema = JSON.parse(require('fs').readFileSync('schema.json', 'utf8'));
// Manually simulate collectTransformTargets logic:
const targets = schema.fields
  .filter(f => f.type === 'text' || f.type === 'image')
  .map(f => ({ sel: f.sel, label: f.label, kind: f.type }));
console.log('Transform targets:', targets);
// Check: no undefined sel, no empty label, correct kinds
```

---

## Section 8: Anti-Patterns

These are patterns found in existing templates that MUST NOT appear in archetypes:

### No Brand Asset URLs

```html
<!-- WRONG — brand-specific URL -->
<img src="/fluid-assets/portrait.jpg">
<img src="https://cdn.example.com/photo.jpg">

<!-- CORRECT — base64 placeholder -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="">
```

### No templateId in schema.json

```json
// WRONG — templateId causes incorrect resolution in resolveSlotSchemaForIteration()
{ "templateId": "stat-hero-single", ... }

// CORRECT
{ "archetypeId": "stat-hero-single", ... }
```

### No Decorative CSS in Archetype Stylesheets

```css
/* WRONG — decorative elements belong to brand layer */
.brushstroke { ... }
.circle-sketch { ... }
.texture-overlay { ... }
.background-gradient { ... }

/* CORRECT — layers stay unstyled in archetypes */
.background-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.foreground-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}
```

### No Empty Structural Markup

```html
<!-- WRONG — empty divs prevent layout preview -->
<div class="headline"></div>
<div class="stat-number"></div>

<!-- CORRECT — realistic placeholder text -->
<div class="headline">YOUR HEADLINE HERE</div>
<div class="stat-number">94%</div>
```

### No Overly Atomic Components

```
// WRONG — single text label is not a design component
components/category-label/

// CORRECT — multi-field functional block
components/stat-card/           # stat-value + label + context-note (3 fields)
components/testimonial-block/   # quote + name + title (3 fields)
```

---

## Section 9: Platform Dimensions Reference

| Platform | Width (px) | Height (px) | Phase |
|----------|------------|-------------|-------|
| Instagram Square | 1080 | 1080 | 19 |
| LinkedIn Landscape | 1200 | 627 | 21 |
| One-Pager (US Letter) | 612 | 792 | 21 |

**Phase 19 scope:** Instagram Square only (`1080 × 1080`). LinkedIn and One-Pager archetypes are Phase 21.

All Phase 19 archetypes MUST use `"width": 1080, "height": 1080` in `schema.json` and `width: 1080px; height: 1080px` on `body` in `index.html`.

---

## Appendix: Key File References

| File | Purpose |
|------|---------|
| `canvas/src/lib/slot-schema.ts` | Authoritative SlotSchema TypeScript interface and `collectTransformTargets()` function |
| `canvas/src/lib/template-configs.ts` | 8 existing template configs — reference for CSS selector conventions and field patterns |
| `canvas/src/server/agent.ts` | Creative agent loop — where archetype selection happens via `list_archetypes` / `read_archetype` tools |
| `canvas/src/server/agent-tools.ts` | Tool implementations (including archetype tools) |
| `archetypes/components/README.md` | Component library conventions |
| `Reference/Archetype Research/README.md` | Research methodology and curation criteria |
