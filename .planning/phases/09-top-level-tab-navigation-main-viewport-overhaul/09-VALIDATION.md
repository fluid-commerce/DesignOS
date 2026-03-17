---
phase: 10
slug: top-level-tab-navigation-main-viewport-overhaul
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | canvas/vitest.config.ts |
| **Quick run command** | `cd canvas && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd canvas && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd canvas && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd canvas && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-00 | 01 | 1 | Wave 0 | scaffold | `cd canvas && npx vitest run src/__tests__/LeftNav.test.tsx src/__tests__/AppShell.test.tsx` | Created by Task 0 | ⬜ pending |
| 10-01-01 | 01 | 1 | NAV-01, NAV-02 | unit | `cd canvas && npx vitest run src/__tests__/LeftNav.test.tsx` | Created by 10-01 Task 0, real assertions by Task 1 | ⬜ pending |
| 10-01-02 | 01 | 1 | NAV-03, NAV-05, NAV-06 | unit | `cd canvas && npx vitest run src/__tests__/AppShell.test.tsx` | Created by 10-01 Task 0, real assertions by Task 2 | ⬜ pending |
| 10-02-00 | 02 | 2 | Wave 0 (NAV-07, NAV-08) | scaffold | `cd canvas && npx vitest run src/__tests__/VoiceGuide.test.tsx` | Created by 10-02 Task 1 Step 0 | ⬜ pending |
| 10-02-01 | 02 | 2 | NAV-07, NAV-08 | unit | `cd canvas && npx vitest run src/__tests__/VoiceGuide.test.tsx` | Real assertions by 10-02 Task 1 Step 5 | ⬜ pending |
| 10-02-02 | 02 | 2 | NAV-02 | unit | `cd canvas && npx vitest run src/__tests__/campaign-store.test.ts` | Existing, updated by 10-02 Task 2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `canvas/src/__tests__/LeftNav.test.tsx` — created by 10-01 Task 0, real assertions by Task 1
- [x] `canvas/src/__tests__/AppShell.test.tsx` — created by 10-01 Task 0, real assertions by Task 2
- [x] `canvas/src/__tests__/VoiceGuide.test.tsx` — created by 10-02 Task 1 Step 0, real assertions by Step 5
- [ ] `react-markdown` + `remark-gfm` — install in 10-02 Task 1 Step 2

*All Wave 0 test files are now created by plan tasks. Nyquist compliance achieved.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Iframe loads templates/index.html | NAV-05 | Requires running Vite dev server + browser | Start dev server, click Templates tab, verify page renders |
| Iframe loads patterns/index.html | NAV-06 | Requires running Vite dev server + browser | Start dev server, click Patterns tab, verify page renders |
| Chat sidebar collapse animation | NAV-03 | Visual smoothness check | Toggle chat sidebar, verify smooth transition and viewport expansion |
| Left nav hover tooltips | NAV-01 | Visual/interaction check | Hover each icon, verify tooltip appears with correct name |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
