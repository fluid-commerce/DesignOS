# Creative Agent Architecture — Design Spec

**Date:** 2026-04-07
**Status:** Design approved, pending implementation plan
**Scope:** Replace the 4-stage pipeline with a single conversational agent backed by harness-enforced context discipline, validation, and cost control.

---

## 1. Vision

Fluid DesignOS generates brand-correct marketing assets (social posts, one-pagers, carousels) through a conversational AI agent. The interaction model is **art director working with a capable junior designer** — the user directs, the agent produces, the user iterates or approves.

The system operates on two tiers:

- **Tier 1 (System-wide):** Universal rules about what makes a well-formed deliverable, regardless of brand. Lives in code. Enforced deterministically by the harness.
- **Tier 2 (Brand-specific):** What makes a deliverable on-brand for a specific organization. Lives in the database. Loaded at runtime and injected as context.

Swapping the database contents produces output for a completely different brand. No code changes required.

---

## 2. System Shape

**Harness type:** Embedded AI product feature (hybrid — conversational front door + structured generation backend)

**Product shape:** Internal creative copilot

**Operator:** Solo developer (design must be maintainable by one person)

**Complexity level:** Level 2 (Durable Harness) — tasks span time, have retries, and require state persistence. Single agent; no multi-agent coordination.

---

## 3. Core Mental Model — Three Nested Loops

```
CONVERSATION LOOP (outer)
  Agent and user talk freely. The agent can answer questions,
  edit brand rules, discuss strategy, or generate assets.
  Persistent chat history in SQLite.

  CREATION LOOP (middle)
    User requests asset -> agent produces -> user reviews ->
    user iterates (via prompt or direct slot edits) or moves on.
    Repeats until user is satisfied. No explicit approval gate —
    the user's next action IS the feedback.

    PRODUCTION PASS (inner)
      Agent generates HTML -> harness runs validation ->
      results injected back -> agent fixes if needed -> saves.
      One complete draft per pass. The user never sees
      a creation that hasn't passed structural validation.

  CAMPAIGN LOOP (parallel middle)
    Lead creation reviewed by user -> user says "do the rest" ->
    harness spawns parallel production passes for remaining
    creations using the approved lead as a creative brief.
```

**The headless/scheduled path** enters at the Campaign Loop directly — no conversation, no user in the middle. The creative brief comes from a config rather than interactive lead approval.

---

## 4. Two-Tier Context System

### 4.1 Tier 1: System Rules

Universal, brand-agnostic, enforced by the harness. These are structural quality constraints.

| Rule | Enforcement |
|------|-------------|
| CSS in `<style>` blocks, never inline `style=""` | Deterministic check (post-save) |
| Self-contained HTML, no external dependencies | Deterministic check |
| Decorative elements use `<div>` + `background-image`, not `<img>` | Deterministic check |
| Platform dimensions must match target | Deterministic check |
| SlotSchema must be complete and match archetype fields | Deterministic check |
| Only fonts registered in the brand asset registry are allowed | Deterministic check (reads DB) |
| `@font-face` family name must match asset registry name | Deterministic check |
| Background/content/foreground layer structure respected | Deterministic check |
| Every creation produces: HTML file + SlotSchema + aiBaseline | Harness-enforced (save_creation contract) |

**What is NOT Tier 1:** No colors, font names, accent systems, brushstroke rules, voice guidance, or any brand-specific content. All of that is Tier 2.

### 4.2 Tier 2: Brand Rules

Loaded from the database at runtime. Assembled into the Brand Brief (see 4.3).

**Existing DB sources:**
- `voice_guide_docs` — voice, tone, messaging frameworks
- `brand_patterns` — visual rules with weights (colors, typography, decorations, archetypes)
- `brand_assets` — font files, textures, logos with serving URLs
- `brand_styles` — CSS layers (global, per-platform)
- `template_design_rules` — per-template/archetype design rules
- `context_map` — configuration for which sections to include per creation type

