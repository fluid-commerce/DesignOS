---
phase: 06-marketing-skills-integration
plan: 01
subsystem: marketing-skills
tags: [skill-library, skill-map, marketing, copywriting, cro, seo]

# Dependency graph
requires:
  - phase: 05-learning-loop
    provides: feedback ingestion engine and session analysis patterns
provides:
  - 30 marketing skill directories under skills/marketing/ with SKILL.md files and references/
  - brand/skill-map.json manifest with operator-approved subagent-to-skill mappings for all 3 asset types
affects: [06-marketing-skills-integration plan 02, all orchestrator plans that reference skill-map.json]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skill-map.json as central manifest: 3 asset types x 4 subagent roles = 12 slots, 1-2 skills max per slot"
    - "Brand docs are PRIMARY, marketing skills are SECONDARY — layout and styling agents get no marketing skills"
    - "18 standalone-only skills: not mapped to pipeline slots, available via ad-hoc invocation"
    - "7 override-only skills: available via --skills flag only, not part of default pipeline"

key-files:
  created:
    - skills/marketing/ (30 subdirectories with SKILL.md, evals/, references/)
    - brand/skill-map.json
  modified: []

key-decisions:
  - "analytics-tracking dropped from social-post spec-check per operator decision — that slot is now empty"
  - "Layout-agent and styling-agent get no marketing skills for any asset type — brand docs govern those layers"
  - "seo-audit is the sole spec-check skill, only for website-section asset type"
  - "Standalone-only pool has 18 skills for ad-hoc use; override-only pool has 7 skills for explicit --skills invocation"

patterns-established:
  - "skill-map.json schema: _meta + 3 asset type keys, each with copy-agent/layout-agent/styling-agent/spec-check-agent arrays"
  - "File paths in skill-map.json are repo-relative (e.g. skills/marketing/copywriting/SKILL.md)"

requirements-completed: [MKTG-03, MKTG-05]

# Metrics
duration: 12min
completed: 2026-03-11
---

# Phase 6 Plan 01: Marketing Skills Integration — Skill Copy and Mapping Summary

**30 marketing skills copied into skills/marketing/ and operator-curated brand/skill-map.json created with 12 pipeline slot mappings across 3 asset types**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-11T17:15:00Z
- **Completed:** 2026-03-11T17:27:00Z
- **Tasks:** 2
- **Files modified:** 111 (109 skill files + skill-map.json + cherry-pick of Task 1 commit)

## Accomplishments

- All 30 marketing domain skills copied from ~/.agents/skills/ with SKILL.md, evals/, and references/ subdirectories preserved
- Operator-curated skill-map.json written with approved mappings: copywriting+social-content for social posts, copywriting+sales-enablement for one-pagers, copywriting+page-cro for website sections with seo-audit spec-check
- Analytics-tracking explicitly dropped from social-post spec-check per operator decision, leaving that slot empty
- 18 standalone-only and 7 override-only skills documented in _meta for future orchestrator reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy 30 marketing skills into skills/marketing/** - `563411f` (feat)
2. **Task 2: Interactive skill-map.json curation walkthrough** - `4974b2c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `skills/marketing/` - 30 subdirectories: copywriting, social-content, page-cro, sales-enablement, seo-audit, and 25 others
- `brand/skill-map.json` - Operator-approved mapping manifest for all 12 subagent slots across 3 asset types

## Decisions Made

- analytics-tracking dropped from social-post spec-check (operator decision): that slot is now empty
- Layout-agent and styling-agent receive no marketing skills across all asset types — brand docs (design tokens, layout archetypes) govern those layers entirely
- seo-audit assigned to website-section spec-check only (page-level SEO checklist is the right validation layer for website content)
- 18 skills placed in standalone-only pool (ad-hoc invocation), 7 in override-only pool (--skills flag)

## Deviations from Plan

**1. [Rule 3 - Blocking] Cherry-picked Task 1 commit into worktree branch**
- **Found during:** Task 2 setup
- **Issue:** Task 1 commit (8bd9a4b) existed on a detached HEAD and was not present in the worktree-phase-6-marketing-skills branch
- **Fix:** `git cherry-pick 8bd9a4b` brought the 109 skill files into the current branch as commit 563411f
- **Files modified:** skills/marketing/ (109 files)
- **Verification:** `ls skills/marketing/ | wc -l` confirmed 30 directories
- **Committed in:** 563411f (Task 1 re-applied)

---

**Total deviations:** 1 auto-fixed (blocking branch mismatch resolved via cherry-pick)
**Impact on plan:** No scope creep. Cherry-pick was necessary to proceed with Task 2.

## Issues Encountered

- Task 1 commit was on a detached commit not in the worktree branch. Cherry-picked cleanly with no conflicts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- skill-map.json ready for Plan 02 orchestrator integration
- All 30 skill SKILL.md files available at predictable paths (skills/marketing/{name}/SKILL.md)
- Plan 02 can reference skill-map.json to dynamically load the right skills per subagent role and asset type

---
*Phase: 06-marketing-skills-integration*
*Completed: 2026-03-11*
