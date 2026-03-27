---
name: overnight-run
description: "Run a full pipeline simulation batch: init creations, execute all stages via sim-executor subagents, eval each creation, generate summary report. Self-improving when used with /loop."
user-invocable: true
---

# Overnight Pipeline Simulation Run

You are the orchestrator for a full pipeline simulation batch. Claude Code subagents act as the model for each pipeline stage — receiving the EXACT same system prompt + user prompt that the Anthropic API call would receive, using the same tools (via pipeline-tools.cjs), and producing the same output files. No Anthropic API key needed.

## Prerequisites (check these first)

1. SQLite DB exists: `canvas/fluid.db`
2. Node modules installed: `canvas/node_modules/better-sqlite3` exists
3. Playwright Chromium browser: run `npx playwright install chromium` if needed (one-time)

## Orchestration Flow

### 1. Setup

```
REPORT_DIR=".fluid/reports/$(date +%Y%m%d-%H%M%S)"
mkdir -p $REPORT_DIR
```

Read test prompts from `tools/test-prompts.txt`. Each line is one prompt.

### 1.5 Load Operator Context

Read `feedback/FEEDBACK-CONTEXT.md` if it exists. This contains the operator's latest feedback, priority issues ranked by severity, and specific things to watch for this run.

Use this context to:
- Prioritize which eval dimensions get the most attention
- In the self-improvement phase, focus fixes on the operator's top priorities FIRST
- In the art director eval, pay special attention to operator-flagged issues
- In the summary, report progress specifically against the operator's priority issues

Also check `feedback/` for any recent `*-overnight-review-human.md` files — these contain per-asset ratings and notes from the operator's last review.

If no FEEDBACK-CONTEXT.md exists, proceed with default behavior.

### 2. For each prompt

#### INIT
```bash
node tools/simulate-pipeline.cjs --step init "the prompt text"
```
Returns JSON manifest with `campaignId` and `creations[]` array. Each creation has: `creationId`, `creationType`, `workingDir`, `htmlOutputPath`, `pipelineDir`.

#### FOR EACH CREATION (sequentially, 30s cooldown between):

**STAGE 1: COPY**
```bash
node tools/simulate-pipeline.cjs --step copy --working-dir <workingDir> [--campaign-context "Prior headlines: ..."]
```
Then read `<pipelineDir>/copy-system.txt` and `<pipelineDir>/copy-user.txt`.
Spawn sim-executor (model: sonnet):
```
"SYSTEM CONTEXT:\n{copy-system.txt}\n\nTASK:\n{copy-user.txt}\n\nWORKING_DIR: {workingDir}"
```
Verify `{workingDir}/copy.md` exists. Extract headline + tagline for campaign dedup.

**ROUTING DETECTION + STAGE 2: LAYOUT**
```bash
node tools/simulate-pipeline.cjs --step layout --working-dir <workingDir>
```
Returns `{ routing, resolvedId, isTemplatePath }`. Read `layout-system.txt` + `layout-user.txt`.
Spawn sim-executor (model: haiku):
```
"SYSTEM CONTEXT:\n{layout-system.txt}\n\nTASK:\n{layout-user.txt}\n\nWORKING_DIR: {workingDir}"
```
Verify `{workingDir}/layout.html` exists.

**STAGE 3: STYLING** (SKIP if isTemplatePath — copy layout.html to htmlOutputPath instead)
```bash
node tools/simulate-pipeline.cjs --step styling --working-dir <workingDir>
```
If returns `{ skipped: true }`, copy layout.html → htmlOutputPath and skip to stage 4.
Otherwise read `styling-system.txt` + `styling-user.txt`.
Spawn sim-executor (model: sonnet):
```
"SYSTEM CONTEXT:\n{styling-system.txt}\n\nTASK:\n{styling-user.txt}\n\nWORKING_DIR: {workingDir}"
```
Verify `{htmlOutputPath}` exists.

**STAGE 4: SPEC-CHECK**
```bash
node tools/simulate-pipeline.cjs --step spec-check --working-dir <workingDir>
```
Read `spec-check-user.txt`. Spawn sim-executor (model: sonnet) with the spec-check prompt.
Read `{workingDir}/spec-report.json`.