**Weight-based enforcement:**
- Weight >= 81: BLOCKING. Harness treats violations as errors the agent must fix.
- Weight 51-80: WARNING. Logged, shown to user, not blocking.
- Weight 21-50: Recommended. Available in brand brief, not validated.
- Weight 1-20: Nice-to-have. Available via discovery tools, not in brief.

### 4.3 The Brand Brief

A pre-assembled document injected into the system prompt at the start of every conversation (and refreshed when brand data changes). Built from the context_map + DB tables.

**Structure:**

```markdown
## Brand Brief

### Voice (from voice_guide_docs, top entries by weight)
[condensed voice rules — tone, messaging patterns, tagline formats]

### Hard Rules (from brand_patterns where weight >= 81)
[non-negotiable visual rules — constraints, not suggestions]

### Color System (from brand_patterns, category=colors)
[palette, accent system, usage rules]

### Typography (from brand_patterns, category=typography)
[font families, weights, scale, usage rules]

### Asset Manifest (from brand_assets)
[all available fonts, textures, logos with exact serving URLs]

### Active CSS Layers (from brand_styles)
[global + platform CSS — what the style system already defines]

### Decoration Rules (from brand_patterns, category=decorations)
[rendering rules for brushstrokes, circles, overlays]
```

**Token budget:** Target ~4K-6K tokens for the brief. The existing `context_map` table is repurposed: instead of mapping (creation_type, stage) → sections (which was designed for the 4-stage pipeline), it maps (creation_type, "brief") → sections. The stage column becomes "brief" for the single-agent model, with the existing priority and max_tokens columns controlling inclusion and truncation. No schema change needed — just different seed data.

**Discovery tools remain available** for deep-dives beyond the brief. The brief ensures the model never starts from zero; tools enable going deeper when needed.

---

## 5. Tool Registry & Permission Tiers

### 5.1 Always Available (safe reads + core creation)

| Tool | Type | Purpose |
|------|------|---------|
| `list_voice_guide` | read | Discover voice docs |
| `read_voice_guide(slug)` | read | Deep-dive a voice doc |
| `list_patterns(category?)` | read | Discover brand patterns |
| `read_pattern(slug)` | read | Deep-dive a pattern |
| `list_assets(category?)` | read | Discover brand assets |
| `list_templates(type?)` | read | Discover templates |
| `read_template(id)` | read | Deep-dive a template |
| `list_archetypes` | read | Discover layout archetypes |
| `read_archetype(slug)` | read | Read archetype HTML + schema |
| `render_preview(html, width, height)` | read | Playwright screenshot, returns base64 WebP |
| `save_creation(html, slotSchema, platform, campaignId?)` | write | Save draft iteration (triggers validation) |
| `edit_creation(iterationId, html, slotSchema?)` | write | Update existing iteration (triggers validation) |

### 5.2 Confirmation-Gated (brand data mutations)

These tools modify the brand identity itself. The harness intercepts the call, sends an SSE event to the frontend, and pauses the agent loop until the user approves or denies.

| Tool | Type | Gate |
|------|------|------|
| `update_pattern(slug, content)` | write | User confirmation required |
| `create_pattern(category, name, content)` | write | User confirmation required |
| `delete_pattern(slug)` | write | Confirmation + blocked for `is_core=1` patterns |
| `update_voice_guide(slug, content)` | write | User confirmation required |
| `create_voice_guide(title, content)` | write | User confirmation required |

**Implementation:** The harness sends `event: confirm_tool` via SSE with tool name, arguments, and a preview of the change. The frontend renders a confirmation dialog. The agent loop waits for the response. On denial, the harness returns a tool_result indicating the action was denied.

### 5.3 Harness-Managed Behaviors (not agent tools)

These are lifecycle hooks, not tools the model calls.

