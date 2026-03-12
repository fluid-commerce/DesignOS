# Phase 07 Deferred Items

## Pre-existing TypeScript Errors (Out of Scope)

Found during Plan 01 execution. Not caused by Plan 01 changes.

### 1. generate-endpoint.test.ts (3 TypeScript errors)
- **File:** `canvas/src/__tests__/generate-endpoint.test.ts`
- **Errors:** TS2322 — EventEmitter type incompatibility in mock ChildProcess; stdin type mismatch (`Writable | null | undefined` vs `Writable | null`)
- **Root cause:** Type mismatch between mock EventEmitter and Readable types; pre-dates Phase 7 work
- **Action:** Fix in a future cleanup task

### 2. skill-paths.test.ts (1 TypeScript error)
- **File:** `canvas/src/__tests__/skill-paths.test.ts`
- **Error:** TS2304 — Cannot find name 'beforeAll' at L20
- **Root cause:** Missing `globals: true` vitest config or missing import; pre-dates Phase 7 work
- **Action:** Fix in a future cleanup task

### 3. ContentEditor.tsx (2 TypeScript errors)
- **File:** `canvas/src/components/ContentEditor.tsx`
- **Errors:** TS2307 — Cannot find module './CarouselSelector' or './ExportActions'
- **Root cause:** Referenced components not yet created; pre-dates Phase 7 work
- **Action:** Create components in a future plan

## Pre-existing Test Failures (Out of Scope)

Found during Plan 02 execution. Not caused by Plan 02 changes.

### 4. skill-paths.test.ts (5 test failures)
- **File:** `canvas/src/__tests__/skill-paths.test.ts`
- **Failures:** fluid-social, fluid-one-pager, fluid-theme-section, fluid-design-os missing 'canvas-active' sentinel check; fluid-design-os missing '.fluid/working/' path instruction
- **Root cause:** Skill files don't yet include expected strings; tests written ahead of skill updates
- **Action:** Address when skill routing is finalized
