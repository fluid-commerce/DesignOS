# Phase 6: Marketing Skills Integration - Research

**Researched:** 2026-03-11
**Domain:** Skill distribution, orchestrator delegation patterns, JSON manifest design
**Confidence:** HIGH

## Summary

Phase 6 integrates 30 marketing domain skills from `~/.agents/skills/` into the Fluid pipeline. The implementation has three distinct workstreams: (1) copy the skill files into `skills/marketing/` in this repo, (2) author `brand/skill-map.json` mapping asset-type + role combos to skill file paths, and (3) update the three orchestrator skills to pass marketing skill file paths in delegation messages alongside brand doc paths.

The existing infrastructure needs only targeted edits. Orchestrators already use the file-path-in-delegation pattern. Subagents already read what they're told. The `sync.sh` script has a `SKILLS` array and install loop that needs extension. No new subagent roles, no new pipeline stages, no abstraction layer — purely additive changes to existing patterns.

The single highest-risk task is the interactive skill-mapping walkthrough, which requires Claude to evaluate all 30 skills across 12 mapping slots (3 asset types × 4 roles) and walk the operator through each decision. This demands careful preparation: a pre-curated proposal with domain groupings, clear per-skill rationale, and a structured approval protocol.

**Primary recommendation:** Execute as three sequential plans — (1) copy skills + build manifest (requires interactive approval walkthrough), (2) update orchestrator skills with marketing context in delegation messages, (3) extend sync.sh for global distribution.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Skill loading strategy:**
- Static manifest at `brand/skill-map.json` defines which skills load for each (asset type + subagent role) combo
- Same pattern as `brand/index.md` agent loading notes — predictable, auditable, easy to tune
- 1-2 marketing skills max per subagent alongside brand docs (token budget constraint)
- Operator can override default skill set via `--skills` flag on any orchestrator command (e.g., `/fluid-social "topic" --skills copywriting,pricing-strategy`) — full override, not additive
- Skill map lives in `brand/skill-map.json` alongside brand docs — same ecosystem, tunable by Phase 5 learning loop

**Packaging & distribution:**
- Marketing skills copied as-is into `skills/marketing/` directory in this repo (no rewriting/ingestion)
- Each skill retains its original SKILL.md structure from `~/.agents/skills/`
- Source of truth moves to this repo — sync.sh overwrites any existing copies at `~/.agents/skills/` or `~/.claude/commands/`
- Skills distributed globally via sync.sh so they're available as standalone tools outside the Fluid pipeline AND as subagent context within it
- No deduplication logic needed — sync.sh simply overwrites with the repo version

**Skill-to-task mapping:**
- Mapping granularity: per asset type (social-post, website-section, one-pager), not per archetype/template
- 3 asset types × 4 subagent roles = 12 mapping entries in skill-map.json
- Human-curated mapping — during execution, Claude proposes the full mapping and walks operator through it skill-by-skill for interactive approval (same approval walkthrough pattern as Phase 5 feedback ingestion)
- All 30 skills should be evaluated for mapping; skills that don't naturally map to any asset type still get distributed as standalone tools

**Subagent architecture:**
- No new subagent roles — existing 4-role pipeline (copy → layout → styling → spec-check) unchanged
- Existing subagents get enriched via marketing skill loading (copy agent absorbs copywriting/CRO/psychology knowledge, spec-check absorbs SEO/analytics knowledge)
- Brand docs are PRIMARY, marketing skills are SECONDARY reference — if a marketing skill contradicts a brand doc, brand wins. Orchestrator delegation messages frame this explicitly: "Load marketing expertise (reference only — brand docs take precedence)"
- Orchestrator skills (fluid-social, fluid-one-pager, fluid-theme-section) updated directly to include marketing skill loading in delegation messages — no wrapper/loader abstraction

**Skill delivery to subagents:**
- File path in delegation message — orchestrator tells subagent "Read skills/marketing/copywriting/SKILL.md" (same pattern as brand docs today)
- Subagent reads the file itself — no content passed in delegation messages (existing anti-pattern rule)
- Brand context listed first in delegation, marketing expertise listed second, reinforcing the hierarchy

