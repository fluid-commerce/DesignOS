Template photography and device mockups for social posts and marketing materials.

## Available Assets

| Asset | Description |
|-------|-------------|
| person-photo-t1 | Portrait photo — template 1 testimonial |
| person-holly | Portrait photo — employee/team member |
| phone-mockup | Device mockup — app screenshot display |
| phone-mockup-t2 | Device mockup — alternate angle |
| screenshot-claude | App screenshot |
| t8-thumbnail | Quarterly stats thumbnail |

## Usage Rules

- Portraits: use for testimonials, employee spotlights, partner announcements
- Phone mockups: use for app highlights, feature spotlights
- Always crop/position with `overflow: hidden` on the container
- Reference via `/api/brand-assets/serve/{name}`

## Image Sizing Rules (weight: 80)

- Photos must fill their container completely (`object-fit: cover`) (weight: 85)
- In split layouts, photo panel is minimum 45% of canvas width
- Photos should NEVER be smaller than 300x300px in the final rendering
- If an archetype has a photo slot, USE IT — do not leave it empty unless absolutely no suitable image exists (weight: 85)

## Photo Edge Treatments (weight: 75)

- Gradient fade: `linear-gradient` overlay from transparent to `#000000` at photo edges for natural blending
- Brushstroke overlap: pair a photo with at least 1 brushstroke overlapping the photo edge for visual interest
- Photos gain depth when decorative elements overlap the photo/text boundary
