---
phase: 2
slug: orchestrator-social-posts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + Node.js CLI tools (no test framework — validation is via existing CLI tools) |
| **Config file** | None — CLI tools are self-contained |
| **Quick run command** | `node tools/brand-compliance.cjs <file> --context social && node tools/dimension-check.cjs <file> --target instagram` |
| **Full suite command** | `bash -c 'for f in output/*.html; do node tools/brand-compliance.cjs "$f" --context social; node tools/dimension-check.cjs "$f" --target instagram; done'` |
| **Estimated runtime** | ~5 seconds per file |

---

## Sampling Rate

- **After every task commit:** Run `node tools/brand-compliance.cjs <latest-output> --context social && node tools/dimension-check.cjs <latest-output> --target instagram`
- **After every plan wave:** Generate one Instagram and one LinkedIn post end-to-end; run both CLI tools on each
- **Before `/gsd:verify-work`:** Full suite must be green — all 7 archetypes generated and validated
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | TMPL-02, SOCL-07 | unit | `ls templates/social/quote.html templates/social/app-highlight.html templates/social/partner-alert.html 2>/dev/null \| wc -l` should be 3; `grep -rl "Reference/\|localhost\|hue-rotate" templates/social/quote.html templates/social/app-highlight.html templates/social/partner-alert.html` should return nothing | N/A (Wave 0) | pending |
| 01-T2 | 01 | 1 | TMPL-02, SOCL-07 | unit | `ls templates/social/problem-first.html templates/social/stat-proof.html templates/social/manifesto.html templates/social/feature-spotlight.html 2>/dev/null \| wc -l` should be 4; `grep -rl "Reference/\|localhost\|hue-rotate" templates/social/problem-first.html templates/social/stat-proof.html templates/social/manifesto.html templates/social/feature-spotlight.html` should return nothing | N/A (Wave 0) | pending |
| 01-T3 | 01 | 1 | TMPL-01 | unit | `grep -c "iframe" templates/social/index.html` should be 7; `grep -c "Content Slots" templates/social/index.html` should be 7 | N/A (Wave 0) | pending |
| 02-T1 | 02 | 1 | ORCH-02, ORCH-03, ORCH-04, ORCH-07 | unit | `for f in .claude/agents/copy-agent.md .claude/agents/layout-agent.md .claude/agents/styling-agent.md; do grep -q "tools:" "$f" && grep -q "fluid-working" "$f"; done` | N/A (Wave 0) | pending |
| 02-T2 | 02 | 1 | ORCH-05, ORCH-06 | unit | `grep -q "spec-report.json" .claude/agents/spec-check-agent.md && grep -q "brand-compliance" .claude/agents/spec-check-agent.md && grep -q "dimension-check" .claude/agents/spec-check-agent.md` | N/A (Wave 0) | pending |
| 03-T1 | 03 | 2 | ORCH-01, SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05, SOCL-06 | unit | `grep -q "context: fork" .claude/skills/fluid-social/SKILL.md && grep -q "\-\-product" .claude/skills/fluid-social/SKILL.md && grep -q "copy-agent" .claude/skills/fluid-social/SKILL.md && grep -q "spec-check-agent" .claude/skills/fluid-social/SKILL.md` | N/A (Wave 0) | pending |
| 03-T2 | 03 | 2 | ORCH-01 | manual-only | Human verification of complete pipeline | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `templates/social/` directory — needs to be created with 7 template files + index.html
- [ ] `templates/social/index.html` — Jonathan's format index page
- [ ] `.claude/skills/fluid-social/SKILL.md` — orchestrator skill
- [ ] `.claude/agents/spec-check-agent.md` — new spec-check subagent
- [ ] Upgrade `.claude/agents/copy-agent.md` — expand from stub to full contract
- [ ] Upgrade `.claude/agents/layout-agent.md` — expand from stub to full contract
- [ ] Upgrade `.claude/agents/styling-agent.md` — expand from stub to full contract

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Complete pipeline end-to-end | ORCH-01 | Requires running /fluid-social in Claude Code | Run `/fluid-social "test topic" --debug`, inspect .fluid-working/ and output/ |
| Circle sketch emphasis-only | SOCL-06 | Visual judgment required | Inspect generated post — circle sketch should be accent element, not dominant |
| Templates as reference not copy | SOCL-07 | Requires semantic comparison | Compare output HTML against template source; structure should diverge |
| Template index in Jonathan's format | TMPL-01 | Requires visual inspection in browser | Open `templates/social/index.html`; verify iframe previews + slot spec tables |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
