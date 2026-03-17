# Phase 5: Learning Loop - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Feedback ingestion system that reads completed canvas iteration trajectories and manual feedback files, identifies patterns, proposes brand rule/template updates, and walks the operator through approval. Also includes a `/fluid-design-os-feedback` skill for manually capturing feedback. Does NOT auto-apply changes — everything goes through human approval. Does NOT add canvas UI features — the approval flow lives in the CLI.

Requirements: META-01 (feedback ingestion meta-skill), META-02 (feedback categorization with human approval gate).

</domain>

<decisions>
## Implementation Decisions

### Trajectory reading & signal detection
- Primary input: completed canvas sessions from `.fluid/working/` — reads `lineage.json` (rounds, winners, prompts) and `annotations.json` (statuses, pin annotations, sidebar notes)
- Secondary input: `feedback/*.md` files (YAML frontmatter format already defined in `feedback/README.md`) — manual overrides that bypass pattern threshold
- Metadata only — do NOT parse variation HTML output. Signal comes from explicit human actions (winner picks, rejections, annotations), not reverse-engineering visual patterns from code
- Pattern threshold: only act on patterns appearing across 3+ sessions. Single rejections are noise
- Exception: explicit operator annotations (e.g., "NEVER use diagonal brushstroke on small posts") and feedback/*.md files bypass the 3-session threshold — direct human instructions are acted on immediately
- Cross-pollination: patterns appearing across multiple asset types inform brand-level docs (design-tokens.md, voice-rules.md). Asset-specific patterns that only appear in one type stay scoped to that asset's docs (social-post-specs.md, website-section-specs.md)
- Track processed sessions in `feedback/ingested.json` manifest — each run only analyzes new sessions, prevents double-counting

### Update targets & scope of changes
- The loop is purely advisory — it produces proposals, never auto-writes to brand docs
- Four proposal types: weight adjustments, rule modifications, new rules, and template updates
- Proposals are actionable diffs: exact file path, current text, proposed replacement text, plus evidence (which sessions, what pattern)
- Proposals target source brand `.md` files only (not rules.json). After approval, compile-rules.cjs rebuilds the compiled version
- Confidence level per proposal based on evidence strength (session count, explicitness of feedback)

### Human approval gate
- Two-phase single command: (1) analyze sessions and generate proposals, then (2) immediately walk operator through each proposal using interactive prompts (AskUserQuestion style — approve/reject/modify per item)
- Proposal file written to `feedback/proposals/YYYY-MM-DD-proposal.md` as audit trail before walking through items
- After approval walkthrough: apply approved changes to source .md files, auto-run `compile-rules.cjs` to rebuild rules.json, auto-commit with descriptive message (e.g., "brand(learning-loop): apply 4 proposals from 2026-03-15")

### Invocation & trigger model
- Manual slash command: `/feedback-ingest` — operator runs when ready to review accumulated data
- No arguments — processes all unprocessed sessions since last run (tracked by ingested.json)
- Always shows a summary report even if no proposals generated ("Analyzed 12 new sessions. Found 3 patterns with proposals. 9 sessions had no actionable signal.")
- Not auto-triggered — operator decides when to run

### Feedback capture skill
- `/fluid-design-os-feedback` skill for manually writing feedback to `feedback/*.md`
- Guided prompts: walks user through asset type, what worked/didn't, specific rule suggestions
- Auto-detects most recent session from `.fluid/working/` to pre-fill context (asset type, platform, session ID), but confirms with user that it's the right session before proceeding
- Writes properly formatted feedback file with YAML frontmatter matching `feedback/README.md` spec
- These files bypass the 3-session threshold in the ingestion loop (operator took time to write them = strong signal)

### Claude's Discretion
- Internal pattern detection algorithm (how to cluster and count rejection/winner patterns)
- Proposal file format and structure details
- How to present evidence in the approval walkthrough
- Confidence scoring methodology
- How to handle conflicting signals (e.g., a pattern is both approved and rejected across sessions)
- Exact guided prompt flow for the feedback capture skill

</decisions>

<specifics>
## Specific Ideas

- "I think the ingestion system should identify proposed weight changes, propose new rules, and let the user give input on what to do" — purely advisory, human always decides
- "I'd rather do something like GSD does where after generating the proposal it walks the user through each item with multiple choice" — interactive approval flow, not file editing
- Cross-pollination depends on context: "If it's feedback on a general brand rule, or if it's feedback on specifically a certain kind of asset. I would tend to err on the side of cross-pollinating"
- Summary should always show, even with no proposals: "If there was no actionable signal, we should still give the user a summary of what"
- Feedback skill should "auto-detect recent session, but ask if that's the session they're leaving feedback about"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `feedback/README.md`: Structured feedback format already defined (YAML frontmatter with date, asset_type, asset_name, prompt_used, outcome, operator_notes, rule_weights_affected)
- `lineage.json`: Tracks full prompt-to-result chain per session (Phase 2 flat entries + Phase 4 rounds with winners/rejections)
- `annotations.json`: Stores human/agent annotations with variation statuses (winner/rejected/final/unmarked)
- `tools/compile-rules.cjs`: Compiles brand .md files into rules.json — already the established compile step
- `tools/rules.json`: Compiled brand rules with weight system (1-100) — the enforcement layer
- `canvas/src/lib/sessions.ts`: Session discovery and lineage parsing already implemented (discoverSessions, loadSession, parseLineage, countVariations)
- `canvas/src/lib/types.ts`: Full TypeScript types for Lineage, Round, VariationInfo, Annotation, AnnotationFile, VariationStatus

### Established Patterns
- Brand docs use weight system 1-100 with enforcement thresholds (81-100 must, 51-80 should, 21-50 recommended, 1-20 nice-to-have)
- CLI tools output dual format (JSON stdout + human stderr) — ingestion tool should follow this
- rules.json compiled statically from brand docs — CLI tools never parse markdown at runtime
- Session-based working directory `.fluid/working/{sessionId}/` with lineage.json per session
- Skills distributed via sync.sh to ~/.claude/commands/

### Integration Points
- `.fluid/working/` — read completed sessions (lineage.json + annotations.json)
- `feedback/` — read manual feedback files, write ingested.json manifest, write proposals/
- `brand/*.md` — target files for approved changes
- `tools/compile-rules.cjs` — auto-run after applying approved changes
- `tools/rules.json` — rebuilt by compile step
- `.claude/skills/fluid-design-os-feedback/SKILL.md` — new skill for manual feedback capture

</code_context>

<deferred>
## Deferred Ideas

- **Canvas UI feedback panel** — a "Learning Loop" tab in the canvas showing proposals with approve/reject buttons. Would be more visual and integrated but adds canvas UI scope beyond Phase 5.
- **Auto-prompt after N sessions** — nudge the operator to run /feedback-ingest after every 5 completed sessions. Nice-to-have automation but not needed for v1.
- **HTML output analysis** — scanning winning variation HTML for specific CSS values (opacity, colors, font sizes) to detect implicit patterns. Deferred in favor of metadata-only approach.
- **Automated trajectory analysis (ITER-02)** — deeper pattern recognition across approval/rejection patterns. Tracked as v2 requirement.

</deferred>

---

*Phase: 05-learning-loop*
*Context gathered: 2026-03-11*