| Behavior | Trigger | What Happens |
|----------|---------|--------------|
| Brand validation | After `save_creation` / `edit_creation` | Run brand-compliance + dimension-check, inject results as system message |
| CSS layer merge | During `save_creation` | Run `mergeCssLayers()` on HTML before writing to disk |
| SlotSchema resolution | During `save_creation` | Resolve archetype schema + brand decorative fields, attach to iteration |
| Copy accumulator | During campaign generation | Track headlines/taglines, inject as negative examples for subsequent creations |
| Stale generation reaper | On server startup | Mark pending generations older than 5 min as `failed` |

---

## 6. The Production Pass (Inner Loop)

When the agent generates a creation, the harness orchestrates a structured production pass.

### 6.1 Lifecycle

**Step 1: Preflight**
- Agent signals creative intent (natural language — "I'll create an Instagram post")
- Harness resolves: platform → dimensions, creation_type → context_map entries
- Harness creates: working directory, DB records (campaign/creation/slide/iteration with status `pending`)

**Step 2: Generation**
- Agent writes HTML using brand brief context + discovery tools as needed
- Agent calls `render_preview` to visually self-check (WebP, 75% quality)
- Agent corrects obvious issues (spacing, hierarchy, missing elements)
- Agent calls `save_creation(html, slotSchema, platform)`

**Step 3: Validation (harness-automatic)**
- `tier1-check.cjs` runs — structural rules (inline styles, self-contained, layer structure, slotSchema)
- `brand-compliance.cjs` runs — Tier 2 rules loaded from DB, checked against HTML
- `dimension-check.cjs` runs — platform dimension verification
- `mergeCssLayers()` applied — brand_styles CSS layers merged into HTML
- SlotSchema resolved — archetype fields + brand decorative fields attached

Results injected into the conversation as a system message:
```
Validation: 1 blocking issue, 1 warning.
- [BLOCKING] Font 'Helvetica' not in brand asset registry
- [WARNING] Brushstroke opacity 0.08, brand rule says 0.10-0.25 (weight 90)
```

**Step 4: Fix (if blocking issues)**
- Agent sees validation results, makes targeted fixes
- Agent calls `edit_creation(iterationId, fixedHtml)`
- Validation reruns automatically
- Max 2 fix cycles. After that, saves as-is with issues flagged for user attention.

**Step 5: Present**
- Harness emits `event: creation_ready` via SSE with iteration ID
- Frontend renders the creation in the canvas
- Agent says "Here you go, what next?" — no approval gate
- User's next action is the feedback

### 6.2 What the model does NOT manage

- DB record creation (harness)
- CSS layer merging (harness)
- SlotSchema resolution (harness)
- Validation execution (harness)
- File path management (harness)
- HTML path fallback resolution (harness)

The model's job is purely creative: read brand context, choose an archetype, write good HTML, and fix issues when the harness tells it to.

### 6.3 Render Preview Specs

- **Format:** WebP at 75% quality (3-5x smaller than PNG, sufficient for layout/hierarchy checks)
- **Budget:** Max 3 renders per production pass. The harness tracks render count and returns an error if exceeded.
- **Viewport:** Set to exact platform dimensions (1080x1080 for IG, 1200x627 for LinkedIn, etc.)
- **Asset resolution:** Rewrite `/fluid-assets/` URLs to `file://` paths before rendering
- **Timeout:** 10 second max per render. Fail gracefully if exceeded.

---

## 7. Campaign Flow

### 7.1 Interactive Campaign (Lead + Batch)

```
1. User: "Launch a campaign for Payments across IG and LinkedIn"

2. Harness parses intent:
   - Multiple platforms detected (instagram, linkedin)
   - Product context extracted (Payments)
   - Classified as campaign (not single creation)

3. Agent generates LEAD CREATION (first Instagram post)
   - Full production pass (generate -> validate -> present)
   - Agent: "Here's the first Instagram post. Want me to adjust
     anything before I generate the rest?"

4. User reviews lead:
   - Iterates via prompt ("make the headline punchier")
   - Makes direct edits via slot editor sidebar
   - Responds: "looks good, do the rest" (or just "go")

5. Harness captures CREATIVE BRIEF from approved lead:
   - Accent color used
   - Archetype chosen
   - Copy tone and style signals
   - User edits applied (treated as direction)
   - Headlines/taglines for copy accumulator

6. Harness spawns PARALLEL production passes:
   - One concurrent API call per remaining creation
   - Each receives: creative brief + brand brief + platform specs
   - Copy accumulator active across all (prevents repetition)
   - Each runs full inner loop (generate -> validate -> fix)

7. Results presented to user:
   - All creations land in the campaign view
   - User can iterate on individual pieces
   - User marks winners when satisfied
```

