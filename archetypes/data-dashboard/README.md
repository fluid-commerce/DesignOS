# data-dashboard

## Purpose

Three-stat grid layout for showcasing multiple metrics simultaneously. A title sets the context at the top; three large numbers sit in a 3-column grid; a ruled divider separates the stats from a footnote that provides sourcing or time period context.

## When to Use

- Quarterly/monthly performance roundups
- Before/after comparisons across multiple dimensions
- Multi-metric announcements (when 3 numbers together tell the story better than 1)
- Research or industry data posts with multiple data points
- Benchmark comparisons

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.headline` | text | Dashboard title (e.g. `Q3 PERFORMANCE AT A GLANCE`) |
| `.stat-1-num` | text | First stat value (e.g. `2.4x`, `94%`, `$1.2M`) |
| `.stat-1-label` | text | First stat descriptor |
| `.stat-2-num` | text | Second stat value |
| `.stat-2-label` | text | Second stat descriptor |
| `.stat-3-num` | text | Third stat value |
| `.stat-3-label` | text | Third stat descriptor |
| `.footnote` | text | Source citation, time period, or methodology note |

## Example Topics

- Q3 results: "2.4x ROAS, 47% cost reduction, 312K new users"
- Benchmark comparison: "3 ways our clients outperformed the industry average"
- Annual report highlight: "The numbers behind a record-breaking year"

## Layout Notes

- Headline: 48px bold, top 80px
- Stats grid: CSS grid, 3 equal columns, starts at 220px, 40px gap
- Each stat number: 120px at 0.85 line-height — bold and compact
- Each stat label: 22px muted, 12px margin-top below number
- Divider: 2px rule at bottom 140px — visual separation before footnote
- Footnote: 18px very muted, bottom 60px — sourcing/context
