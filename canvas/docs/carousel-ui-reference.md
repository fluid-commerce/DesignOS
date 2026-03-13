# Carousel template UI reference

Reference for the carousel behavior used in **t7-carousel.html** and **t8-quarterly-stats.html**.

## Source files

- **Template:** `templates/social/t7-carousel.html` (and t8-quarterly-stats.html)
- **Nav/chrome:** `templates/nav.js` (only runs when not in an iframe)

## Template structure (t7-carousel.html)

- **Canvas:** `.canvas` 1080×1080, `overflow: hidden`.
- **Slides:** `.slide` elements, `position: absolute; inset: 0; display: none`. One has `.active` → `display: block`.
- **Per-slide UI:**
  - `.slide-counter` — top right, e.g. `01/04`, `03/04` (NeueHaas 24px, white).
  - `.slide-label` — top right below counter, vertical text e.g. "Insights" (`writing-mode: vertical-lr`).
- **Controller (inline script):**
  - `window.CAROUSEL_TOTAL`, `window.CAROUSEL_CURRENT`
  - `window.CAROUSEL_PREV()`, `window.CAROUSEL_NEXT()`, `window.CAROUSEL_GO(n)` (n 1-indexed)
  - Listens for `postMessage`: `e.data.type === 'setSlide'` → `go(e.data.slide - 1)`
  - On change calls `window.onCarouselChange(current + 1, total)` if set

## Nav.js carousel UI (when opened standalone, not in iframe)

- **Left/right arrows:** `.nav-slide-arrow`, fixed at `top: 50%`, `left: 16px` / `right: 16px`. 48×48px circle, blue border/color, call `CAROUSEL_PREV` / `CAROUSEL_NEXT` on click.
- **Bottom bar:** Center shows template name + `#carousel-page-indicator` e.g. `03 / 04`. Updated via `onCarouselChange(n, total)`.
- **Top actions:** For carousel templates, adds "← Slide" and "Slide →" buttons that call `CAROUSEL_PREV` / `CAROUSEL_NEXT`.

## Controlling the carousel from the parent (e.g. preview iframe)

Send a postMessage to the iframe:

```js
iframe.contentWindow.postMessage({ type: 'setSlide', slide: 1 }, '*');  // 1-indexed
```

The template’s inline script listens and calls `go(e.data.slide - 1)`.

## Slide counts

- **t7-carousel:** 4 slides (cover, intro text, tool feature, app feature).
- **t8-quarterly-stats:** 4 slides (cover stat, three stats, AI efficiency, outlook).