### 7.2 Headless/Scheduled Campaign (future)

Same infrastructure, no conversation loop. A config replaces interactive lead approval:

```json
{
  "prompt": "Q2 campaign for Fluid Payments",
  "platforms": ["instagram", "linkedin"],
  "creativeBrief": {
    "accentColor": "green",
    "tone": "proof-driven",
    "archetype": "stat-hero-single"
  },
  "count": { "instagram": 3, "linkedin": 2 }
}
```

**Entry point:** `POST /api/generate/headless` — creates campaign, runs parallel production passes, returns campaign ID. No SSE, no conversation. Results queryable via existing campaign API endpoints.

---

## 8. State & Durability

### 8.1 What survives a page reload

- Full conversation history (`chat_messages` table)
- All creation state (`iterations` table — html_path, slotSchema, aiBaseline, userState, status)
- Campaign structure (campaigns -> creations -> slides -> iterations)
- Brand brief (rebuilt from DB on reconnect)

### 8.2 What survives a server restart

- Everything above (SQLite WAL mode)
- Stale generation reaper runs on startup: any `generation_status = 'pending'` older than 5 minutes is marked `failed`

### 8.3 Idempotency

- Each generation gets a `generationId` (nanoid). Resubmitting the same generationId within 60 seconds is rejected with the existing generation's status.
- `save_creation` is idempotent per iterationId — saving the same HTML twice updates rather than duplicates.

### 8.4 Session management

- Active sessions tracked in-memory: `Map<chatId, { cancelled: boolean, tokenCount: number }>`
- Cancellation: sets `cancelled = true`, agent loop checks on each iteration
- Server restart: all in-memory sessions are lost; stale reaper handles the DB side

---

## 9. Cost Control & Observability

### 9.1 Cost guards

| Guard | Threshold | Behavior |
|-------|-----------|----------|
| Per-turn token tracking | Every API call | Log input_tokens + output_tokens, accumulate per chat |
| Per-chat budget | 500K tokens | At 80%: system message warning. At 100%: stop agent loop. |
| Per-creation budget | 100K tokens | A single production pass exceeding this aborts the fix loop |
| Render budget | 3 per production pass | 4th `render_preview` call returns error instead of screenshot |
| Agent loop cap | 25 iterations | Hard stop on tool-use loop (already in sandbox branch) |

### 9.2 Observability

**Generation log (new table or extend existing):**
Per creation: model used, tokens_in, tokens_out, cost_estimate, duration_ms, validation_result (pass/fail/issues), fix_iterations_count, renders_used.

**Context injection log (existing `context_log` table):**
What brand brief sections were active, what discovery tools were called beyond the brief (gap signals — indicates the brief is missing something the model needs).

**Health endpoint:**
`GET /api/health` returns: `{ status, db, anthropicKeyPresent, brandBriefTokenCount, activeGenerations }`

### 9.3 What the user sees

- Streaming text as agent thinks
- Tool activity indicators ("Reading brand patterns...", "Rendering preview...")
- Validation results after save (pass/fail with specifics, non-modal)
- Creation appears in canvas when ready
- Per-chat token usage (shown as a usage meter, not dollar amounts)

---

## 10. Agent System Prompt Structure

The system prompt is assembled at chat creation time and refreshed when brand data changes.

