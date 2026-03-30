# Gold Standard Theme Tokens

**Source:** GOLD_STANDARD_WORKFLOW.md + tools/rules.json
**Agent:** Styling agent
**Weight:** 100

---

## CSS Variable Patterns (Weight: 100 -- Gold Standard)

### Color Variables

All colors resolve through CSS custom properties. Use `var(--clr-*)` in inline styles, utility classes in template classes.

| CSS Variable | Utility Class (text) | Utility Class (bg) | Usage |
|-------------|---------------------|--------------------|----|
| `var(--clr-primary)` | `text-primary` | `bg-primary` | Primary brand color |
| `var(--clr-secondary)` | `text-secondary` | `bg-secondary` | Secondary brand color |
| `var(--clr-tertiary)` | `text-tertiary` | `bg-tertiary` | Tertiary brand color |
| `var(--clr-accent)` | `text-accent` | `bg-accent` | Accent highlight |
| `var(--clr-accent-secondary)` | `text-accent-secondary` | `bg-accent-secondary` | Secondary accent |
| `var(--clr-white)` | `text-white` | `bg-white` | White |
| `var(--clr-black)` | `text-black` | `bg-black` | Black |
| `var(--clr-success)` | `text-success` | `bg-success` | Success state |
| `var(--clr-warning)` | `text-warning` | `bg-warning` | Warning state |
| `var(--clr-error)` | `text-error` | `bg-error` | Error state |
| `var(--clr-info)` | `text-info` | `bg-info` | Info state |
| `var(--clr-muted)` | `text-muted` | `bg-muted` | Muted/subdued |
| -- | `text-inherit` | -- | Inherit from parent |
| -- | -- | `bg-neutral` | Neutral background |
| -- | -- | `bg-transparent` | Transparent |

**Total: 13 text colors, 13+ background colors** (bg includes transparent and neutral)

---

### Spacing Variables

| CSS Variable | Utility Class (padding-y) | Utility Class (padding-x) |
|-------------|--------------------------|--------------------------|
| `var(--space-xs)` | `py-xs` / `lg:py-xs` | `px-xs` / `lg:px-xs` |
| `var(--space-sm)` | `py-sm` / `lg:py-sm` | `px-sm` / `lg:px-sm` |
| `var(--space-md)` | `py-md` / `lg:py-md` | `px-md` / `lg:px-md` |
| `var(--space-lg)` | `py-lg` / `lg:py-lg` | `px-lg` / `lg:px-lg` |
| `var(--space-xl)` | `py-xl` / `lg:py-xl` | `px-xl` / `lg:px-xl` |
| `var(--space-2xl)` | `py-2xl` / `lg:py-2xl` | `px-2xl` / `lg:px-2xl` |
| `var(--space-3xl)` | `py-3xl` / `lg:py-3xl` | `px-3xl` / `lg:px-3xl` |

Additional spacing variables confirmed in use:
- `var(--space-4xl)`, `var(--space-5xl)` -- used in section styles.css files

**Total: 7 padding options** for section and container padding selects

---

### Border Radius Variables

| CSS Variable | Utility Class |
|-------------|--------------|
| -- | `rounded-none` |
| `var(--radius-sm)` | `rounded-sm` |
| `var(--radius-default)` | `rounded` |
| `var(--radius-md)` | `rounded-md` |
| `var(--radius-lg)` | `rounded-lg` |
| `var(--radius-xl)` | `rounded-xl` |
| `var(--radius-2xl)` | `rounded-2xl` |
| `var(--radius-3xl)` | `rounded-3xl` |

**Total: 8 border radius options** for section and container border radius selects

---

## Font Size Utility Classes (Weight: 100 -- Gold Standard)

### All 13 Sizes (Mobile)

| Utility Class | Label |
|--------------|-------|
| `text-xs` | XS |
| `text-sm` | SM |
| `text-base` | Base |
| `text-lg` | LG |
| `text-xl` | XL |
| `text-2xl` | 2XL |
| `text-3xl` | 3XL |
| `text-4xl` | 4XL |
| `text-5xl` | 5XL |
| `text-6xl` | 6XL |
| `text-7xl` | 7XL |
| `text-8xl` | 8XL |
| `text-9xl` | 9XL |

### All 13 Sizes (Desktop)

Same 13 sizes with `lg:` prefix: `lg:text-xs` through `lg:text-9xl`

---

## Font Weight Utility Classes (Weight: 100 -- Gold Standard)

### All 5 Weights

| Utility Class | Label |
|--------------|-------|
| `font-light` | Light |
| `font-normal` | Normal |
| `font-medium` | Medium |
| `font-semibold` | Semibold |
| `font-bold` | Bold |

**NOTE:** `font-black` exists in the theme system (used by existing non-Gold-Standard sections) but is NOT part of the Gold Standard spec. Do not include it.

