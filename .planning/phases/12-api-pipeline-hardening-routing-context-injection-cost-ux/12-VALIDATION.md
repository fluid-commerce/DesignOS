---
phase: 12
slug: api-pipeline-hardening-routing-context-injection-cost-ux
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
updated: 2026-03-17
---

# Phase 12 — Validation Strategy

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
- **Before `/gsd:verify-work`:** Full suite must be green (or documented skips only)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-01 | 01 | 1 | CLEAN-01 | absence check | `grep -qE 'spawn\|activeChild\|ChildProcess\|createInterface\|createReadStream\|engine.*cli' canvas/src/server/watcher.ts && echo FAIL \|\| echo PASS` | pending |
| 12-01-02 | 01 | 1 | CLEAN-02 | integration | `cd canvas && npx vitest run --reporter=verbose 2>&1 \| tail -20` | pending |
| 12-02-01 | 02 | 1 | CLEAN-03 | absence check | `ls tools/compile-rules.cjs tools/rules.json 2>&1 \| grep -c "No such file"` | pending |
| 12-02-02 | 02 | 1 | CLEAN-04, CLEAN-05 | absence check | `ls -d .planning/phases/10-voice-guide* .planning/phases/11-patterns* .planning/phases/12-templates* .planning/phases/13-pipeline* .planning/phases/14-dam* 2>&1 \| grep -c "No such file"` | pending |
| 12-03-01 | 03 | 2 | CLEAN-06 | integration | `cd canvas && npx vitest run --reporter=verbose 2>&1 \| tail -5` | pending |
| 12-03-02 | 03 | 2 | CLEAN-08 | absence check | `grep -rcE '#[0-9A-Fa-f]{6}' <skill-files> \| grep -v ':0$'` (should return empty) | pending |
| 12-03-03 | 03 | 2 | CLEAN-07 | content check | `grep -c "compile-rules\|rules\.json" CLAUDE.md` (should return 0) | pending |

*Status: pending | green | red | flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 12 is a cleanup phase — verification uses grep/ls absence checks and existing vitest suite rather than new test files. No Wave 0 test scaffolding needed.

---

## Requirement Coverage

| Req ID | Description | Plan | Task |
|--------|-------------|------|------|
| CLEAN-01 | Remove CLI generation paths from watcher.ts | 01 | 01 |
| CLEAN-02 | Clean up CLI-referencing tests | 01 | 02 |
| CLEAN-03 | Migrate brand-compliance.cjs to SQLite DB reads | 02 | 01 |
| CLEAN-04 | Delete compile-rules.cjs and rules.json | 02 | 01 |
| CLEAN-05 | Delete orphaned phase directories, update STATE.md | 02 | 02 |
| CLEAN-06 | Fix pre-existing test failures, audit stale references | 03 | 01, 03 |
| CLEAN-07 | Update CLAUDE.md to reflect DB-backed reality | 03 | 03 |
| CLEAN-08 | Slim project-level skill files (strip embedded brand data) | 03 | 02 |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| brand-compliance.cjs runs against a sample HTML file | CLEAN-03 | Requires seeded DB | Run app once, then `node tools/brand-compliance.cjs canvas/.fluid/campaigns/*/output.html` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not needed (cleanup phase uses absence/content checks)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
