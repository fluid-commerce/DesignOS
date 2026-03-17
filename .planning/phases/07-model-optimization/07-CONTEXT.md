# Phase 07: Model Optimization

## Problem Statement

The Fluid asset generation pipeline currently runs all subagents on Sonnet and orchestrators inherit Opus from the parent conversation. Every agent gets the same model regardless of task complexity, leading to:

1. **Unnecessary cost** — tasks like layout templating and deterministic spec-checking don't need Sonnet-level reasoning
2. **Unnecessary latency** — the full pipeline (copy → layout → styling → spec-check) runs sequentially, and each step waits for Sonnet when a faster model could suffice
3. **No explicit model strategy** — model selection was never deliberately designed; it defaulted to "sonnet for everything"

## Current State

### Agent Model Assignments (as of Phase 06)

| Agent | Frontmatter Model | Actual Runtime Model | Task Complexity |
|-------|-------------------|---------------------|-----------------|
| Orchestrator (fluid-social, fluid-one-pager, fluid-theme-section) | (none — inherits parent) | Opus (from user session) | Medium: argument parsing, delegation, status reporting |
| copy-agent | `model: sonnet` | Sonnet | High: creative writing, brand voice, tone inference |
| layout-agent | `model: sonnet` | Sonnet | Low-Medium: template matching, HTML structure |
| styling-agent | `model: sonnet` | Sonnet | Medium-High: CSS composition, asset integration, design token application |
| spec-check-agent | `model: sonnet` | Sonnet | Low-Medium: running CLI tools, reading JSON output, structured reporting |

### Orchestrator Delegation (no model override)

The orchestrator skills (`fluid-social.md`, `fluid-one-pager.md`, `fluid-theme-section.md`) delegate via the Agent tool without a `model` parameter:

```
Agent(subagent_type="copy-agent", prompt="...", ...)
```

The Agent tool behavior: "If `model` omitted, uses the agent definition's model, or inherits from the parent." So the frontmatter `model: sonnet` in each agent definition IS being used — but the orchestrator itself runs at parent (Opus) level.

## Goal

Assign the right model tier to each agent based on task complexity:

- **Opus** — reserved for tasks requiring deep creative reasoning, complex judgment
- **Sonnet** — default for tasks requiring good reasoning + instruction following
- **Haiku** — for mechanical, template-driven, or validation tasks

Reduce end-to-end pipeline time and cost while maintaining output quality.

## Constraints

- Output quality must not regress (spec-check pass rates must stay the same or improve)
- Fix loop convergence must not degrade (same or fewer iterations to pass)
- Brand compliance scores must remain at parity
- Changes should be easy to revert per-agent if quality drops
