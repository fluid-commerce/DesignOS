---
phase: 15-brand-data-architecture
plan: "03"
subsystem: ui
tags: [react, tsx, collapsible, design-rules, templates]

requires:
  - phase: 15-01
    provides: CollapsibleSection pattern and DB-backed patterns page structure
  - phase: 14-design-dna
    provides: /api/design-rules endpoint with scope hierarchy (global-social, platform, archetype)
provides:
  - Unified TemplatesScreen with collapsible Social Media Design Rules at top
  - Per-template cards with HTML preview, descriptive name, purpose, and inline-editable design rules
  - No tab navigation; single scrollable page
affects: [phase-16-smart-context-pipeline]

tech-stack:
  added: []
  patterns:
    - CollapsibleSection with maxHeight 0/2000px animation and chevron SVG rotation
    - Rules state lifted to parent component; filtered subsets passed to children
    - TEMPLATE_CARDS array as single source of truth for template metadata

key-files:
  created: []
  modified:
    - canvas/src/components/TemplatesScreen.tsx
    - canvas/src/__tests__/AppShell.test.tsx

key-decisions:
  - "TemplatesTab type and activeTab state removed entirely — no tab navigation on templates page"
  - "Archetype rules shown per-template card (filtered by archetypeSlug) rather than in a single grouped section"
  - "Template iframes use /templates/social/{slug}.html; comparison and timeline show placeholder (no matching files)"
  - "AppShell test updated to verify per-card iframes instead of single Template Library iframe"

patterns-established:
  - "CollapsibleSection: 44px header, #141414 bg, maxHeight animation, chevron rotation 0deg/90deg"
  - "Rules fetch lifted to TemplatesScreen; filter splits into globalRules/platformRules/archetypeRules"

requirements-completed:
  - P15-TEMPLATES

duration: 3min
completed: 2026-03-17
---

# Phase 15 Plan 03: Templates Screen Summary

**TemplatesScreen rewritten from two-tab layout into unified scrollable page with collapsible social rules and seven per-template cards, each showing HTML preview and inline-editable design rules**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T22:40:31Z
- **Completed:** 2026-03-17T22:43:49Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Removed TemplatesTab type, activeTab state, tabs array, and tab bar JSX entirely
- Added CollapsibleSection component identical to PatternsScreen pattern — 44px header, chevron animation, maxHeight transition
- Added TEMPLATE_CARDS constant defining 7 templates with descriptive names and purpose descriptions (no "archetype" or "template" suffix)
- Social media design rules (global + Instagram + LinkedIn) moved into collapsible section at page top (collapsed by default)
- Per-template archetype rules shown inline on each card in a nested collapsible (collapsed by default)
- Template iframes load from /templates/social/{slug}.html with graceful fallback for missing files
- All 358 vitest tests pass

## Task Commits

1. **Task 1: Rewrite TemplatesScreen.tsx as unified page** - `ef3f721` (feat)

## Files Created/Modified
- `canvas/src/components/TemplatesScreen.tsx` - Fully rewritten: no tabs, CollapsibleSection, TEMPLATE_CARDS, unified layout
- `canvas/src/__tests__/AppShell.test.tsx` - Tests updated to verify new structure (per-card iframes, not single Template Library iframe)

## Decisions Made
- Comparison and Timeline templates have no matching .html files in /templates/social/ (only slug-based files are problem-first, quote, stat-proof, app-highlight, partner-alert); showed "Preview not available" placeholder rather than broken iframes
- Rules state lifted from DesignDnaPanel into TemplatesScreen to share a single fetch across social rules section and all per-template cards
- AppShell test for patterns updated simultaneously (plan 15-01 left it failing; pre-existing test breakage resolved as part of this commit)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated AppShell.test.tsx to match new TemplatesScreen and PatternsScreen structures**
- **Found during:** Task 1 (vitest run after rewrite)
- **Issue:** AppShell tests expected `title="Template Library"` iframe (old tab structure) and `title="Pattern Library"` iframe (old PatternsScreen — already removed in 15-01 but test not updated)
- **Fix:** Updated both test cases to verify new component structures — per-card iframes for Templates, no /patterns/ iframe for Patterns
- **Files modified:** canvas/src/__tests__/AppShell.test.tsx
- **Verification:** 358 tests pass, 0 failures
- **Committed in:** ef3f721 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test update required for correctness; no scope creep.

## Issues Encountered
None.

## Next Phase Readiness
- Templates page is fully DB-backed and editor-ready
- Phase 15 plans 01-03 complete; plan 04 (VoiceGuide) is the final wave-1 plan
- No blockers

---
*Phase: 15-brand-data-architecture*
*Completed: 2026-03-17*
