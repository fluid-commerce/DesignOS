---
phase: 1
slug: brand-intelligence-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:assert` + shell scripts |
| **Config file** | None — Wave 0 installs |
| **Quick run command** | `node tools/brand-compliance.cjs test/sample-bad.html` |
| **Full suite command** | `bash tools/test-all.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tools/brand-compliance.cjs test/sample-bad.html && node tools/schema-validation.cjs test/sample-bad.liquid`
- **After every plan wave:** Run `bash tools/test-all.sh`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BRAND-01 | manual | N/A — structural review | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | BRAND-02 | unit | `node tools/compile-rules.cjs --validate` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | BRAND-03 | unit | `grep -c "Weight:" brand/voice-rules.md` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | BRAND-04 | unit | `grep -c "^###" brand/layout-archetypes.md` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | BRAND-05 | unit | `node tools/validate-asset-index.cjs` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | BRAND-06 | smoke | `open patterns/index.html` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | BRAND-07 | unit | `node tools/check-links.cjs brand/` | ❌ W0 | ⬜ pending |
| 01-01-08 | 01 | 1 | BRAND-08 | unit | `node tools/compile-rules.cjs --validate` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CLI-01 | unit | `node tools/schema-validation.cjs test/sample-bad.liquid` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | CLI-02 | unit | `node tools/brand-compliance.cjs test/sample-bad.html` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | CLI-03 | unit | `node tools/dimension-check.cjs test/sample-wrong-size.html` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | CLI-04 | unit | `node tools/scaffold.cjs test-section && node tools/schema-validation.cjs test-section/index.liquid` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | DIST-01 | smoke | `ls brand/ assets/ tools/ skills/ patterns/ templates/ feedback/` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | DIST-02 | manual | Agent follows install.md end-to-end | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | DIST-03 | integration | `bash sync.sh && ls ~/.claude/skills/fluid-*` | ❌ W0 | ⬜ pending |
| 01-03-04 | 03 | 2 | META-03 | manual | Research doc reviewed | ✅ | ✅ green |
| 01-03-05 | 03 | 2 | META-04 | manual | Research doc reviewed | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/sample-bad.html` — HTML file with intentional brand violations (wrong colors, wrong fonts)
- [ ] `test/sample-bad.liquid` — .liquid file with incomplete schema (missing font sizes, colors, weights)
- [ ] `test/sample-wrong-size.html` — HTML file with wrong dimensions
- [ ] `test/sample-good.html` — HTML file that passes all checks (golden file)
- [ ] `test/sample-good.liquid` — .liquid file that passes schema validation
- [ ] `tools/test-all.sh` — Runner script that executes all validation tools against test fixtures
- [ ] `tools/check-links.cjs` — Wiki link validator for brand/ directory
- [ ] `tools/validate-asset-index.cjs` — Asset index completeness checker

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Subagent loads 3-6 focused docs per role | BRAND-01 | Requires spawning actual subagent and counting loaded docs | Spawn a "copy" subagent, verify it navigates to voice rules without loading design tokens |
| Install instructions work end-to-end | DIST-02 | Requires fresh environment setup | Follow install.md in a fresh clone, verify skills appear |
| Pattern Library renders without errors | BRAND-06 | Requires browser visual inspection | Open patterns/index.html, verify all elements render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