---

## Font Family Utility Classes (Weight: 100 -- Gold Standard)

### All 4 Families

| Utility Class | Label | Website Font |
|--------------|-------|-------------|
| `font-primary` | Primary | NeueHaas |
| `font-body` | Body | Inter |
| `font-handwritten` | Handwritten | -- |
| `font-serif` | Serif | -- |

**Context matters:** These are semantic family names. The actual fonts they resolve to depend on the theme's configuration. For Fluid's theme, `font-primary` maps to NeueHaas and `font-body` maps to Inter.

**Social vs Website fonts (Weight: 85 rule from rules.json):**
- All deliverables: FLFont (taglines) + NeueHaas (headlines, weight 900) + Inter (body, weight 300-400)

---

## No-Hardcode Rules (Weight: 100 -- Gold Standard)

### NEVER hard-code these values:

| What | Bad | Good |
|------|-----|------|
| Colors | `#e6ea00` | `var(--clr-secondary)` or `text-secondary` class |
| Border radius | `13px` | `var(--radius-lg)` or `rounded-lg` class |
| Spacing | `24px` | `var(--space-lg)` or `py-lg` class |
| Font size | `16px` or `1rem` | `text-base` class |
| Font weight | `700` | `font-bold` class |
| Font family | `"NeueHaas", sans-serif` | `font-primary` class |

### Where to use CSS variables vs utility classes:

- **In template HTML attributes:** Use utility classes (`class="text-primary bg-neutral py-xl"`)
- **In styles.css:** Use CSS variables (`gap: var(--space-lg);`, `color: var(--clr-primary);`)
- **In inline styles:** Use CSS variables (avoid inline styles, but if needed: `style="color: var(--clr-primary)"`)

---

## All 13 Color Names (from rules.json)

### Text Colors
```
text-primary
text-secondary
text-tertiary
text-accent
text-accent-secondary
text-white
text-black
text-success
text-warning
text-error
text-info
text-muted
text-inherit
```

### Background Colors
```
bg-primary
bg-secondary
bg-tertiary
bg-accent
bg-accent-secondary
bg-white
bg-black
bg-success
bg-warning
bg-error
bg-info
bg-muted
bg-neutral
bg-transparent
```

---

## All 13 Size Names (from rules.json)

```
text-xs
text-sm
text-base
text-lg
text-xl
text-2xl
text-3xl
text-4xl
text-5xl
text-6xl
text-7xl
text-8xl
text-9xl
```

Desktop variants: same with `lg:` prefix.

---

## All 5 Weight Names (from rules.json)

```
font-light
font-normal
font-medium
font-semibold
font-bold
```

---

## Layout Utility Classes (confirmed from existing sections)

These Tailwind-like layout utilities are used in existing sections:

| Class | Purpose |
|-------|---------|
| `container` | Max-width centered container |
| `max-w-4xl` | Max width constraint |
| `mx-auto` | Horizontal centering |
| `text-center` | Center text alignment |
| `flex` | Flexbox display |
| `items-center` | Vertical centering (flex) |
| `justify-center` | Horizontal centering (flex) |
| `space-y-4xl` | Vertical spacing between children |
| `mb-2xl`, `mb-lg`, `mb-md` | Bottom margin |
| `leading-tight` | Tight line height (headings) |
| `leading-relaxed` | Relaxed line height (body) |
| `w-full`, `h-full` | Full width/height |
| `w-12`, `h-12` | Fixed 3rem size |
| `object-cover` | Image cover fit |
| `overflow-hidden` | Hide overflow |

---

## Z-Index Variables

| Variable | Purpose |
|----------|---------|
| `var(--z-10)` | Content z-index (above background, below overlays) |

---

## Empirical Context

From `EMPIRICAL-FINDINGS.md`:

- CSS custom properties (`--clr-*`, `--space-*`, `--radius-*`) are populated per theme. The exact injection mechanism (inline style block or generated stylesheet) was not found in the backend code but is handled by the theme renderer.
- The `_classes.scss` in the backend defines a LIMITED set of utility classes (4 bg colors, 4 border colors). The full set (13 colors, 13 sizes, etc.) comes from the frontend theme CSS layer.
- Existing sections confirm all these utility classes work at runtime by using them in templates.

---

## Cross-References

- [[schema-rules.md]] -- Where these tokens are used in schema option lists
- [[button-system.md]] -- Button-specific color and size tokens
- [[template-patterns.md]] -- How to apply tokens in Liquid templates
- [[validation-checklist.md]] -- Validation checks for token usage
- [[EMPIRICAL-FINDINGS.md]] -- How CSS variables resolve in the rendering pipeline
- `tools/rules.json` -- Compiled source of truth for all option values
- `tools/brand-compliance.cjs` -- Validates no hard-coded values
