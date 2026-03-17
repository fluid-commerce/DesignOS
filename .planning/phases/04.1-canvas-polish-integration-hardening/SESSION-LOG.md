# Phase 04.1 Session Log

**Phase:** Canvas Polish & Integration Hardening (Iteration Workflow Fix)
**Date:** 2026-03-11
**Duration:** Full session (planning through execution + live debugging)

---

## Timeline

### 1. Planning (`/gsd:plan-phase 04.1`)

Discuss-phase had already been completed with the user's design decisions captured in `04.1-CONTEXT.md`. Key decisions:
- Sidebar is the single prompt surface (remove IteratePanel)
- Agent generates human-readable titles
- Context bundler auto-bundles winner HTML + annotations for iteration
- Annotations scoped per-variation, not migrated across rounds
- Iteration creates new rounds in same session directory

Research agent produced `04.1-RESEARCH.md` (27KB) covering SSE patterns, Zustand store architecture, and session discovery.

Planner created 5 plans across 3 waves:
- **Wave 0:** Plan 01 (type foundation + context-bundler)
- **Wave 1:** Plan 02 (sidebar mode switching + stream extension)
- **Wave 2:** Plans 03 + 04 in parallel (server endpoint + timeline component)
- **Wave 3:** Plan 05 (end-to-end wiring + verification)

Plan checker validated all plans.

### 2. Execution (`/gsd:execute-phase 04.1`)

**Waves 0-2 completed by executor agents.** All plans produced working code with tests passing.

**Wave 3 (Plan 05) hit a checkpoint** — executor agent exhausted context before completing the final wiring. The remaining work was completed manually during live debugging.

### 3. Live Debugging — Critical Bugs Found by User

After execution, the user tested the app manually and discovered several critical issues:

#### Bug 1: Generated sessions not appearing in Recent Sessions
**Symptom:** Generation says "Done" in sidebar, but main window shows "Select a session to view variations" and new session doesn't appear in sidebar list. Even after refresh.
**Root cause:** Server relied on Claude agent to write `lineage.json` — Claude often didn't write it, or wrote it with wrong schema (`id` instead of `sessionId`, missing `platform`). `parseLineage()` silently rejected these.
**Fix:**
- Server writes `lineage.json` immediately on session creation (before spawning agent)
- `parseLineage()` accepts `id` as fallback for `sessionId`, defaults `platform` from `mode`/`type`
**Why E2E passed but manual didn't:** E2E test created a session via API and checked lineage file immediately — the server had just written it. Real generations depended on Claude writing it later, which was unreliable.

#### Bug 2: MCP permission error during iteration
**Symptom:** Agent says "I'm unable to proceed without access to the annotations. Please approve the mcp_fluid-canvas__read_annotations tool..." — then main window shows "no variations to display" with no recovery path.
**Root cause:** `claude -p` subprocess spawned without MCP tools in `--allowedTools` and no `--mcp-config` flag. Also `mcp__fluid-canvas__*` wasn't in `settings.local.json`.
**Fix:** Added all MCP tools to `--allowedTools` flag, pass `--mcp-config` when available, added permission to settings.

#### Bug 3: Iteration created new empty session instead of reusing existing
**Symptom:** Clicking "Iterate" created a brand new empty session directory instead of adding a round to the current session.
**Root cause:** `mkdir` ran unconditionally before iteration mode detection. `handleGenerate` in PromptSidebar never passed `sessionId`/`iterationContext` to generate.
**Fix:** Moved `mkdir` inside non-iteration branch. Wired `buildIterationContext()` into `handleGenerate`.

#### Bug 4: Session titles showing as numbers
**Symptom:** Recent Sessions list showed raw `YYYYMMDD-HHMMSS` strings instead of human-readable names.
**Root cause:** `title: null` in lineage.json, no title generation logic. `SessionSummary` type didn't have `title` field.
**Fix:** Server generates title from first 6 words of prompt. Added `title` to `SessionSummary` type and `discoverSessions()`.

#### Bug 5: Sessions showing "no variations yet" despite having HTML files
**Symptom:** Clicking on sessions showed 0 variations, even though HTML files existed on disk.
**Root cause:** `discoverSessions()` used `countVariations(lineage)` from lineage metadata — which was often 0 because Claude never updated the variations array. Also 40 empty e2e test sessions cluttered the list.
**Fix:** Count via `findVariationFiles()` on disk, fall back to lineage count. Cleaned up empty test sessions.

#### Bug 6: E2BIG spawn error on iteration
**Symptom:** `Generation failed: {"error":"Error: spawn E2BIG"}` when iterating on a session with large HTML (2.1MB).
**Root cause:** Full winner HTML was passed inline as a CLI argument to `claude -p`, exceeding OS argument size limit.
**Fix:** Write winner HTML to `.iteration-winner.html` temp file in session directory. Tell agent to `Read` the file.

