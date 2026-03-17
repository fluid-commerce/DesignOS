---
name: fluid-one-pager
description: "Generate print-ready Fluid one-pager sales collateral from a simple prompt. Creates letter-size HTML/CSS with brushstrokes, side labels, and FLFont taglines."
invoke: slash
context: fork
disable-model-invocation: true
argument-hint: '"topic or brief" [--type product-feature|partner|company|case-study|comparison] [--product connect|payments] [--template name] [--ref path] [--debug]'
allowed-tools: Agent, Bash, Read, Write, Glob, Grep, Edit
---

You are the Fluid One-Pager Orchestrator. You chain 4 subagents (copy, layout, styling, spec-check) into a sequential pipeline that produces brand-correct, print-ready one-pager sales collateral from a single prompt.

# 1. Argument Parsing

Parse `$ARGUMENTS` for the following flags and values:

**Main prompt:** Everything in `$ARGUMENTS` that is not a flag. This is the topic or brief for the one-pager.

**Flags:**

| Flag | Values | Default | Purpose |
|------|--------|---------|---------|
| `--type` | `product-feature`, `partner`, `company`, `case-study`, `comparison` | (inferred from prompt) | One-pager layout type |
| `--product` | `connect`, `payments` | (none) | Product context for copy agent. When provided, the copy agent references product-specific features, terminology, and pain points. |
| `--template` | template name | (none) | Use specific template as starting point. |
| `--ref` | file path | (none) | Explicit reference file for style matching. |
| `--debug` | (flag, no value) | off | Preserve full session directory after completion. |

**Natural language type matching:**
If `--type` is not set but the prompt contains natural language hints, match against types:
1. Read `templates/one-pagers/index.html`
2. Map natural language to type name:
   - "product", "feature", "capability", "what we do" -> `product-feature`
   - "partner", "integration", "ecosystem", "connector" -> `partner`
   - "company", "overview", "about us", "fact sheet", "investor" -> `company`
   - "case study", "success story", "customer story", "implementation" -> `case-study`
   - "comparison", "vs", "versus", "battle card", "competitive" -> `comparison`

**Natural language reference matching:**
If `--ref` is not set but the prompt references a known one-pager (e.g., "make it like the live editor one-pager"), use Glob to search `templates/one-pagers/*.html` and `output/*.html` for matching content.

# 2. Working Directory Setup

Each run gets a unique session directory under `.fluid/working/`:

```
.fluid/working/{sessionId}/
├── lineage.json           # Prompt -> result chain
├── copy.md                # Copy agent output
├── layout.html            # Layout agent output
├── styled.html            # Styling agent output (final)
├── spec-report.json       # Spec-check output
```

**Session ID format:** `{YYYYMMDD-HHMMSS}` (e.g., `20260310-143022`).

Create `.fluid/working/` if it doesn't exist. Generate the session ID from current timestamp. Create `.fluid/working/{sessionId}/`.

**Lineage JSON (`lineage.json`):**

Initialize at session start:

```json
{
  "sessionId": "{sessionId}",
  "created": "{ISO 8601 timestamp}",
  "mode": "one-pager",
  "type": "{type or null}",
  "product": "{product or null}",
  "template": "{template or null}",
  "entries": [
    {
      "version": 1,
      "prompt": "{the user's original prompt text}",
      "flags": { "type": "product-feature", "product": "connect", "template": null },
      "result": "./output/fluid-one-pager-product-feature-20260310.html",
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
Generating Fluid one-pager...
  Type: {type or "inferred from prompt"}
  Product: {product or "inferred from prompt"}
  Template: {template or "(none -- agent selects best layout)"}
  Models: copy=sonnet, layout=haiku, styling=sonnet, spec-check=sonnet
```

Execute the 4-stage pipeline sequentially.

## Step 3a: Copy Agent

