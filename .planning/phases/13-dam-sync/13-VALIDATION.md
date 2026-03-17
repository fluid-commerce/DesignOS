---
phase: 13
slug: dam-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured in `canvas/vite.config.ts`) |
| **Config file** | `canvas/vite.config.ts` (test section with environmentMatchGlobs) |
| **Quick run command** | `cd canvas && npx vitest run src/__tests__/dam-sync.test.ts` |
| **Full suite command** | `cd canvas && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd canvas && npx vitest run src/__tests__/dam-sync.test.ts`
- **After every plan wave:** Run `cd canvas && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | flattenDamTree | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "flattenDamTree"` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | upsertDamAsset insert | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "upsert"` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | upsertDamAsset incremental | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "incremental"` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | softDeleteRemovedDamAssets | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "soft-delete"` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | DB migration columns | unit | `npx vitest run src/__tests__/db.test.ts` | Extend existing | ⬜ pending |
| 13-02-02 | 02 | 1 | /api/brand-assets includes DAM | integration | `npx vitest run src/__tests__/brand-assets.test.ts` | Extend existing | ⬜ pending |
| 13-03-01 | 03 | 2 | /api/dam-sync POST | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "POST endpoint"` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | runDamSync offline handling | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "offline"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `canvas/src/__tests__/dam-sync.test.ts` — stubs for flattenDamTree, upsert, incremental sync, soft-delete, offline handling, POST endpoint
- [ ] `canvas/vite.config.ts` — add `['src/__tests__/dam-sync.test.ts', 'node']` to environmentMatchGlobs (DAM sync is server-only)

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DAM assets appear in Assets UI | UI rendering | Requires browser | Open Assets tab, verify DAM-synced assets display with thumbnails |
| "Sync now" button triggers sync | UI interaction | Requires browser | Click sync button, verify toast/indicator, verify new DAM assets appear |
| "Last synced" indicator updates | UI state | Requires browser | After sync, verify timestamp updates in UI |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