```
[Tier 1: Role and behavior]
You are a creative partner for a brand design system. You generate
marketing assets, discuss brand strategy, and iterate based on
user feedback.

[Tier 1: Workflow]
When creating an asset:
1. Review the Brand Brief below for context
2. Choose an appropriate archetype (use list_archetypes / read_archetype)
3. Generate complete, self-contained HTML
4. Render a preview to visually check your work
5. Fix obvious issues (spacing, hierarchy, missing elements)
6. Save with save_creation — the system will validate automatically
7. Present to the user: "Here you go, what next?"

[Tier 1: Structural rules]
- All CSS in <style> blocks with class selectors. Never inline style="".
- Self-contained HTML. No external CDN or stylesheet links.
- Decorative elements use <div> with background-image, not <img>.
- Only use fonts that appear in the Asset Manifest below.
- Every creation must have a complete SlotSchema based on an archetype.
- Use the background-layer / content / foreground-layer structure.

[Tier 1: Intent gating]
- Only modify brand data (patterns, voice guide) when the user
  explicitly asks. The system will ask the user to confirm.
- When iterating on a creation, preserve user's direct edits
  (from the slot editor) unless the user says otherwise.

[Tier 1: Platform dimensions]
Instagram Square: 1080x1080
Instagram Story: 1080x1920
LinkedIn Post: 1200x627
LinkedIn Article: 1200x644
Facebook Post: 1200x630
Twitter/X Post: 1200x675
One-Pager: 1280x1600

[Tier 2: Brand Brief — assembled from DB]
{brandBrief}

[Tier 1: UI context awareness]
The user is currently viewing: {currentView}
Active campaign: {activeCampaignId || "none"}
Active creation: {activeCreationId || "none"}
Active iteration: {activeIterationId || "none"}

When the user says "make it punchier" or "try a different color,"
they mean the active creation. When they reference "the campaign,"
they mean the active campaign.
```

---

## 11. Tier Boundary Cleanup (Migration)

Findings from the codebase audit. These Fluid-specific values are currently hardcoded in Tier 1 and must be migrated to DB (Tier 2).

### 11.1 Move to `brand_patterns`

| Current Location | Content | Target Pattern |
|-----------------|---------|----------------|
| api-pipeline.ts:1395, copy-agent.md:73-87 | Accent color hex values + emotion mappings | `accent-color-system` (category: colors) |
| styling-agent.md:214-233, spec-check-agent.md:150-157 | Brushstroke CSS rules (screen blend, opacity, edge-bleed) | `brushstroke-rendering` (category: decorations) |
| styling-agent.md:239-266, spec-check-agent.md:159-172 | Circle emphasis rules (mask-image, sizing, rotation) | `circle-emphasis` (category: decorations) |
| styling-agent.md:268-284, spec-check-agent.md:179-185 | Footer structure + platform padding | `footer-structure` (category: archetypes) |
| api-pipeline.ts:422-438 | Archetype alias map (problem-first -> minimal-statement, etc.) | `archetype-aliases` (category: archetypes) |
| api-pipeline.ts:1502-1510 | Decorative minimums (2 brushstrokes, 1 emphasis) | `decoration-requirements` (category: decorations) |
| api-pipeline.ts:1499-1500 | Font-family naming rules (Inter -> NeueHaas) | `font-system` (category: typography) |

### 11.2 Move to `voice_guide_docs`

| Current Location | Content | Target |
|-----------------|---------|--------|
| copy-agent.md:113-131 | Pain-first messaging default, one-sentence-one-idea, scenario naming | Update existing voice guide entries or create `messaging-strategy` doc |
| copy-agent.md:128-131 | FLFont tagline patterns ([benefit]. [contrast].) | Update existing voice guide or `tagline-patterns` doc |

### 11.3 Refactor `brand-compliance.cjs`

- Remove hardcoded `BASE_RULES.accent_colors` array (`['#FF8B58', '#42B1FF', '#44B574', '#C985E5']`)
- Remove hardcoded `BASE_RULES.social_families` and `allowed_families` (`NeueHaasDisplay`, `FLFont`, etc.)
- Load accent colors from `brand_patterns` (category=colors) at startup
- Load allowed font families from `brand_assets` (category=fonts) at startup
- Keep structural checks (inline styles, self-contained HTML, dimension format) as Tier 1

