# Design Components — Inline Pattern Library

This file is the **copy-paste reference** for building Instagram archetype HTML/CSS. Each component section includes:
1. Purpose and archetype usage
2. HTML snippet with placeholder content
3. CSS rules (positioned for a 1080×1080 canvas)
4. Corresponding SlotSchema field definition

**Key rule:** Components are patterns, not runtime includes. Copy the markup structure and CSS into your archetype's `index.html` and `<style>` block directly. There is no import or partial system.

---

## What is a Component?

A design component is a mid-level functional block — a meaningful content unit that appears in multiple archetype layouts. Components sit between atomic elements (a text label) and full archetypes (a complete 1080×1080 layout).

**A component is independently meaningful to a user.** "Add a stat card" makes sense. "Add a text label" does not.

---

## Component Index

| Component | Used by archetypes |
|-----------|-------------------|
| stat-card | hero-stat, data-dashboard |
| image-block | photo-bg-overlay, split-photo-text, quote-testimonial |
| quote-block | quote-testimonial |
| headline-block | hero-stat, photo-bg-overlay, split-photo-text, minimal-statement, data-dashboard |
| subtext-block | hero-stat, photo-bg-overlay, minimal-statement |
| body-copy-block | split-photo-text |
| attribution-block | quote-testimonial, split-photo-text |
| portrait-block | quote-testimonial |
| footnote-block | data-dashboard |
| decorative-zone | All archetypes |
| divider | data-dashboard |

---

## 1. stat-card

**Purpose:** Large stat number + supporting label. The primary pattern for posts that lead with a compelling metric.

**Used by:** hero-stat, data-dashboard

**HTML:**

```html
<!-- SLOT: stat-number -->
<div class="stat-number">94%</div>

<!-- SLOT: stat-label -->
<div class="stat-label">Approval rate across all PSPs</div>
```

**CSS:**

```css
.stat-number {
  position: absolute;
  top: 280px;
  left: 68px;
  font-family: sans-serif;
  font-size: 260px;
  font-weight: 900;
  line-height: 0.85;
  color: #ffffff;
}

.stat-label {
  position: absolute;
  top: 570px;
  left: 68px;
  font-family: sans-serif;
  font-size: 28px;
  font-weight: 400;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.45);
  max-width: 700px;
}
```

**SlotSchema fields:**

```json
{ "type": "text", "sel": ".stat-number", "label": "Stat Value",  "mode": "text", "rows": 1 },
{ "type": "text", "sel": ".stat-label",  "label": "Stat Label",  "mode": "text", "rows": 2 }
```

---

## 2. image-block

**Purpose:** Photo container with `<img>` element. Supports full-bleed and partial-fill layouts.

**Used by:** photo-bg-overlay, split-photo-text, quote-testimonial

**HTML:**

```html
<!-- SLOT: photo -->
<div class="photo">
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="">
</div>
```

**CSS (full-bleed variant — photo-bg-overlay):**

