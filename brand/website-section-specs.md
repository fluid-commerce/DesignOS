# Website Section Specs — Website Agent Context

> Weight thresholds: 1-20 optional | 21-50 flexible | 51-80 strong preference | 81-100 brand-critical

## Gold Standard Schema Rules (Weight: 100)

Every .liquid section must be Gold Standard compliant from day one. No partial schemas, no hard-coded values. See the full workflow in Reference/Brand reference material/Website/Gold Standard/GOLD_STANDARD_WORKFLOW.md.

### Text Element Settings (Weight: 100)

Every text element requires exactly 6 settings:
1. Content field (text, textarea, richtext)
2. Font family — 4 options: primary, body, handwritten, serif (Weight: 95)
3. Font size mobile — 13 options: text-xs through text-9xl (Weight: 100)
4. Font size desktop — 13 options: lg:text-xs through lg:text-9xl (Weight: 100)
5. Font weight — 5 options: light, normal, medium, semibold, bold (Weight: 95)
6. Color — 13 semantic color options (Weight: 100)

### Button System (Weight: 95)

Every button requires exactly 7 settings:
1. `show_button` — checkbox toggle
2. `button_text` — text
3. `button_url` — url
4. `button_style` — 3 options: filled, outline, ghost
5. `button_color` — 10 options: primary through white
6. `button_size` — 5 options: btn-xs through btn-xl
7. `button_font_weight` — 5 options: light through bold

Button implementation pattern (always use `btn` utility class):
```liquid
{% if section.settings.show_button %}
<a href="{{ section.settings.button_url | default: '#' }}"
   class="btn btn-{{ section.settings.button_style | default: 'filled' }}-{{ section.settings.button_color | default: 'primary' }} {{ section.settings.button_size | default: 'btn-md' }} {{ section.settings.button_font_weight | default: 'font-medium' }} {{ settings.button_border_radius | default: 'rounded' }}">
  {{ section.settings.button_text | default: 'Click Here' }}
</a>
{% endif %}
```

### Section Settings (Weight: 90)

5 required settings per section:
1. `background_color` — 13 semantic color options
2. `background_image` — image_picker
3. `section_padding_y_mobile` — 7 options: py-xs through py-3xl
4. `section_padding_y_desktop` — 7 options: lg:py-xs through lg:py-3xl
5. `section_border_radius` — 8 options: rounded-none through rounded-3xl

### Container Settings (Weight: 90)

7 required settings per container:
1. `container_background_color` — 13 options + transparent
2. `container_background_image` — image_picker
3. `container_border_radius` — 8 options
4. `container_padding_y_mobile` — 7 options
5. `container_padding_y_desktop` — 7 options
6. `container_padding_x_mobile` — 7 options
7. `container_padding_x_desktop` — 7 options

## No Hard-Coded Values (Weight: 100)

This is the single most important rule for website sections:
- No hard-coded colors — use `var(--clr-*)` or semantic classes
- No hard-coded border radius — use `var(--radius-*)`
- No hard-coded spacing — use `var(--space-*)`
- No custom button styles — use `btn btn-{style}-{color}` class system
- All blocks must include `{{ block.fluid_attributes }}`
- All images must have placeholder fallbacks

## Schema Settings Order (Weight: 85)

Settings must be ordered: Content -> Interactive -> Layout -> Container. Content fields immediately followed by their styling settings (font family, size, weight, color).

## Default Values (Weight: 75)

| Setting | Default |
|---------|---------|
| Section background | `bg-neutral` |
| Text color | `text-primary` |
| Button size | `btn-md` |
| Button font weight | `font-medium` |
| Section padding | `py-xl` (mobile), `lg:py-3xl` (desktop) |
| Heading | `text-3xl` (mobile), `lg:text-4xl` (desktop), `font-bold` |
| Body | `text-base` (mobile), `lg:text-lg` (desktop), `font-normal` |

## Website Visual Language (Weight: 80)

Key visual elements from the build prompt:
- **Paint-stroke underline:** SVG brush-stroke under a key word in hero headlines. Orange or blue. Animates "drawing in" on load. One per hero section max.
- **Ghost large text:** 100px+, ~4-6% opacity, monospace or display text behind content. Creates depth.
- **Orange bar accent:** 48px wide x 4px tall orange rectangle above eyebrow labels.
- **1px grid separators:** Modules separated by single-pixel lines, no spacing gap — cage/grid visual effect.
- **Monospace eyebrow text:** Small, letter-spaced, all-caps label above section headlines. Brand blue color. `text-transform: uppercase; letter-spacing: 0.1em;` in Space Mono. (Weight: 80)

## Related Docs

- See [design-tokens.md](design-tokens.md) for all color hex values, font stacks, and CSS variable patterns
- See [voice-rules.md](voice-rules.md) for copy tone and messaging in website sections