### Claude's Discretion
- Exact framing language in delegation messages (beyond the "reference only — brand docs take precedence" requirement)
- Whether skill-map.json is consumed by orchestrators at runtime (dynamic read) or hardcoded into orchestrator skills during a build step
- How to handle --skills flag validation (unknown skill names, too many skills)
- Sync.sh implementation details for distributing marketing skills

### Deferred Ideas (OUT OF SCOPE)
- **Dynamic prompt-based skill selection** — orchestrator analyzes prompt and adds skills beyond the manifest defaults. Deferred in favor of static manifest + --skills override for v1.
- **Per-archetype skill overrides** — social-post/stat-proof loads analytics-tracking while social-post/manifesto doesn't. Could be added to skill-map.json later if needed.
- **Skill condensation/summaries** — creating shorter versions of skills for token efficiency. Deferred because 1-2 skills per subagent keeps token budget manageable.
- **Marketing skill weight system** — numeric weights on marketing skill rules (like brand docs have). Would enable spec-check to validate against marketing best practices. Future phase.
</user_constraints>

---

## Standard Stack

### Core (no new dependencies — all pattern extensions)

| Component | Current State | Phase 6 Change | Why |
|-----------|---------------|----------------|-----|
| `brand/skill-map.json` | Does not exist | Create | Central manifest for skill-to-task mappings |
| `skills/marketing/` | Empty directory exists | Populate with 30 skill directories | Repo-local source of truth |
| `.claude/skills/fluid-social/SKILL.md` | Exists, complete | Edit delegation messages | Add marketing skill loading for copy + spec-check agents |
| `.claude/skills/fluid-one-pager/SKILL.md` | Exists, complete | Edit delegation messages | Same |
| `.claude/skills/fluid-theme-section/SKILL.md` | Exists, complete | Edit delegation messages | Same |
| `sync.sh` | Distributes 7 orchestrator skills | Extend to copy `skills/marketing/` contents globally | Marketing skills available as standalone tools |
| `brand/index.md` | 9 role-to-doc mappings | Add marketing skill references | Consistent with agent loading notes pattern |

### The 30 Marketing Skills (confirmed at `~/.agents/skills/`)

Confirmed present with line counts (proxy for depth/token cost):

| Skill | Lines | Domain | Primary Subagent Role |
|-------|-------|--------|----------------------|
| copywriting | 254 | Content/Copy | copy-agent |
| copy-editing | 449 | Content/Copy | copy-agent |
| social-content | 280 | Content/Copy | copy-agent |
| content-strategy | 361 | Content/Copy | copy-agent |
| marketing-psychology | 457 | Psychology | copy-agent |
| page-cro | 184 | CRO | copy-agent (one-pager/website only) |
| popup-cro | 455 | CRO | — (no direct asset type match) |
| signup-flow-cro | 361 | CRO | — |
| onboarding-cro | 222 | CRO | — |
| form-cro | 431 | CRO | — |
| paywall-upgrade-cro | 229 | CRO | — |
| churn-prevention | 426 | CRO/Retention | — |
| seo-audit | 414 | SEO | spec-check-agent |
| schema-markup | 181 | SEO | spec-check-agent (website only) |
| ai-seo | 400 | SEO | spec-check-agent (website only) |
| programmatic-seo | 240 | SEO | — |
| site-architecture | 359 | SEO | — |
| analytics-tracking | 311 | Analytics | spec-check-agent |
| ab-test-setup | 268 | Analytics | — |
| sales-enablement | 351 | Sales | copy-agent (one-pager only) |
| cold-email | 160 | Sales | — |
| competitor-alternatives | 258 | Sales | copy-agent (one-pager only) |
| ad-creative | 364 | Paid Media | copy-agent (social only) |
| paid-ads | 317 | Paid Media | — |
| email-sequence | 311 | Sales | — |
| launch-strategy | 355 | Growth | — |
| free-tool-strategy | 180 | Growth | — |
| pricing-strategy | 233 | Growth | — |
| referral-program | 257 | Growth | — |
| marketing-ideas | 169 | Growth | — |
| revops | 345 | Growth | — |

