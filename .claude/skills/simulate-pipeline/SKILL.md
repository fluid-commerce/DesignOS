---
name: simulate-pipeline
description: "Simulate the full generation pipeline using Claude Code subagents instead of API calls. Creates real assets in the DB for evaluation and feedback loops."
invoke: slash
context: fork
argument-hint: '"prompt" [--pipeline] [--dry-run] [--batch file.txt]'
allowed-tools: Agent, Bash, Read, Write, Glob, Grep, Edit
---

You are the Pipeline Simulation Orchestrator. You run `simulate-pipeline.cjs` to set up DB records and build pipeline prompts, then execute each stage using Claude Code subagents — producing real assets identical to what the API pipeline would create.

# 1. Run the CLI

Execute the simulate-pipeline CLI with the user's prompt:

```bash
node tools/simulate-pipeline.cjs $ARGUMENTS
```

If `$ARGUMENTS` contains `--pipeline`, `--dry-run`, `--live`, or `--batch`, the CLI handles it directly — just print the output and stop. No subagent orchestration needed.

For default mode, the CLI outputs a JSON manifest after the `__MANIFEST__` marker on the last line. Parse it.

# 2. Parse the Manifest

The manifest JSON has this structure:

```json
{
  "prompt": "...",
  "campaignId": "...",
  "creations": [
    {
      "creationId": "...",
      "creationType": "instagram|linkedin|one-pager",
      "title": "...",
      "iterationId": "...",
      "workingDir": "/abs/path/to/working",
      "htmlOutputPath": "/abs/path/to/final.html",
      "pipelineDir": "/abs/path/to/working/_pipeline",
      "stages": [
        {
          "name": "copy|layout|styling|spec-check",
          "model": "sonnet|haiku",
          "systemPrompt": "/path/to/system.txt",
          "userPrompt": "/path/to/user.txt",
          "dependsOn": "previous-stage-name or null",
          "output": "/path/to/expected/output",
          "description": "human-readable stage description"
        }
      ],
      "brandContext": {
        "assetManifest": "/path/to/asset-manifest.json",
        "voiceGuides": "/path/to/voice-guide-list.json",
        "brandPatterns": "/path/to/brand-patterns-list.json"
      }
    }
  ]
}
```

# 3. Execute Stages per Creation

For each creation in the manifest, execute stages sequentially (copy → layout → styling → spec-check).

Print a header:

```
Simulating pipeline for: "{prompt}"
  Campaign: {campaignId}
  Creations: {N}
```

## For each creation:

Print: `[{title}] Starting {creationType} pipeline...`

### Stage: copy

1. Read the system prompt file and user prompt file.
2. Delegate to `copy-agent` via Agent tool with `model: "sonnet"`:

   **Prompt:**
   ```
   SYSTEM CONTEXT:
   {contents of copy-system.txt}

   TASK:
   {contents of copy-user.txt}
   ```

3. Wait for completion.
4. Verify `{workingDir}/copy.md` exists.
5. Print: `  [1/4] Copy...        done`

### Stage: layout

1. Read the system prompt file and user prompt file.
2. Delegate to `layout-agent` via Agent tool with `model: "haiku"`:

   **Prompt:**
   ```
   SYSTEM CONTEXT:
   {contents of layout-system.txt}

   TASK:
   {contents of layout-user.txt}
   ```

3. Wait for completion.
4. Verify `{workingDir}/layout.html` exists.
5. Print: `  [2/4] Layout...      done`

### Stage: styling

1. Read the system prompt file and user prompt file.
2. Delegate to `styling-agent` via Agent tool with `model: "sonnet"`:

   **Prompt:**
   ```
   SYSTEM CONTEXT:
   {contents of styling-system.txt}

   TASK:
   {contents of styling-user.txt}
   ```

3. Wait for completion.
4. Verify the `htmlOutputPath` file exists.
5. Print: `  [3/4] Styling...     done`

### Stage: spec-check

1. Read the user prompt file.
2. Delegate to `spec-check-agent` via Agent tool with `model: "sonnet"`:

   **Prompt:**
   ```
   {contents of spec-check-user.txt}

   Also run the brand compliance CLI:
   node tools/brand-compliance.cjs "{htmlOutputPath}" --context {social or website based on creationType}
   ```

3. Wait for completion.
4. Read `{workingDir}/spec-report.json` if it exists.
5. Print result: `  [4/4] Spec-check...  {pass or FAIL (N blocking issues)}`

### After all stages:

Update the DB iteration status:

```bash
node -e "
  const Database = require('$(pwd)/canvas/node_modules/better-sqlite3');
  const db = new Database(process.env.FLUID_DB_PATH || '$(pwd)/canvas/fluid.db');
  db.prepare(\"UPDATE iterations SET generation_status = 'complete' WHERE id = ?\").run('{iterationId}');
  db.close();
"
```

Print: `  [✓] {title} complete → {htmlOutputPath}`

# 4. Fix Loop (if spec-check fails)

If spec-check reports `"overall": "fail"`, run up to 3 fix iterations following the same pattern as `/fluid-social` Section 4:

1. Read blocking issues from `spec-report.json`
2. Group by `fix_target` (copy, layout, styling)
3. Re-delegate to each target agent with fix instructions
4. If copy was fixed, cascade through layout → styling
5. Re-run spec-check
6. Break on pass, escalate after 3 iterations

# 5. Summary

After all creations are complete, print:

```
Pipeline simulation complete.
  {N} creation(s) processed
  Results:
    - {title}: {pass/fail} → {htmlOutputPath}
```

# 6. Multiple Creations (Campaigns)

When the manifest contains multiple creations (e.g., a full campaign prompt like "Launch a campaign for Payments"):

- Execute each creation's pipeline sequentially (not in parallel — DB state matters)
- Print status for each creation as it completes
- Final summary shows all results

# Anti-Patterns

- **NEVER pass file contents in Agent delegation messages.** Read system/user prompt files yourself, then include them in the delegation. But for brand docs and intermediate files (copy.md, layout.html), tell the agent to read them by path.
- **NEVER skip the manifest.** Always run the CLI first to get proper DB records and pipeline prompts.
- **NEVER modify the pipeline prompt files.** They are read-only artifacts from the real pipeline code.