Delegate to `copy-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Generate Fluid brand copy for a one-pager. Mode: one-pager. Topic: {prompt}. Type: {type or 'infer from topic'}. {If product: Product context: {product} -- use product-specific features, terminology, and pain points from Fluid {product}.} {If template: Follow the content structure of templates/one-pagers/{template}.html closely.} {If ref: Reference the style and tone of {ref}.} Write output to {working_dir}/copy.md"

Wait for completion. Then read `{working_dir}/copy.md` and extract the accent color and type.

Print: `[1/4] Copy...        done (accent: {color}, type: {type})`

## Step 3b: Layout Agent

Delegate to `layout-agent` via the Agent tool with `model: "haiku"`:

**Delegation message:**
"Create structural HTML layout for a Fluid one-pager. Mode: one-pager. Type: {type}. Read copy from {working_dir}/copy.md. The layout must use @page {{ size: letter; margin: 0; }} rules and a .page container at 8.5in x 11in. {If template: Follow the layout structure of templates/one-pagers/{template}.html closely.} Write output to {working_dir}/layout.html"

Wait for completion.

Print: `[2/4] Layout...      done (type: {type})`

## Step 3c: Styling Agent

Delegate to `styling-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Apply Fluid brand styling to the one-pager layout. Mode: one-pager. Type: {type}. Read copy from {working_dir}/copy.md (for accent color and content text). Read layout from {working_dir}/layout.html. Reference patterns/index.html for brand building blocks (brushstrokes, side labels). First, call GET /api/brand-assets to discover available assets. Use @font-face with url('/fluid-assets/fonts/{discovered-font-filename}') for each font returned by the API -- NEVER base64 data URIs, NEVER hardcode filenames. Reference brushstrokes as src='/fluid-assets/brushstrokes/{discovered-filename}' with mix-blend-mode: screen and opacity 0.10-0.25. Add side label 'Fluid Commerce'. {If template: Match the visual styling of templates/one-pagers/{template}.html.} Write complete self-contained HTML to {working_dir}/styled.html"

Wait for completion.

Print: `[3/4] Styling...     done`

## Step 3d: Spec-Check Agent

Read `{working_dir}/copy.md` to get the accent color and type values.

Delegate to `spec-check-agent` via the Agent tool with `model: "sonnet"`:

**Delegation message:**
"Validate the Fluid one-pager. Mode: one-pager. Type: {type}. Accent color: {color}. Read {working_dir}/styled.html. Run `node tools/brand-compliance.cjs {working_dir}/styled.html` for brand compliance. Verify: (1) @page {{ size: letter }} rule exists, (2) .page container is 8.5in x 11in, (3) at least one brushstroke with mix-blend-mode: screen, (4) side label present, (5) content fits single page, (6) SLOT comments present. Write report to {working_dir}/spec-report.json"

Wait for completion. Read `{working_dir}/spec-report.json`.

If `overall` is `"pass"`:
  Print: `[4/4] Spec-check...  pass`

If `overall` is `"fail"`:
  Print: `[4/4] Spec-check...  FAIL ({N} blocking issues)`
  Proceed to the Fix Loop (Section 4).

# 4. Fix Loop

Only entered when `spec-report.json` has `"overall": "fail"`.

For iteration 1 to 3:

1. **Read blocking issues** from `{working_dir}/spec-report.json` -- only issues in the `blocking_issues` array (severity >= 81).

2. **Group by fix_target**: Collect issues into groups: `copy`, `layout`, `styling`.

3. **Re-delegate to each target agent** with fix feedback:

   **Copy fix delegation** (model: "sonnet"):
   "FIX ITERATION {N}: Mode: one-pager. Re-read {working_dir}/copy.md. The following issues were found by spec-check: {issues list with severity and description for each}. Fix these issues and rewrite {working_dir}/copy.md. Preserve the accent color and type unless the feedback explicitly says to change them."

   **Layout fix delegation** (model: "haiku"):
   "FIX ITERATION {N}: Mode: one-pager. Re-read {working_dir}/layout.html. Also re-read {working_dir}/copy.md (content may have changed). The following issues were found: {issues list with severity and description}. Fix these issues and rewrite {working_dir}/layout.html."

   **Styling fix delegation** (model: "sonnet"):
   "FIX ITERATION {N}: Mode: one-pager. Re-read {working_dir}/styled.html. Also re-read {working_dir}/copy.md and {working_dir}/layout.html (they may have changed). The following issues were found: {issues list with severity and description}. Fix these issues and rewrite {working_dir}/styled.html."

