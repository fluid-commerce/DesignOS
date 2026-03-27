Decorative typography treatments for visual interest and brand consistency. (weight: 80)

## Opening Quote Marks (weight: 80)

For quote/testimonial archetypes, the opening quote mark is a DESIGN ELEMENT, not just punctuation:
- Font: NeueHaas Black (900)
- Size: 200-280px
- Color: accent color at 25-35% opacity (NOT 4-10% — must be visible)
- Position: absolute, partially behind the quote text
- z-index: below the quote text so text reads on top

```css
.quote-mark {
  font-family: 'NeueHaas', sans-serif;
  font-weight: 900;
  font-size: 240px;
  color: var(--accent);
  opacity: 0.3;
  position: absolute;
  top: -40px;
  left: -20px;
  z-index: 0;
  pointer-events: none;
  line-height: 1;
}
```

## Logo Over Text Rule (weight: 80)

When referring to WeCommerce, Fluid, or any brand entity, ALWAYS prefer the logo asset over spelling out the name in text. Logo assets: `wecommerce-flags`, `wecommerce-logos`, `frame-3-fluid-dots`. Logo minimum height: 40px in body content, 18px in footer.