**Token budget analysis:** At 1-2 skills max per subagent, even the largest skill (marketing-psychology at 457 lines, ~5-6KB) adds acceptable overhead. The constraint is sound.

---

## Architecture Patterns

### Pattern 1: skill-map.json Schema

The manifest follows the brand doc pattern — role-keyed, file-path-referenced, predictable.

```json
{
  "_comment": "Marketing skill map. 1-2 skills per subagent per asset type. Brand docs take precedence over all marketing skills.",
  "social-post": {
    "copy-agent": ["skills/marketing/copywriting/SKILL.md", "skills/marketing/social-content/SKILL.md"],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": ["skills/marketing/analytics-tracking/SKILL.md"]
  },
  "one-pager": {
    "copy-agent": ["skills/marketing/copywriting/SKILL.md", "skills/marketing/sales-enablement/SKILL.md"],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": []
  },
  "website-section": {
    "copy-agent": ["skills/marketing/copywriting/SKILL.md", "skills/marketing/page-cro/SKILL.md"],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": ["skills/marketing/seo-audit/SKILL.md"]
  }
}
```

**Note:** The above is a research proposal for the interactive walkthrough. The actual values will be operator-approved during execution.

**Why layout-agent and styling-agent get no marketing skills:** Marketing skills operate at the copy, strategy, and validation level. Layout structure and CSS implementation are fully governed by brand archetypes and design tokens — no marketing skill adds value there without contradicting brand constraints.

### Pattern 2: Delegation Message Extension

Orchestrators currently tell agents what brand docs to read. Phase 6 adds a marketing expertise block after brand docs. The hierarchy is enforced by ordering and explicit framing.

Current copy-agent delegation (fluid-social):
```
"Generate Fluid brand copy for a social post. Topic: {prompt}. Platform: {platform}. ... Write output to {working_dir}/copy.md"
```

Extended delegation:
```
"Generate Fluid brand copy for a social post. Topic: {prompt}. Platform: {platform}.

Brand context (load these first — they are authoritative):
- brand/voice-rules.md
- brand/social-post-specs.md

Marketing expertise (reference only — brand docs take precedence in any conflict):
- skills/marketing/copywriting/SKILL.md
- skills/marketing/social-content/SKILL.md

... Write output to {working_dir}/copy.md"
```

### Pattern 3: --skills Flag Handling

Extends the existing flag pattern (`--platform`, `--template`, `--debug`). Flag value is a comma-separated list of skill directory names that replaces the manifest defaults for that run.

```bash
/fluid-social "topic" --skills copywriting,pricing-strategy
```

Behavior:
1. Parse `--skills` value by splitting on commas
2. For each skill name, resolve to `skills/marketing/{name}/SKILL.md`
3. Validate file exists — if not, warn and continue (graceful degradation)
4. Replace manifest defaults for the copy-agent slot with the provided list
5. No cap enforcement in v1 — operator is responsible for budget management when overriding

**Discretion recommendation:** Hardcode skill paths in orchestrator skills (not runtime reads of skill-map.json). Reason: orchestrator skills are already large text files; adding a Bash call to read and parse JSON mid-pipeline adds complexity with minimal gain. The manifest serves as documentation and is edited when defaults change. When `--skills` is provided, the orchestrator skips manifest lookup entirely and uses the provided paths.

### Pattern 4: sync.sh Extension for Marketing Skills

Current `sync.sh` installs 7 orchestrator skills via symlink (Claude) or file copy (Cursor). Phase 6 adds a second install loop for marketing skills.

For global `~/.agents/skills/` distribution, the approach differs from the orchestrator pattern. Marketing skills need to reach `~/.agents/skills/` (not `~/.claude/skills/`), so that `~/.agents/sync.sh` can distribute them further to Claude and Cursor as standalone slash commands.

