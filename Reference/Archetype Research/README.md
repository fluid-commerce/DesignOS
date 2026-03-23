# Archetype Research

This directory contains reference social posts used to derive archetype layouts. Each reference is a high-performing post that was researched, curated, and deconstructed to identify structural patterns.

## Methodology

The research process is collaborative:

1. **Agent research** — The agent searches for high-performing social posts matching the curation criteria (see below), then presents candidates with screenshots, engagement data, and structural notes.
2. **User curation** — The user reviews candidates and selects which to keep as references. The user may also add their own reference posts directly.
3. **Agent deconstruction** — For each accepted reference, the agent produces a `deconstruction.md` analyzing the layout zones, structural pattern, content slots, and proposed archetype slug.
4. **Archetype derivation** — Strong structural patterns across multiple references are promoted to a new archetype in `archetypes/`.

"High-performing" means two things simultaneously: strong engagement metrics AND strong design quality. Engagement without design quality produces mediocre archetypes. Design quality without engagement produces beautiful but ineffective templates.

## Curation Criteria

**Platform:**
- Instagram (square, 1080x1080)
- LinkedIn (landscape, 1200x627)

**Engagement threshold:**
- Engagement rate > 3% for accounts with 10K+ followers
- Engagement rate > 5% for accounts with 100K+ followers
- Engagement = (likes + comments + shares) / follower_count × 100

**Design quality:**
- Must be HIGH (clear hierarchy, intentional typography, purposeful layout)
- MEDIUM posts may be included as "structural only" references if the layout pattern is unusually distinct
- Reject LOW quality regardless of engagement

**Structural diversity — we seek:**
- Stat-heavy layouts (large numbers, proof-driven)
- Comparison layouts (A vs B, before/after)
- Testimonial/quote layouts (social proof, attribution)
- Problem-solution layouts (pain point + resolution)
- Data-driven layouts (charts, tables, infographics)
- Image-hero layouts (product, portrait, scene)

Avoid over-indexing on "text + background" patterns — those are too generic to derive meaningful archetypes from.

## Per-Post Structure

Each reference post lives in a subfolder named `{platform}-{slug}-{id}/`:

```
Reference/Archetype Research/
└── instagram-stat-proof-001/
    ├── screenshot.png      # Full-resolution screenshot of the post
    ├── metadata.json       # Engagement data, source, quality classification
    └── deconstruction.md   # Layout analysis and archetype mapping
```

The `{id}` suffix is a sequential number per slug to allow multiple references for the same structural pattern.

## metadata.json Format

```json
{
  "source_url": "https://www.instagram.com/p/...",
  "platform": "instagram",
  "engagement": {
    "likes": 0,
    "comments": 0,
    "shares": 0
  },
  "account_followers": 0,
  "engagement_rate_pct": 0.0,
  "date_posted": "2026-01-01",
  "design_quality": "HIGH",
  "structural_notes": "Brief description of what makes this layout structurally interesting"
}
```

Field rules:
- `platform`: `"instagram"` or `"linkedin"`
- `design_quality`: `"HIGH"`, `"MEDIUM"`, or `"LOW"`
- `engagement_rate_pct`: calculated to 2 decimal places
- `structural_notes`: 1–3 sentences on what is structurally notable (not content-specific)

## deconstruction.md Format

Each `deconstruction.md` follows this template:

```markdown
# Deconstruction: {descriptive title}

**Source:** {source_url}
**Platform:** {platform}
**Date analyzed:** {YYYY-MM-DD}

## Layout Zones

| Zone | Position | Content | CSS Class (proposed) |
|------|----------|---------|----------------------|
| Top bar | 0–120px from top, full width | Category/platform label | .category |
| Main stat | Center-left | Large numeric value | .stat-number |
| Context label | Below stat | Stat description | .context-label |
| Headline | Bottom third | Supporting headline | .headline |
| Body copy | Below headline | 2–3 sentence explanation | .body-copy |

## Structural Pattern

{2–4 sentences describing the visual hierarchy and layout logic — e.g., "This layout uses a single dominant number as the visual anchor, with supporting text arranged in a descending hierarchy below. The stat takes ~40% of the canvas height..."}

## Slots Identified

- **Slot 1:** Category/side label (text, 1 row)
- **Slot 2:** Context label (text, 1 row)
- **Slot 3:** Stat value — large numeric or percentage (text, 1 row)
- **Slot 4:** Headline (text, 2 rows)
- **Slot 5:** Body copy (text/pre, 4 rows)

## Proposed Archetype

**Slug:** `{archetype-slug}` (e.g., `stat-hero-single`)
**Rationale:** {1 sentence on why this deserves a dedicated archetype slot}
**Status:** `proposed` | `accepted` | `merged-into:{other-slug}`

## Deconstruction Sketch

{Describe or attach an ASCII/visual sketch of the layout zones. This helps Phase 19 implementers position elements accurately without re-analyzing the reference.}

Example:
```
┌─────────────────────────────┐
│  [CATEGORY LABEL]           │  ← .category span, top-left
│                             │
│  Context label              │  ← .context-label, center
│  ██ 94% ██                  │  ← .stat-number, dominant center
│                             │
│  Headline goes here         │  ← .headline, lower third
│  Body copy 2-3 lines        │  ← .body-copy
└─────────────────────────────┘
```
```
