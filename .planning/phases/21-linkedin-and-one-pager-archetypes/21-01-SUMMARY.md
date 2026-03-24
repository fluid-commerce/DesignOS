---
phase: 21-linkedin-and-one-pager-archetypes
plan: "01"
subsystem: archetypes
tags: [platform-aware, validator, slot-schema, typescript, backfill]
dependency_graph:
  requires: []
  provides:
    - validator platform-aware dimension checks (instagram-square, linkedin-landscape, one-pager)
    - SlotSchema.platform optional field
    - TemplateMetadata.platform extended with one-pager
    - All 10 Instagram archetypes backfilled with archetypeId and platform
  affects:
    - tools/validate-archetypes.cjs
    - canvas/src/lib/slot-schema.ts
    - canvas/src/lib/template-configs.ts
    - archetypes/*/schema.json (all 10)
tech_stack:
  added: []
  patterns:
    - "Slug suffix convention: -li=linkedin-landscape, -op=one-pager, else instagram-square"
    - "PLATFORM_DIMS lookup table replaces hardcoded REQUIRED_DIMS constant"
key_files:
  created: []
  modified:
    - tools/validate-archetypes.cjs
    - canvas/src/lib/slot-schema.ts
    - canvas/src/lib/template-configs.ts
    - archetypes/hero-stat/schema.json
    - archetypes/data-dashboard/schema.json
    - archetypes/split-photo-text/schema.json
    - archetypes/photo-bg-overlay/schema.json
    - archetypes/minimal-statement/schema.json
    - archetypes/quote-testimonial/schema.json
    - archetypes/hero-stat-split/schema.json
    - archetypes/split-photo-quote/schema.json
    - archetypes/minimal-photo-top/schema.json
    - archetypes/stat-hero-single/schema.json
decisions:
  - "Slug suffix convention (-li, -op) chosen over explicit platform field in directory name — validator stays zero-config for new archetypes"
  - "archetypeId backfilled alongside platform in all 10 schema.json files to align with Phase 20 pipeline expectations"
  - "Pre-existing TypeScript errors in TransformOverlay.tsx, BuildHero.tsx, PromptInput.tsx deferred — not caused by these changes"
metrics:
  duration: 7min
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 13
---

# Phase 21 Plan 01: Multi-Platform Archetype Infrastructure Summary

Platform-aware validator with slug-suffix detection (instagram-square/linkedin-landscape/one-pager), SlotSchema platform field, and all 10 Instagram archetypes backfilled with archetypeId and platform.

## What Was Built

### Task 1: Platform-Aware Validator (tools/validate-archetypes.cjs)

Replaced the hardcoded `REQUIRED_DIMS = { width: 1080, height: 1080 }` constant with a platform lookup system:

- `getPlatformForSlug(slug)` — derives platform from slug suffix: `-li` = linkedin-landscape, `-op` = one-pager, else instagram-square
- `PLATFORM_DIMS` — lookup table: instagram-square 1080x1080, linkedin-landscape 1200x627, one-pager 612x792
- **Check 12** — one-pager archetypes must include `@page { ... }` rule in index.html
- **Check 13** — schema.json `platform` field (if present) must match the slug-derived platform

All 10 existing Instagram archetypes pass with 0 errors after the change.

### Task 2: TypeScript Types + Backfill (12 files)

**canvas/src/lib/slot-schema.ts:** Added two optional fields to `SlotSchema`:
- `archetypeId?: string` — set for archetype-based assets (Phase 20 expectation)
- `platform?: 'instagram-square' | 'linkedin-landscape' | 'one-pager'` — new in Phase 21

**canvas/src/lib/template-configs.ts:**
- `TemplateMetadata.platform` union extended with `'one-pager'`
- All 8 TEMPLATE_SCHEMAS entries (t1-quote through t8-quarterly-stats) received `platform` field matching their TEMPLATE_METADATA counterpart

**10 archetype schema.json files:** Each received `archetypeId` (slug string) and `"platform": "instagram-square"` as the first two fields, consistent with the new SlotSchema interface.

## Verification Results

- `node tools/validate-archetypes.cjs all` — 10 archetypes, 0 errors, 0 warnings
- No TypeScript errors in changed files (slot-schema.ts, template-configs.ts)
- All 10 archetypes pass Check 13 (platform field matches slug suffix)

## Deviations from Plan

**Pre-existing TypeScript errors deferred** — 14 errors in 4 files (TransformOverlay.tsx, BuildHero.tsx, PromptInput.tsx, brand-context.test.ts) were present before this plan and are unrelated to changes. Logged as out-of-scope per deviation rules.

**STATE.md merge conflict resolved** — File had unresolved git merge markers from parallel branch work. Resolved by merging upstream and stash content, keeping all decisions from both branches and updating progress counts to reflect Phase 21 plan 01 completion.

**archetypeId added alongside platform** — The plan said "if not already present, add archetypeId". Only stat-hero-single had archetypeId; the other 9 did not. Added to all 10 for consistency.

## Self-Check: PASSED

- tools/validate-archetypes.cjs: EXISTS
- canvas/src/lib/slot-schema.ts: EXISTS
- canvas/src/lib/template-configs.ts: EXISTS
- 21-01-SUMMARY.md: EXISTS
- Commit c41d123: EXISTS (Task 1 — validator)
- Commit 20b64e9: EXISTS (Task 2 — types + backfill)
