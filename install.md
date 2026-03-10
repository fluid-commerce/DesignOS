# Fluid Creative OS — Installation Guide

Machine-readable installation instructions. An agent can follow these steps autonomously.

## Prerequisites

- Node.js (v18+) installed
- Claude Code CLI installed (`claude` command available)
- Git installed

## Installation Steps

### Step 1: Clone the repository

```bash
git clone <repo-url> ~/fluid-creative-os
```

EXPECTED: Repository cloned into `~/fluid-creative-os/` with directories: `brand/`, `assets/`, `tools/`, `patterns/`, `.claude/`

> Note: Replace `<repo-url>` with the actual repository URL. If you already have the repo, skip this step.

### Step 2: Run the sync script

```bash
cd ~/fluid-creative-os && chmod +x sync.sh && ./sync.sh
```

EXPECTED: Output shows "=== Fluid Creative OS Sync ===" followed by skill symlink/copy confirmations and "=== Sync Complete ===" with count of installed skills.

### Step 3: Add as additional directory in Claude Code (recommended)

```bash
claude --add-dir ~/fluid-creative-os
```

EXPECTED: Claude Code confirms the directory was added. Skills in `.claude/skills/` are auto-discovered with hot reload — no restart needed.

### Step 4: Verify skill installation

```bash
ls ~/.claude/skills/ | grep fluid
```

EXPECTED: Three entries:
```
fluid-brand-compliance-check
fluid-brand-intelligence
fluid-scaffold-section
```

### Step 5: Verify brand docs are accessible

```bash
ls ~/fluid-creative-os/brand/
```

EXPECTED: Eight `.md` files:
```
asset-index.md
asset-usage.md
design-tokens.md
index.md
layout-archetypes.md
social-post-specs.md
voice-rules.md
website-section-specs.md
```

### Step 6: Test a skill (optional)

In any Claude Code session within the project directory, type:

```
/scaffold-section test-hero
```

EXPECTED: Claude runs `node tools/scaffold.cjs test-hero` and generates a `.liquid` section skeleton.

## Cursor Installation

To install for Cursor only:

```bash
cd ~/fluid-creative-os && ./sync.sh --target cursor
```

EXPECTED: Skills copied to `~/.cursor/skills/fluid-*` directories.

## Verify Installation Is Working

After installation, test that brand intelligence activates:

1. Open Claude Code in the project directory
2. Ask: "Create a social post for Fluid's email marketing feature"
3. The agent should automatically load `brand/voice-rules.md` and `brand/social-post-specs.md`

EXPECTED: Generated content uses Fluid's voice (confident, clear, action-oriented) and follows social post dimension specs.

## Troubleshooting

### Permission denied on sync.sh
```bash
chmod +x ~/fluid-creative-os/sync.sh
```
EXPECTED: No output. Re-run `./sync.sh`.

### Skills not showing in Claude Code
- Ensure you ran `claude --add-dir ~/fluid-creative-os`
- Check that `.claude/skills/` contains the skill directories: `ls ~/fluid-creative-os/.claude/skills/`
- Restart Claude Code if skills were added while a session was active

### Symlink conflicts
If `~/.claude/skills/fluid-*` already exists from a previous install:
```bash
./sync.sh --uninstall && ./sync.sh
```
EXPECTED: Old skills removed, fresh install completed.

### brand/ directory not found error
You are running sync.sh from the wrong directory. Navigate to the repo root:
```bash
cd ~/fluid-creative-os && ./sync.sh
```

### tools/ directory warning
If tools/ is empty, CLI validation tools have not been built yet. Skills will install but validation commands will not work until tools are populated (Plan 01-02).

## Uninstall

```bash
cd ~/fluid-creative-os && ./sync.sh --uninstall
```

EXPECTED: Output shows removal of all `fluid-*` skill symlinks/copies from both Claude Code and Cursor directories.

## What Gets Installed

| Component | Location | Purpose |
|-----------|----------|---------|
| brand-intelligence skill | `.claude/skills/` + global symlink | Always-active brand context loading |
| brand-compliance-check skill | `.claude/skills/` + global symlink | On-demand validation command |
| scaffold-section skill | `.claude/skills/` + global symlink | Gold Standard section generator |
| PostToolUse hooks | `.claude/settings.json` (project-scoped) | Auto-validate on file write |
| Subagent definitions | `.claude/agents/` (project-scoped) | Copy, styling, layout agent configs |
| Brand docs | `brand/` (project-scoped) | 8 role-specific brand intelligence files |

## What Is NOT Touched

- `~/.agents/` — Your global agent configuration is untouched
- `~/.claude/commands/` — Your global slash commands are untouched
- `~/.claude/CLAUDE.md` — Your global Claude instructions are untouched
- Any existing skills without the `fluid-` prefix are untouched