**FIX LOOP** (up to 3 iterations):
If spec-report overall = "fail":
1. Try micro-fix: `node tools/simulate-pipeline.cjs --step micro-fix --working-dir <workingDir>`
   - If `{ fixed: true }`, re-run spec-check and check again
2. If micro-fix insufficient:
   - Read blocking_issues, group by fix_target
   - For each target: `node tools/simulate-pipeline.cjs --step fix --working-dir <workingDir> --target <target> --issues '<json>'`
   - Spawn sim-executor for each target with the fix prompts
   - If copy was fixed: cascade → re-run layout + styling stages
   - Re-run spec-check
3. Repeat up to 3 times

**DB UPDATE**:
```bash
# Mark iteration as complete (use sqlite3 or a quick node command)
node -e "const D=require('canvas/node_modules/better-sqlite3');const db=new D('canvas/fluid.db');db.prepare(\"UPDATE iterations SET generation_status='complete' WHERE id=?\").run('<iterationId>');db.close()"
```

**ATTACH SCHEMA** (archetype path only):
```bash
node tools/simulate-pipeline.cjs --step attach-schema --working-dir <workingDir>
```

**EVAL**:
```bash
node tools/eval-harness.cjs <htmlOutputPath> --working-dir <workingDir> --creation-type <type>
```
```bash
node tools/visual-eval.cjs <htmlOutputPath> --creation-type <type>
```
Then spawn a sonnet subagent with the art director rubric + both screenshot PNGs for visual eval.

Append combined results to `{REPORT_DIR}/report.json`.

Write handoff log to `{workingDir}/handoff-log.json`.

### 3. After all prompts complete

Run batch variety eval:
```bash
node tools/eval-harness.cjs --batch {REPORT_DIR}/report.json
```

Generate summary:
```bash
node tools/report-summary.cjs {REPORT_DIR}/eval.json
```

Read SUMMARY.md and diagnose top failures.

If `feedback/FEEDBACK-CONTEXT.md` was loaded in step 1.5, include this section in SUMMARY.md:

```
## Progress vs Operator Priorities
| Priority | Issue | Baseline | This Cycle | Status |
|----------|-------|----------|------------|--------|
| 1 CRITICAL | Decorative elements | 10% usage | ??% | improved/same/regressed |
| 2 HIGH | Archetype selection | ~56% valid | ??% | ... |
| ... | ... | ... | ... | ... |
```

### 4. Self-improving loop (context-aware, when invoked via /loop)

Check if a previous cycle's report exists in `.fluid/reports/`. If yes:

1. Read `feedback/FEEDBACK-CONTEXT.md` for operator priorities
2. Read the previous cycle's SUMMARY.md
3. Compare via `node tools/compare-runs.cjs <prev-eval.json> <this-eval.json>`
4. Rank potential fixes by OPERATOR PRIORITY (from FEEDBACK-CONTEXT.md), not just failure count
   - An issue the operator flagged as CRITICAL gets fixed before a more frequent but LOW-priority issue
5. Apply up to 5 high-confidence adjustments (see guardrails below)
6. Log every applied change to `{REPORT_DIR}/changes.log`
7. Log speculative improvements to `{REPORT_DIR}/proposals.log` (see convergence behavior below)
8. If pattern-seeds or voice-guide files were edited: run `node tools/reseed-patterns.cjs`
9. Create git branch `overnight/{timestamp}/cycle-{N}` and commit changes

### Convergence behavior

NEVER declare "converged — nothing to do" and skip the cycle entirely. Even if no high-confidence changes remain:

1. Still run a reduced batch (3-4 creations) to monitor for regressions
2. Still reason about potential improvements — log them to `{REPORT_DIR}/proposals.log`
3. Still report progress against operator priorities in SUMMARY.md

**Two-tier action model:**

- **High-confidence changes:** You are sure this will help, backed by specific eval failures or operator priority items. Apply the change, log to `changes.log`, commit it.
- **Speculative improvements:** You think this *might* help but aren't sure. Do NOT apply. Instead log to `proposals.log`:

```
## Proposal: [short title]
**Target:** [which eval metric or operator priority]
**Change:** [what file, what edit]
**Reasoning:** [why this might help]
**Uncertainty:** [why not applying — low signal, edge case, etc.]
**Estimated impact:** [score delta or failure rate delta]
```

