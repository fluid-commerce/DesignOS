---
phase: 6
slug: marketing-skills-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash smoke tests (no test framework needed — phase is file-distribution) |
| **Config file** | none |
| **Quick run command** | `node -e "JSON.parse(require('fs').readFileSync('brand/skill-map.json','utf8'))"` |
| **Full suite command** | See Per-Task Verification Map below |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick JSON parse check
- **After every plan wave:** Run all smoke tests in verification map
- **Before `/gsd:verify-work`:** All smoke tests pass + one manual orchestrator run
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SC-1 | smoke | `ls skills/marketing/ \| wc -l` (expect 30) | N/A (new dir) | ⬜ pending |
| 06-01-02 | 01 | 1 | SC-5 | smoke | `node -e "JSON.parse(require('fs').readFileSync('brand/skill-map.json','utf8'))"` | N/A (new file) | ⬜ pending |
| 06-02-01 | 02 | 2 | SC-1,SC-2 | smoke | `grep -c "skills/marketing" .claude/skills/fluid-social/SKILL.md` (expect > 0) | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | SC-4 | smoke | `grep -c "\-\-skills" .claude/skills/fluid-social/SKILL.md` (expect > 0) | ✅ | ⬜ pending |
| 06-03-01 | 03 | 2 | SC-3 | smoke | `grep -c "skills/marketing" sync.sh` (expect > 0) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or test files needed — all validations are one-line Bash smoke tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Marketing skill content improves copy output quality | SC-2 | Qualitative — requires human judgment of generated copy | Run `/fluid-social "test topic"` and verify delegation messages include skill paths; review output for marketing expertise influence |
| Interactive skill mapping approval works | SC-5 | Interactive UX — requires human walkthrough | Execute the curation task and verify approval prompts appear for each skill group |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
