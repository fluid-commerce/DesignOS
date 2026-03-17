---
phase: 11-anthropic-api-generation-pipeline
verified: 2026-03-16T18:30:00Z
status: gaps_found
score: 5/6 must-haves verified
re_verification: false
gaps:
  - truth: "Stage progress is visible in the chat sidebar during generation"
    status: failed
    reason: "emitStageStatus() emits { type: 'stage_status', ... } events but stream-parser.ts has no handler for this event type — it falls through to the final 'return null' (filtered). Stage status events are sent over the wire but never rendered in the sidebar."
    artifacts:
      - path: "canvas/src/lib/stream-parser.ts"
        issue: "parseStreamEvent() has no case for event.type === 'stage_status'; these events are silently dropped"
      - path: "canvas/src/server/api-pipeline.ts"
        issue: "emitStageStatus() correctly emits events but client-side consumer does not render them"
    missing:
      - "Add a handler in stream-parser.ts for event.type === 'stage_status' that returns a StreamUIMessage with type: 'status' and content like 'Stage: copy starting' or similar"
  - truth: "Requirements API-01 through API-07 are defined in REQUIREMENTS.md"
    status: failed
    reason: "API-01 through API-07 are referenced in ROADMAP.md and defined in 11-RESEARCH.md, but they are not present in REQUIREMENTS.md at all. The canonical requirements file has no API-* section."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "No API-* requirements section; 87 requirements listed, none are API-prefixed"
    missing:
      - "Add API-01 through API-07 definitions to .planning/REQUIREMENTS.md under a new 'Anthropic API Pipeline' section, or formally note they are phase-scoped and not v1 requirements"
human_verification:
  - test: "Trigger a real generation with ANTHROPIC_API_KEY set and observe sidebar during pipeline run"
    expected: "Four distinct stage progress indicators appear in chat (copy, layout, styling, spec-check) and the final HTML asset is visible in the campaign view"
    why_human: "Requires real Anthropic API key, real-time streaming behavior, and visual inspection of sidebar rendering — cannot verify programmatically"
  - test: "Submit a request with body.engine='cli' and confirm spawn behavior"
    expected: "claude -p is spawned instead of runApiPipeline, SSE stream contains the CLI stream-json NDJSON format"
    why_human: "Requires claude binary installed and running dev server; cannot mock-test the full spawn path end-to-end"
---

# Phase 11: Anthropic API Generation Pipeline — Verification Report

