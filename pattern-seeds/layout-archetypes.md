Brand-agnostic layout skeletons for social posts and one-pagers. Each archetype defines structural positioning only — no brand styling, fonts, or decorative elements. (weight: 90)

## Instagram Archetypes (1080x1080)

| Slug | Structure | Best For |
|------|-----------|----------|
| `minimal-statement` | Bold centered headline + subtext, lots of whitespace | Pain points, brand declarations, emotional hooks |
| `hero-stat` | 3-stat row at bottom + headline + eyebrow | Data proof, quarterly stats, multiple metrics |
| `stat-hero-single` | One giant stat number dominates + headline + body | Single proof point ("6X", "82%", "$75K") |
| `hero-stat-split` | Photo left + stat/headline/body right | One big number with context + photo |
| `photo-bg-overlay` | Full-bleed photo with dark overlay + headline/subtext | Dramatic visual posts, product showcases |
| `split-photo-text` | 50/50 split: photo left, text right | Case studies, testimonials with photo |
| `split-photo-quote` | Photo left + large pull quote right | Thought leadership with portrait |
| `quote-testimonial` | Large quote + portrait photo + name/title | Client testimonials |
| `minimal-photo-top` | Photo anchored at top, text below | Product showcases, app highlights |
| `data-dashboard` | 2x2 or 3-4 stat grid with headline | Multiple data points, reports |

## LinkedIn Archetypes (1200x627)

| Slug | Structure | Best For |
|------|-----------|----------|
| `minimal-statement-li` | Bold statement, landscape format | Brand declarations, announcements |
| `hero-stat-li` | Stats + headline, landscape | Data-driven LinkedIn posts |
| `quote-testimonial-li` | Quote + attribution, landscape | Client testimonials for LinkedIn |
| `split-photo-text-li` | Photo left + text right, landscape | Case studies, educational content |
| `data-dashboard-li` | Multi-stat grid, landscape | Reports, metrics updates |
| `article-preview-li` | Article card preview layout | Thought leadership, blog promotion |

## One-Pager Archetypes (816x1056)

| Slug | Structure | Best For |
|------|-----------|----------|
| `case-study-op` | Problem → solution → results flow | Client success stories |
| `product-feature-op` | Feature grid + hero section | Product capability overviews |
| `company-overview-op` | Mission + stats + team layout | Company introductions |

## Selection Guide (weight: 85)

- **Has a big stat to highlight?** → `stat-hero-single` (IG) or `hero-stat-li` (LI)
- **Has multiple stats?** → `hero-stat`, `data-dashboard`, or their `-li` variants
- **Has a photo?** → `photo-bg-overlay`, `split-photo-text`, `hero-stat-split`, `minimal-photo-top`
- **Client testimonial?** → `quote-testimonial` (IG) or `quote-testimonial-li` (LI)
- **Pure text/statement?** → `minimal-statement` (IG) or `minimal-statement-li` (LI)
- **Uncertain?** → Default to `minimal-statement` — it works for most content