```css
.photo {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

**CSS (half-width variant — split-photo-text):**

```css
.photo {
  position: absolute;
  top: 0;
  left: 0;
  width: 540px;
  height: 1080px;
  overflow: hidden;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

**SlotSchema field:**

```json
{ "type": "image", "sel": ".photo img", "label": "Photo", "dims": "1080 x 1080px" }
```

---

## 3. quote-block

**Purpose:** Styled quotation text. Multi-line, italic or bold emphasis.

**Used by:** quote-testimonial

**HTML:**

```html
<!-- SLOT: quote-text -->
<div class="quote-text">"This changed how we think about payment reliability entirely."</div>
```

**CSS:**

```css
.quote-text {
  position: absolute;
  top: 300px;
  left: 68px;
  right: 68px;
  font-family: sans-serif;
  font-size: 48px;
  font-weight: 700;
  font-style: italic;
  line-height: 1.3;
  color: #ffffff;
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".quote-text", "label": "Quote", "mode": "pre", "rows": 5 }
```

---

## 4. headline-block

**Purpose:** Primary headline text. The dominant typographic element in non-stat layouts.

**Used by:** hero-stat, photo-bg-overlay, split-photo-text, minimal-statement, data-dashboard

**HTML:**

```html
<!-- SLOT: headline -->
<div class="headline">Headline goes here</div>
```

**CSS:**

```css
.headline {
  position: absolute;
  top: 400px;
  left: 68px;
  right: 68px;
  font-family: sans-serif;
  font-size: 82px;
  font-weight: 900;
  line-height: 0.95;
  color: #ffffff;
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".headline", "label": "Headline", "mode": "pre", "rows": 3 }
```

---

## 5. subtext-block

**Purpose:** Supporting copy below a stat or headline. Short explanatory sentences.

**Used by:** hero-stat, photo-bg-overlay, minimal-statement

**HTML:**

```html
<!-- SLOT: subtext -->
<div class="subtext">Supporting context that explains what the number means and why it matters.</div>
```

**CSS:**

```css
.subtext {
  position: absolute;
  top: 680px;
  left: 68px;
  right: 68px;
  font-family: sans-serif;
  font-size: 28px;
  font-weight: 400;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".subtext", "label": "Supporting Text", "mode": "pre", "rows": 4 }
```

---

## 6. body-copy-block

**Purpose:** Longer body text for split layouts where the text column has more room.

**Used by:** split-photo-text

**HTML:**

```html
<!-- SLOT: body-copy -->
<div class="body-copy">Body copy goes here. Two to three sentences that explain the content in detail and give readers enough context to understand the significance.</div>
```

**CSS:**

```css
.body-copy {
  position: absolute;
  top: 500px;
  left: 580px;
  right: 68px;
  font-family: sans-serif;
  font-size: 24px;
  font-weight: 400;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.45);
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".body-copy", "label": "Body Copy", "mode": "pre", "rows": 5 }
```

---

## 7. attribution-block

**Purpose:** Name and title/role for testimonials and split layouts.

**Used by:** quote-testimonial, split-photo-text

**HTML:**

```html
<!-- SLOT: attribution -->
<div class="attribution">Jane Smith
Head of Engineering</div>
```

**CSS:**

```css
.attribution {
  position: absolute;
  top: 820px;
  left: 68px;
  font-family: sans-serif;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-line;
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".attribution", "label": "Attribution", "mode": "pre", "rows": 2 }
```

---

## 8. portrait-block

**Purpose:** Circular portrait image. Used in testimonial and quote layouts.

**Used by:** quote-testimonial

**HTML:**

```html
<!-- SLOT: portrait -->
<div class="portrait">
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="">
</div>
```

**CSS:**

```css
.portrait {
  position: absolute;
  top: 780px;
  left: 68px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

**SlotSchema field:**

```json
{ "type": "image", "sel": ".portrait img", "label": "Portrait Photo", "dims": "120 x 120px" }
```

---

## 9. footnote-block

**Purpose:** Small context or source attribution at the bottom of data-heavy layouts.

**Used by:** data-dashboard

**HTML:**

```html
<!-- SLOT: footnote -->
<div class="footnote">Source: Internal analytics, Q4 2024 • All metrics verified</div>
```

**CSS:**

```css
.footnote {
  position: absolute;
  bottom: 60px;
  left: 68px;
  right: 68px;
  font-family: sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.35);
}
```

**SlotSchema field:**

```json
{ "type": "text", "sel": ".footnote", "label": "Footnote", "mode": "pre", "rows": 2 }
```

---

## 10. decorative-zone

**Purpose:** Empty container for brand decorative injection. Present in ALL archetypes. The pipeline injects brushstrokes, textures, and circle elements into this div at generation time.

**Used by:** All archetypes

**HTML (always the first element inside `<body>`):**

```html
<div class="decorative-zone"></div>
```

**CSS:**

```css
.decorative-zone {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
```

**No SlotSchema field.** This zone is filled by the pipeline, not by the editor.

---

## 11. divider

**Purpose:** Visual separator between data rows in multi-stat layouts.

**Used by:** data-dashboard

**HTML:**

```html
<div class="divider"></div>
```

**CSS:**

```css
.divider {
  position: absolute;
  left: 68px;
  right: 68px;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}
```

**SlotSchema field:**

```json
{ "type": "divider", "label": "Section Break" }
```

---

## Future Components

The following components from the roadmap are not used by any of the 6 Phase 19 Instagram archetypes. They are listed here for Phase 21+ implementation reference.

| Component | Description |
|-----------|-------------|
| chart-bar | Horizontal bar chart for comparison layouts |
| metric-row | Compact stat + label row for dense dashboards |
| cta-pill | Pill-shaped call-to-action button element |
| event-details | Date + time + location block for event posts |
| badge | Icon + label badge (e.g., "Award Winner") |
| logo-lockup | Company logo + name treatment |
| product-shot-frame | Product mockup frame with device or print context |

---

## Conventions Summary

- All content elements use `position: absolute` with explicit `px` values
- Default left/right margin: `68px` from canvas edge
- Neutral text colors: `#ffffff` (primary), `rgba(255,255,255,0.45)` (secondary)
- `font-family: sans-serif` — brand font applied at generation time
- Numeric font weights only (`700`, `900`) — no named weights like `bold`
- Placeholder images use base64 data URIs — no external URLs
- `.decorative-zone` is always the first element in `<body>`, always unstyled beyond `position: absolute; inset: 0`