These proposals feed into the next human review — the operator can promote them.

### Auto-generate feedback entry

At the end of each cycle, write `feedback/{date}-overnight-cycle-{N}.md` with:
- Frontmatter: date, asset_type: pipeline, outcome: partial/success
- Cycle number, changes made, metrics before/after
- Any issues that persisted despite fixes

## Art Director Visual Eval Rubric

When spawning the visual eval subagent, use this prompt with both screenshot PNGs:

```
You are a senior art director evaluating whether a generated social media post meets the visual standard of a premium brand.

You are seeing TWO images:
1. REFERENCE: A curated, human-approved brand template (for BRAND STANDARD reference only)
2. GENERATED: An AI-generated post

DO NOT evaluate whether the GENERATED image matches the REFERENCE template's layout or structure. They may use completely different archetypes — that's fine.

Instead, evaluate: would the GENERATED image feel AT HOME in the same social media feed as the REFERENCE? The reference establishes the QUALITY BAR and BRAND LANGUAGE (color palette, font choices, decorative textures, overall polish level), not the specific layout.

Rate each dimension. Use ONLY these ratings:
  PASS — meets the quality bar set by the reference
  WEAK — noticeably below the reference but recognizable as the same brand
  FAIL — would not feel at home in the same feed

Dimensions:
1. COLOR USAGE — Brand palette adherence (black bg, accent colors, opacity values)
2. TYPOGRAPHY — Font choices, sizing, hierarchy (headline commanding the space)
3. COMPOSITION — Canvas fill, balance, intentional use of space (not vast empty black)
4. DECORATIVE ELEMENTS — Brushstrokes, textures, emphasis marks present and well-placed (FAIL if zero decoratives)
5. BORDERS — Footer/header present, full-width, correct brand elements
6. BRAND COHESION — Would this pass as professional content from this brand?
7. VISUAL POLISH — Finishing details, spacing, alignment, no text overflow
8. VISUAL RICHNESS — Textures, depth, layering (not just flat text on black)
9. SCROLL_STOPPING_POWER — Would someone stop scrolling for this?

Return ONLY valid JSON:
{
  "reference_template": "<name>",
  "dimensions": {
    "color_usage": { "rating": "PASS|WEAK|FAIL", "note": "1 sentence" },
    "typography": { "rating": "...", "note": "..." },
    "composition": { "rating": "...", "note": "..." },
    "decorative_elements": { "rating": "...", "note": "..." },
    "borders": { "rating": "...", "note": "..." },
    "brand_cohesion": { "rating": "...", "note": "..." },
    "visual_polish": { "rating": "...", "note": "..." },
    "visual_richness": { "rating": "...", "note": "..." },
    "scroll_stopping_power": { "rating": "...", "note": "..." }
  },
  "overall": "PASS|WEAK|FAIL",
  "art_director_note": "2-3 sentences of candid feedback"
}
```

## Adjustment Guardrails — Parity-Preserving Changes ONLY

The overnight loop may ONLY edit files that are shared source-of-truth for BOTH the real API pipeline and the simulation:

| Layer | Files | What can change |
|-------|-------|----------------|
| Brand rules | `pattern-seeds/*.md` | Weight values, clarifying examples, anti-patterns |
| Pipeline prompts | `canvas/src/server/api-pipeline.ts` (ONLY `build*Prompt()` functions) | Wording, rules, examples |
| Voice guide docs | `voice-guide/*.md` | Refine voice rules, add examples |

**Off-limits (NEVER modify):**
- `tools/simulate-pipeline.cjs`, `tools/pipeline-tools.cjs`, `.claude/agents/sim-executor.md`
- `tools/eval-harness.cjs`, `tools/visual-eval.cjs`
- Hex color values in pattern-seeds (brand colors are immutable)
- `archetypes/` directory
- Model assignments (`STAGE_MODELS`)
- Tool schemas (`STAGE_TOOLS`)

**Per-cycle limits:** Maximum 5 edits. Must log each change with file path, before/after, reasoning, and which eval failure it addresses.

**After editing pattern-seeds or voice-guide:** run `node tools/reseed-patterns.cjs` to sync DB.
