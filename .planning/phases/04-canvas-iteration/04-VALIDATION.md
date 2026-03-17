---
phase: 4
slug: canvas-iteration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (ships with Vite, zero-config for Vite projects) |
| **Config file** | `canvas/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `cd canvas && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd canvas && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd canvas && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd canvas && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | CANV-01 | unit | `cd canvas && npx vitest run src/__tests__/VariationGrid.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | CANV-02 | unit | `cd canvas && npx vitest run src/__tests__/annotations.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | CANV-03 | unit | `cd canvas && npx vitest run src/__tests__/Timeline.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | CANV-04 | unit | `cd canvas && npx vitest run mcp/__tests__/tools.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 0 | CANV-05 | unit | `cd canvas && npx vitest run src/__tests__/sessions.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `canvas/vitest.config.ts` — Vitest configuration
- [ ] `canvas/src/__tests__/VariationGrid.test.tsx` — stubs for CANV-01
- [ ] `canvas/src/__tests__/annotations.test.ts` — stubs for CANV-02
- [ ] `canvas/src/__tests__/Timeline.test.tsx` — stubs for CANV-03
- [ ] `canvas/mcp/__tests__/tools.test.ts` — stubs for CANV-04
- [ ] `canvas/src/__tests__/sessions.test.ts` — stubs for CANV-05
- [ ] Framework install: `cd canvas && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side-by-side visual layout renders correctly | CANV-01 | Visual layout requires browser rendering | Open canvas in browser, load a session with 3+ variations, verify iframes display at native dimensions without overlap |
| Annotation pins appear at correct positions | CANV-02 | CSS positioning requires visual confirmation | Add annotation to variation, reload page, verify pin is at same position |
| MCP tools accessible from Claude Code | CANV-04 | Requires running Claude Code instance | Run `claude mcp add`, verify tools show in `/mcp` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
