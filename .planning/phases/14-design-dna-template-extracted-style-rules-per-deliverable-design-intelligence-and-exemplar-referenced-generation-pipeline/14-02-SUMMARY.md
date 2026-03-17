---
phase: 14-design-dna
plan: "02"
subsystem: pipeline
tags: [design-dna, pipeline, prompt-injection, brand-intelligence, exemplar]
dependency_graph:
  requires: [14-01]
  provides: [design-dna-pipeline-injection]
  affects: [canvas/src/server/api-pipeline.ts, canvas/src/server/db-api.ts]
tech_stack:
  added: []
  patterns: [design-dna-injection, archetype-detection, exemplar-referenced-generation]
key_files:
  created: []
  modified:
    - canvas/src/server/api-pipeline.ts
    - canvas/src/server/db-api.ts
decisions:
  - "designDna variable declared at runApiPipeline scope so fix loop cascade inherits it without re-loading"
  - "buildStylingPrompt updated to explicitly reference fontSrc/cssUrl/imgSrc fields so agents use pre-formatted values"
  - "loadDesignDna returns empty string for non-social creation types (one-pager, theme-section) — no injection needed"
metrics:
  duration: 2min
  completed: "2026-03-17"
  tasks: 2
  files: 2
---

# Phase 14 Plan 02: Design DNA Pipeline Injection Summary

**One-liner:** DB-backed Design DNA (global style + platform rules + archetype notes + HTML exemplar) injected into layout and styling agent prompts; list_brand_assets now returns ready-to-use fontSrc/cssUrl/imgSrc CSS values.

## What Was Built

### Task 1: Fix list_brand_assets + add getDesignDnaForPipeline (commit: 59bce26)

**db-api.ts** — new `getDesignDnaForPipeline(creationType, archetypeSlug?)` function that assembles:
- `globalStyle`: Visual Compositor Contract from `brand_patterns` (slug: `visual-compositor-contract`)
- `socialGeneral`: All `global-social` scoped design rules joined
- `platformRules`: Platform-scoped rules (`instagram` or `linkedin`) with `## Label` headings
- `archetypeNotes`: Archetype-specific rules if a slug is provided

**api-pipeline.ts** — enhanced `list_brand_assets` tool handler:
- Font assets return `fontSrc: "url('/fluid-assets/...') format('truetype')"` — verbatim for `@font-face src`
- Image assets return `cssUrl: "url('/fluid-assets/...')"` for `background-image` and `imgSrc` for `<img src>`
- Tool description updated to advertise the new fields and instruct agents to use them verbatim

### Task 2: Inject Design DNA + HTML exemplar into pipeline prompts (commit: 36e6e3b)

**api-pipeline.ts** additions:
- `ARCHETYPE_TEMPLATE_FILES` — maps 7 archetype slugs to template HTML file paths under `templates/social/`
- `DEFAULT_ARCHETYPE = 'problem-first'`
- `loadDesignDna(ctx, archetypeSlug?)` — async function that assembles the full Design DNA block:
  - Only active for `instagram` / `linkedin` creation types
  - Reads global/platform/archetype DNA via `getDesignDnaForPipeline`
  - Loads matching template HTML and wraps it in `<example>` tags
  - Gracefully skips exemplar if template file is missing

**Prompt changes:**
- `buildCopyPrompt` — added `Archetype:` line instruction with all 7 options
- `buildLayoutPrompt(ctx, designDna?)` — injects Design DNA block (structural rules only)
- `buildStylingPrompt(ctx, designDna?)` — injects Design DNA block including full HTML exemplar; updated to reference `fontSrc`/`cssUrl`/`imgSrc` fields
- `runApiPipeline` — detects archetype from `copy.md` regex, loads Design DNA once, passes to layout+styling (and fix loop cascade)

## Deviations from Plan

**1. [Rule 2 - Enhancement] Styling prompt updated to reference new fontSrc/cssUrl/imgSrc fields**
- **Found during:** Task 2
- **Issue:** The plan updated the tool handler to return new CSS fields but didn't update the styling prompt to tell agents about them — agents would still assemble font-face rules manually
- **Fix:** Updated `buildStylingPrompt` to explicitly reference `fontSrc` (for @font-face) and `cssUrl`/`imgSrc` (for images) by name so agents know the fields exist
- **Files modified:** canvas/src/server/api-pipeline.ts
- **Commit:** 36e6e3b

**2. [Rule 2 - Enhancement] Fix loop cascade passes designDna**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified passing `designDna` to fix loop cascade calls of `buildLayoutPrompt`/`buildStylingPrompt` but the original plan text was ambiguous. Implemented it for consistency.
- **Fix:** `designDna` declared at `runApiPipeline` function scope (before the fix loop try block), passed in cascade calls
- **Files modified:** canvas/src/server/api-pipeline.ts
- **Commit:** 36e6e3b

## Self-Check: PASSED

- canvas/src/server/db-api.ts: FOUND — contains `getDesignDnaForPipeline`
- canvas/src/server/api-pipeline.ts: FOUND — contains `fontSrc`, `cssUrl`, `imgSrc`, `loadDesignDna`, `ARCHETYPE_TEMPLATE_FILES`, `DEFAULT_ARCHETYPE`, `<example>`
- Commit 59bce26: FOUND (Task 1)
- Commit 36e6e3b: FOUND (Task 2)
- TypeScript: compiles clean (0 errors)
