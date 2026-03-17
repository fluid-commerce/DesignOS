---
phase: 11-anthropic-api-generation-pipeline
plan: "01"
subsystem: server/api
tags: [anthropic-sdk, tool-use, pipeline, type-definitions, testing]
dependency_graph:
  requires: []
  provides: [anthropic-client, PIPELINE_TOOLS, executeTool, loadStagePrompt, STAGE_MODELS, SSE-helpers]
  affects: [canvas/src/server/api-pipeline.ts]
tech_stack:
  added: ["@anthropic-ai/sdk@latest"]
  patterns: [singleton-client, tool-executor-pattern, disk-backed-skill-prompts, fallback-prompts]
key_files:
  created:
    - canvas/src/server/api-pipeline.ts
    - canvas/src/__tests__/api-pipeline.test.ts
  modified:
    - canvas/package.json
    - canvas/package-lock.json
    - canvas/vitest.config.ts
decisions:
  - PROJECT_ROOT resolves to Fluid-DesignOS root (3 levels up from canvas/src/server/), not canvas/ — brand/, tools/, patterns/ all live at project root
  - loadStagePrompt reads ~/.agents/skills/*/SKILL.md from disk for primary path; falls back to hardcoded prompts only on file read failure
  - write_file security check uses resolvedPath.startsWith(workingDir + path.sep) to prevent path traversal
  - api-pipeline.test.ts uses node environment (added to vitest.config.ts environmentMatchGlobs) — Anthropic SDK fails in jsdom
metrics:
  duration: 7min
  completed: "2026-03-16"
  tasks_completed: 2
  files_modified: 5
---

# Phase 11 Plan 01: Anthropic SDK Foundation Summary

Install @anthropic-ai/sdk, define tool schemas, implement the tool executor and stage prompt loader. Foundational building blocks for Plan 02's pipeline orchestrator.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install SDK and create api-pipeline.ts | 4928038 | canvas/package.json, canvas/src/server/api-pipeline.ts |
| 2 | Unit tests for tool executor, schemas, prompt loader | 57042ea | canvas/src/__tests__/api-pipeline.test.ts, canvas/vitest.config.ts |

## Exports from api-pipeline.ts

- `anthropic` — Anthropic SDK client singleton (reads `ANTHROPIC_API_KEY` from env)
- `PipelineStage`, `FixTarget`, `StageResult`, `PipelineContext` — pipeline types
- `STAGE_MODELS` — stage to model mapping (haiku for layout, sonnet for creative)
- `PIPELINE_TOOLS` — all 4 tool schemas (read_file, write_file, list_files, run_brand_check)
- `STAGE_TOOLS` — per-stage tool subset
- `executeTool(name, input, workingDir)` — executes tool calls, path-sandboxed
- `loadStagePrompt(stage, ctx)` — async, reads skill .md from disk, extracts stage section
- `emitText`, `emitToolStart`, `emitToolDone`, `emitStageStatus` — SSE helpers

## Test Coverage (32 tests, all passing)

- STAGE_MODELS mapping correctness
- All 4 tool schemas validated (name, description, required fields)
- read_file: reads real brand docs, returns error string on missing file
- write_file: writes inside workingDir, rejects paths outside (path traversal prevention), creates parent dirs
- list_files: lists brand directory, filters by glob pattern, handles missing dir
- run_brand_check: calls CLI via mocked execSync, handles CLI failures
- unknown tool: returns descriptive error string
- loadStagePrompt: loads from fluid-social SKILL.md for all 4 stages, falls back to hardcoded prompts, injects context variables

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PROJECT_ROOT path resolution**
- **Found during:** Task 2 (list_files test failure)
- **Issue:** Plan specified `path.resolve(__dirname, '../..')` (2 levels up from `canvas/src/server/`) = `canvas/`. But `brand/`, `tools/`, `patterns/` all live at `Fluid-DesignOS/` (3 levels up).
- **Fix:** Changed to `path.resolve(__dirname, '../../..')` so relative paths like `brand/voice-rules.md` resolve correctly.
- **Files modified:** canvas/src/server/api-pipeline.ts
- **Commit:** 57042ea

**2. [Rule 3 - Blocking] Added api-pipeline.test.ts to node environment in vitest.config.ts**
- **Found during:** Task 2 (test suite error)
- **Issue:** Vitest defaults to jsdom environment; Anthropic SDK throws "browser-like environment" error in jsdom.
- **Fix:** Added `['src/__tests__/api-pipeline.test.ts', 'node']` to `environmentMatchGlobs` in vitest.config.ts.
- **Files modified:** canvas/vitest.config.ts
- **Commit:** 57042ea

## Self-Check: PASSED