**Phase Goal:** Replace CLI-spawned `claude -p` generation with direct Anthropic API calls from the Vite server, running the full orchestrator pipeline (copy → layout → styling → spec-check → fix loop) with tool use, streaming responses to the chat sidebar via SSE. CLI path preserved as explicit fallback only.
**Verified:** 2026-03-16T18:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Anthropic SDK is installed and importable without error | VERIFIED | `@anthropic-ai/sdk@^0.79.0` in canvas/package.json; `import Anthropic from '@anthropic-ai/sdk'` at line 7 of api-pipeline.ts; 44 tests passing that import from it |
| 2 | Tool schemas define read_file, write_file, list_files, run_brand_check with valid JSON Schema | VERIFIED | All 4 tools defined in api-pipeline.ts lines 61-129; each has name, description, and input_schema with required fields; 6 schema tests passing |
| 3 | Tool executor reads/writes/lists files and runs brand-compliance CLI; rejects writes outside workingDir | VERIFIED | executeTool() at lines 161-246; path traversal check at line 190; resolvedPath.startsWith(resolvedWorking + path.sep) pattern; write_file sandbox and path traversal tests passing |
| 4 | Skill .md files are loaded from disk and transformed into system prompts for each pipeline stage | VERIFIED | loadStagePrompt() at lines 335-377; reads ~/.agents/skills/*/SKILL.md via fs.readFile; extractStageSection() extracts stage-specific section; fallback to hardcoded prompt on error; 10 prompt loader tests passing |
| 5 | Pipeline orchestrator runs 4 stages (copy, layout, styling, spec-check) sequentially with fix loop (max 3 iterations) and cascade rule; default path uses API | VERIFIED | runApiPipeline() at lines 582-668; runStageWithTools() agentic loop at lines 495-572; fix loop at lines 616-667; cascade rule at lines 640-647; engine routing `body.engine ?? 'api'` at watcher.ts line 1195; all wired and tested |
| 6 | Stage progress is visible in the chat sidebar during generation | FAILED | emitStageStatus() at lines 421-433 emits { type: 'stage_status', ... }; stream-parser.ts has NO handler for this event type — it falls through to `return null` at line 141 and is silently filtered. stage_status events are emitted to the wire but never rendered in the UI. |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `canvas/src/server/api-pipeline.ts` | SDK client, tool schemas, tool executor, stage prompt loader, pipeline types, SSE helpers, agentic loop, orchestrator | VERIFIED | 669 lines; exports: anthropic, STAGE_MODELS, PIPELINE_TOOLS, STAGE_TOOLS, executeTool, loadStagePrompt, emitText, emitToolStart, emitToolDone, emitStageStatus, runStageWithTools, runApiPipeline |
| `canvas/src/__tests__/api-pipeline.test.ts` | Unit tests for all pipeline components | VERIFIED | 694 lines; 44 tests all passing; covers: STAGE_MODELS, tool schemas, all 4 tool executor cases, loadStagePrompt (9 sub-tests), runStageWithTools (5 sub-tests), runApiPipeline (2 sub-tests), engine routing (3 sub-tests) |
| `canvas/src/server/watcher.ts` (modified) | Engine routing in /api/generate — API default, CLI fallback | VERIFIED | import at line 4; engine detection at line 1195; `if (engine === 'cli')` at line 1289; `runApiPipeline(pipelineCtx, res)` at line 1448 |
| `canvas/package.json` | @anthropic-ai/sdk dependency | VERIFIED | `"@anthropic-ai/sdk": "^0.79.0"` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| canvas/src/server/api-pipeline.ts | @anthropic-ai/sdk | `import Anthropic from '@anthropic-ai/sdk'` | WIRED | Line 7; `anthropic.messages.create()` called in runStageWithTools line 514 |
| canvas/src/server/api-pipeline.ts | brand/*.md | `fs.readFile` in tool executor | WIRED | Lines 172-178; resolves paths relative to PROJECT_ROOT; real file read tested |
| canvas/src/server/api-pipeline.ts | tools/brand-compliance.cjs | `execSync` in run_brand_check tool | WIRED | Lines 229-233; `node "${toolPath}" "${resolvedPath}"` with cwd=PROJECT_ROOT |
| canvas/src/server/api-pipeline.ts | ~/.agents/skills/fluid-*/SKILL.md | `fs.readFile` in loadStagePrompt | WIRED | Lines 345-349; SKILL_FILES mapping at lines 262-267 |
| canvas/src/server/watcher.ts | canvas/src/server/api-pipeline.ts | `import { runApiPipeline }` | WIRED | Line 4; `runApiPipeline(pipelineCtx, res)` at line 1448 |
| canvas/src/server/api-pipeline.ts | canvas/src/lib/stream-parser.ts | SSE events in NDJSON format | PARTIAL | emitText (stream_event/content_block_delta) and emitToolDone (tool_result) ARE handled by stream-parser.ts; emitStageStatus (stage_status) is NOT handled — filtered to null at stream-parser.ts line 141 |

### Requirements Coverage