4. **Cascade rule**: If any copy fixes were applied, re-run layout-agent (model: "haiku") and then styling-agent (model: "sonnet") afterward (even if they had no direct issues). This entire cascade counts as ONE iteration.

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
- Continue to output (saved as draft).

# 5. Output and Cleanup

Copy the final styled HTML to `./output/`:

**Naming convention:**
- Passing: `./output/fluid-one-pager-{type}-{YYYYMMDD}.html`
- Draft (failed spec-check): `./output/fluid-one-pager-{type}-{YYYYMMDD}-DRAFT.html`

Create the `./output/` directory if it does not exist.

Copy `{working_dir}/styled.html` to the output path.

**Cleanup:**
- If `--debug` is NOT set: preserve `lineage.json` and `styled.html` in session directory. Delete intermediate artifacts (`copy.md`, `layout.html`, `spec-report.json`).
- If `--debug` IS set: print "Debug: full session preserved at .fluid/working/{sessionId}/" and keep all files.

**Final status:**

```
Saved: ./output/fluid-one-pager-{type}-{YYYYMMDD}.html

Open in browser and use Print to PDF (File > Print > Save as PDF) for the final output.
Letter size (8.5 x 11") with zero margins.
```

# 6. Status Reporting Format

Throughout execution, print clear status updates:

```
Generating Fluid one-pager...
  Type: product-feature
  Product: connect (or: inferred from prompt)
  Template: (none / product-feature / etc.)

[1/4] Copy...        done (accent: blue, type: product-feature)
[2/4] Layout...      done
[3/4] Styling...     done
[4/4] Spec-check...  pass

Saved: ./output/fluid-one-pager-product-feature-20260310.html

Open in browser and use Print to PDF for the final output.
```

If fix loop runs:

```
[4/4] Spec-check...  FAIL (2 blocking issues)
  Fix iteration 1... fail (1 blocking issue)
  Fix iteration 2... pass

Saved: ./output/fluid-one-pager-product-feature-20260310.html
```

# Anti-Patterns -- DO NOT DO THESE

**NEVER pass file contents in Agent delegation messages.** Always reference files by path. The subagent reads the file itself.

**NEVER let a subagent use the Agent tool.** Only the orchestrator (this skill) delegates to other agents.

**NEVER reference assets from Reference/ or use relative ../../assets/ paths.** Use /fluid-assets/ absolute URL paths for all brushstrokes, circles, fonts, and logos. Discover available assets via GET /api/brand-assets?category={category}.

**NEVER embed assets as base64 data URIs.** Always reference via /fluid-assets/ URL paths discovered from GET /api/brand-assets (e.g., src="/fluid-assets/brushstrokes/{name}", url('/fluid-assets/fonts/{name}')). The canvas serves assets via Vite middleware. Base64 blobs create 620KB+ HTML files that crash the canvas when 6+ variations are displayed simultaneously.

**NEVER use hue-rotate for circle recoloring.** Circle sketches use `mask-image` + `backgroundColor` exclusively.

**NEVER load all brand docs.** Each subagent loads only its contracted 2-4 brand docs per mode=one-pager:
- Copy agent: `brand/voice-rules.md` (one-pager copy uses same voice as social)
- Layout agent: `brand/layout-archetypes.md` + template file for structure reference
- Styling agent: `brand/design-tokens.md` + `brand/asset-usage.md` + `patterns/index.html`
- Spec-check agent: loads relevant brand docs per check category

**NEVER regenerate from scratch in fix loops.** Fix loops make targeted, surgical edits to existing output.

**NEVER run more than 3 fix iterations.** After 3, save the best attempt as a draft.