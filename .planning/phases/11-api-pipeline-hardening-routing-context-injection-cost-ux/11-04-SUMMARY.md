---
phase: 11-api-pipeline-hardening-routing-context-injection-cost-ux
plan: "04"
subsystem: chat-ux
tags: [stream-parser, ux, haiku-narrator, stage-badges, chat-layout]
dependency_graph:
  requires: [11-01]
  provides: [stage-narrative-sse, claude-style-chat-layout]
  affects: [canvas/src/lib/stream-parser.ts, canvas/src/server/api-pipeline.ts, canvas/src/components/PromptSidebar.tsx, canvas/src/components/StreamMessage.tsx]
tech_stack:
  added: []
  patterns: [haiku-narrator, stage-badge-pills, bottom-input-chat-layout, sse-stage-events]
key_files:
  created: []
  modified:
    - canvas/src/lib/stream-parser.ts
    - canvas/src/server/api-pipeline.ts
    - canvas/src/components/StreamMessage.tsx
    - canvas/src/components/PromptSidebar.tsx
    - canvas/src/__tests__/stream-parser.test.ts
decisions:
  - "Tool noise filtered at parser level (null return) AND at displayMessages useMemo for double safety"
  - "Stage-running/stage-done collapse tool-start/tool-done visual noise into meaningful stage-level progress"
  - "Haiku narrator catches errors gracefully with fallback generic narration — never breaks pipeline"
  - "Spacer div (flex:1) before messages pushes content to bottom; shrinks to 0 as messages fill area"
metrics:
  duration: "8min"
  completed: "2026-03-16"
  tasks: 2
  files: 5
---

# Phase 11 Plan 04: Chat UX Overhaul — Stage Badges + Haiku Narrator Summary

Claude-style bottom-input chat layout with per-stage progress badges (running spinner + done checkmark) and Haiku-generated conversational narration after each pipeline stage; all tool-call noise filtered.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Stream parser + SSE events + Haiku narrator | 8911c0c | stream-parser.ts, api-pipeline.ts, stream-parser.test.ts |
| 2 | Claude-style chat layout + stage badge components | 798221b | PromptSidebar.tsx, StreamMessage.tsx |

## What Was Built

### Task 1: Stream Parser + SSE Events + Haiku Narrator

**stream-parser.ts changes:**
- Extended `StreamUIMessage` type to include `'stage-running' | 'stage-done' | 'stage-narrative'` and added `stage?: string` field
- `parseStreamEvent` now returns `null` for `tool_use` content_block_start (filtered)
- `parseStreamEvent` returns `null` for `tool_result` events (filtered)
- `stage_status` with `status: 'starting'` maps to `{ type: 'stage-running' }`
- `stage_status` with `status: 'done'` maps to `{ type: 'stage-done' }`
- `stage_status` with other statuses (max-tokens-reached, fix-N) still maps to `{ type: 'status' }`
- New `stage_narrative` event type maps to `{ type: 'stage-narrative' }`

**api-pipeline.ts additions:**
- `emitStageNarrative(res, creationId, stage, text)` — emits `stage_narrative` SSE event
- `STAGE_LABELS` constant mapping stage keys to human-readable labels
- `generateStageNarrative(stage, stageOutput, ctx, res)` — calls `claude-haiku-4-5-20251001` with 80 max_tokens, generates a 1-sentence conversational summary; fallback on error
- `runApiPipeline` now calls `generateStageNarrative` after each of the 4 stages (copy, layout, styling, spec-check)

**Tests updated:** Existing `tool_use` test updated to expect `null`; existing `stage_status` test updated to expect `stage-running`. Added 5 new tests covering `stage-done`, `stage-narrative`, other stage statuses, and `tool_result` filter.

### Task 2: Claude-Style Chat Layout + Stage Badge Components

**PromptSidebar.tsx restructure:**
- Layout order changed: `[Header (borderBottom)] [Message scroll area (flex:1)] [Input zone (borderTop)]`
- Header is fixed at top with mode label and optional annotation badge + `+ New` button
- Message scroll area has `<div style={{ flex: 1 }} />` spacer before messages — pushes messages to bottom when few
- Input zone at bottom: textarea + Generate button (flex:1) + Stop Generation button (conditional)
- `displayMessages` useMemo now filters `tool-start` and `tool-done` events as double safety
- Removed "Recent Sessions" section

**StreamMessage.tsx additions:**
- `case 'stage-running'`: Blue pill (`backgroundColor: '#1e2d40'`, `color: '#7bb8e0'`) with SVG spinner arc and emoji stage label
- `case 'stage-done'`: Green pill (`backgroundColor: '#1e3d2e'`, `color: '#7be0a0'`) with checkmark and completion label
- `case 'stage-narrative'`: Text bubble (same as `text` type: `#2a2a2e` bg, `#e0e0e0` text) for conversational narration

## Verification

- `cd canvas && npx vitest run src/__tests__/stream-parser.test.ts` — 18/18 PASS
- Full `npx vitest run` — 351 pass, 14 pre-existing failures (ResizeObserver/jsdom in AppShell, VoiceGuide tab assertion, api-pipeline brandCtx signature — all from prior plans, documented below)

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (Pre-existing, Out of Scope)

These failures exist in the test suite prior to this plan and are not caused by Plan 04 changes:

1. **AppShell tests** — `ResizeObserver is not defined` in jsdom environment (BuildHero component)
2. **VoiceGuide.test.tsx** — tab active state assertion failing due to VoiceGuide changes in Plan 11-02
3. **api-pipeline tests** — `getFallbackPrompt` signature was updated by Plan 11-02 linter to require `brandCtx` parameter; existing api-pipeline unit tests were written against the old signature

## Self-Check

- [x] `canvas/src/lib/stream-parser.ts` — exists, contains `stage-narrative` type
- [x] `canvas/src/server/api-pipeline.ts` — exists, contains `generateStageNarrative`
- [x] `canvas/src/components/StreamMessage.tsx` — exists, contains `case 'stage-running':`
- [x] `canvas/src/components/PromptSidebar.tsx` — exists, contains `borderTop: '1px solid #2a2a2e'`
- [x] Commits 8911c0c and 798221b exist in git log

## Self-Check: PASSED
