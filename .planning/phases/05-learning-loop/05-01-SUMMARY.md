---
phase: 05-learning-loop
plan: "01"
subsystem: feedback-ingestion
tags: [learning-loop, cli-tools, feedback, signals, proposals, pattern-clustering]
dependency_graph:
  requires:
    - canvas/src/lib/sessions.ts (reference pattern)
    - canvas/src/lib/types.ts (data shape reference)
    - feedback/README.md (frontmatter spec)
  provides:
    - tools/feedback-ingest.cjs (feedback ingestion engine)
    - feedback/proposals/ (proposals output directory)
  affects:
    - 05-02 (SKILL.md wrapper will call this engine)
tech_stack:
  added: []
  patterns:
    - CJS self-test pattern (--test flag with in-memory fixtures, no test framework)
    - Dual output convention (JSON stdout, human summary stderr) matching compile-rules.cjs
    - Zero-dependency Node.js tool (fs, path, os built-ins only)
    - Hand-rolled YAML frontmatter parser for feedback/*.md files
key_files:
  created:
    - tools/feedback-ingest.cjs
    - feedback/proposals/.gitkeep
  modified: []
decisions:
  - "Session pattern clustering uses (asset_type, topic) tuples as cluster keys — precise enough for cross-pollination scoping without over-clustering"
  - "Topic extraction is keyword-based matching against TOPIC_KEYWORDS map — covers the 9 most common signal topics (brushstroke, opacity, circle, font, copy_density, web_vs_social, color, layout, logo)"
  - "Directive language bypass uses DIRECTIVE_KEYWORDS list (never, always, don't, stop using, avoid, etc.) — pragmatic over NLP, zero dependencies"
  - "feedback file entries use synthetic session ID feedback:{filename} to integrate with session-based clustering without special-casing"
  - "Confidence scoring: HIGH=5+ sessions or feedback file, MEDIUM=3-4 sessions, LOW=1-session threshold bypass"
metrics:
  duration: 4min
  completed: "2026-03-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests: 66
  test_command: "node tools/feedback-ingest.cjs --test"
  test_result: "66/66 passing"
---

# Phase 5 Plan 1: Feedback Ingestion Engine Summary

**One-liner:** Zero-dependency CJS feedback ingestion engine with session discovery, Phase 2/4 lineage support, YAML frontmatter parsing, (asset_type, topic) pattern clustering, and actionable proposal generation — 66 self-tests passing.

## What Was Built

`tools/feedback-ingest.cjs` — a standalone Node.js CLI tool that closes the Fluid Creative OS learning loop by reading completed canvas sessions and manual feedback files, extracting structured signals, clustering patterns, and generating actionable proposals for brand doc updates.

### CLI Modes

| Mode | Behavior |
|------|----------|
| `node tools/feedback-ingest.cjs` | Full run: analyze + write proposals to feedback/proposals/ + JSON to stdout |
| `node tools/feedback-ingest.cjs --dry-run` | Analyze and print JSON to stdout without writing files |
| `node tools/feedback-ingest.cjs --test` | Run 66 self-tests, exit 0 on pass |

### Core Functions

1. **`discoverSessions(workingDir)`** — filters `.fluid/working/` for valid `YYYYMMDD-HHMMSS` dirs with `lineage.json`
2. **`loadSessionSignals(workingDir, sessionId)`** — handles both Phase 2 (`entries[]`) and Phase 4 (`rounds[]`) lineage formats; `annotations.json` statuses take precedence over `lineage.json` statuses
3. **`parseFeedbackFiles(feedbackDir)`** — hand-rolled YAML frontmatter parser for `feedback/*.md` (skips README.md), handles nested `rule_weights_affected` arrays
4. **`loadIngestedManifest` / `saveIngestedManifest`** — tracks processed session IDs in `feedback/ingested.json` to prevent double-counting
5. **`clusterSignals(sessionSignals, feedbackEntries)`** — groups by `(asset_type, topic)` tuples; applies 3-session threshold (1-session bypass for directive annotations and feedback files); detects 40/60+ conflicting splits
6. **`scopeProposal(cluster)`** — single asset type → asset-specific doc (`social-post-specs.md` / `website-section-specs.md`); multi-asset type → brand-level doc (`design-tokens.md` / `voice-rules.md`)
7. **`generateProposals(clusters)`** — produces typed proposals with `type`, `confidence`, `target`, `scope`, `currentText`, `proposedText`, `evidence[]`, `conflicting`
8. **`writeProposalFile(proposals, outputDir)`** — writes `feedback/proposals/YYYY-MM-DD-proposal.md` in Pattern 4 format from RESEARCH.md
9. **`main(options)`** — full orchestration: manifest diff → signal loading → clustering → proposals → file write → manifest update

### Real-World Test

Ran `--dry-run` against existing `.fluid/working/`: discovered 16 sessions, processed 3 with signals, returned 0 proposals (correctly: no pattern hits the 3-session threshold yet, confirming the threshold logic works).

## Verification

| Check | Result |
|-------|--------|
| `node tools/feedback-ingest.cjs --test` exits 0 | PASS — 66/66 tests |
| `node tools/feedback-ingest.cjs --dry-run` runs without error | PASS — 16 sessions analyzed |
| `feedback/proposals/.gitkeep` exists | PASS |
| Zero npm dependencies | PASS — only `node:fs`, `node:path`, `node:os` |

## Deviations from Plan

None — plan executed exactly as written. Both Task 1 and Task 2 delivered in a single file as specified. All behaviors from `<behavior>` blocks are covered by self-tests.

## Self-Check

**Files:**
- `tools/feedback-ingest.cjs`: FOUND (1394 lines)
- `feedback/proposals/.gitkeep`: FOUND

**Commits:**
- `5918e85`: feat(05-01): feedback ingestion engine with session analysis and proposal generation — FOUND

## Self-Check: PASSED