API-01 through API-07 are defined in `11-RESEARCH.md` (not in `REQUIREMENTS.md`). Traceability is based on the research document definitions:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-01 | 11-01 | Install and configure @anthropic-ai/sdk in Vite server | SATISFIED | SDK at ^0.79.0 in package.json; Anthropic client singleton exported from api-pipeline.ts |
| API-02 | 11-02 | Implement server-side pipeline orchestrator for 4-stage pipeline | SATISFIED | runApiPipeline() chains copy->layout->styling->spec-check; fix loop; tested |
| API-03 | 11-01 | Define tool schemas for brand doc reading, file write, brand-compliance validation | SATISFIED | 4 PIPELINE_TOOLS with valid input_schema; 6 schema tests passing |
| API-04 | 11-01 | Implement tool executor handling tool calls and returning results | SATISFIED | executeTool() handles all 4 tools; path sandboxing; never throws |
| API-05 | 11-02 | Forward API responses to chat sidebar via existing SSE infrastructure | PARTIAL | stream_event/tool_result format wired; stage_status not handled by stream-parser.ts |
| API-06 | 11-02 | Gate claude -p path behind engine=cli; default to API path | SATISFIED | `body.engine ?? 'api'`; `if (engine === 'cli')` wraps all spawn code; tested |
| API-07 | 11-01 | Map skill .md files to system prompts for each pipeline stage | SATISFIED | loadStagePrompt() reads SKILL_FILES from disk; extracts stage section; fallback on error |

**ORPHANED REQUIREMENTS:** API-01 through API-07 are referenced in ROADMAP.md Phase 11 but are NOT present in `.planning/REQUIREMENTS.md`. The traceability table in REQUIREMENTS.md ends at Phase 8 (E2E-07). No API-* section exists in the canonical requirements file.

### Anti-Patterns Found

No anti-patterns found in `canvas/src/server/api-pipeline.ts` or in the engine-routing additions to `canvas/src/server/watcher.ts`. No TODO/FIXME/placeholder comments. No stub implementations.

**Pre-existing test failures (unrelated to Phase 11):**
- 8 tests failing in AppShell, App render, and skill-paths suites — all pre-existed before this phase per 11-02-SUMMARY.md notes. These are not caused by Phase 11 changes.

### Human Verification Required

#### 1. Real API generation end-to-end

**Test:** With `ANTHROPIC_API_KEY` set in `.env`, start the dev server (`cd canvas && npm run dev`), type a prompt in the sidebar and submit. Watch the chat sidebar during the 4-stage generation.
**Expected:** Chat messages appear for tool use (read_file, write_file) during each stage; final HTML asset appears in campaign view after generation completes.
**Why human:** Requires real API key, real-time streaming behavior, visual inspection.

#### 2. CLI fallback path

**Test:** Send a generate request with `body.engine = 'cli'` (via dev tools or modified frontend call). Confirm the spawn path is taken.
**Expected:** `claude -p` is spawned (visible via server logs or process monitor); SSE stream contains the CLI stream-json NDJSON format (not stage_status events).
**Why human:** Requires claude binary installed and running server; cannot mock-test the full spawn path end-to-end.

### Gaps Summary

**Gap 1 (Blocker — API-05 partial): stage_status events not displayed in chat sidebar.**

`emitStageStatus()` correctly emits `{ type: 'stage_status', creationId, stage, status }` over the SSE wire. However, `stream-parser.ts`'s `parseStreamEvent()` has no case for `event.type === 'stage_status'` — these events fall through to `return null` and are silently discarded. The user cannot see "copy starting", "layout done", etc. in the sidebar during generation.

This is a single-file fix: add a `stage_status` case to `stream-parser.ts` returning a `StreamUIMessage` with `type: 'status'` and content summarizing the stage + status.

**Gap 2 (Documentation): API requirements not in REQUIREMENTS.md.**

API-01 through API-07 exist only in `11-RESEARCH.md` and are referenced in `ROADMAP.md`, but the canonical `REQUIREMENTS.md` has no API-* section and its traceability table does not map any phase 11 requirement IDs. Either add these to REQUIREMENTS.md or explicitly document that they are phase-scoped implementation requirements rather than v1 product requirements.

---

_Verified: 2026-03-16T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