Two-stage distribution:
1. This repo's `sync.sh` copies `skills/marketing/{name}/SKILL.md` to `~/.agents/skills/{name}/SKILL.md` (overwrite)
2. User runs `~/.agents/sync.sh` to distribute from `~/.agents/skills/` to `~/.claude/commands/` and `~/.cursor/skills/`

**Simpler alternative (discretion recommendation):** Have this repo's `sync.sh` write directly to `~/.claude/commands/` and `~/.cursor/skills/` for marketing skills (bypassing the `~/.agents/` intermediate). This avoids needing a second sync run. Tradeoff: couples this repo's sync to knowledge of Claude/Cursor paths, which is already the case.

### Pattern 5: Interactive Approval Walkthrough

Modeled on Phase 5's `feedback-ingest` walkthrough pattern. During execution:

1. Agent reads all 30 skill SKILL.md files to understand domain and content
2. Agent builds a complete proposed skill-map.json grouped by domain
3. Agent presents each mapping slot to operator: "social-post / copy-agent → [copywriting, social-content]. Rationale: X. Approve? (y/n/alternative)"
4. Operator responds skill-by-skill
5. Agent accumulates approved decisions and writes final skill-map.json

Skills that don't map to any asset type: agent confirms with operator that they'll be distributed as standalone tools only (no pipeline integration for v1).

### Recommended Directory Structure

