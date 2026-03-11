# Model Strategy

Deliberate model assignments for the Fluid asset generation pipeline.
Updated: 2026-03-11 (Phase 07-01)

## Current Assignments

| Agent | Model | Rationale |
|-------|-------|-----------|
| **copy-agent** | Sonnet | Creative writing, brand voice, tone inference — needs strong instruction following |
| **layout-agent** | **Haiku** | Template matching, mechanical HTML output — well-constrained, spec-check catches errors |
| **styling-agent** | Sonnet | Complex CSS composition, multi-input integration, subtle brand rules |
| **spec-check-agent** | Sonnet | Holistic review requires reading HTML and making brand judgment calls |

## How Model Selection Works

1. **Agent frontmatter** (`model:` field in `.claude/agents/*.md`) sets the default
2. **Orchestrator delegation** can override with explicit `model:` parameter in Agent tool calls
3. **Both are set** — frontmatter matches orchestrator instructions for consistency

## Orchestrator Model Pins

All three orchestrators (`fluid-social`, `fluid-one-pager`, `fluid-theme-section`) pass explicit `model` params:

- Copy agent: `model: "sonnet"`
- Layout agent: `model: "haiku"`
- Styling agent: `model: "sonnet"`
- Spec-check agent: `model: "sonnet"`

This applies to both initial pipeline runs AND fix loop re-delegations.

## Future Exploration (Phase 07-02)

- Test spec-check-agent on Haiku with tighter checklist-style prompting
- Evaluate if copy-agent benefits from Opus on complex prompts (manifesto, thought leadership)
- Track fix loop iteration counts to detect quality regression from model changes

## Rollback

To revert any agent: change `model:` in `.claude/agents/{agent}.md` frontmatter AND update the orchestrator delegation instructions in both:
- `~/.claude/commands/fluid-{social,one-pager,theme-section}.md`
- `~/.agents/skills/fluid-{social,one-pager,theme-section}/SKILL.md`