### 11.4 Refactor `brand-seeder.ts`

- Remove hardcoded company names (WeCommerce, Fluid) from template definitions
- Remove hardcoded design rules per archetype (lines 330-383)
- Template definitions should reference slots and structure only, not brand content
- Design rules per archetype should be seeded into `template_design_rules` and loaded from there

### 11.5 Delete `.claude/agents/` subagent files

The copy-agent.md, layout-agent.md, styling-agent.md, and spec-check-agent.md files are already deleted on the sandbox branch. They contain the densest concentration of Tier 2 leaks and are no longer used. Confirm deletion on merge.

---

## 12. Evaluation Plan

### 12.1 Automated validation (runs every production pass)

**Tier 1 checks (new: `tier1-check.cjs`):**
- No inline `style=""` attributes
- Self-contained HTML (no external `<link>` or `<script src>`)
- Decorative elements use `<div>` not `<img>`
- SlotSchema present and valid (all archetype fields accounted for)
- Background/content/foreground layer structure intact
- `@font-face` family names match brand_assets entries
- Platform dimensions correct

**Tier 2 checks (refactored `brand-compliance.cjs`):**
- All rules loaded from DB at startup
- Weight >= 81 violations are BLOCKING
- Weight 51-80 violations are WARNINGS
- Results returned as structured JSON

### 12.2 Golden task suite

Five curated prompts that cover the core use cases. Run after code changes to catch regressions.