```
skills/
└── marketing/
    ├── copywriting/
    │   └── SKILL.md          (copied as-is from ~/.agents/skills/copywriting/)
    ├── social-content/
    │   └── SKILL.md
    ├── marketing-psychology/
    │   └── SKILL.md
    ├── page-cro/
    │   └── SKILL.md
    ├── sales-enablement/
    │   └── SKILL.md
    ├── seo-audit/
    │   └── SKILL.md
    ├── analytics-tracking/
    │   └── SKILL.md
    └── ... (23 more)
brand/
└── skill-map.json            (new file, 12 mapping entries)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marketing skill content | Writing new skill content | Copy SKILL.md files as-is from `~/.agents/skills/` | Content already exists, battle-tested, operator already trusts it |
| Skill loading logic | Dynamic loader function, lazy-load abstraction | File path in delegation message — subagent reads | Already the established pattern; adding indirection creates new failure modes |
| JSON parsing at runtime | Bash/node json parsing in orchestrator skill | Hardcode paths directly in orchestrator skill text | Orchestrator SKILL.md is interpreted directly; Bash calls in the middle of skill text add fragility |
| Skill deduplication | Diff/merge logic between repo and `~/.agents/` versions | Overwrite with repo version (sync.sh) | Repo is declared authoritative; deduplication is unnecessary complexity |
| Approval UI | Interactive menu/selection UI | Sequential text-based walkthrough (same as feedback-ingest) | Already works; operator expects this pattern |

---

## Common Pitfalls

### Pitfall 1: Token Budget Creep from Unchecked Skill Size

**What goes wrong:** Developer assigns 2 skills per subagent without checking sizes. `marketing-psychology` (457 lines) + `copy-editing` (449 lines) = ~900 lines of secondary context. Combined with brand docs (~12-16KB total), subagent context becomes oversized.

**Why it happens:** Skill files look small individually; aggregate size is only visible when totaled.

**How to avoid:** Cap at 1-2 skills per subagent as decided. Prefer shorter skills over longer ones when two candidates serve similar purposes. `page-cro` (184 lines) is better than `popup-cro` (455 lines) for website-section context.

**Warning signs:** Delegation messages that feel long when read aloud. Subagent producing unexpected blends of marketing advice and brand rules.

### Pitfall 2: Marketing Skill Contradicting Brand Voice

**What goes wrong:** `copywriting` skill says "use rhetorical questions" while Fluid brand voice rule says "lead with pain, one sentence one idea" — a subagent gets confused about which applies.

**Why it happens:** General-purpose marketing skills give general-purpose advice. Fluid brand rules are specific.

**How to avoid:** The hierarchy framing in delegation messages is the primary guard. The message must explicitly say "brand docs take precedence in any conflict" before listing marketing skills. Spec-check agent should not load marketing skills — it validates against brand rules only.

**Warning signs:** Copy agent producing output that sounds generically marketingish, not distinctly Fluid.

### Pitfall 3: Sync.sh Distributing Skills That Conflict with Existing Global Installs

**What goes wrong:** `~/.agents/skills/copywriting/SKILL.md` already exists (the user installed it separately). Repo's sync.sh overwrites with the repo version. Repo version may be older than what's already there.

**Why it happens:** The repo is declared the authoritative source of truth, but the user may have updated skills globally since.

**How to avoid:** Per locked decision, overwrite is the intended behavior — repo version wins. Document this clearly in sync.sh output so operator can verify after sync. The sync.sh should print "Overwrote: ~/.agents/skills/copywriting/" for visibility.

**Warning signs:** Operator reports marketing skills behaving differently than expected after sync.

### Pitfall 4: --skills Flag with Paths vs Names

**What goes wrong:** Operator types `--skills skills/marketing/copywriting` (a path) instead of `--skills copywriting` (a name). Orchestrator tries to resolve `skills/marketing/skills/marketing/copywriting/SKILL.md`.

**How to avoid:** Validate the --skills value by attempting file resolution before the pipeline starts. If `skills/marketing/{name}/SKILL.md` does not exist, print a clear warning with the resolved path and the correct skill names from the manifest.

### Pitfall 5: skill-map.json Drift from Actual Skills Directory

**What goes wrong:** A skill is renamed or removed from `skills/marketing/` but skill-map.json still references it. Subagent delegation includes a path that doesn't exist.

**How to avoid:** During the --skills validation step, always check file existence. In the orchestrator, before delegating, verify that the skill-map.json entries resolve to real files. Print a warning (not a failure) if a mapped skill is missing.

---

## Code Examples

### skill-map.json Full Schema

```json
{
  "_meta": {
    "version": "1.0",
    "updated": "2026-03-11",
    "note": "1-2 skills per subagent max. Brand docs take precedence over all marketing skills."
  },
  "social-post": {
    "copy-agent": [
      "skills/marketing/copywriting/SKILL.md",
      "skills/marketing/social-content/SKILL.md"
    ],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": [
      "skills/marketing/analytics-tracking/SKILL.md"
    ]
  },
  "one-pager": {
    "copy-agent": [
      "skills/marketing/copywriting/SKILL.md",
      "skills/marketing/sales-enablement/SKILL.md"
    ],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": []
  },
  "website-section": {
    "copy-agent": [
      "skills/marketing/copywriting/SKILL.md",
      "skills/marketing/page-cro/SKILL.md"
    ],
    "layout-agent": [],
    "styling-agent": [],
    "spec-check-agent": [
      "skills/marketing/seo-audit/SKILL.md"
    ]
  }
}
```

### Delegation Message Extension (fluid-social copy-agent)

```
"Generate Fluid brand copy for a social post. Topic: {prompt}. Platform: {platform}. {If product: Product context: {product}.} {If template: Follow the structure of templates/social/{template}.html closely.} {If ref: Reference the style and tone of {ref}.}

Brand context (PRIMARY — load these first, they are the authoritative spec):
- brand/voice-rules.md
- brand/social-post-specs.md

Marketing expertise (SECONDARY — reference only, brand docs take precedence in any conflict):
{for each skill in resolved_skills}
- {skill_path}
{endfor}

Apply marketing expertise to strengthen persuasion, specificity, and psychological hooks — while staying within Fluid brand voice constraints.

Write output to {working_dir}/copy.md"
```

### --skills Flag Resolution (pseudocode in orchestrator SKILL.md)

```
# In argument parsing section:
If --skills flag present:
  resolved_skills = []
  for name in split($skills_arg, ","):
    path = "skills/marketing/" + trim(name) + "/SKILL.md"
    if file_exists(path):
      append resolved_skills, path
    else:
      print "WARNING: Unknown skill '{name}' (resolved to {path}) — skipping"

  if resolved_skills is empty:
    print "WARNING: No valid skills found in --skills argument. Using manifest defaults."
    resolved_skills = lookup skill-map.json for asset_type + "copy-agent"
