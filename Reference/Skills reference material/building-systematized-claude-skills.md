# Building Highly Systematized Claude Skills Packages

A comprehensive guide based on reverse-engineering the GSD (Get Shit Done) skill system — one of the most sophisticated Claude Code skill architectures in production.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Three Invoke Types](#2-the-three-invoke-types)
3. [Skill File Anatomy](#3-skill-file-anatomy)
4. [Distribution Pipeline](#4-distribution-pipeline)
5. [Building Simple Skills](#5-building-simple-skills)
6. [Building Complex Orchestrated Skills (GSD Pattern)](#6-building-complex-orchestrated-skills-gsd-pattern)
7. [Multi-Agent Coordination](#7-multi-agent-coordination)
8. [State Management Across Sessions](#8-state-management-across-sessions)
9. [Templates & Structured Output](#9-templates--structured-output)
10. [Configuration Systems](#10-configuration-systems)
11. [Verification & Quality Gates](#11-verification--quality-gates)
12. [CLI Tooling Layer](#12-cli-tooling-layer)
13. [Reference Architecture: Complete Skill Taxonomy](#13-reference-architecture-complete-skill-taxonomy)
14. [Checklist: Shipping a Production Skill](#14-checklist-shipping-a-production-skill)

---

## 1. Architecture Overview

Claude Code skills operate at three layers:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: ORCHESTRATION                                 │
│  Workflows, subagents, wave execution, state machines   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: COMMANDS & ROUTING                            │
│  Slash commands, frontmatter, execution_context refs    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: DISTRIBUTION                                  │
│  sync.sh, CLAUDE.md injection, .mdc rules, MCP config   │
└─────────────────────────────────────────────────────────┘
```

**The key insight:** Skills are just markdown files with YAML frontmatter. The intelligence comes from how you structure the instructions, not from any runtime framework. Claude reads the markdown and follows the instructions — the "framework" is entirely prompt engineering.

### Directory Structure

```
~/.agents/                          # Source of truth
├── sync.sh                         # Distribution script
├── meta-rule.md                    # Rules injected into CLAUDE.md
├── mcp.json                        # MCP server definitions
├── skills/                         # All skill definitions
│   ├── my-skill/
│   │   └── SKILL.md                # Skill definition (frontmatter + instructions)
│   ├── complex-skill/
│   │   ├── SKILL.md
│   │   └── reference-data.md       # Supporting files
│   └── ...
└── env/
    └── api-keys.env                # Shared secrets

~/.claude/                          # Generated output (Claude Code)
├── CLAUDE.md                       # Auto-generated from skills
├── commands/                       # Slash commands (from "slash" skills)
│   ├── my-skill.md
│   └── gsd/                        # Sub-command namespacing
│       ├── new-project.md
│       └── execute-phase.md
└── mcp.json                        # MCP config

~/.cursor/                          # Generated output (Cursor)
├── skills/                         # Skill files synced
├── rules/                          # .mdc rules generated
└── mcp.json
```

---

## 2. The Three Invoke Types

Every skill declares how it activates via the `invoke` field in frontmatter:

### `invoke: always`

**Behavior:** Summary injected into CLAUDE.md. Claude sees it every conversation. Skill file is read on-demand when relevant context is detected.

**Best for:** Background intelligence, design guidelines, conventions, workflow rules that should passively influence all interactions.

**Example:** A UI/UX design guide that informs color, typography, and accessibility decisions whenever the user is building UI.

```yaml
---
name: ui-ux-pro-max
description: >
  UI/UX design intelligence with 67 styles, 96 palettes...
invoke: always
---
```

**CLAUDE.md output:**
```markdown
## ui-ux-pro-max

UI/UX design intelligence with 67 styles, 96 palettes...

This skill is always active. When relevant context is detected, follow the
instructions in the full skill file.

Read the full skill at ~/.agents/skills/ui-ux-pro-max/SKILL.md
```

**Cursor output:** `.mdc` rule with `alwaysApply: true`.

### `invoke: trigger`

**Behavior:** Summary injected into CLAUDE.md with trigger phrases listed. Claude activates the skill when it detects matching phrases in user messages.

**Best for:** Tools and capabilities that should activate on specific keywords but not consume context otherwise.

```yaml
---
name: gemini-image-gen
description: >
  Generate images using Google Gemini Nano Banana models via API.
invoke: trigger
trigger_phrases:
  - "generate image"
  - "create image"
  - "gemini image"
  - "nano banana"
---
```

**CLAUDE.md output:**
```markdown
## gemini-image-gen

Generate images using Google Gemini...

**Activate when the user mentions:**
- "generate image"
- "create image"
- "gemini image"

When triggered, read and follow ~/.agents/skills/gemini-image-gen/SKILL.md
```

**Cursor output:** `.mdc` rule with `alwaysApply: false`.

### `invoke: slash`

**Behavior:** Skill becomes a `/command`. Frontmatter is stripped; body becomes the command prompt. The user explicitly invokes it.

**Best for:** Explicit actions, tools, generators — anything the user would consciously decide to run.

```yaml
---
name: slidev
description: Create web-based slides using Markdown and Vue.
invoke: slash
---

# Slidev - Presentation Slides for Developers
[... instructions follow ...]
```

**Output:** `~/.claude/commands/slidev.md` (frontmatter stripped).

---

## 3. Skill File Anatomy

### Simple Skill (Single File)

```markdown
---
name: my-skill
description: One-line description of what this skill does
invoke: trigger
trigger_phrases:
  - "phrase one"
  - "phrase two"
---

# Skill Title

## When to Apply
[Conditions for activation]

## Instructions
[What Claude should do]

## Examples
[Input/output examples]
```

### Complex Skill (GSD Pattern — Command with Workflow)

For skills with sub-commands, the command files live separately from the skill definition:

**Command file** (`~/.claude/commands/gsd/new-project.md`):
```markdown
---
name: gsd:new-project
description: Initialize a new project
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<objective>
What this command accomplishes.
</objective>

<execution_context>
@/path/to/workflow.md
@/path/to/template.md
@/path/to/reference.md
</execution_context>

<process>
Execute the workflow from @/path/to/workflow.md end-to-end.
Preserve all workflow gates.
</process>
```

**Key elements:**

| Field | Purpose |
|-------|---------|
| `name` | Command name (colon = namespace) |
| `description` | Shows in `/help` listing |
| `argument-hint` | Shows expected arguments |
| `allowed-tools` | Restricts which tools the command can use |
| `<objective>` | What the command creates/accomplishes |
| `<execution_context>` | `@file` references loaded before execution |
| `<process>` | Routing instructions to the workflow |

**The `@file` pattern:** References like `@/path/to/file.md` tell Claude to read that file into context before executing. This is how commands stay lean (small file) while workflows can be large (detailed instructions).

---

## 4. Distribution Pipeline

The `sync.sh` script is the single source of truth for distributing skills:

```
~/.agents/skills/*/SKILL.md
        │
        ▼
   sync.sh parses frontmatter
        │
        ├── invoke: slash ──► ~/.claude/commands/<name>.md
        │                     (frontmatter stripped)
        │
        ├── invoke: always ─► ~/.claude/CLAUDE.md (summary injected)
        │                     ~/.cursor/rules/<name>.mdc (alwaysApply: true)
        │
        ├── invoke: trigger ► ~/.claude/CLAUDE.md (summary + phrases)
        │                     ~/.cursor/rules/<name>.mdc (alwaysApply: false)
        │
        └── all ────────────► ~/.cursor/skills/<name>/ (files copied)
```

### What sync.sh does:

1. **Parses YAML frontmatter** from each `SKILL.md` using Python
2. **Generates Claude Code commands** (strips frontmatter for slash skills)
3. **Generates CLAUDE.md** with summaries for always/trigger skills
4. **Generates Cursor `.mdc` rules** with appropriate `alwaysApply` settings
5. **Syncs MCP server configs** to both Claude and Cursor
6. **Handles symlinks** for skills that are symlinked from other locations

### Running distribution:

```bash
bash ~/.agents/sync.sh
```

**Rule:** NEVER edit generated files directly. Always edit source files in `~/.agents/skills/` and re-run sync.

---

## 5. Building Simple Skills

### Example: A Code Review Skill

```bash
mkdir -p ~/.agents/skills/code-review
```

**`~/.agents/skills/code-review/SKILL.md`:**
```markdown
---
name: code-review
description: >
  Systematic code review following OWASP, performance, and
  maintainability guidelines. Use when reviewing PRs or code changes.
invoke: trigger
trigger_phrases:
  - "review this code"
  - "code review"
  - "review my PR"
  - "check this for issues"
---

# Code Review

## Process

1. **Security scan** — Check for OWASP Top 10 vulnerabilities
2. **Performance** — Identify N+1 queries, unnecessary re-renders, memory leaks
3. **Maintainability** — Flag magic numbers, missing error handling, unclear naming
4. **Testing** — Check test coverage for critical paths

## Output Format

For each finding:
- **File:Line** — Location
- **Severity** — Critical / High / Medium / Low
- **Issue** — What's wrong
- **Fix** — How to fix it

## Rules

- Don't nitpick style (formatters handle that)
- Focus on bugs and security over preferences
- Praise good patterns when you see them
```

Deploy:
```bash
bash ~/.agents/sync.sh
```

### Example: An Always-Active Convention Skill

```markdown
---
name: our-conventions
description: Team coding conventions for TypeScript projects
invoke: always
---

# Team Conventions

## Imports
- Use path aliases (`@/components/...`)
- Group: external → internal → types → styles

## Naming
- Components: PascalCase
- Hooks: camelCase with `use` prefix
- Constants: SCREAMING_SNAKE_CASE

## Error Handling
- Always use Result types, never throw
- Log errors at the boundary, not at every level
```

---

## 6. Building Complex Orchestrated Skills (GSD Pattern)

The GSD skill is the gold standard for complex, multi-command skill packages. Here's the architecture pattern it uses:

### Directory Structure

```
~/.claude/get-shit-done/              # Skill root
├── VERSION                           # Semantic version
├── CHANGELOG.md                      # Version history
├── bin/
│   ├── gsd-tools.cjs                # CLI utility (~130 commands)
│   └── lib/                          # Modular libraries
│       ├── core.cjs                  # Shared utilities
│       ├── state.cjs                 # State management
│       ├── phase.cjs                 # Phase operations
│       ├── roadmap.cjs               # Roadmap parsing
│       ├── config.cjs                # Configuration
│       ├── template.cjs              # Template rendering
│       └── verify.cjs                # Verification logic
├── workflows/                        # Step-by-step execution guides (34 files)
│   ├── new-project.md                # Project initialization
│   ├── plan-phase.md                 # Phase planning
│   ├── execute-phase.md              # Wave-based execution
│   ├── execute-plan.md               # Single plan execution
│   └── ...
├── templates/                        # Output format templates (24 files)
│   ├── project.md                    # PROJECT.md format
│   ├── roadmap.md                    # ROADMAP.md format
│   ├── phase-prompt.md               # PLAN.md format
│   ├── summary.md                    # SUMMARY.md format
│   └── config.json                   # Default configuration
└── references/                       # Decision guides (13 files)
    ├── checkpoints.md                # Checkpoint patterns
    ├── model-profiles.md             # Agent model assignments
    ├── verification-patterns.md      # How to verify artifacts
    └── git-integration.md            # Git workflow patterns
```

### The Command → Workflow → Template Pipeline

```
User invokes /gsd:plan-phase 3
        │
        ▼
Command (commands/gsd/plan-phase.md)
  - Declares allowed-tools
  - Points to workflow via @execution_context
  - Passes $ARGUMENTS
        │
        ▼
Workflow (workflows/plan-phase.md)
  - Step-by-step instructions
  - Calls CLI tools (gsd-tools.cjs)
  - Spawns subagents
  - Manages gates and checkpoints
        │
        ▼
Template (templates/phase-prompt.md)
  - Defines output file format
  - YAML frontmatter schema
  - Required fields and sections
        │
        ▼
Reference (references/checkpoints.md)
  - Decision guides for edge cases
  - Pattern libraries
  - Best practices
```

### How Commands Stay Lean

Commands are ~40 lines max. They act as routers:

```markdown
<objective>
What gets created/accomplished
</objective>

<execution_context>
@/path/to/workflow.md        ← The heavy lifting
@/path/to/template.md        ← Output format
@/path/to/reference.md       ← Decision guide
</execution_context>

<process>
Execute the workflow end-to-end.
Preserve all gates.
</process>
```

**Why this works:** Commands are loaded into context immediately. If they were 5,000 lines, they'd waste tokens. Instead, the `@file` references are loaded lazily — Claude reads them when needed.

### Namespacing Sub-Commands

GSD uses colon-separated namespaces: `gsd:new-project`, `gsd:execute-phase`.

In the filesystem, this maps to a directory:
```
~/.claude/commands/gsd/
├── new-project.md
├── plan-phase.md
├── execute-phase.md
└── ...
```

Users invoke them as `/gsd:new-project`, `/gsd:plan-phase 3`, etc.

---

## 7. Multi-Agent Coordination

GSD's most powerful pattern is its multi-agent orchestration with 12 specialized subagent types.

### Defining Subagent Types

Each subagent type is registered in Claude Code's agent system with:
- A unique name (e.g., `gsd-executor`, `gsd-planner`)
- Allowed tools
- A description of its role

### The Orchestrator Pattern

The command/workflow acts as an **orchestrator** that:
1. Loads minimal context (~15% of token budget)
2. Discovers work to be done
3. Groups work into waves based on dependencies
4. Spawns subagents for each unit of work
5. Each subagent gets 100% fresh context
6. Orchestrator collects results

```
Orchestrator (execute-phase)
    │
    ├── Wave 1 (parallel)
    │   ├── gsd-executor → Plan 01-01
    │   └── gsd-executor → Plan 01-02
    │
    ├── Wave 2 (after wave 1 completes)
    │   └── gsd-executor → Plan 01-03
    │
    └── Post-execution
        └── gsd-verifier → Verify phase
```

### Model Profile System

Different agents need different reasoning capabilities:

| Agent Role | Quality | Balanced | Budget |
|-----------|---------|----------|--------|
| Planner (architecture decisions) | opus | opus | sonnet |
| Executor (follows instructions) | opus | sonnet | sonnet |
| Researcher (exploration) | opus | sonnet | haiku |
| Verifier (checks correctness) | sonnet | sonnet | haiku |
| Mapper (read-only extraction) | sonnet | haiku | haiku |

**Design rationale:**
- **Opus for planning** — Architecture decisions have the highest leverage
- **Sonnet for execution** — The plan already contains the reasoning
- **Haiku for read-only** — Pattern extraction doesn't need deep reasoning

### Spawning Subagents

In workflows, subagents are spawned via the Task/Agent tool:

```
Spawn a gsd-executor subagent with:
- subagent_type: "gsd-executor"
- The plan file as context
- Fresh token budget (100% of context window)
```

The orchestrator stays lean by delegating all heavy work to subagents.

---

## 8. State Management Across Sessions

GSD solves the "context window reset" problem with a structured state system.

### The .planning/ Directory

Every project maintains persistent state:

```
.planning/
├── PROJECT.md          # Vision, value prop, constraints, key decisions
├── REQUIREMENTS.md     # Feature table with IDs, priorities, status
├── ROADMAP.md          # Phase structure with goals
├── STATE.md            # Living memory — position, metrics, context
├── config.json         # Workflow configuration
├── CONTEXT.md          # Locked decisions, assumptions
│
├── phases/
│   └── 01-setup/
│       ├── CONTEXT.md           # Phase-specific context
│       ├── RESEARCH.md          # Domain research
│       ├── 01-01-PLAN.md        # Executable plan
│       ├── 01-01-SUMMARY.md     # Execution results
│       ├── VERIFICATION.md      # Post-execution verification
│       └── UAT.md               # User acceptance results
│
├── research/           # Domain research outputs
├── codebase/           # Codebase mapping outputs
├── quick/              # Quick task plans & summaries
└── todos/              # Task backlog
    ├── pending/
    └── completed/
```

### STATE.md: The Living Memory

STATE.md is the most critical file — it's read at the start of every operation:

```markdown
---
current_phase: 3
current_plan: 01
milestone: "v1.0"
status: "executing"
total_phases: 5
completed_phases: [1, 2]
---

## Position
Phase 3: API Integration — currently executing Plan 01

## Accumulated Context
- Database uses Drizzle ORM (decided Phase 1)
- Auth uses Clerk (decided Phase 2)
- API rate limiting: 100 req/min per user

## Metrics
- Lines added: 4,231
- Files modified: 47
- Tests passing: 89/89
```

### Session Resumption

When a session ends mid-work, GSD creates `.continue-here*.md` files:

```markdown
# Continue Here

## What was happening
Executing Phase 3, Plan 02 — API endpoint implementation

## What's done
- Tasks 1-4 completed
- Database migrations applied

## What's next
- Task 5: Implement rate limiting middleware
- Task 6: Add error response formatting

## Files to read
- .planning/phases/03-api/03-02-PLAN.md
- src/middleware/rate-limit.ts (partially implemented)
```

The `/gsd:resume-work` command reads this file and picks up exactly where things left off.

---

## 9. Templates & Structured Output

Templates define the exact format of generated artifacts. They use YAML frontmatter for machine-readable metadata and markdown for human-readable content.

### Template Design Principles

1. **Frontmatter is structured data** — parseable by CLI tools
2. **Body is instructions for Claude** — what to write and how
3. **Required fields prevent omissions** — Claude must fill every field
4. **Examples clarify expectations** — show, don't just tell

### Example: Plan Template (Simplified)

```markdown
---
phase: XX-name
plan: NN
type: execute
wave: N
depends_on: []
files_modified: []
autonomous: true
requirements: []      # MUST NOT be empty

must_haves:
  truths: []          # Observable behaviors
  artifacts: []       # Files that must exist
  key_links: []       # Critical connections
---

<objective>
[What this plan accomplishes]
Purpose: [Why this matters]
Output: [What artifacts will be created]
</objective>

<tasks>
<task id="1" type="auto">
  <name>[Task name]</name>
  <files>[Files to create/modify]</files>
  <action>[What to do]</action>
  <verify>[How to confirm it worked]</verify>
  <done>[Definition of done]</done>
</task>
</tasks>
```

### Why XML Tags in Markdown?

GSD uses XML tags (`<objective>`, `<tasks>`, `<task>`) inside markdown because:

1. **Unambiguous parsing** — Claude can distinguish structure from content
2. **Attribute support** — `<task id="1" type="auto">` carries metadata
3. **Nesting** — Tasks contain sub-elements cleanly
4. **Claude handles XML natively** — No special parsing needed

---

## 10. Configuration Systems

### Layered Configuration

```
Defaults (templates/config.json)
        │
        ▼
Project config (.planning/config.json)
        │
        ▼
Runtime overrides (/gsd:settings, /gsd:set-profile)
        │
        ▼
Per-agent overrides (model_overrides in config)
```

### Configuration Categories

**Workflow toggles** — Enable/disable optional pipeline stages:
```json
{
  "workflow": {
    "research": true,         // Run domain research before planning
    "plan_check": true,       // Verify plans before execution
    "verifier": true,         // Post-execution verification
    "auto_advance": false,    // Auto-chain commands
    "nyquist_validation": true // Requirements coverage auditing
  }
}
```

**Gates** — User confirmation points:
```json
{
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_plan": true,
    "execute_next_plan": true
  }
}
```

**Parallelization** — Execution strategy:
```json
{
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  }
}
```

**Safety** — Guardrails:
```json
{
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

### Reading Config in Workflows

The CLI tool handles config resolution:
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase 3)
```

This returns a JSON blob with all resolved values — the workflow never parses config directly.

---

## 11. Verification & Quality Gates

### Goal-Backward Verification

GSD's verification works backward from the goal, not forward from tasks:

```
Phase Goal: "Users can sign up with email/password"
        │
        ▼
Must-Have Truths:
  - POST /api/auth/signup returns 201 with valid credentials
  - Passwords are hashed with bcrypt (cost 12+)
  - Duplicate emails return 409
        │
        ▼
Must-Have Artifacts:
  - src/routes/auth/signup.ts (real implementation, not stub)
  - src/lib/auth/password.ts (bcrypt hashing)
  - migrations/003_users_table.sql
        │
        ▼
Key Links:
  - signup route → password.ts → database
  - Error responses match API spec
```

The verifier checks these conditions, not whether tasks were completed.

### Checkpoint System

Three types of human interaction points:

| Type | When | Example |
|------|------|---------|
| `checkpoint:human-verify` | Claude built it, human confirms | "Visit localhost:3000 and check the layout" |
| `checkpoint:decision` | Human chooses between options | "Use Stripe or Paddle for payments?" |
| `checkpoint:human-action` | Human does something Claude can't | "Log into AWS console and create IAM role" |

**Golden rule:** If Claude can run it, Claude runs it. Checkpoints are for judgment and access, not for commands.

### Nyquist Validation

Named after the Nyquist sampling theorem — ensures requirements are "sampled" (covered) at sufficient frequency:

- Every requirement in REQUIREMENTS.md maps to at least one plan
- Every plan maps to at least one requirement
- Gaps are flagged and addressed via decimal phases (1.1, 1.2, etc.)

---

## 12. CLI Tooling Layer

For complex skills, a CLI utility prevents Claude from doing string manipulation in prompts.

### Why a CLI Tool?

Claude is bad at:
- Parsing YAML frontmatter reliably
- Calculating phase numbers
- Managing JSON state files atomically
- Complex file path resolution

A CLI tool handles these deterministically:

```bash
# Load all project context in one call
node gsd-tools.cjs state load

# Resolve which model to use for an agent
node gsd-tools.cjs resolve-model gsd-executor

# Find next decimal phase number
node gsd-tools.cjs phase next-decimal 3

# Fill a template
node gsd-tools.cjs template fill summary --phase 3

# Verify plan structure
node gsd-tools.cjs verify plan-structure ./path/to/PLAN.md
```

### CLI Design Principles

1. **One call, all context** — `init` commands return everything needed as JSON
2. **Deterministic operations** — No Claude judgment in state management
3. **Atomic updates** — State changes are all-or-nothing
4. **Large output to file** — When JSON is large, output to temp file and return `@file:/path`

```bash
INIT=$(node gsd-tools.cjs init execute-phase 3)
if [[ "$INIT" == @file:* ]]; then
  INIT=$(cat "${INIT#@file:}")
fi
```

### Building Your Own CLI Tool

For complex skills, write a Node.js (or Python/Rust) CLI:

```javascript
// bin/my-skill-tools.cjs
const command = process.argv[2];

switch (command) {
  case 'init':
    // Load all context, return JSON
    console.log(JSON.stringify({
      config: loadConfig(),
      state: loadState(),
      files: discoverFiles()
    }));
    break;

  case 'update-state':
    // Atomic state update
    updateState(process.argv[3], process.argv[4]);
    break;
}
```

---

## 13. Reference Architecture: Complete Skill Taxonomy

### Tier 1: Single-File Skills

```
~/.agents/skills/my-skill/
└── SKILL.md              # Everything in one file
```

- 50-500 lines
- No state, no CLI, no subagents
- Examples: code review, copywriting, design guidelines

### Tier 2: Multi-File Skills

```
~/.agents/skills/my-skill/
├── SKILL.md              # Entry point
├── reference-data.md     # Supporting knowledge
└── examples.md           # Example inputs/outputs
```

- Skill reads supporting files as needed
- No external tooling
- Examples: SEO audit, analytics tracking, schema markup

### Tier 3: Workflow Skills

```
~/.claude/my-skill/
├── workflows/
│   ├── main-flow.md
│   └── sub-flow.md
├── templates/
│   └── output-format.md
└── references/
    └── decision-guide.md

~/.claude/commands/my-skill/
├── start.md
└── continue.md
```

- Multiple commands
- Structured workflows
- Templates for output
- Examples: project scaffolding, migration tools

### Tier 4: Orchestrated Skills (GSD Level)

```
~/.claude/my-skill/
├── VERSION
├── CHANGELOG.md
├── bin/
│   ├── tools.cjs
│   └── lib/
├── workflows/            # 10-30+ files
├── templates/            # 10-20+ files
└── references/           # 5-15 files

~/.claude/commands/my-skill/
├── command-1.md
├── command-2.md
└── ...                   # 10-30+ commands
```

- CLI tooling for state management
- Multiple subagent types
- Wave-based parallel execution
- Persistent state across sessions
- Configuration system with profiles
- Verification and quality gates
- Version management

---

## 14. Checklist: Shipping a Production Skill

### Minimum Viable Skill

- [ ] `SKILL.md` with valid frontmatter (`name`, `description`, `invoke`)
- [ ] Clear "When to Apply" section
- [ ] Step-by-step instructions Claude can follow
- [ ] Run `bash ~/.agents/sync.sh`
- [ ] Test by invoking in a conversation

### Intermediate Skill

- [ ] Everything above
- [ ] Supporting reference files
- [ ] Output format templates
- [ ] Error handling instructions
- [ ] Examples of expected behavior

### Advanced Orchestrated Skill

- [ ] Everything above
- [ ] Namespaced sub-commands (`skill:command`)
- [ ] Workflow files with step-by-step processes
- [ ] CLI tool for deterministic operations
- [ ] State management (persistent `.planning/` or equivalent)
- [ ] Configuration system with defaults
- [ ] User gates for confirmation points
- [ ] Subagent definitions for parallel work
- [ ] Model profile system for cost control
- [ ] Verification/quality gates
- [ ] Session resumption support
- [ ] Version tracking (VERSION + CHANGELOG.md)

---

## Appendix A: GSD at a Glance

| Metric | Count |
|--------|-------|
| Commands | 32 |
| Workflows | 34 |
| Templates | 24 |
| References | 13 |
| Subagent types | 12 |
| CLI commands | ~130 |
| Library modules | 11 |
| Config options | 25+ |
| Version | 1.22.4 |

## Appendix B: Key Design Decisions in GSD

1. **Commands are routers, not executors** — Keep commands under 50 lines; all logic lives in workflows
2. **@file lazy loading** — Only load context when needed, not upfront
3. **Orchestrator stays lean** — 15% context budget; subagents get 100% fresh
4. **State is plain markdown** — Human-readable, git-committable, Claude-parseable
5. **CLI handles determinism** — Never ask Claude to parse YAML or calculate numbers
6. **Goal-backward verification** — Check outcomes, not task completion
7. **Decimal phases for gaps** — 1.1, 1.2 phases close gaps without restructuring the roadmap
8. **Git integration is optional** — Branching strategies, commit conventions, but never forced
9. **Gates are configurable** — Users choose their own autonomy level
10. **Model profiles respect quotas** — Smart agent-to-model mapping saves tokens without sacrificing quality

---

*Generated from analysis of GSD v1.22.4 and the ~/.agents skill distribution system.*
