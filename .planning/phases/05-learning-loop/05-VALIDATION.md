---
phase: 05
slug: learning-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in (`--test` self-test flag on CJS tools) + Vitest (canvas tests) |
| **Config file** | `canvas/vite.config.ts` (vitest inline) |
| **Quick run command** | `node tools/feedback-ingest.cjs --test` |
| **Full suite command** | `node tools/feedback-ingest.cjs --test && cd canvas && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tools/feedback-ingest.cjs --test`
- **After every plan wave:** Run `node tools/feedback-ingest.cjs --test && cd canvas && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | META-01 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | META-01 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | META-01 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | META-02 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | META-02 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | META-02 | unit | `node tools/feedback-ingest.cjs --test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tools/feedback-ingest.cjs` — create file with `--test` self-test flag
- [ ] `feedback/proposals/` — create directory (`.gitkeep`)
- [ ] Verify `node tools/compile-rules.cjs` exits 0

*Wave 0 sets up test infrastructure; all META-01/META-02 tests are stubs until implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive approval walkthrough | META-02 | AskUserQuestion requires live CLI session | Run `/feedback-ingest` with real session data, verify each proposal presented with approve/reject options |
| `/fluid-design-os-feedback` guided flow | META-01 | Interactive skill with user prompts | Run `/fluid-design-os-feedback`, verify session auto-detect, guided questions, file output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
