# Feedback Directory

This directory stores agent-generated feedback on asset and skill usage. It is read by the Phase 5 learning loop to tune brand rule weights and improve outputs over time.

## Conventions

Each feedback entry is a single markdown file with YAML frontmatter.

### Filename Pattern

```
YYYY-MM-DD-asset-type-brief.md
```

Example: `2026-03-15-brushstroke-diagonal-sweep-too-prominent.md`

### Frontmatter Format

```yaml
---
date: 2026-03-15
asset_type: brushstroke | circle | logo | font | layout | copy | color
asset_name: brushstroke-diagonal-sweep.png  # if applicable
prompt_used: "Social post for partner alert, orange accent"
outcome: success | partial | failure
operator_notes: "Brushstroke opacity was too high at 0.25, reduced to 0.15 for better balance"
rule_weights_affected:
  - rule: "brushstroke opacity 0.10-0.25"
    current_weight: 90
    suggested_adjustment: "narrow range to 0.10-0.18 for small posts"
---
```

### Body

Free-form notes, screenshots, or before/after descriptions. Keep it brief -- the frontmatter carries the structured data.

## Who Writes Here

- Agents write feedback automatically after generating assets (when configured)
- Operators can manually add feedback files
- The learning loop (Phase 5) reads all files in this directory to propose weight adjustments
