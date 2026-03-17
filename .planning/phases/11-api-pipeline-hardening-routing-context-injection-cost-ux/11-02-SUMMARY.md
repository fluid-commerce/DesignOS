---
phase: 11-api-pipeline-hardening-routing-context-injection-cost-ux
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, react, api, seeder, voice-guide, brand-patterns]

# Dependency graph
requires:
  - phase: 11-01
    provides: DB schema patterns, watcher.ts API middleware structure, getDb() import pattern
provides:
  - voice_guide_docs SQLite table seeded with 13 docs from voice-guide/ directory
  - brand_patterns SQLite table seeded with HTML sections from patterns/index.html
  - /api/voice-guide GET endpoint (returns all docs sorted by sort_order)
  - /api/voice-guide/:slug PUT endpoint (update doc content)
  - /api/brand-patterns GET endpoint with optional ?category filter
  - VoiceGuide.tsx wired to DB via API fetch (no ?raw imports)
  - brand-seeder.ts with idempotent seedVoiceGuideIfEmpty and seedBrandPatternsIfEmpty
affects:
  - phase 12 (pipeline integration — subagents read brand context from DB via MCP)
  - phase 13 (templates DB migration follows same seeder pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent seeder pattern: COUNT(*) guard before INSERT OR IGNORE for zero-downtime re-seeding"
    - "API-backed component pattern: React component fetches from /api/* instead of ?raw Vite imports"
    - "HTML section parser: split patterns/index.html on h2.section-title for structured storage"
    - "Category mapping for brand patterns: design-tokens, layout-archetype, pattern"

key-files:
  created:
    - canvas/src/server/brand-seeder.ts
    - canvas/src/__tests__/brand-seeder.test.ts
  modified:
    - canvas/src/lib/db.ts
    - canvas/src/server/db-api.ts
    - canvas/src/server/watcher.ts
    - canvas/src/components/VoiceGuide.tsx

key-decisions:
  - "Seeder reads from filesystem at startup only — DB is source of truth after first seed; subsequent restarts skip via COUNT(*) guard"
  - "VoiceGuide activeDocSlug initialized to empty string, set to docs[0].slug via second useEffect on docs load — avoids stale closure"
  - "brand_patterns category mapping: Color Palette/Typography/Opacity Patterns → design-tokens; Layout Archetypes → layout-archetype; all else → pattern"

patterns-established:
  - "DB table seeding: COUNT(*) check + INSERT OR IGNORE pattern — idempotent, safe for repeated server restarts"
  - "API-first React component: remove ?raw Vite imports, use fetch + useState + useEffect, show loading state during async init"

requirements-completed: [PIPE-05]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 11 Plan 02: DB-Backed Voice Guide and Brand Patterns Summary

**SQLite voice_guide_docs (13 docs) and brand_patterns tables seeded from existing files, REST API endpoints added, and VoiceGuide.tsx migrated from ?raw Vite imports to DB fetch**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T23:37:03Z
- **Completed:** 2026-03-16T23:42:00Z
- **Tasks:** 2 (verified already complete from prior execution)
- **Files modified:** 6

## Accomplishments

- Created `voice_guide_docs` and `brand_patterns` SQLite tables in db.ts initSchema
- Built idempotent `brand-seeder.ts` seeding 13 voice guide docs and HTML pattern sections from disk
- Added `getVoiceGuideDocs`, `getVoiceGuideDoc`, `updateVoiceGuideDoc`, `getBrandPatterns` CRUD to db-api.ts
- Added `/api/voice-guide` (GET + PUT /:slug) and `/api/brand-patterns` (GET with category filter) endpoints to watcher.ts
- Migrated `VoiceGuide.tsx` from 13 `?raw` Vite imports to `fetch('/api/voice-guide')` with loading state
- 13 brand-seeder tests pass (idempotency, sort order, category filtering, doc retrieval)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema + seeder + API endpoints for voice guide and brand patterns** - `dd951fb` + `6321033` (feat)
2. **Task 2: Switch VoiceGuide.tsx from ?raw imports to DB fetch** - included in `6321033` (feat)

## Files Created/Modified

- `canvas/src/lib/db.ts` - Added `voice_guide_docs` and `brand_patterns` CREATE TABLE IF NOT EXISTS blocks
- `canvas/src/server/brand-seeder.ts` - New: idempotent seedVoiceGuideIfEmpty (13 docs) and seedBrandPatternsIfEmpty (HTML parser)
- `canvas/src/server/db-api.ts` - Added VoiceGuideDoc/BrandPattern types and 4 CRUD functions
- `canvas/src/server/watcher.ts` - Added 3 new API endpoints and seeder startup calls
- `canvas/src/components/VoiceGuide.tsx` - Replaced ?raw imports + static DOCS array with fetch + useState/useEffect
- `canvas/src/__tests__/brand-seeder.test.ts` - New: 13 test cases covering seeding and retrieval

## Decisions Made

- Seeder reads from filesystem at startup only — DB is source of truth after first seed; subsequent restarts skip via COUNT(*) guard
- VoiceGuide `activeDocSlug` initialized to `''`, set to `docs[0].slug` via second `useEffect` on docs load to avoid stale closure issues
- brand_patterns category mapping: Color Palette/Typography/Opacity Patterns map to `design-tokens`; Layout Archetypes map to `layout-archetype`; all other sections map to `pattern`

## Deviations from Plan

None — plan executed exactly as written. Both tasks were already complete when this executor started (prior agent completed the work before OAuth expiry). Summary created to document the work and update project state.

## Issues Encountered

None — all tests pass (13 brand-seeder tests, 6 VoiceGuide tests). Pre-existing test failures (9 failures in full suite for ResizeObserver, AppShell, skill-paths) are unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- voice_guide_docs and brand_patterns tables are ready as DB source of truth for Phase 12 MCP integration
- Seeder pattern established — Phase 13 (templates) can follow the same idempotent approach
- VoiceGuide component is DB-backed and editable via PUT /api/voice-guide/:slug — in-app editing is possible without code changes

---
*Phase: 11-api-pipeline-hardening-routing-context-injection-cost-ux*
*Completed: 2026-03-16*