| # | Prompt | Tests |
|---|--------|-------|
| 1 | "Create an Instagram post about Fluid Connect" | Single creation, brand compliance pass, slotSchema valid, cost within budget |
| 2 | "Launch a campaign for Payments across Instagram and LinkedIn" | Campaign structure created, lead generation works, multi-platform |
| 3 | "Make the headline punchier" (after #1) | Iteration works, original preserved, updated HTML passes validation |
| 4 | "Create a one-pager about FairShare" | Different creation type, letter dimensions, archetype selection |
| 5 | "What accent color works best for revenue growth?" | Conversational response, no creation generated, references brand patterns |

**Pass criteria per task:**
- All Tier 1 checks pass
- No Tier 2 blocking issues (weight >= 81)
- Token cost within 2x of baseline
- Correct DB records created

**Execution:** `node tools/eval-harness.cjs --golden` — runs all 5 prompts, outputs pass/fail + token cost per task. Baseline costs recorded on first run and compared on subsequent runs.

### 12.3 Regression detection

- Token cost comparison between golden task runs (flag >50% increase)
- Validation pass rate comparison (flag any decrease)
- Context gap monitoring: if discovery tool calls increase between runs, the brand brief may be missing needed sections
- Tool denial rate: if confirmation-gated tools fire unexpectedly, the model may be confused about intent

---

## 13. Implementation Phases

### Phase 1: Foundation (the harness core)

**Goal:** Working single-agent chat that can generate creations with harness-enforced validation.

**Scope:**
- Agent loop from sandbox branch (agent.ts, agent-tools.ts, chat-routes.ts)
- Chat store and ChatSidebar UI from sandbox branch
- Brand Brief assembler — reads context_map + DB tables, builds system prompt section
- Validation lifecycle hooks — auto-run on `save_creation` / `edit_creation`, inject results as system message
- CSS layer merge on save — `mergeCssLayers()` applied automatically
- SlotSchema resolution on save — archetype fields + brand decorative fields attached
- Per-turn token tracking with per-chat budget (500K tokens)
- Structured SSE events: `creation_ready`, `validation_result`, `error`
- Render preview switched to WebP 75% quality
- Render budget enforcement (max 3 per production pass)

**Not in scope:** Campaign flow, headless generation, tier boundary cleanup, confirmation gates.

**Acceptance criteria:**
- Agent generates a single creation from a prompt
- Creation passes tier1-check and brand-compliance automatically
- Validation results appear in the chat as a system message
- Token usage tracked and visible
- Page reload preserves full conversation + creation state

### Phase 2: Creative Intelligence

**Goal:** Clean tier boundary, add brand-mutation safety, improve agent context.

**Scope:**
- Tier boundary cleanup — migrate ~15 hardcoded Fluid values to DB (see Section 11)
- Refactor `brand-compliance.cjs` to load all rules from DB
- New `tier1-check.cjs` for structural validation (separate from brand rules)
- Confirmation gates for brand-mutating tools (update/create/delete pattern, voice guide)
- Agent system prompt refinement — UI context awareness, iteration behavior
- Stale generation reaper on server startup
- Fix loop enforcement (max 2 cycles, then save with issues flagged)

**Acceptance criteria:**
- `brand-compliance.cjs` has zero hardcoded brand values
- Brand-mutating tools show confirmation dialog before executing
- Agent correctly references active creation/campaign from UI context
- Stale generations cleaned up on restart

### Phase 3: Campaign Flow

**Goal:** Lead-first interactive campaigns with parallel batch generation.

**Scope:**
- Campaign intent parsing (reuse existing `parseChannelHints` logic)
- Lead creation workflow — generate first, present, await iteration
- Creative brief capture from approved lead (accent, archetype, tone, user edits)
- Parallel batch generation — concurrent API calls for remaining creations
- Copy accumulator integration across parallel creations
- Campaign-level SSE progress events
- Campaign view in frontend showing all creations

**Acceptance criteria:**
- "Launch a campaign for X across IG and LinkedIn" generates lead, then batch
- No headline/tagline repetition across campaign creations
- All batch creations pass validation
- User can iterate on individual creations after batch completes

### Phase 4: Headless, Evaluation & Scheduling

**Goal:** Programmatic generation, automated quality gates, scheduling foundation.

**Scope:**
- `POST /api/generate/headless` endpoint — accepts creative brief config, returns campaign ID
- Golden task suite (5 prompts, automated runner, baseline comparison)
- `eval-harness.cjs` extended with token cost tracking
- Context gap monitoring (alert when discovery tools exceed threshold)
- Health endpoint: `GET /api/health`
- Scheduling config schema (for future cron integration)

**Acceptance criteria:**
- Headless endpoint generates a complete campaign without conversation
- All 5 golden tasks pass on a clean DB
- Token cost per golden task within 2x of recorded baseline
- Health endpoint returns accurate status

---

## 14. Key Risks

| Risk | Mitigation |
|------|------------|
| Model ignores brand brief and generates off-brand | Harness-enforced validation catches this; fix loop corrects. Brand brief in system prompt ensures minimum context. |
| Token costs unpredictable with conversational agent | Per-chat and per-creation budgets with hard stops. WebP renders reduce vision token cost. |
| Tier boundary cleanup breaks existing brand data | Migration is additive (new DB entries), not destructive. Existing seed data preserved. Run golden tasks after migration. |
| Parallel campaign generation creates race conditions | Each creation gets its own working directory and DB records. Copy accumulator is the only shared state, protected by sequential headline/tagline registration. |
| Render preview Playwright crashes | 10-second timeout per render. Lazy browser singleton with crash recovery. Render failures are non-fatal — creation still saves, just without visual self-check. |
| Long conversations exceed context window | Per-chat token budget prevents unbounded growth. Future: conversation summarization/pruning (not in scope for Phase 1-4). |

---

## 15. What This Design Does NOT Include

Explicitly out of scope to keep the system lean:

- **Multi-agent coordination.** One agent. The harness handles orchestration.
- **Conversation branching or forking.** Linear chat history only.
- **Multi-user / auth.** Single-user system. No permission model between users.
- **Image generation.** Agent composes existing brand assets, does not generate new images.
- **Conversation summarization.** Token budget is the boundary; pruning is future work.
- **A/B testing of agent behavior.** One system prompt, one model, one behavior.
- **Real-time collaboration.** One user, one agent, one conversation at a time.
