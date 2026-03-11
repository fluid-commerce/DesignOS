---
phase: 06-marketing-skills-integration
plan: 02
subsystem: orchestrator-skills
tags: [marketing-skills, delegation, sync, brand-index]
dependency_graph:
  requires: [06-01]
  provides: [marketing-skill-delegation, skills-override-flag, global-distribution]
  affects: [fluid-social, fluid-one-pager, fluid-theme-section, sync.sh, brand/index.md]
tech_stack:
  added: []
  patterns: [skill-delegation-hierarchy, brand-first-secondary-skills, skills-override-flag]
key_files:
  created: []
  modified:
    - .claude/skills/fluid-social/SKILL.md
    - .claude/skills/fluid-one-pager/SKILL.md
    - .claude/skills/fluid-theme-section/SKILL.md
    - sync.sh
    - brand/index.md
decisions:
  - "Marketing skills embedded as hardcoded defaults in orchestrator skills (no runtime skill-map.json reads)"
  - "Brand docs listed first (PRIMARY), marketing skills listed second (SECONDARY) with explicit precedence framing in all delegation messages"
  - "--skills flag is a full override (not additive) -- resolved_skills replaces defaults for ALL subagent delegation"
  - "sync.sh uses cp -r for marketing skills (not symlinks) to support skills with references/ subdirectories"
  - "Marketing skills distributed to ~/.agents/skills/ with overwrite -- repo is authoritative source"
metrics:
  duration: 4min
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 5
---

# Phase 06 Plan 02: Orchestrator Pipeline Wiring Summary

**One-liner:** Marketing skills wired into all 3 orchestrators via brand-first delegation hierarchy with --skills override flag and global sync.sh distribution.

## What Was Built

### Task 1: Orchestrator skills updated with marketing delegation + --skills flag

All 3 orchestrator skills (`fluid-social`, `fluid-one-pager`, `fluid-theme-section`) received:

1. **--skills flag** added to argument-hint and flags table in Section 1
2. **Marketing skill resolution block** with warning for unknown skill names and empty-list fallback to defaults
3. **Copy-agent delegation updated** with branded marketing expertise block:
   - Brand context (PRIMARY -- must follow): voice-rules + platform-specific spec
   - Marketing expertise (SECONDARY -- brand docs take precedence in any conflict)
   - Default skills hardcoded from skill-map.json interface (no runtime reads)
4. **Spec-check-agent delegation updated** with secondary marketing expertise reference:
   - fluid-social: `analytics-tracking` skill
   - fluid-theme-section: `seo-audit` skill
5. **Anti-pattern note added** in all 3 skills: "NEVER load more than 2 marketing skills per subagent"

**Default skill paths by orchestrator:**
- fluid-social copy: `skills/marketing/copywriting/SKILL.md` + `skills/marketing/social-content/SKILL.md`
- fluid-social spec-check: `skills/marketing/analytics-tracking/SKILL.md`
- fluid-one-pager copy: `skills/marketing/copywriting/SKILL.md` + `skills/marketing/sales-enablement/SKILL.md`
- fluid-theme-section copy: `skills/marketing/copywriting/SKILL.md` + `skills/marketing/page-cro/SKILL.md`
- fluid-theme-section spec-check: `skills/marketing/seo-audit/SKILL.md`

### Task 2: sync.sh extended + brand/index.md updated

**sync.sh** received a new MARKETING SKILLS section:
- Loops through `skills/marketing/*/` directories
- Checks for SKILL.md presence before copying (skips if missing)
- Copies with `cp -r` to handle skills with subdirectories
- Overwrites at `~/.agents/skills/{skill-name}/`
- Respects `--dry-run` flag
- Uninstall section removes marketing skills from `~/.agents/skills/`
- REPORT section now includes `ls ~/.agents/skills/ | grep -c ''` verify command
- Help text updated to mention global marketing skills distribution

**brand/index.md** received a new Marketing Skill Loading section:
- Per-role skill mapping for all 3 orchestrators
- Notes `brand/skill-map.json` as the full mapping reference
- Documents `--skills` override behavior
- Explicit brand-first hierarchy statement

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c286db4 | feat(06-02): wire marketing skills into orchestrator delegation + --skills flag |
| 2 | 7273c7c | feat(06-02): extend sync.sh for marketing skills distribution + update brand/index.md |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Missing context] skill-map.json did not exist**
- **Found during:** Task 1
- **Issue:** Plan 02 references `brand/skill-map.json` (created in Plan 01) but Plan 01 was only partially executed (skills were copied but SUMMARY.md and skill-map.json were not created)
- **Fix:** Used the expected interface defined in 06-02-PLAN.md context block as the authoritative source for skill paths. The plan itself documents what skill-map.json should contain, so no data was lost.
- **Files modified:** None (used paths from plan context)
- **Commit:** N/A (inline resolution)

## Verification

All checks pass:
- `grep -c "skills/marketing" .claude/skills/fluid-social/SKILL.md` = 4
- `grep -c "skills/marketing" .claude/skills/fluid-one-pager/SKILL.md` = 3
- `grep -c "skills/marketing" .claude/skills/fluid-theme-section/SKILL.md` = 4
- `grep -c "\-\-skills" .claude/skills/fluid-social/SKILL.md` = 11
- `grep -c "skills/marketing" sync.sh` = 3
- `grep -c "marketing" brand/index.md` = 7
- `./sync.sh --dry-run` shows 30 marketing skills in distribution plan (44 total: 7 skills x2 platforms + 30 marketing)

## Self-Check: PASSED

Files confirmed to exist:
- .claude/skills/fluid-social/SKILL.md -- FOUND
- .claude/skills/fluid-one-pager/SKILL.md -- FOUND
- .claude/skills/fluid-theme-section/SKILL.md -- FOUND
- sync.sh -- FOUND
- brand/index.md -- FOUND

Commits confirmed:
- c286db4 -- FOUND
- 7273c7c -- FOUND
