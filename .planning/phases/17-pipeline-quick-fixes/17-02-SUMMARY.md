---
phase: 17-pipeline-quick-fixes
plan: "02"
subsystem: brand-compliance
tags: [compliance, validation, font-enforcement, db-driven]
dependency_graph:
  requires: []
  provides: [8-new-compliance-rules, db-driven-font-allowlist]
  affects: [tools/brand-compliance.cjs]
tech_stack:
  added: []
  patterns: [db-driven-font-loading]
key_files:
  created: []
  modified:
    - tools/brand-compliance.cjs
decisions:
  - "8 new check functions added with graduated weights (55-90) reflecting violation severity"
  - "Font allowlist now DB-driven via brand_assets WHERE category='fonts' — removed hardcoded Inter from social fallback"
  - "Website families extend DB fonts with Syne/DM Sans/Space Mono as known web-safe additions"
metrics:
  duration: 2min
  completed: "2026-03-23"
  tasks: 2
  files: 1
---

# Phase 17 Plan 02: Compliance Validator Expansion Summary

Added 8 new validation rules to brand-compliance.cjs and made font enforcement DB-driven.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add 8 new check functions to brand-compliance.cjs | 3f4b44e | tools/brand-compliance.cjs |
| 2 | Make font allowlist DB-driven in loadRulesFromDb | 238629e | tools/brand-compliance.cjs |

## What Was Built

**8 new check functions (wired into violations aggregation):**
1. `checkInlineStyles` (weight 90) - detects `style=` attributes outside `<style>` blocks
2. `checkDecorativeImgTags` (weight 85) - flags `<img>` tags used for decorative elements
3. `checkHeadlineLetterSpacing` (weight 85) - enforces negative letter-spacing on headline classes
4. `checkBodyCopyColor` (weight 80) - social context: body text must be ~white@45% opacity
5. `checkCopyWordCount` (weight 75) - per-platform word count limits (IG: 20, LI: 30)
6. `checkTitleTag` (weight 70) - flags missing `<title>` tag
7. `checkMinimumElementGap` (weight 65) - text elements < 20px apart
8. `checkMultilingualAccents` (weight 55) - accent-dropping in uppercase text

**DB-driven font allowlist:** Extended `loadRulesFromDb()` to query `brand_assets WHERE category = 'fonts'` and drive `social_families`/`allowed_families` from the DB. Removed `Inter` from hardcoded social fallback (not a Fluid brand font). Website families extend DB fonts with `Syne`/`DM Sans`/`Space Mono`.

## Deviations from Plan

None.

## Self-Check

- [x] Commit 3f4b44e exists - CONFIRMED
- [x] Commit 238629e exists - CONFIRMED
- [x] tools/brand-compliance.cjs contains checkInlineStyles - CONFIRMED
- [x] tools/brand-compliance.cjs contains loadRulesFromDb with brand_assets query - CONFIRMED

## Self-Check: PASSED
