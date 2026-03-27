Hand-drawn emphasis elements for words and data points. CSS-mask technique — any color. (weight: 90)

**EMPHASIS ONLY, NOT DECORATIVE** — Every circle/underline must wrap a specific word or data point. White PNG masks + backgroundColor = any color. Never use hue-rotate or tinted PNGs. (weight: 90)

**MINIMUM ONE PER POST** — At least one circle (`circle-1` through `circle-6`) or underline (`underline-1` through `underline-3`) emphasis MUST appear on every social post, wrapping a keyword in the headline or a key stat. (weight: 85)

**PLACEMENT** — Every underline MUST sit directly beneath a specific word or phrase. NEVER place an underline floating in empty space or as a decorative border. The underline's horizontal position must MATCH the text it emphasizes. If no specific word to emphasize, use a brushstroke instead. Color must be the post's accent color. (weight: 90)

**STATIC BY DEFAULT** — For social post images, email graphics, one-pagers, and any static output: just use the mask technique with no animation. Animation is optional and only for interactive contexts (web pages, app UIs). (weight: 75)

## How It Works

White PNG used as CSS `mask-image`. A colored `div` behind the text has its shape cut by the mask. Change `backgroundColor` to change the color. Works in any context.

## Circle Variants (6 masks)

Assets: `circle-1` through `circle-6` — white masks, use as mask-image.

Each has a different hand-drawn style ranging from tight clean ovals to loose rough circles.

## Underline Variants (3 masks)

Assets: `underline-1` through `underline-3` — white masks, use as mask-image.

## Circle Sketches (3 variants)

Assets: `circle-sketch-clean`, `circle-sketch-rough`, `circle-sketch-blue`

Standalone decorative circles (not masks). Used as accent elements behind content.

## Numbered Circles (11 variants)

Assets: `circle-001` through `circle-011`

Pre-rendered circle textures for direct use.

```css
/* Circle emphasis — CSS mask technique */
.circle-emphasis {
  position: absolute;
  background-color: #FF8B58;  /* Change to post accent color */
  -webkit-mask-image: url('/api/brand-assets/serve/circle-1');
  mask-image: url('/api/brand-assets/serve/circle-1');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  z-index: 0;
  pointer-events: none;
}

/* Underline emphasis — same technique */
.underline-emphasis {
  position: absolute;
  background-color: #42b1ff;
  -webkit-mask-image: url('/api/brand-assets/serve/underline-1');
  mask-image: url('/api/brand-assets/serve/underline-1');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  height: 20px;
  bottom: -8px;
  left: -5%;
  right: -5%;
}

/* HTML usage */
<span style="position: relative; display: inline-block;">
  <span style="position: relative; z-index: 1;">KEY WORD</span>
  <div class="circle-emphasis"
       style="inset: -20% -15%; position: absolute;"></div>
</span>
```
