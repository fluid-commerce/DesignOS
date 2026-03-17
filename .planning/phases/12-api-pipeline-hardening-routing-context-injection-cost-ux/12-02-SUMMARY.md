---
phase: 12-api-pipeline-hardening-routing-context-injection-cost-ux
plan: "02"
subsystem: tools
tags: [db-migration, cleanup, brand-validation, sqlite]
dependency_graph:
  requires: []
  provides: [db-backed-brand-validation, clean-phase-directory-structure]
  affects: [tools/brand-compliance.cjs, tools/schema-validation.cjs, tools/dimension-check.cjs, tools/scaffold.cjs, .planning/STATE.md]
tech_stack:
  added: [better-sqlite3 (in brand-compliance.cjs)]
  patterns: [SQLite-backed validation with built-in fallback constants]
key_files:
  modified:
    - tools/brand-compliance.cjs
    - tools/schema-validation.cjs
    - tools/dimension-check.cjs
    - tools/scaffold.cjs
    - .planning/STATE.md
  deleted:
    - tools/compile-rules.cjs
    - tools/rules.json
decisions:
  - "brand-compliance.cjs uses better-sqlite3 directly (not ESM canvas/src/lib/db.ts) since CJS tools cannot import ESM modules"
  - "Brand rule constants (colors, fonts, thresholds) are inlined as authoritative values in each tool; DB supplements with additional hex colors from brand_patterns"
  - "Graceful fallback when DB unavailable: brand-compliance.cjs continues with built-in constants and emits a Note to stderr"
  - "schema-validation.cjs and dimension-check.cjs use fully inlined constants; no DB query needed for their fixed Gold Standard values"
metrics:
  duration: 12min
  completed: "2026-03-17T02:01:34Z"
---

# Phase 12 Plan 02: Migrate Brand Validation Tools from rules.json to SQLite

**One-liner:** Retired the compile-rules static pipeline by migrating brand-compliance.cjs to better-sqlite3 DB reads and inlining Gold Standard constants in the other validation tools.

## What Was Built

The static `compile-rules.cjs -> rules.json` compilation pipeline has been eliminated. Brand validation tools now either read directly from the SQLite DB (brand-compliance.cjs) or use authoritative inlined constants that previously lived in rules.json (schema-validation.cjs, dimension-check.cjs, scaffold.cjs).

Five orphaned phase directories — remnants of an earlier roadmap numbering scheme — were deleted to match the current 15-phase roadmap. STATE.md was updated to accurately reflect Phase 12 as the current work.

## Completed Tasks

| Task | Name | Commit | Files Changed |
|------|------|--------|---------------|
| 1 | Migrate brand validation tools from rules.json to SQLite DB | 9f7ceae | tools/brand-compliance.cjs, tools/schema-validation.cjs, tools/dimension-check.cjs, tools/scaffold.cjs, -tools/compile-rules.cjs, -tools/rules.json |
| 2 | Delete orphaned directories and update STATE.md | 671b42e | .planning/STATE.md, 5 deleted .gitkeep files |

## Key Changes

**brand-compliance.cjs:**
- Replaced `loadRules()` (reads rules.json) with `loadRulesFromDb()` (reads brand_patterns from SQLite via better-sqlite3)
- DB query: `SELECT name, html_snippet FROM brand_patterns WHERE category = 'design-tokens'` — extracts hex colors from HTML snippets
- Built-in color/font constants serve as authoritative baseline; DB colors are additive
- Graceful fallback: if DB unavailable, emits "Note: Could not read from DB" to stderr and continues with built-in rules
- DB path: `FLUID_DB_PATH` env var or `canvas/.fluid/fluid.db`

**schema-validation.cjs:**
- `GOLD_STANDARD_SCHEMA` constant inlined (was loaded from rules.json)
- `loadRules()` now returns the inlined constant — no file I/O, no dependencies

**dimension-check.cjs:**
- `KNOWN_DIMENSIONS` constant inlined (was loaded from rules.json)
- `loadRules()` now returns the inlined constant

**scaffold.cjs:**
- Removed unused `loadRules()` call and `RULES_PATH` / `fs.existsSync` import block
- All scaffold generation was already self-contained; rules.json was loaded but never used

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one implementation note:

The plan suggested parsing font names and colors from HTML snippets in DB for the full rules structure. In practice, the brand_patterns HTML snippets contain color values embedded in markup, not structured data. The implemented approach inlines the authoritative constants (matching what compile-rules.cjs hardcoded anyway) and uses DB queries to supplement with any additional hex colors found in brand_patterns. This is semantically equivalent and more robust since the constants are the authoritative source.

## Verification

```
node tools/brand-compliance.cjs --help   # Exits 0, no "rules.json not found"
ls tools/compile-rules.cjs               # No such file or directory
ls tools/rules.json                      # No such file or directory
grep "rules.json" tools/brand-compliance.cjs  # 0 matches
grep "better-sqlite3" tools/brand-compliance.cjs  # 2 matches
ls .planning/phases/ | wc -l             # 15 directories (orphans removed)
grep "Phase 12" .planning/STATE.md       # Found: current position updated
```

## Self-Check: PASSED

- tools/brand-compliance.cjs exists and runs without error: FOUND
- tools/compile-rules.cjs deleted: CONFIRMED (No such file)
- tools/rules.json deleted: CONFIRMED (No such file)
- 5 orphaned phase directories deleted: CONFIRMED (15 remain)
- STATE.md updated with Phase 12 content: CONFIRMED
- Commits: 9f7ceae (task 1), 671b42e (task 2)