else:
  resolved_skills = lookup skill-map.json for asset_type + "copy-agent"
```

### sync.sh Marketing Skills Extension

```bash
# ──────────────────────────────────────────────
# INSTALL: MARKETING SKILLS (global distribution)
# ──────────────────────────────────────────────
MARKETING_SKILLS_DIR="$REPO_DIR/skills/marketing"

if [ -d "$MARKETING_SKILLS_DIR" ]; then
  echo ""
  echo "--- Marketing Skills (global) ---"

  for skill_dir in "$MARKETING_SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    src="$skill_dir/SKILL.md"
    dst="$HOME/.agents/skills/$skill_name/SKILL.md"

    if [ ! -f "$src" ]; then
      echo "  SKIP: $src (SKILL.md not found)"
      continue
    fi

    run mkdir -p "$(dirname "$dst")"
    run cp "$src" "$dst"
    echo "  Overwrote: $dst"
    ((INSTALLED++))
  done
fi
```

---

## Key Domain Insights from Skill Inspection

### Which Skills Map Well vs. Poorly

**High mapping confidence (skills with clear per-asset-type relevance):**

| Skill | Maps to | Why confident |
|-------|---------|---------------|
| `copywriting` | copy-agent, all 3 types | General conversion copy principles enhance any brand copy |
| `social-content` | copy-agent, social-post only | Platform-specific content strategy for Instagram/LinkedIn |
| `sales-enablement` | copy-agent, one-pager only | "Sales uses what sales trusts" principles directly apply |
| `page-cro` | copy-agent, website-section only | Value prop clarity + CTA hierarchy applies to hero/CTA sections |
| `seo-audit` | spec-check-agent, website-section only | On-page SEO checklist relevant for .liquid sections |
| `analytics-tracking` | spec-check-agent, social-post only | UTM parameter awareness, tracking event naming for social campaigns |
| `marketing-psychology` | copy-agent as optional override | 457-line deep resource; best used via --skills override for persuasion-focused work |

**Low mapping confidence (standalone tools only in v1):**
- `ab-test-setup`, `email-sequence`, `cold-email`, `paid-ads`, `popup-cro`, `signup-flow-cro`, `form-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `programmatic-seo`, `site-architecture`, `free-tool-strategy`, `launch-strategy`, `pricing-strategy`, `referral-program`, `marketing-ideas`, `revops`

These 18 skills address post-generation or non-asset workflows (A/B testing infrastructure, email nurture flows, ad buying strategy, churn prevention). They provide no direct value during asset generation but remain valuable as standalone `~/.agents/skills/` commands.

### Skills with References Subdirectories

Several marketing skills use `references/` subdirectories (e.g., `copywriting` references `references/copy-frameworks.md`, `references/natural-transitions.md`). When copying these skills to `skills/marketing/`, the `references/` subdirectories must be copied as well, not just SKILL.md. The skill content links to them by relative path.

**Confirmed skills with references subdirectories (from directory listing):**
- `copywriting/references/`
- `page-cro/references/`
- `seo-audit/references/`
- Possibly others

**Impact on sync.sh:** The copy command must be `cp -r {skill_dir}/ {dst_dir}/` (recursive), not just `cp SKILL.md`.

---

## State of the Art

| Old Approach | Current Approach | Phase 6 Change |
|--------------|------------------|----------------|
| Brand docs only in delegation | Brand docs + marketing skill paths | Marketing skills listed as secondary context |
| 7 skills distributed by sync.sh | 7 + 30 skills distributed | sync.sh extended for marketing/ directory |
| No skill manifest | No manifest | `brand/skill-map.json` introduced |
| `--debug`, `--ref`, `--template` flags | Same | `--skills` flag added |

---

## Open Questions

1. **Which skills have references/ subdirectories?**
   - What we know: `copywriting`, `page-cro`, `seo-audit` confirmed from directory listing earlier. Others likely.
   - What's unclear: Full list not enumerated.
   - Recommendation: In Plan 1 (copy skills task), enumerate all `~/.agents/skills/{name}/` directories and copy the entire directory recursively, not just SKILL.md. This handles references/ without needing advance knowledge.

