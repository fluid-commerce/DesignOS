---
phase: 17-pipeline-quick-fixes
plan: "01"
subsystem: api-pipeline
tags: [pipeline, prompts, font-enforcement, quality-rules]
dependency_graph:
  requires: []
  provides: [system-level-prompt-rules, db-driven-font-enforcement]
  affects: [api-pipeline.ts, brand-seeder.ts, watcher.ts]
tech_stack:
  added: []
  patterns: [db-seeder-pattern, micro-fix-escalation]
key_files:
  created: []
  modified:
    - canvas/src/server/api-pipeline.ts
    - canvas/src/server/brand-seeder.ts
    - canvas/src/server/watcher.ts
decisions:
  - "System-invariant rules (word limits, inline styles ban, decorative elements, circle emphasis, font fallbacks) live in prompt builders in code, not DB — avoids extractHardRules cache invalidation issues"
  - "font-non-brand-family removed from MICRO_FIXABLE_RULES so tryMicroFix escalates to full fix loop for font violations (correct fix via styling agent, not regex replacement)"
  - "Font enforcement seeded as brand pattern (weight: 90, category: pattern) so extractHardRules picks it up automatically at runtime"
metrics:
  duration: 3min
  completed: "2026-03-23"
  tasks: 2
  files: 3
---

# Phase 17 Plan 01: Pipeline Prompt Quality Rules Summary

Injected 6 system-level quality rules into pipeline prompt builders and replaced hardcoded FONT_REPLACEMENTS with DB-driven font enforcement pattern.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Inject system-level rules into buildCopyPrompt and buildStylingPrompt | 1704c22 | canvas/src/server/api-pipeline.ts |
| 2 | Remove FONT_REPLACEMENTS and seed DB font enforcement pattern | b1946ec | canvas/src/server/api-pipeline.ts, canvas/src/server/brand-seeder.ts, canvas/src/server/watcher.ts |

## What Was Built

**buildCopyPrompt additions:** WORD LIMITS rule — Instagram 20 words maximum total visible copy, LinkedIn 30 words maximum total (headline + body + tagline combined, footer excluded).

**buildStylingPrompt additions (4 new rules):**
1. CSS CLASSES — all styling must be in `<style>` blocks using class selectors; `style=""` attributes prohibited
2. DECORATIVE ELEMENTS — brushstrokes/textures/circles must use `<div>` with `background-image` + `background-size: contain`; never `<img>` tags
3. CIRCLE EMPHASIS — `::before` pseudo-elements use percentage sizing (width: 110%; height: 130%; left: -5%; top: -15%) to prevent mask bounding box clipping
4. FONT FALLBACKS — ban Georgia, Times New Roman, Times, serif, cursive; always use `sans-serif`

**FONT_REPLACEMENTS removal:** Hardcoded regex replacement map deleted from api-pipeline.ts. `font-non-brand-family` removed from `MICRO_FIXABLE_RULES` so font violations escalate directly to the full fix loop (styling agent handles font correction properly).

**seedFontEnforcementIfEmpty():** New seeder in brand-seeder.ts that inserts a `font-enforcement` brand pattern (category: pattern, weight: 90) listing NeueHaas and flfontbold as the only allowed fonts. Called at startup in watcher.ts alongside `seedGlobalVisualStyleIfEmpty()`.

## Deviations from Plan

None — plan executed exactly as written.

## Tests

43 api-pipeline tests pass. 6 pre-existing failing test files (UI/integration tests unrelated to pipeline) remain unchanged.

## Self-Check

- [x] canvas/src/server/api-pipeline.ts contains "WORD LIMITS" — FOUND
- [x] canvas/src/server/api-pipeline.ts contains "CSS CLASSES" — FOUND
- [x] canvas/src/server/api-pipeline.ts does NOT contain "FONT_REPLACEMENTS" — CONFIRMED
- [x] canvas/src/server/brand-seeder.ts contains "font-enforcement" — FOUND
- [x] Commits 1704c22 and b1946ec exist — CONFIRMED

## Self-Check: PASSED
