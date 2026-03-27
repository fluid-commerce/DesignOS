The handwritten font for the takeaway line. Confidence and personality. (weight: 90)

## Size Guide

| Platform | Size Range | Example |
|----------|-----------|---------|
| Instagram primary | 36-48px | "Every transaction matters." |
| Instagram secondary | 28-36px | "One connection. Zero 3am calls." |
| LinkedIn | 28-32px | "One platform. Every transaction." |

FLFont tagline must be VISUALLY PROMINENT — it is the signature element of the brand. If it reads as fine print, it is too small. (weight: 85)

## Tagline Sentence Patterns

| Pattern | Example |
|---------|---------|
| [benefit]. [contrast]. | "One connection. Zero 3am calls." |
| [declaration]. | "Every transaction matters." |
| [scope]. [claim]. | "One platform. Every transaction." |

## Placement Rules

- Below headline or bottom of content, before footer (weight: 80)
- **Never** inside the headline itself
- Color: always the post's accent color
- Sentence case (NOT uppercase)

```css
/* FLFont Tagline Rules:
   - Taglines and emphasis ONLY, never body/headlines (Weight: 90)
   - Below headline, before footer (Weight: 80)
   - Instagram: 36-48px, LinkedIn: 28-32px
   - Color: post accent color
*/

.tagline {
  font-family: 'flfontbold', cursive;
  font-size: 40px;        /* Instagram: 36-48px */
  color: #FF8B58;          /* Replace with post accent color */
  line-height: 1.3;
  margin-top: 16px;
}
```

```html
<p class="tagline">Every transaction matters.</p>
```