#### Bug 7: White screen on session click / during iteration (initial attempt)
**Symptom:** Clicking any session or mid-iteration, entire screen goes white with no recovery. Persists after server restart.
**Root cause (initial diagnosis):** No React error boundary — any render error crashes the entire component tree. File watcher refreshing during generation caused partial files to flicker.
**Initial fix:**
- Added `ErrorBoundary` component wrapping session view
- File watcher pauses during active generation
- Main pane shows spinner during generation, hides VariationGrid entirely
- Right sidebar also hidden during generation
**Result:** Partially helped but did NOT fully fix the white screen. See Bug 9 for the true root cause.

#### Bug 8: Iteration UX confusing — duplicate copies appearing
**Symptom:** When iteration starts, a duplicate copy of the original design appears immediately to the left. Then a new version appears below with no changes. Then changes get applied. Very confusing.
**Root cause:** File watcher triggered `refreshSessions()` every 200ms during generation. As the agent read/wrote files, each intermediate state was picked up and rendered as a "variation."
**Fix:** File watcher pauses when `generationStatus === 'generating'`. Main pane shows only the generating spinner until completion. Variations only appear after generation completes and final `selectSession()` loads the finished data.

#### Bug 9: White screen — THE REAL ROOT CAUSE (Session 2, parallel debug)
**Symptom:** After iteration, clicking on the iterated session (or any session) causes permanent white screen. Persists across refreshes and server restarts. ErrorBoundary from Bug 7 fix did NOT catch this.
**Investigation method:** Two parallel debug agents in isolated git worktrees, attacking from different angles.
**Root cause (confirmed by both agents independently):**

**Primary: `.iteration-winner.html` loaded as a variation.**
The E2BIG fix (Bug 6) writes winner HTML to `.iteration-winner.html` in the session directory. But `isVariationFile()` only excluded `copy.html`, `layout.html`, `index.html` — NOT dotfiles. Node's `readdir()` returns dotfiles. So `.iteration-winner.html` (2.1MB) was loaded as a third "variation" alongside the two real ones. Total: **6.3MB of HTML loaded into 3 simultaneous iframes**, crashing the browser tab (not a JS error — a browser-level memory/rendering crash). ErrorBoundary can't catch browser tab crashes. The file persists on disk, so every click re-crashes.

**Secondary: `StatusBadge` crash on undefined status.**
The `StatusBadge` component did `STATUS_STYLES[status]` without a fallback. Iteration-created lineage entries had non-standard variation schemas (missing `status` field). `STATUS_STYLES[undefined]` returns `undefined`, and accessing `.bg` throws — killing the React tree. The `Timeline` component (which renders `StatusBadge`) was OUTSIDE the ErrorBoundary.

**Tertiary: `generationStatus` stuck on `'complete'` forever.**
After generation, the Zustand store status stayed `'complete'` and was never reset. When clicking a different session, the `useEffect` in App.tsx re-fired the auto-select logic, potentially overriding user's manual selection and creating loops.

**Tertiary: Race condition in `selectSession`.**
Rapid session clicking could cause stale API responses to overwrite newer ones (no request ordering).

**Fixes (7 total):**
1. `sessions.ts` — `isVariationFile()` excludes dotfiles: `if (filename.startsWith('.')) return false`
2. `StatusBadge.tsx` — Fallback: `STATUS_STYLES[status] ?? STATUS_STYLES.unmarked`
3. `AssetFrame.tsx` — 10MB HTML size guard: shows "Preview too large" placeholder instead of crashing iframe
4. `App.tsx` — `resetGeneration()` called after completion effect
5. `App.tsx` — Timeline/Notes sidebar wrapped in ErrorBoundary
6. `store/sessions.ts` — Request counter discards stale responses from rapid clicking
7. `main.tsx` — Top-level ErrorBoundary wrapping `<App />` as last-resort crash handler

**Why previous fix attempts failed:** Bug 7's ErrorBoundary was correctly placed but the crash was a browser-level tab crash (6.3MB in iframes), not a JavaScript exception. React error boundaries only catch JS errors in the render tree. The true fix was preventing the bad data from reaching the render tree at all (excluding `.iteration-winner.html`).

#### Bug 10: Preview too large threshold too aggressive
**Symptom:** After Bug 9 fix, real designs showed "Preview too large — 2.0 MB" placeholder instead of rendering.
**Root cause:** Initial size guard was 1.5MB, but generated designs are legitimately 2MB+ because the Claude agent embeds all images as inline base64 data URIs.
**Fix:** Raised threshold from 1.5MB to 10MB. The guard is only meant to catch catastrophic cases (multiple iframes totaling 10MB+), not normal designs.

---

## Key Architecture Decisions Made During Debugging

1. **Server writes lineage.json, not Claude** — The agent is unreliable at writing metadata files with correct schemas. Server creates authoritative lineage on session creation; agent only updates it (e.g., filling in variation paths after generation).

