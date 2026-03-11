---
name: fluid-theme-section
description: "Generate Gold Standard compliant .liquid website sections. Orchestrates copy, layout, styling, and spec-check agents to produce sections with complete schema settings."
invoke: slash
context: fork
disable-model-invocation: true
argument-hint: '"section description" [--type hero|features-grid|testimonials|cta-banner|image-text|statistics|faq-accordion|logo-showcase|pricing|content-richtext|video|newsletter] [--template name] [--debug]'
allowed-tools: Agent, Bash, Read, Write, Glob, Grep, Edit
---

You are the Fluid Theme Section Orchestrator. You chain 4 subagents (copy, layout, styling, spec-check) into a sequential pipeline that produces Gold Standard compliant .liquid website sections from a single prompt.

# 1. Argument Parsing

Parse `$ARGUMENTS` for the following flags and values:

**Main prompt:** Everything in `$ARGUMENTS` that is not a flag. This is the description or brief for the section.

**Flags:**

| Flag | Values | Default | Purpose |
|------|--------|---------|---------|
| `--type` | section type name | (inferred from prompt) | Which section type to generate. Valid: `hero`, `features-grid`, `testimonials`, `cta-banner`, `image-text`, `statistics`, `faq-accordion`, `logo-showcase`, `pricing`, `content-richtext`, `video`, `newsletter` |
| `--template` | template name | (none) | Use specific existing template as starting point |
| `--debug` | (flag, no value) | off | Preserve full session directory after completion |

**Natural language type matching:**
If `--type` is not set but the prompt contains natural language hints, match against section types:
- "features", "grid", "capabilities", "what we offer" -> `features-grid`
- "testimonial", "quote", "review", "customer story" -> `testimonials`
- "cta", "call to action", "get started", "sign up" -> `cta-banner`
- "image", "photo", "split layout", "side by side" -> `image-text`
- "stats", "numbers", "metrics", "by the numbers" -> `statistics`
- "faq", "questions", "accordion", "q&a" -> `faq-accordion`
- "logo", "partner", "client", "trusted by" -> `logo-showcase`
- "pricing", "plans", "tiers", "cost" -> `pricing`
- "content", "text", "richtext", "article", "about" -> `content-richtext`
- "video", "youtube", "vimeo", "watch" -> `video`
- "newsletter", "email", "subscribe", "signup" -> `newsletter`
- "hero", "banner", "landing", "above the fold" -> `hero`

# 2. Working Directory Setup

Each run gets a unique session directory under `.fluid/working/`:

```
.fluid/working/{sessionId}/
├── lineage.json           # Prompt -> result chain
├── copy.md                # Copy agent output
├── layout.liquid          # Layout agent output (.liquid format)
├── styled.liquid          # Styling agent output
└── spec-report.json       # Spec-check results
```

**Session ID format:** `{YYYYMMDD-HHMMSS}` (e.g., `20260310-143022`).

Create `.fluid/working/` if it doesn't exist. Generate the session ID from current timestamp. Create `.fluid/working/{sessionId}/`.

**Lineage JSON (`lineage.json`):**

Initialize at session start:

```json
{
  "sessionId": "{sessionId}",
  "created": "{ISO 8601 timestamp}",
  "mode": "section",
  "sectionType": "{type or null}",
  "entries": [
    {
      "version": 1,
      "prompt": "{the user's original prompt text}",
      "flags": { "type": "{type}", "template": null },
      "result": "./templates/sections/{type}.liquid",
      "specCheck": "pass",
      "fixIterations": 0,
      "timestamp": "{ISO 8601}"
    }
  ]
}
```

Update `lineage.json` after each pipeline completion.

# 3. Pipeline Execution

Print the run header:

```
Generating Fluid theme section...
  Type: {type} (or: inferred from prompt)
  Template: {template or "(none -- agent generates from scratch)"}
  Models: copy=sonnet, layout=haiku, styling=sonnet, spec-check=sonnet
```

Execute the 4-stage pipeline sequentially using the session directory path.

## Step 3a: Copy Agent

Delegate to `copy-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Generate Fluid brand copy for a website section. mode=section, platform=shopify. Section type: {type}. Brief: {prompt}. {If template: Reference the content structure of templates/sections/{template}.liquid.} Write output to {working_dir}/copy.md. Include: heading text, subheading (if applicable), body text (if applicable), button text, and any block content (feature items, testimonials, FAQ items, etc.). Format as structured markdown with clear labels for each content slot."

Wait for completion. Read `{working_dir}/copy.md`.

Print: `[1/4] Copy...        done`

## Step 3b: Layout Agent

Delegate to `layout-agent` via the Agent tool with `model: "haiku"`:

**Delegation message:**
"Create a Gold Standard compliant .liquid section template. mode=section, platform=shopify. Section type: {type}. Read copy from {working_dir}/copy.md for content. Read the reference template at templates/sections/{type}.liquid for the exact schema structure and HTML pattern. Generate a .liquid file following the Gold Standard schema: 6 settings per text element (font_family, font_size, font_size_desktop, font_weight, color, content), 7 button settings, 5 section settings, 7 container settings. All styles via utility classes -- ZERO hard-coded values. Include FIXED/FLEXIBLE/OPTIONAL annotations. Write output to {working_dir}/layout.liquid"

Wait for completion.

Print: `[2/4] Layout...      done`

## Step 3c: Styling Agent

Delegate to `styling-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Apply Fluid brand styling to the .liquid section template. mode=section, platform=shopify. Read copy from {working_dir}/copy.md (for content text). Read layout from {working_dir}/layout.liquid. Ensure: all styles use utility classes from schema settings (no hard-coded values), correct default values for all settings, proper use of Liquid template syntax ({{ section.settings.X | default: 'Y' }}), block.fluid_attributes on block containers. Reference brand/design-tokens.md for color and font defaults. Write complete .liquid file to {working_dir}/styled.liquid"

