---
phase: 11
slug: anthropic-api-generation-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `canvas/vitest.config.ts` |
| **Quick run command** | `cd canvas && npm test` |
| **Full suite command** | `cd canvas && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd canvas && npm test`
- **After every plan wave:** Run `cd canvas && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | API-01 | unit | `cd canvas && npm test -- api-pipeline` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | API-03 | unit | `cd canvas && npm test -- api-pipeline` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | API-04 | unit | `cd canvas && npm test -- api-pipeline` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | API-02, API-07 | unit | `cd canvas && npm test -- api-pipeline` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | API-05 | unit | `cd canvas && npm test -- api-pipeline` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 1 | API-06 | unit | `cd canvas && npm test -- generate` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `canvas/src/__tests__/api-pipeline.test.ts` — stubs for API-01 through API-07
- [ ] SDK install: `cd canvas && npm install @anthropic-ai/sdk`

*Existing Vitest infrastructure covers framework — no new test config needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full pipeline generates valid HTML from prompt | API-02 | Requires real API key + visual inspection | Type prompt in sidebar, verify styled HTML output |
| SSE streaming visible in sidebar during generation | API-05 | Real-time UI behavior | Watch chat sidebar during generation, confirm stage progress messages appear |
| CLI fallback works when explicitly requested | API-06 | Full integration with claude binary | Set engine=cli, confirm claude -p spawns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
