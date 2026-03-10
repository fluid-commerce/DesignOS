---
phase: 02-orchestrator-social-posts
plan: 02
subsystem: agents
tags: [subagents, copy, layout, styling, spec-check, brand-validation, pipeline]

# Dependency graph
requires:
  - phase: 01-brand-intelligence
    provides: "Brand docs (voice-rules.md, design-tokens.md, layout-archetypes.md, social-post-specs.md, asset-usage.md), CLI tools (brand-compliance.cjs, dimension-check.cjs), Pattern Library (patterns/index.html), subagent stubs"
provides:
  - "4 production subagent definitions with full contracts (copy, layout, styling, spec-check)"
  - "Structured file I/O protocol: copy.md -> layout.html -> styled.html -> spec-report.json"
  - "Fix loop behavior documented in each agent"
  - "Severity-based spec-check with 8 holistic review categories + 2 deterministic CLI checks"
affects: [02-orchestrator-social-posts, 03-website-sections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subagent contract pattern: INPUTS/OUTPUTS/MAX_ITERATIONS in HTML comment block"
    - "File-based inter-agent communication via .fluid-working/ directory"
    - "Severity-based validation: 81+ blocking, 51-80 warning, 1-50 info"
    - "fix_target routing: each spec-check issue names the responsible subagent"

key-files:
  created:
    - ".claude/agents/spec-check-agent.md"
  modified:
    - ".claude/agents/copy-agent.md"
    - ".claude/agents/layout-agent.md"
    - ".claude/agents/styling-agent.md"

key-decisions:
  - "Accent color inference lives in copy agent (maps content mood to orange/blue/green/purple)"
  - "Circle sketch implementation uses mask-image + backgroundColor, NOT hue-rotate (deprecated)"
  - "Spec-check runs deterministic CLI tools first, then holistic review in single pass"
  - "Fix loop is targeted (not from-scratch): agents make surgical edits to existing output"

patterns-established:
  - "Contract comment block: every subagent has <!-- CONTRACT --> with INPUTS, OUTPUTS, MAX_ITERATIONS"
  - "Brand doc loading scoped per agent: copy gets voice+social, layout gets archetypes+social, styling gets tokens+assets+social+patterns"
  - "No Agent tool in subagents: only orchestrator can delegate to other agents"

requirements-completed: [ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, ORCH-07]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 2 Plan 02: Subagent Contracts Summary

**4 production subagent contracts (copy, layout, styling, spec-check) with structured .fluid-working/ file I/O, fix loop behavior, and 10-category spec validation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T20:14:35Z
- **Completed:** 2026-03-10T20:19:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Upgraded 3 stub agents (copy, layout, styling) into full production contracts with YAML frontmatter, structured I/O, brand doc loading scopes, and fix loop behavior
- Created spec-check agent combining 2 deterministic CLI tool checks + 8 holistic review categories with severity-based blocking/warning classification
- Established file-based pipeline protocol: copy.md -> layout.html -> styled.html -> spec-report.json with fix_target routing hints

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade copy, layout, and styling agents** - `e29e271` (feat)
2. **Task 2: Create spec-check agent** - `389d958` (feat)

## Files Created/Modified
- `.claude/agents/copy-agent.md` - Full copy subagent with accent color inference, archetype selection, platform-aware copy, structured copy.md output
- `.claude/agents/layout-agent.md` - Full layout subagent reading copy.md, selecting archetype layout, producing structural HTML with SLOT comments
- `.claude/agents/styling-agent.md` - Full styling subagent applying design tokens, embedding fonts/assets, producing self-contained styled.html
- `.claude/agents/spec-check-agent.md` - New validation subagent with CLI tool integration and 8-category holistic review

## Decisions Made
- Accent color inference lives in the copy agent (earliest pipeline stage) so all downstream agents inherit the color decision
- Circle sketch implementation exclusively uses mask-image + backgroundColor approach; hue-rotate is deprecated per brand docs
- Spec-check runs deterministic CLI tools first (fast, catches obvious issues) then holistic review (slower, catches nuanced issues)
- Fix loop behavior is targeted, not from-scratch: agents re-read feedback and make surgical edits to their existing output
- Styling agent has Bash tool access (for base64 encoding assets) while copy and layout agents do not need it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 subagent contracts are ready for the orchestrator skill to chain them (Plan 03/04)
- File I/O contracts are compatible: each agent reads its predecessor's output and writes its own
- Templates directory (templates/social/) still needs to be created (Plan 03: template library)
- Orchestrator skill (fluid-social/SKILL.md) is the next dependency (Plan 04 or later)

## Self-Check: PASSED

All 5 files verified present. Both task commits (e29e271, 389d958) confirmed in git log.

---
*Phase: 02-orchestrator-social-posts*
*Completed: 2026-03-10*