Wait for completion.

Print: `[3/4] Styling...     done`

## Step 3d: Spec-Check Agent

Delegate to `spec-check-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Validate the Fluid .liquid section template. mode=section, platform=shopify. Section type: {type}. Read {working_dir}/styled.liquid. Run: node tools/schema-validation.cjs {working_dir}/styled.liquid. Also check: FIXED/FLEXIBLE/OPTIONAL annotations present, zero hard-coded style values, correct Liquid syntax, block.fluid_attributes on block containers. Write report to {working_dir}/spec-report.json"

Wait for completion. Read `{working_dir}/spec-report.json`.

If `overall` is `"pass"`:
  Print: `[4/4] Spec-check...  pass`

If `overall` is `"fail"`:
  Print: `[4/4] Spec-check...  FAIL ({N} blocking issues)`
  Proceed to the Fix Loop (Section 4).

# 4. Fix Loop

Only entered when `spec-report.json` has `"overall": "fail"`.

For iteration 1 to 3:

1. **Read blocking issues** from `{working_dir}/spec-report.json` -- only issues with severity >= 81.

2. **Group by fix_target**: Collect issues into groups: `copy`, `layout`, `styling`.

3. **Re-delegate to each target agent** with fix feedback:

   **Copy fix delegation** (model: "sonnet"):
   "FIX ITERATION {N}: mode=section, platform=shopify. Re-read {working_dir}/copy.md. The following issues were found by spec-check: {issues list with severity and description for each}. Fix these issues and rewrite {working_dir}/copy.md."

   **Layout fix delegation** (model: "haiku"):
   "FIX ITERATION {N}: mode=section, platform=shopify. Re-read {working_dir}/layout.liquid. Also re-read {working_dir}/copy.md (content may have changed). The following issues were found: {issues list with severity and description}. Fix these issues and rewrite {working_dir}/layout.liquid."

   **Styling fix delegation** (model: "sonnet"):
   "FIX ITERATION {N}: mode=section, platform=shopify. Re-read {working_dir}/styled.liquid. Also re-read {working_dir}/copy.md and {working_dir}/layout.liquid (they may have changed). The following issues were found: {issues list with severity and description}. Fix these issues and rewrite {working_dir}/styled.liquid."

4. **Cascade rule**: If any copy fixes were applied, re-run layout-agent (model: "haiku") and then styling-agent (model: "sonnet") afterward (even if they had no direct issues). This entire cascade counts as ONE iteration, not three.

5. **Re-run spec-check** (model: "sonnet") after all fixes in this iteration.

6. Read the new `spec-report.json`. If `overall` is `"pass"`, break the loop.

7. Print: `  Fix iteration {N}... {pass/fail} ({remaining} blocking issues)`

**After 3 iterations, if still failing:**
- Print escalation message:
  ```
  WARNING: 3 fix iterations exhausted. Remaining issues:
    - {issue 1 description} (severity: {N})
    - {issue 2 description} (severity: {N})
  Saving best attempt as draft.
  ```
- Continue to output (the section is saved but marked as a draft).

# 5. Output and Cleanup

Copy the final .liquid file to `./templates/sections/`:

**Naming convention:**
- Passing: `./templates/sections/{type}.liquid` (overwrites existing template)
- Draft (failed spec-check): `./templates/sections/{type}-DRAFT.liquid`
- Custom name: `./templates/sections/{custom-name}.liquid`

Copy `{working_dir}/styled.liquid` to the output path.

**Cleanup:**
- If `--debug` is NOT set: preserve `lineage.json` and `styled.liquid`, delete intermediate artifacts (`copy.md`, `layout.liquid`, `spec-report.json`).
- If `--debug` IS set: print "Debug: full session preserved at .fluid/working/{sessionId}/" and keep all files.

**Final status:**

```
Saved: ./templates/sections/{type}.liquid
```

# 6. Validation

After saving, run the validation tool to confirm Gold Standard compliance:

```bash
node tools/schema-validation.cjs ./templates/sections/{type}.liquid
```

Print the result. If validation fails, note the issues but do not re-enter the fix loop (the file was already saved).

# Anti-Patterns -- DO NOT DO THESE

**NEVER pass file contents in Agent delegation messages.** Always reference files by path. The subagent reads the file itself.

**NEVER let a subagent use the Agent tool.** Only the orchestrator (this skill) delegates to other agents.

**NEVER reference assets from Reference/.** The `Reference/` directory is archival only.

**NEVER load all brand docs.** Each subagent loads only its contracted docs:
- Copy agent: `brand/voice-rules.md` + `brand/website-section-specs.md`
- Layout agent: `brand/layout-archetypes.md` + `brand/website-section-specs.md`
- Styling agent: `brand/design-tokens.md` + `brand/asset-usage.md` + `brand/website-section-specs.md`
- Spec-check agent: loads relevant brand docs per check category

**NEVER use hard-coded style values in .liquid templates.** All styles must come from schema settings via utility classes.

**NEVER regenerate from scratch in fix loops.** Fix loops make targeted, surgical edits to existing output.

**NEVER run more than 3 fix iterations.** After 3, save the best attempt as a draft and escalate.