2. **Should skill-map.json be read at runtime or hardcoded?**
   - What we know: User indicated preference for "runtime read" or "build step" is Claude's discretion.
   - Recommendation: Hardcode paths directly in orchestrator SKILL.md text. The manifest is documentation + default spec. When `--skills` override is present, orchestrators skip manifest lookup. This keeps orchestrator skills as self-contained text files with no runtime file I/O dependency.

3. **Should marketing skills installed globally use the `fluid-` namespace prefix?**
   - What we know: Orchestrator skills use `fluid-` prefix to avoid conflicts (per Phase 1 decision). Marketing skills (copywriting, seo-audit, etc.) are general-purpose — they pre-exist as `~/.agents/skills/copywriting/` without namespace.
   - Recommendation: No prefix for marketing skills. They keep their original names at `~/.agents/skills/copywriting/`, which matches the existing user expectation (these skills are already installed). The repo version simply becomes authoritative.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (canvas/src/__tests__/) |
| Config file | canvas/vite.config.ts |
| Quick run command | `cd canvas && npx vitest run` |
| Full suite command | `cd canvas && npx vitest run` |

### Phase Requirements to Test Map

Phase 6 is a configuration and file-distribution phase. The deliverables are text files (SKILL.md copies, JSON manifest, updated orchestrator skills, updated sync.sh). There are no runtime software components to unit test.

| Behavior | Test Type | Approach |
|----------|-----------|----------|
| skill-map.json is valid JSON | smoke | `node -e "JSON.parse(require('fs').readFileSync('brand/skill-map.json','utf8'))"` |
| All skill paths in skill-map.json resolve to real files | smoke | Bash loop checking file existence |
| skills/marketing/ contains 30 directories | smoke | `ls skills/marketing/ | wc -l` |
| Orchestrator skills contain marketing skill references | smoke | `grep -c "skills/marketing" .claude/skills/fluid-social/SKILL.md` |
| --skills parsing pseudocode is present in orchestrators | manual | Human review of delegation message section |

### Sampling Rate

- **Per task:** Run the smoke tests above as a manual verification checklist
- **Phase gate:** All smoke tests pass + manual review of one full orchestrator run with marketing skill loading (e.g., `/fluid-social "test prompt"` and confirm delegation messages include skill paths)

### Wave 0 Gaps

None. No new test infrastructure needed. Smoke tests are one-line Bash commands, not automated test files.

---

## Sources

### Primary (HIGH confidence)

- Direct file inspection: `/Users/cheyrasmussen/.agents/skills/*/SKILL.md` — all 30 skills read or enumerated
- Direct file inspection: `/Users/cheyrasmussen/Fluid-DesignOS/.claude/skills/fluid-social/SKILL.md` — delegation message pattern confirmed
- Direct file inspection: `/Users/cheyrasmussen/Fluid-DesignOS/sync.sh` — SKILLS array and install loop pattern confirmed
- Direct file inspection: `/Users/cheyrasmussen/Fluid-DesignOS/.planning/phases/06-marketing-skills-integration/06-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- Inspection of `fluid-one-pager` and `fluid-theme-section` orchestrator patterns — confirmed identical delegation message structure to fluid-social
- Inspection of `feedback-ingest` skill — interactive approval walkthrough pattern confirmed

### Tertiary (LOW confidence)

- Token budget estimates (skill file sizes as KB proxies) — line counts used, not actual token counts. At typical 4 chars/token, 450 lines ≈ 3,000-4,000 tokens. Within acceptable range for secondary context.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components directly inspected in the codebase
- Architecture patterns: HIGH — derived from existing patterns confirmed in orchestrator SKILL.md files
- Skill mapping proposals: MEDIUM — research-based proposal; final values require operator approval in execution
- Pitfalls: HIGH — derived from direct inspection of skill file structures and existing anti-patterns documented in orchestrator skills

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain — no external dependencies that change)
