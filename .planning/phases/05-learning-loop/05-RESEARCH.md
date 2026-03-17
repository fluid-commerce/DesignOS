# Phase 5: Learning Loop - Research

**Researched:** 2026-03-11
**Domain:** Feedback ingestion CLI tool + slash command skill for brand rule evolution
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trajectory reading & signal detection**
- Primary input: completed canvas sessions from `.fluid/working/` — reads `lineage.json` (rounds, winners, prompts) and `annotations.json` (statuses, pin annotations, sidebar notes)
- Secondary input: `feedback/*.md` files (YAML frontmatter format already defined in `feedback/README.md`) — manual overrides that bypass pattern threshold
- Metadata only — do NOT parse variation HTML output. Signal comes from explicit human actions (winner picks, rejections, annotations), not reverse-engineering visual patterns from code
- Pattern threshold: only act on patterns appearing across 3+ sessions. Single rejections are noise
- Exception: explicit operator annotations (e.g., "NEVER use diagonal brushstroke on small posts") and feedback/*.md files bypass the 3-session threshold — direct human instructions are acted on immediately
- Cross-pollination: patterns appearing across multiple asset types inform brand-level docs (design-tokens.md, voice-rules.md). Asset-specific patterns that only appear in one type stay scoped to that asset's docs (social-post-specs.md, website-section-specs.md)
- Track processed sessions in `feedback/ingested.json` manifest — each run only analyzes new sessions, prevents double-counting

**Update targets & scope of changes**
- The loop is purely advisory — it produces proposals, never auto-writes to brand docs
- Four proposal types: weight adjustments, rule modifications, new rules, and template updates
- Proposals are actionable diffs: exact file path, current text, proposed replacement text, plus evidence (which sessions, what pattern)
- Proposals target source brand `.md` files only (not rules.json). After approval, compile-rules.cjs rebuilds the compiled version
- Confidence level per proposal based on evidence strength (session count, explicitness of feedback)

**Human approval gate**
- Two-phase single command: (1) analyze sessions and generate proposals, then (2) immediately walk operator through each proposal using interactive prompts (AskUserQuestion style — approve/reject/modify per item)
- Proposal file written to `feedback/proposals/YYYY-MM-DD-proposal.md` as audit trail before walking through items
- After approval walkthrough: apply approved changes to source .md files, auto-run `compile-rules.cjs` to rebuild rules.json, auto-commit with descriptive message (e.g., "brand(learning-loop): apply 4 proposals from 2026-03-15")

**Invocation & trigger model**
- Manual slash command: `/feedback-ingest` — operator runs when ready to review accumulated data
- No arguments — processes all unprocessed sessions since last run (tracked by ingested.json)
- Always shows a summary report even if no proposals generated
- Not auto-triggered — operator decides when to run

**Feedback capture skill**
- `/fluid-design-os-feedback` skill for manually writing feedback to `feedback/*.md`
- Guided prompts: walks user through asset type, what worked/didn't, specific rule suggestions
- Auto-detects most recent session from `.fluid/working/` to pre-fill context, but confirms with user before proceeding
- Writes properly formatted feedback file with YAML frontmatter matching `feedback/README.md` spec
- These files bypass the 3-session threshold in the ingestion loop

### Claude's Discretion
- Internal pattern detection algorithm (how to cluster and count rejection/winner patterns)
- Proposal file format and structure details
- How to present evidence in the approval walkthrough
- Confidence scoring methodology
- How to handle conflicting signals (e.g., a pattern is both approved and rejected across sessions)
- Exact guided prompt flow for the feedback capture skill

### Deferred Ideas (OUT OF SCOPE)
- **Canvas UI feedback panel** — a "Learning Loop" tab in the canvas showing proposals with approve/reject buttons
- **Auto-prompt after N sessions** — nudge the operator to run /feedback-ingest after every 5 completed sessions
- **HTML output analysis** — scanning winning variation HTML for specific CSS values
- **Automated trajectory analysis (ITER-02)** — deeper pattern recognition across approval/rejection patterns
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| META-01 | Feedback ingestion meta-skill — reads documented trajectories and updates brand rules/templates/skills | Session reading patterns (sessions.ts), lineage+annotation data structures, ingested.json manifest, proposal file format, compile-rules.cjs integration |
| META-02 | Feedback categorization — asset-specific feedback vs. systemic brand changes (systemic requires human approval) | Cross-pollination logic, proposal type taxonomy, confidence scoring, human approval walkthrough pattern |
</phase_requirements>

---

## Summary

Phase 5 implements a feedback ingestion system that closes the quality loop: canvas sessions already capture rich signal (winner picks, rejections, pin annotations) and manual `feedback/*.md` files provide structured operator notes. This phase builds two skills that read those signals, extract patterns, and propose specific updates to brand docs.

The implementation is entirely in Node.js CLI tools and Claude slash command SKILL.md files — no new canvas React code. The complexity is in the pattern detection logic (clustering signals across sessions, cross-pollination thresholds) and the interactive approval walkthrough that uses AskUserQuestion to walk the operator through each proposal one at a time.

Both skills follow established project patterns: dual stdout/stderr output, CJS modules with zero external dependencies, and the fluid- namespace prefix. The ingestion skill's approval flow integrates with the existing `tools/compile-rules.cjs` pipeline to rebuild rules.json after changes.

**Primary recommendation:** Build two deliverables — `tools/feedback-ingest.cjs` (the engine) + `.claude/skills/feedback-ingest/SKILL.md` (the /feedback-ingest slash command that runs it with interactive approval) + `.claude/skills/fluid-design-os-feedback/SKILL.md` (the /fluid-design-os-feedback capture skill). No new dependencies.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | N/A | fs, path, readline | Zero-dependency policy matches all other tools in project |
| YAML frontmatter parsing | hand-rolled | Read feedback/*.md files | No external deps allowed; format is simple enough |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `canvas/src/lib/sessions.ts` | existing | Session discovery logic as reference pattern | Copy the approach for Node CJS — don't import the TypeScript module directly |
| `tools/compile-rules.cjs` | existing | Rebuilds rules.json after brand doc edits | Auto-run after applying approved changes |
| `AskUserQuestion` (Claude tool) | built-in | Interactive per-proposal approval | This is the approval gate mechanism within the SKILL.md |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled YAML parser | `js-yaml` npm package | Project has zero-dependency policy — hand-roll a simple frontmatter extractor (only needs basic key: value pairs) |
| In-SKILL.md pattern logic | Separate CJS engine | Separate engine (feedback-ingest.cjs) is testable and reusable; the skill is a thin wrapper |

**Installation:** No new packages required. Everything is Node.js built-ins + existing project tools.

---

## Architecture Patterns

### Recommended Project Structure

```
.claude/skills/
├── feedback-ingest/
│   └── SKILL.md          # /feedback-ingest slash command (thin wrapper around tools/feedback-ingest.cjs)
└── fluid-design-os-feedback/
    └── SKILL.md          # /fluid-design-os-feedback manual capture skill

tools/
└── feedback-ingest.cjs   # Engine: session analysis, pattern detection, proposal generation

feedback/
├── README.md             # (exists) format spec
├── ingested.json         # Manifest of processed session IDs (created on first run)
└── proposals/
    └── YYYY-MM-DD-proposal.md   # Audit trail for each run
```

### Pattern 1: Session Signal Extraction

**What:** Read lineage.json + annotations.json for each unprocessed session; extract structured signals (winner IDs, rejected variation IDs, pin annotation text, sidebar notes, statuses).

**When to use:** The ingestion engine's first pass over each session directory.

**Anatomy of a signal record:**
```javascript
// Derived from real session data at .fluid/working/
{
  sessionId: '20260310-223636',
  platform: 'instagram',           // from lineage.json
  template: null,                  // from lineage.json
  signals: [
    {
      type: 'rejection',           // variation rejected
      variationPath: 'v2-styled.html',
      roundNumber: 1,
      prompt: 'Create social post...'
    },
    {
      type: 'pin-annotation',      // explicit operator comment
      variationPath: 'styled.html',
      text: 'The box this text is in feels more like a web page than a social post',
      x: 53.25, y: 79.25          // location context
    },
    {
      type: 'winner',
      variationPath: 'styled.html'
    }
  ]
}
```

**Data sources (verified from codebase):**
- `lineage.json`: `rounds[].variations[].status` ('winner'|'rejected'|'final'|'unmarked'), `rounds[].prompt`, `platform`, `template`
- `annotations.json`: `statuses` (Record<variationPath, VariationStatus>), `annotations[].text` (pin and sidebar text), `annotations[].type`
- Phase 2 sessions: `entries[]` (no status field, treat as unresolved unless annotations override)

### Pattern 2: ingested.json Manifest

**What:** A JSON file tracking which sessions have been analyzed, preventing double-counting across runs.

**Format:**
```json
{
  "version": "1.0",
  "lastRun": "2026-03-15T10:30:00Z",
  "processedSessions": [
    "20260310-212943",
    "20260310-223636"
  ]
}
```

**Logic:** On each run, discover all sessions in `.fluid/working/`, diff against `processedSessions`, process only new ones, append to manifest after successful run.

### Pattern 3: Pattern Clustering

**What:** Group signals across sessions by theme to detect patterns that meet the 3-session threshold.

**Clustering approach (Claude's discretion — recommended):**
1. Normalize annotation text to extract topical keywords (text length, web-vs-social feel, brushstroke, opacity, circle usage, font size, copy density)
2. Group by (asset_type, signal_topic) tuples
3. Count distinct sessions contributing to each group
4. Apply threshold: 3+ sessions for standard patterns, 1 session for explicit annotations or feedback/*.md

**Conflicting signals:** When a topic has both approval and rejection signals, calculate net sentiment score. If split >= 40/60, flag as "conflicting — operator judgement required" and include BOTH sides as evidence. Do not suppress conflicting proposals.

### Pattern 4: Proposal File Format

**What:** Written to `feedback/proposals/YYYY-MM-DD-proposal.md` before interactive walkthrough begins.

**Recommended format:**
```markdown
# Feedback Ingestion Proposals — 2026-03-15

**Sessions analyzed:** 8 new sessions (12 total)
**Patterns found:** 3 with actionable proposals
**Sessions with no signal:** 5

---

## Proposal 1: Narrow brushstroke opacity range
**Type:** weight-adjustment / rule-modification
**Confidence:** HIGH (5 sessions, explicit annotation in 2)
**Target:** brand/social-post-specs.md
**Scope:** asset-specific (social posts only)

**Current text:**
> Brushstroke opacity: 0.10–0.25

**Proposed text:**
> Brushstroke opacity: 0.10–0.18 (0.20–0.25 only for large-format LinkedIn)

**Evidence:**
- 20260310-223636: Pin annotation "opacity was too high, made it feel heavy"
- 20260311-091920: Pin annotation "background element too prominent"
- 3 additional sessions: v2 rejected with brushstroke-prominent variations

---

## Proposal 2: ...
```

### Pattern 5: Interactive Approval Walkthrough (within SKILL.md)

**What:** After writing the proposal file, the SKILL.md walks through each proposal using AskUserQuestion.

**Pattern (based on GSD's discuss-phase model):**
1. Print summary header: "Found 3 proposals. Walking through each now."
2. For each proposal: print evidence summary, then AskUserQuestion with options: `[A] Approve  [R] Reject  [M] Modify  [S] Skip for now`
3. Track decisions; for "Modify" — ask follow-up: "What change would you like to make?"
4. After walkthrough: report "Approved: 2, Rejected: 1, Deferred: 0"
5. Apply approved changes with Write/Edit tool to brand .md files
6. Run `node tools/compile-rules.cjs` to rebuild rules.json
7. Auto-commit

**Key constraint:** AskUserQuestion is the approval mechanism — this means the walkthrough happens IN the skill execution (no separate review file workflow).

### Pattern 6: Feedback Capture Skill

**What:** `/fluid-design-os-feedback` guides operator through writing a structured `feedback/*.md` file.

**Guided flow:**
1. Discover most recent session in `.fluid/working/` (sorted by dirname timestamp)
2. AskUserQuestion: "Is this the session you're leaving feedback about? [Session: {id}, Platform: {platform}, {N} variations]"
3. If yes: pre-fill context fields. If no: list recent sessions to choose from.
4. AskUserQuestion: "What was the outcome?" (success / partial / failure / multiple-choice)
5. AskUserQuestion: "What worked well? (optional, press Enter to skip)"
6. AskUserQuestion: "What didn't work? What should be different?"
7. AskUserQuestion: "Any specific rule weight changes? (e.g., 'brushstroke opacity max should be lower')"
8. Write `feedback/YYYY-MM-DD-{asset-type}-{brief}.md` with YAML frontmatter

**Filename generation:** `date-assettype-brief.md` where brief is a 2-4 word kebab slug auto-generated from the "what didn't work" text.

### Anti-Patterns to Avoid

- **Parsing HTML output:** Never analyze `styled.html` content for CSS values. Signal source is metadata only.
- **Auto-applying changes:** All brand doc modifications go through human approval gate — never write to brand/*.md without explicit approval for each proposal.
- **Importing TypeScript sessions.ts:** The CJS engine must re-implement the session discovery pattern using `require('node:fs')`, not import the TypeScript module.
- **Single-run double-counting:** Always consult `ingested.json` before processing. A session already in processedSessions is skipped entirely.
- **Forgetting to re-compile:** After applying any brand doc changes, always auto-run `node tools/compile-rules.cjs` — rules.json must stay in sync.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rebuilding rules.json | Custom JSON writer | `tools/compile-rules.cjs` | Already handles all brand doc parsing; auto-run after edits |
| Session data types | Redefine TS interfaces | Reference `canvas/src/lib/types.ts` for shape (even in CJS, same structure applies) | Established contracts already validated |
| YAML frontmatter in feedback files | Full YAML parser | Hand-rolled `frontmatter` extractor (split on `---`, parse key: value lines) | Format is a flat key: value spec, no nested YAML needed |
| Git commit | Custom git logic | `git add -A && git commit -m "brand(learning-loop): apply N proposals..."` | Simple enough — no abstraction needed |

**Key insight:** The entire phase is plumbing between existing pieces. The hardest part is pattern clustering logic, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: Empty or Partial Sessions
**What goes wrong:** Many sessions in `.fluid/working/` are empty directories or have no `lineage.json` (build test artifacts, failed starts). The tool crashes or produces noise.
**Why it happens:** Session creation happens before generation — any failed generation leaves an orphaned dir. Inspecting the filesystem confirms 15+ of 35 working dirs are empty.
**How to avoid:** Guard every session read: check `lineage.json` existence before attempting to parse; skip sessions without it silently. Only sessions with both `lineage.json` AND at least one variation should produce signals.
**Warning signs:** Zero proposals generated even after many sessions; crash on `JSON.parse`.

### Pitfall 2: Phase 2 vs Phase 4 Lineage Format
**What goes wrong:** Phase 2 sessions use `entries[]` (flat, no status field). Phase 4 sessions use `rounds[].variations[]` with explicit `status`. Treating them the same causes missing signals.
**Why it happens:** Lineage format evolved across phases; both formats exist in `.fluid/working/`.
**How to avoid:** Branch on `lineage.rounds ? ... : lineage.entries`. For Phase 2, derive status from `annotations.json` statuses map (the canvas can annotate Phase 2 sessions too). Verified: sessions `20260310-212943` and `20260311-100000` demonstrate both formats.
**Warning signs:** Phase 2 sessions always show "no signal" even when they have annotations.

### Pitfall 3: Proposals Touching the Wrong Target
**What goes wrong:** A pattern detected in social posts causes a proposal to update `design-tokens.md` (a brand-wide doc) when it should only update `social-post-specs.md`.
**Why it happens:** Cross-pollination logic is "err on the side of cross-pollinating" but that must be conditional on the pattern appearing across multiple asset types, not just frequently.
**How to avoid:** Strictly enforce scope: single-asset-type patterns → asset-specific doc (social-post-specs.md / website-section-specs.md). Multi-asset-type patterns → brand-level doc (design-tokens.md, voice-rules.md). Document the scope determination in each proposal's evidence block so the operator can review it.
**Warning signs:** Operator says "why is this touching design-tokens.md? It's only happened in social posts."

### Pitfall 4: AskUserQuestion in a Loop (Skill Timeout)
**What goes wrong:** Walking through many proposals one-by-one with AskUserQuestion in a tight loop — if Claude's context window resets or the skill times out mid-walkthrough, partially-applied changes corrupt the brand docs.
**Why it happens:** Long interactive sessions with many AskUserQuestion calls can hit execution limits.
**How to avoid:** Write the proposal file FIRST (complete audit trail before touching anything). Apply changes only AFTER collecting ALL decisions. Never apply partial changes — collect approve/reject for all proposals, then batch-apply in one pass.
**Warning signs:** Operator sees some proposals applied, others not; git diff shows inconsistent state.

### Pitfall 5: compile-rules.cjs Bug (rules.colors.website undefined)
**What goes wrong:** `compile-rules.cjs` has a pre-existing bug with website context (`rules.colors.website undefined`) noted in STATE.md decisions from Phase 3.
**Why it happens:** The compiled rules.json structure mismatches what validators expect for the website context.
**How to avoid:** The feedback ingestion tool just calls `node tools/compile-rules.cjs` — if the tool exits with an error, catch it and warn the operator ("rules.json rebuild failed — brand docs updated but rules.json may be stale. Run node tools/compile-rules.cjs manually"). Do NOT block the commit over this known bug.
**Warning signs:** `compile-rules.cjs` exits non-zero; stderr shows "rules.colors.website undefined".

---

## Code Examples

Verified patterns from existing project code:

### Session Discovery (CJS equivalent of sessions.ts)
```javascript
// Source: canvas/src/lib/sessions.ts — adapted for Node CJS in tools/
const fs = require('node:fs');
const path = require('node:path');

const SESSION_DIR_PATTERN = /^\d{8}-\d{6}$/;

function discoverSessions(workingDir) {
  if (!fs.existsSync(workingDir)) return [];
  const entries = fs.readdirSync(workingDir);
  return entries
    .filter(e => SESSION_DIR_PATTERN.test(e))
    .filter(e => {
      const lineagePath = path.join(workingDir, e, 'lineage.json');
      return fs.existsSync(lineagePath);
    });
}
```

### Lineage + Annotation Reading
```javascript
// Source: derived from canvas/src/lib/sessions.ts + observed session structures
function loadSessionSignals(workingDir, sessionId) {
  const sessionDir = path.join(workingDir, sessionId);
  const lineage = JSON.parse(fs.readFileSync(path.join(sessionDir, 'lineage.json'), 'utf-8'));

  let statuses = {};
  let annotationTexts = [];
  const annotationsPath = path.join(sessionDir, 'annotations.json');
  if (fs.existsSync(annotationsPath)) {
    const af = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8'));
    statuses = af.statuses || {};         // Record<variationPath, 'winner'|'rejected'|'final'|'unmarked'>
    annotationTexts = (af.annotations || []).map(a => ({ text: a.text, type: a.type }));
  }

  // Extract variation statuses — Phase 4 rounds format
  const variationStatuses = [];
  if (lineage.rounds) {
    for (const round of lineage.rounds) {
      for (const v of round.variations) {
        // Prefer annotation statuses (set by canvas UI) over lineage.json statuses
        const status = statuses[v.path] || v.status;
        variationStatuses.push({ id: v.id, path: v.path, status, roundNumber: round.roundNumber });
      }
    }
  }
  // Phase 2 flat entries: statuses come only from annotations.json
  if (lineage.entries) {
    for (const entry of lineage.entries) {
      const status = statuses[entry.output] || 'unmarked';
      variationStatuses.push({ path: entry.output, status });
    }
  }

  return { lineage, variationStatuses, annotationTexts };
}
```

### Dual Output Format (following existing CLI convention)
```javascript
// Source: tools/compile-rules.cjs, tools/brand-compliance.cjs — established pattern
// JSON to stdout for machine consumption; human summary to stderr
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.stderr.write(`\nFeedback ingestion complete\n`);
process.stderr.write(`  Sessions analyzed: ${newCount}\n`);
process.stderr.write(`  Proposals generated: ${proposals.length}\n`);
```

### Feedback Frontmatter Format
```yaml
# Source: feedback/README.md
---
date: 2026-03-15
asset_type: brushstroke | circle | logo | font | layout | copy | color
asset_name: brushstroke-diagonal-sweep.png
prompt_used: "Social post for partner alert, orange accent"
outcome: success | partial | failure
operator_notes: "Brushstroke opacity was too high at 0.25"
rule_weights_affected:
  - rule: "brushstroke opacity 0.10-0.25"
    current_weight: 90
    suggested_adjustment: "narrow range to 0.10-0.18 for small posts"
---
```

### SKILL.md Frontmatter Pattern (matching project skills)
```yaml
# Source: .claude/skills/fluid-social/SKILL.md — established pattern
---
name: feedback-ingest
description: "Analyze completed canvas sessions and manual feedback files. Propose and interactively apply updates to brand rules, templates, and skills."
invoke: slash
context: fork
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `.fluid-working/` session dir | Session-based `.fluid/working/{sessionId}/` | Phase 02-03 decision | Each session is isolated; ingestion can process sessions independently |
| Lineage Phase 2 `entries[]` | Lineage Phase 4 `rounds[].variations[]` with status | Phase 4 canvas | Richer signals but both formats coexist and must be handled |
| Manual annotation review | canvas annotations.json per session | Phase 4 | Structured signal extraction is now possible |

**Status of existing signals in `.fluid/working/`:**
- 35 session directories exist currently; ~15 are empty (no lineage.json)
- 5 sessions have annotations.json — these are the richest signal sources
- 3 sessions have winner status set in annotations.json statuses
- Real annotation examples: "box feels more like a web page than a social post", "text too small, too much text", "background element has cut off edge", "circle used wrong — should emphasize a positive"

---

## Open Questions

1. **No round-format sessions with real winner data yet**
   - What we know: The `.fluid/working/` directory has real Phase 2 sessions with annotations but no Phase 4 `rounds[]` sessions with winner picks. Phase 4 canvas was just completed.
   - What's unclear: Whether the ingestion tool should produce proposals from the existing Phase 2 sessions (limited signal) or wait for Phase 4 sessions to accumulate.
   - Recommendation: Build the tool to handle both formats and process existing sessions. The summary "Analyzed 5 sessions, 0 proposals (insufficient pattern threshold)" is valid and expected. First real proposals will come after the canvas has been used in production.

2. **Scope of `compile-rules.cjs` bug**
   - What we know: Pre-existing bug with `rules.colors.website undefined` noted in STATE.md. The bug appears to be in the summary stats output (line 269 references `rules.colors.social` and `rules.colors.website` which don't exist in the actual data structure).
   - What's unclear: Whether this causes the tool to actually fail on exit or just produce wrong stats.
   - Recommendation: Test `node tools/compile-rules.cjs` before Phase 5 implementation begins. If it exits non-zero, fix the stats output bug as part of Phase 5 Wave 0. If it exits 0 with bad stats, just handle non-zero exit gracefully in the ingestion tool.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (canvas/package.json) |
| Config file | `canvas/vite.config.ts` (vitest section implied; `vitest.config.*` not present — uses vite.config.ts inline) |
| Quick run command | `cd canvas && npm test -- --run canvas/src/__tests__/sessions.test.ts` |
| Full suite command | `cd canvas && npm test` |

**Note:** The feedback ingestion engine (`tools/feedback-ingest.cjs`) is a standalone CJS Node.js script, not part of the canvas Vite project. Tests for it should use Node's built-in test runner or be added to a separate test runner. Given the project uses zero-external-dep CJS tools, recommend a simple in-script `--test` flag that self-tests without a framework.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-01 | Session discovery skips empty dirs and sessions without lineage.json | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |
| META-01 | Phase 2 (entries) and Phase 4 (rounds) lineage formats both produce signals | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |
| META-01 | ingested.json manifest prevents double-counting sessions | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |
| META-01 | Proposal file written to feedback/proposals/ with correct format | integration | `node tools/feedback-ingest.cjs --dry-run` | ❌ Wave 0 |
| META-02 | Asset-specific pattern (single asset type) scoped to asset doc | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |
| META-02 | Cross-asset pattern (multi asset type) targets brand-level doc | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |
| META-02 | Explicit operator annotations bypass 3-session threshold | unit | `node tools/feedback-ingest.cjs --test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node tools/feedback-ingest.cjs --test`
- **Per wave merge:** `node tools/feedback-ingest.cjs --test && cd canvas && npm test`
- **Phase gate:** Full canvas suite green + feedback-ingest --test green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tools/feedback-ingest.cjs` — create file with `--test` self-test flag
- [ ] `feedback/proposals/` — create directory (`.gitkeep`)
- [ ] Verify `node tools/compile-rules.cjs` exits 0 (known bug on line 269 referencing undefined `rules.colors.social`)

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `canvas/src/lib/sessions.ts` (session discovery, lineage parsing)
- Direct codebase inspection — `canvas/src/lib/types.ts` (Lineage, Round, VariationInfo, AnnotationFile, VariationStatus type definitions)
- Direct codebase inspection — `tools/compile-rules.cjs` (dual output pattern, rules.json structure)
- Direct codebase inspection — `feedback/README.md` (feedback frontmatter spec)
- Direct codebase inspection — `.fluid/working/` (8 sessions with real data, 2 with rich annotations)
- Direct codebase inspection — `.claude/skills/fluid-social/SKILL.md` (SKILL.md frontmatter pattern, AskUserQuestion usage context)

### Secondary (MEDIUM confidence)

- `.planning/phases/05-learning-loop/05-CONTEXT.md` — all architectural decisions verified against codebase
- `STATE.md` accumulated decisions — compile-rules.cjs bug, dual output pattern, session-based working dir pattern

### Tertiary (LOW confidence)

- None — all claims verified against codebase directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is existing Node.js + project tools, no new dependencies
- Architecture: HIGH — directly derived from existing sessions.ts, types.ts, annotations.json structures observed in real sessions
- Pitfalls: HIGH — Pitfalls 1-3 verified from direct filesystem inspection (empty dirs, both lineage formats present, mixed session states); Pitfall 4 is operational experience with AskUserQuestion; Pitfall 5 verified from STATE.md and compile-rules.cjs source

**Research date:** 2026-03-11
**Valid until:** Stable — no external dependencies; valid until codebase structure changes
