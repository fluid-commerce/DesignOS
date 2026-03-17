---
phase: 3
slug: website-sections-one-pagers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in CLI tools (validation is the test) |
| **Config file** | `tools/rules.json` (compiled brand rules) |
| **Quick run command** | `node tools/schema-validation.cjs <file.liquid>` |
| **Full suite command** | `for f in templates/sections/*.liquid; do node tools/schema-validation.cjs "$f"; done` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tools/schema-validation.cjs <latest-file>`
- **After every plan wave:** Run `for f in templates/sections/*.liquid; do node tools/schema-validation.cjs "$f"; done`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SITE-02 | manual | Verify files in `docs/fluid-themes-gold-standard/` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SITE-01 | unit | `node tools/schema-validation.cjs templates/sections/hero.liquid` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | SITE-03 | unit | `node tools/schema-validation.cjs <file>` (checks 13 font sizes, 13 colors, 5 weights) | ✅ | ⬜ pending |
| 03-01-04 | 01 | 1 | SITE-04 | unit | `node tools/schema-validation.cjs <file>` (checks 7 button settings) | ✅ | ⬜ pending |
| 03-01-05 | 01 | 1 | SITE-05 | unit | `node tools/schema-validation.cjs <file>` (checks section/container settings) | ✅ | ⬜ pending |
| 03-01-06 | 01 | 1 | SITE-06 | unit | `node tools/brand-compliance.cjs <file> --context website` | ✅ | ⬜ pending |
| 03-01-07 | 01 | 1 | SITE-07 | unit | `node tools/schema-validation.cjs <file>` + `node tools/brand-compliance.cjs <file>` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | PAGE-01 | smoke | `node tools/brand-compliance.cjs <file>` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | PAGE-02 | manual | Visual inspection of brushstrokes, side labels, FLFont | N/A | ⬜ pending |
| 03-02-03 | 02 | 2 | PAGE-03 | smoke | `node tools/dimension-check.cjs <file> --target letter` | ✅ | ⬜ pending |
| 03-02-04 | 02 | 2 | TMPL-03 | manual | Check `<!-- SLOT: -->` comments in templates | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 2 | TMPL-04 | manual | Check annotation comments in templates | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `templates/sections/` directory — create for section templates
- [ ] `templates/one-pagers/` directory — create for one-pager templates
- [ ] `docs/fluid-themes-gold-standard/` directory — create for decomposed Gold Standard docs
- [ ] Verify `dimension-check.cjs --target letter` supports 8.5x11" validation
- [ ] Verify `brand-compliance.cjs --context website` fires website-specific rules

*Existing infrastructure covers most requirements via schema-validation.cjs and brand-compliance.cjs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gold Standard docs decomposed correctly | SITE-02 | Content accuracy requires human review | Check files in `docs/fluid-themes-gold-standard/` preserve original wording |
| Fluid brand elements in one-pager | PAGE-02 | Visual quality assessment | Open HTML in browser, verify brushstrokes, side labels, FLFont taglines render |
| Template slot annotations | TMPL-03, TMPL-04 | Semantic accuracy of FIXED/FLEXIBLE/OPTIONAL | Review template comments for correct element classification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