2. **Winner HTML goes to temp file, not CLI args** — HTML assets can be arbitrarily large (2MB+). CLI argument limits are ~256KB on macOS. Always write large payloads to temp files.

3. **File watcher pauses during generation** — Showing in-progress files is confusing and error-prone. The spinner-only approach during generation is cleaner. Data loads once when generation completes.

4. **Error boundaries are mandatory at MULTIPLE levels** — The iframe `srcDoc` with large HTML, combined with async state race conditions, can crash React's render tree. Error boundaries at top-level (`main.tsx`), session view, AND right sidebar are all needed because a crash in any one area shouldn't kill the others.

5. **Disk-based variation counting over metadata** — The lineage.json `variations` array is often stale or empty (agent forgets to update it). Counting actual HTML files on disk is more reliable.

6. **Temp files must be excluded from variation scanning** — Any file written to a session directory that starts with `.` or is in the `INTERMEDIATE_FILES` set gets excluded from `findVariationFiles()`. The `.iteration-winner.html` incident proved that stray HTML files can crash the entire app.

7. **Defensive rendering for all external data** — Components like `StatusBadge` must have fallbacks for unknown/undefined values. Data from disk (written by Claude agent) is unpredictable and should be treated like untrusted external input.

8. **Generation status must reset after completion** — The Zustand generation store status must be reset to `'idle'` after the completion effect runs, or it interferes with subsequent manual session selections.

9. **Generated HTML uses inline base64 images** — Claude embeds all images as `data:image/png;base64,...` URIs directly in the HTML. This is why files are 2MB+ and is expected behavior. Size guards should be set high (10MB) to only catch truly catastrophic cases.

---

## Files Modified (Complete List)

### Core Application
- `canvas/src/App.tsx` — Error boundary (session + sidebar), generation state guards, resetGeneration on completion, IteratePanel removal
- `canvas/src/main.tsx` — Top-level ErrorBoundary wrapping `<App />`
- `canvas/src/components/ErrorBoundary.tsx` — **NEW** — React error boundary with recovery UI
- `canvas/src/components/StatusBadge.tsx` — Nullish coalescing fallback for undefined status values
- `canvas/src/components/AssetFrame.tsx` — 10MB HTML size guard (placeholder for oversized content)
- `canvas/src/components/PromptSidebar.tsx` — Session-aware mode, iteration context wiring
- `canvas/src/components/VariationGrid.tsx` — Improved empty state
- `canvas/src/components/Timeline.tsx` — Round-based timeline

### Server & Data Layer
- `canvas/src/server/watcher.ts` — Iteration detection, server-side lineage creation, MCP tools, E2BIG fix (winner HTML to temp file)
- `canvas/src/lib/sessions.ts` — Tolerant parseLineage, disk-based variation counting, title support, dotfile exclusion in `isVariationFile()`
- `canvas/src/lib/types.ts` — IterationContext, GenerateRequestBody, title fields
- `canvas/src/lib/context-bundler.ts` — buildIterationContext implementation

### Hooks & Stores
- `canvas/src/hooks/useFileWatcher.ts` — Pauses during generation
- `canvas/src/hooks/useGenerationStream.ts` — Extended GenerateOptions for iteration
- `canvas/src/store/generation.ts` — No changes (already had activeSessionId)
- `canvas/src/store/sessions.ts` — Request counter for stale response detection on rapid session clicking

### Tests
- `canvas/e2e/generation-flow.spec.ts` — **NEW** — 4 e2e tests
- `canvas/e2e/phase-04.1-iteration.spec.ts` — **NEW** — 15 e2e tests

### Configuration
- `.claude/settings.local.json` — MCP permissions added

---

## Remaining Work / Known Issues

1. **Old sessions have `(no title)`** — Sessions created before the title fix show `null` title. Could be backfilled but not critical.
2. **`checkpoint-verification.spec.ts` references removed IteratePanel** — 5 pre-existing e2e tests reference the deleted component and need updating.
3. **Round-based collapsible timeline in main pane** — The CONTEXT.md envisioned a vertical timeline of all rounds in the main pane (each round collapsible). Currently just shows the latest variations flat. This is a UX enhancement, not a blocker.
4. **Inline title editing** — CONTEXT.md mentioned users can edit the project title inline. Not implemented yet.
5. **Phase 04.1 not formally closed** — The execute-phase workflow was interrupted. Needs verify_phase_goal + roadmap update.
6. **Iteration end-to-end not yet verified working** — The white screen bugs blocked live testing of iteration. The data pipeline is wired and bugs are fixed, but a clean iteration test hasn't been completed yet.

## Investigation Methodology Note

The white screen bug (Bug 9) was ultimately solved by running **two independent debug agents in parallel git worktrees**. Both agents converged on the same primary root cause (`.iteration-winner.html` loaded as variation), which gave high confidence in the fix. This parallel-investigation pattern is effective for persistent bugs where previous single-agent attempts have claimed fixes that didn't hold.
