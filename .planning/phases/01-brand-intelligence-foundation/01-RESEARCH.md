# Phase 1: Brand Intelligence + Foundation - Research

**Researched:** 2026-03-10
**Domain:** Brand documentation architecture, CLI validation tooling, Claude Code skill distribution
**Confidence:** HIGH

## Summary

Phase 1 builds the foundation everything else sits on: modular brand docs that subagents can selectively load, CLI tools for deterministic validation, a Brand Pattern Library with copy-pasteable code, and a distribution system that installs into Claude Code and Cursor. The research covers four domains: (1) brand document decomposition strategy based on actual source content analysis, (2) Claude Skills 2.0 and Superpowers patterns that directly inform skill/doc architecture, (3) CLI validation tool design using Node.js built-ins, and (4) the sync.sh distribution pattern already proven in the user's existing infrastructure.

Key finding: Claude Skills 2.0 introduces `context: fork` for isolated subagent execution, custom agents via `.claude/agents/`, and skill preloading via the `skills` frontmatter field on agents. These features directly enable the Phase 2 orchestrator-subagent architecture, meaning Phase 1's doc structure must be designed as preloadable skill content from the start.

**Primary recommendation:** Structure brand docs as skill-compatible markdown files in `.claude/skills/` format with YAML frontmatter, so they can be both wiki-linked for human navigation AND preloaded into subagents via the `skills` field. Build CLI tools as zero-dependency Node.js scripts that validate against a compiled `rules.json` (not runtime markdown parsing). Use the existing `~/.agents/sync.sh` pattern as the template for the project's own `sync.sh`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Group docs by subagent role: voice-rules.md (copy agent), design-tokens.md (styling agent), layout-archetypes.md (layout agent), etc.
- Resolve brand source conflicts during decomposition -- each doc is the single source of truth. No ambiguity for agents.
- Preserve original wording from source docs -- distribute content into role files, don't rewrite
- Create an orchestrator index that wiki-links to all role files
- Original source material stays in Reference/ as archives -- agents never load them directly
- Wiki-linking: inline links with context hints
- Research META-03 (Claude Skills 2.0) and META-04 (Superpowers) FIRST -- findings inform doc structure and skill architecture
- Numeric weights 1-100 instead of categorical FIXED/FLEXIBLE/OPTIONAL
- Named thresholds: 1-20 (optional), 21-50 (flexible), 51-80 (strong preference), 81-100 (brand-critical)
- CLI tool severity maps to weights: 81-100 = error, 51-80 = warning, 21-50 = info, 1-20 = hint
- Brand Pattern Library: HTML page(s) with copy-pasteable code and technical specs
- Single asset-index.md listing every asset with filename, base64 thumbnail, usage rules, per-rule weights
- Descriptive filenames: brushstroke-wide-sweep.png instead of brushstroke01.png
- Node.js CLI scripts, zero external dependencies
- Output: structured JSON + human-readable summary
- Brand compliance check validates against compiled rules.json, not parsing markdown at runtime
- Template scaffolding generates Gold Standard skeleton with full schema pre-filled
- Standalone git repo with flat functional directories: brand/, assets/, tools/, skills/, patterns/, templates/, feedback/, Reference/, .planning/
- sync.sh script for Claude Code and Cursor distribution, idempotent
- Agent-installable: machine-readable install instructions
- feedback/ directory with conventions for agents to write usage data back

### Claude's Discretion
- Pattern Library structure: one HTML page or multiple, and relationship to asset index
- Specific decomposition boundaries (which paragraphs go to which role file)
- Brand conflict resolution when sources disagree
- Exact file naming within brand/ directory
- Gold Standard decomposition granularity

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | Brand intelligence layer with modular .md files, 3-6 docs max per subagent | Source doc analysis identifies 6 role files; Skills 2.0 `skills` field enables preloading exactly the needed subset |
| BRAND-02 | Design tokens documented (7 colors, 4 fonts, spacing, radius, opacity) | Extracted from social-post-design-guide.md and fluid-website-build-prompt.md; conflicts identified and resolution strategy documented |
| BRAND-03 | Copy voice rules documented (lead with pain, one sentence one idea, etc.) | Content exists in social-post-design-guide.md section 8 and Manifesto.txt; preserving original wording per user decision |
| BRAND-04 | Layout archetypes documented (6 types) | social-post-design-guide.md section 7 has all 6 archetypes with technical specs |
| BRAND-05 | Brand asset repository organized and indexed | 13 assets inventoried; descriptive rename mapping created; asset-index.md structure with weight system defined |
| BRAND-06 | Brand Pattern Library HTML page(s) | Architecture patterns for rendering building blocks with code snippets; leverages existing template HTML as reference |
| BRAND-07 | All brand docs wiki-linked | Linking strategy uses contextual hints per user decision; index-level and cross-doc linking patterns defined |
| BRAND-08 | Template elements annotated with weights (1-100 system replaces FIXED/FLEXIBLE/OPTIONAL) | Weight system maps to CLI severity; threshold bands defined; per-element and per-usage-rule application |
| CLI-01 | Schema validation hook for .liquid files | Gold Standard checklist provides exact counts (13 font sizes, 13 colors, 5 weights); Node.js parser for .liquid schema sections |
| CLI-02 | Brand compliance check for hex colors, fonts, spacing | Compiled rules.json approach; Node.js regex-based line scanner; structured JSON output format |
| CLI-03 | Asset dimension validation | HTML dimension parsing via regex; target dimensions from design guide (1080x1080, 1200x627, 1340x630) |
| CLI-04 | Template scaffolding from Gold Standard | Gold Standard workflow document provides complete schema structure; scaffold generates pre-filled .liquid skeleton |
| DIST-01 | Git repo with clear directory structure | Flat functional directories decided; structure documented |
| DIST-02 | Installation script for Claude Code and Cursor | Existing sync.sh pattern proven; project-specific sync.sh follows same architecture |
| DIST-03 | Works via sync.sh pattern for both platforms | Distribution pipeline maps skill invoke types to platform-specific outputs |
| META-03 | Research Claude Skills 2.0 patterns | COMPLETED: context fork, allowed-tools, hooks, agent field, skill preloading, hot reload all documented |
| META-04 | Research Superpowers skill system | COMPLETED: Methodology patterns (spec-before-implementation, mandatory skill activation, constraint-based execution) applicable to brand system |
</phase_requirements>

## META-03: Claude Skills 2.0 Findings

**Confidence: HIGH** (verified against official docs at code.claude.com/docs/en/skills)

### Skill File Format (Current as of March 2026)

Skills live in `.claude/skills/<name>/SKILL.md` (project-level) or `~/.claude/skills/<name>/SKILL.md` (user-level). Each skill is a directory with `SKILL.md` as entrypoint plus optional supporting files.

**Frontmatter fields:**

| Field | Purpose | Phase 1 Relevance |
|-------|---------|-------------------|
| `name` | Display name, becomes `/slash-command` | Brand skills get invocable names |
| `description` | When to use; Claude uses for auto-invocation | Critical for subagent skill matching |
| `disable-model-invocation` | Prevent auto-loading (`true`/`false`) | Use `true` for CLI-trigger-only skills |
| `user-invocable` | Hide from `/` menu (`true`/`false`) | Use `false` for background brand knowledge |
| `allowed-tools` | Tools available without permission prompts | Restrict brand skills to read-only |
| `model` | Which model to use | Cost optimization for brand lookups |
| `context` | Set to `fork` for isolated subagent | Phase 2 orchestrator will use this |
| `agent` | Which subagent type (built-in or custom) | Phase 2 will define copy-agent, styling-agent, etc. |
| `hooks` | Scoped lifecycle hooks | CLI validation on file writes |

**Custom subagents** (`.claude/agents/<name>.md`):

| Field | Purpose |
|-------|---------|
| `name` | Unique identifier |
| `description` | When Claude delegates to this agent |
| `tools` | Tool allowlist; `Agent(worker, researcher)` syntax for nested spawning |
| `disallowedTools` | Tool denylist |
| `model` | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permissionMode` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | Skills preloaded into agent context at startup (full content injected) |
| `hooks` | Lifecycle hooks scoped to this agent |
| `memory` | `user`, `project`, or `local` -- persistent cross-session learning |
| `maxTurns` | Max agentic turns before stopping |
| `background` | Run as background task |
| `isolation` | `worktree` for git worktree isolation |

**Key insight for Phase 1:** The `skills` field on agents means brand doc files structured as skills can be directly preloaded into subagents. A copy subagent's agent definition would list `skills: [voice-rules, messaging-copy]` and receive those files' full content at startup. This means brand docs in `brand/` should also exist as skills in `.claude/skills/` (or be symlinked).

### Hooks for CLI Validation

Hooks fire on specific lifecycle events. For CLI validation (CLI-01, CLI-02):

**PostToolUse hook on Write/Edit** can trigger validation scripts after files are written:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "./tools/validate-on-write.sh"
          }
        ]
      }
    ]
  }
}
```

Hook receives JSON via stdin with `tool_input` containing the file path. The validation script can check file extension and route to schema-validation or brand-compliance accordingly.

### Distribution: Skills from --add-dir

Skills defined in `.claude/skills/` within directories added via `--add-dir` are loaded automatically with hot reload. This means the Fluid Creative OS repo, when added as an additional directory, automatically makes all its skills available without copying files. This is an alternative to sync.sh for Claude Code specifically, though sync.sh is still needed for Cursor.

## META-04: Superpowers Findings

**Confidence: MEDIUM** (verified against GitHub repo, not deeply integrated)

### Applicable Patterns

| Pattern | What Superpowers Does | How Phase 1 Applies |
|---------|----------------------|---------------------|
| Spec before implementation | Hard gate preventing code before design approval | Brand docs ARE the spec; subagents can't generate without loading them first |
| Mandatory skill activation | Agent checks for relevant skills before any task | Brand skills should use `user-invocable: false` + good descriptions so Claude auto-loads them |
| Constraint-based execution | Tasks scoped to 2-5 minutes with exact file paths | CLI tools provide deterministic validation boundaries |
| Two-stage review | Spec compliance review, then code quality review | Maps to Phase 2's spec-check then fix subagent pattern |

### What NOT to Adopt

- Superpowers' TDD enforcement pattern is irrelevant here (no production code in Phase 1)
- Superpowers' brainstorming skill is redundant with GSD's discuss-phase
- The full Superpowers framework should NOT be installed -- it would conflict with GSD

**Recommendation:** Extract applicable methodology patterns into brand skill design, but do NOT install Superpowers as a dependency.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 18+ (built-ins only) | CLI tools runtime | User decision: zero external dependencies |
| Markdown (.md) | N/A | Brand docs, skills | Claude Code native format; Skills 2.0 standard |
| HTML/CSS | N/A | Brand Pattern Library | Self-contained visual reference with code snippets |
| Bash (sync.sh) | N/A | Distribution script | Proven pattern from existing ~/.agents/sync.sh |
| JSON | N/A | rules.json, asset-index data | Machine-parseable by CLI tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` | built-in | File reading/writing | CLI tools, rules.json compilation |
| `node:path` | built-in | Path resolution | CLI tools for cross-platform paths |
| `node:readline` | built-in | Line-by-line file parsing | Schema validation, brand compliance scanning |
| `node:child_process` | built-in | Subprocess execution | Only if tools need to chain |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js CLI | Python scripts | Node.js chosen because user decided zero-dependency; Python would need explicit install check |
| Compiled rules.json | Runtime markdown parsing | rules.json is faster, deterministic, and doesn't break when doc formatting changes |
| HTML Pattern Library | Storybook | Overkill; self-contained HTML is simpler and matches Jonathan's template format |

## Architecture Patterns

### Recommended Project Structure

```
fluid-creative-os/                    # Repo root
├── brand/                            # Decomposed brand intelligence
│   ├── index.md                      # Orchestrator index with wiki-links to all role files
│   ├── voice-rules.md                # Copy agent: voice, messaging, copy principles
│   ├── design-tokens.md              # Styling agent: colors, fonts, spacing, opacity, radius
│   ├── layout-archetypes.md          # Layout agent: 6 layout types with specs
│   ├── asset-usage.md                # Asset rules: per-asset usage rules with weights
│   ├── social-post-specs.md          # Social-specific: dimensions, typography scale, footer structure
│   └── website-section-specs.md      # Website-specific: Gold Standard schema rules, button system
├── assets/                           # Brand assets with descriptive names
│   ├── brushstrokes/                 # 7 brushstroke PNGs
│   ├── circles/                      # 2 circle sketch PNGs
│   ├── logos/                        # Flags, logos, Frame 3
│   └── fonts/                        # FLFont Bold, Inter Variable
├── tools/                            # CLI validation tools
│   ├── brand-compliance.cjs          # CLI-02: hex, font, spacing validation
│   ├── schema-validation.cjs         # CLI-01: .liquid schema completeness
│   ├── dimension-check.cjs           # CLI-03: HTML dimension validation
│   ├── scaffold.cjs                  # CLI-04: Gold Standard template scaffolding
│   ├── compile-rules.cjs             # Compiles brand docs into rules.json
│   └── rules.json                    # Compiled brand rules (generated)
├── skills/                           # Agent skills (skill source files)
│   ├── brand-intelligence/           # Always-active brand context skill
│   │   └── SKILL.md
│   ├── brand-compliance-check/       # Trigger-based validation skill
│   │   └── SKILL.md
│   └── scaffold-section/             # Slash command for Gold Standard scaffold
│       └── SKILL.md
├── patterns/                         # Brand Pattern Library
│   └── index.html                    # HTML rendering of all building blocks
├── templates/                        # Starter templates
│   └── gold-standard/                # .liquid skeleton
├── feedback/                         # Iteration logs (Phase 5 input)
│   ├── .gitkeep
│   └── README.md                     # Conventions for feedback format
├── Reference/                        # Original source material (archive)
│   └── ...                           # Existing reference docs
├── .claude/
│   ├── skills/                       # Symlinks to skills/ for auto-discovery
│   ├── agents/                       # Custom subagent definitions (Phase 2 prep)
│   └── settings.json                 # Hook configuration for PostToolUse validation
├── sync.sh                           # Distribution script
├── install.md                        # Machine-readable installation instructions
├── CLAUDE.md                         # Project-level instructions (generated by sync.sh)
└── .planning/                        # GSD planning state
```

### Pattern 1: Brand Doc as Preloadable Skill Content

**What:** Each brand doc in `brand/` is ALSO available as a skill via symlink in `.claude/skills/`. The doc serves dual purpose: human-readable brand reference AND machine-loadable subagent context.

**When to use:** Every brand doc file.

**Example:**

```markdown
# brand/voice-rules.md
<!-- Weight: per-rule weights inline -->

## Copy Principles for Fluid Brand Voice

### 1. Lead with pain, not features (Weight: 95)
"The order went through. It never reached the commission engine."
-- not "Fluid Connect offers real-time bidirectional sync."

### 2. One sentence, one idea (Weight: 90)
Short. Dramatic. Let the big claim land before building on it.

### 3. Name specific scenarios (Weight: 85)
"They're at a red light. The moment passes."
-- not "Mobile checkout is important."

...

## Related Docs
- See [design-tokens.md](design-tokens.md) for color mood mapping (which accent color matches which emotion)
- See [layout-archetypes.md](layout-archetypes.md) for headline sizing per layout type
```

The `.claude/skills/voice-rules/SKILL.md` skill file:
```yaml
---
name: voice-rules
description: Fluid brand voice rules for copy generation. Load when writing marketing copy, social posts, or any customer-facing text. Covers pain-first messaging, one-sentence-one-idea rhythm, human scenarios, and FLFont tagline usage.
user-invocable: false
---

<!-- This skill preloads voice-rules.md content for subagent consumption -->
Read and apply the brand voice rules from brand/voice-rules.md in this project.
```

### Pattern 2: Compiled Rules for CLI Validation

**What:** A build step (`compile-rules.cjs`) extracts machine-checkable rules from brand docs into `rules.json`. CLI tools validate against `rules.json`, never parsing markdown at runtime.

**When to use:** All CLI validation tools (CLI-01 through CLI-03).

**Example rules.json structure:**

```json
{
  "version": "1.0.0",
  "compiled": "2026-03-10T00:00:00Z",
  "colors": {
    "allowed_hex": ["#000000", "#ffffff", "#FF8B58", "#42b1ff", "#44b574", "#c985e5"],
    "allowed_rgba_patterns": [
      "rgba(255,255,255,0.45)",
      "rgba(255,255,255,0.25)",
      "rgba(255,255,255,0.03)",
      "rgba(255,255,255,0.06)"
    ],
    "rules": [
      { "id": "color-bg-pure-black", "pattern": "background.*#191919|background.*#1a1a1a", "message": "Social posts use pure #000 background, not dark gray", "weight": 95 }
    ]
  },
  "fonts": {
    "allowed_families": ["NeueHaasDisplay", "NeueHaas", "FLFont", "flfontbold", "Inter"],
    "rules": [...]
  },
  "spacing": {
    "disallowed_hardcoded": true,
    "rules": [...]
  },
  "schema": {
    "font_size_count": 13,
    "color_count": 13,
    "weight_count": 5,
    "button_settings_count": 7,
    "section_settings_count": 5,
    "container_settings_count": 7
  }
}
```

### Pattern 3: Weight System in Brand Docs

**What:** Every brand rule carries a numeric weight (1-100) inline in the doc. Weights map to CLI severity and inform agent decision-making.

**When to use:** Every rule in every brand doc.

**Threshold mapping:**
| Weight Range | Label | CLI Severity | Agent Behavior |
|-------------|-------|-------------|----------------|
| 81-100 | Brand-critical | error | Must follow; violation fails validation |
| 51-80 | Strong preference | warning | Should follow; violation flagged but not blocking |
| 21-50 | Flexible | info | Recommended; deviation acceptable with reason |
| 1-20 | Optional | hint | Nice-to-have; agent can ignore freely |

### Pattern 4: PostToolUse Hook for Auto-Validation

**What:** Configure `.claude/settings.json` with PostToolUse hooks that auto-run validation when Claude writes .liquid or .html files.

**When to use:** Development workflow; runs automatically, no manual invocation needed.

**Example `.claude/settings.json`:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "./tools/validate-on-write.sh"
          }
        ]
      }
    ]
  }
}
```

**validate-on-write.sh:**
```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log(j.tool_input?.file_path||j.tool_input?.path||'')")

case "$FILE" in
  *.liquid)
    node ./tools/schema-validation.cjs "$FILE"
    ;;
  *.html)
    node ./tools/brand-compliance.cjs "$FILE"
    ;;
esac
```

### Anti-Patterns to Avoid

- **Monolithic brand doc:** Never create a single large brand guide. Subagents need focused context (3-6 docs max). The whole point is decomposition.
- **Runtime markdown parsing in CLI:** Don't have CLI tools parse brand markdown files on every run. Compile to rules.json once; validate against that.
- **Storing brand docs only as skills:** Brand docs must live in `brand/` for human readability and wiki-linking. Skills reference them; they don't replace them.
- **Copying brand content into skill files:** Skills should point to brand docs, not duplicate them. One source of truth per topic.
- **Hard-coding thresholds in CLI tools:** Weight thresholds (81-100 = error, etc.) should be configurable in rules.json, not hard-coded in tool scripts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Python in sync.sh (existing pattern) | Edge cases in YAML are numerous; existing sync.sh already handles this |
| .liquid file parsing | Full template parser | Regex for schema section extraction | Only need to count select options in schema JSON, not parse full Liquid |
| HTML hex color detection | Simple string search | Regex with word boundary and context | Must avoid false positives on hex-like strings in data attributes or comments |
| File-watching for hot reload | Custom fswatch wrapper | Claude Code's built-in hot reload for .claude/skills/ | Skills 2.0 has built-in hot reload; no need to build our own |
| Cross-platform distribution | Manual file copying | sync.sh script following ~/.agents/sync.sh pattern | Proven, idempotent, handles both Claude Code and Cursor |

## Common Pitfalls

### Pitfall 1: Color Conflicts Between Sources
**What goes wrong:** social-post-design-guide.md and fluid-website-build-prompt.md define overlapping but different color systems. Social posts use `#FF8B58` (orange), `#42b1ff` (blue), `#44b574` (green), `#c985e5` (purple) as accent colors on `#000` backgrounds. The website build prompt uses `#FF5500` (orange), `#00AAFF` (blue), `#00E87A` (green) on `#050505`/`#0a0a0a` backgrounds.
**Why it happens:** Different design contexts (social vs. web) evolved independently.
**How to avoid:** design-tokens.md must document BOTH color systems with context labels. Social post colors and website colors are different and valid in their respective contexts. Weight the social colors at 95 for social contexts and website colors at 95 for website contexts. The CLI compliance tool must be context-aware (checking social HTML against social rules, .liquid against website rules).
**Warning signs:** A single flat color list with no context labels.

### Pitfall 2: Font Name Confusion
**What goes wrong:** The actual font files are `flfontbold.ttf` and `Inter-VariableFont_opsz,wght.ttf`, but docs reference them as "FLFont Bold", "NeueHaasDisplay", and "Inter". The templates use `font-family: 'NeueHaas'` as the CSS name for Inter. Jonathan's templates use Inter Variable as a substitute for NeueHaasDisplay.
**Why it happens:** Font licensing; Inter is used as a development proxy for NeueHaas.
**How to avoid:** design-tokens.md must include a font mapping table: display name -> CSS family name -> actual file. The CLI compliance tool must accept all valid aliases.
**Warning signs:** CLI tool rejects valid font references because it only knows one name.

### Pitfall 3: Asset Rename Breaks References
**What goes wrong:** Renaming `brushstroke01.png` to `brushstroke-diagonal-sweep.png` (per user decision for descriptive names) breaks references in existing templates and generated examples.
**Why it happens:** Templates in Reference/ use original filenames.
**How to avoid:** Reference/ stays untouched (per user decision). Only the new `assets/` directory uses descriptive names. asset-index.md includes an "original filename" column for traceability. Pattern Library references new names exclusively.
**Warning signs:** Broken image references in Pattern Library HTML.

### Pitfall 4: Oversized Brand Docs
**What goes wrong:** A single brand doc exceeds useful context size, defeating the purpose of decomposition.
**Why it happens:** Including too much detail or too many examples in one file.
**How to avoid:** Target 2-4KB per brand doc (fits comfortably in subagent context). If a doc exceeds 6KB, it needs further splitting. The orchestrator index can be larger since it's loaded only by the orchestrating agent.
**Warning signs:** Any brand doc file larger than 8KB.

### Pitfall 5: sync.sh Assumes Global Installation
**What goes wrong:** sync.sh writes to `~/.claude/` which overwrites existing skills, or conflicts with the user's existing `~/.agents/sync.sh`.
**Why it happens:** Following the global sync.sh pattern too literally for a project-specific tool.
**How to avoid:** The project's sync.sh should write to PROJECT-SPECIFIC locations:
- Option A: Install as `--add-dir` (Claude Code loads `.claude/skills/` from the added directory automatically)
- Option B: Symlink project skills into `~/.claude/skills/fluid-*` with a namespace prefix
- Option C: Generate a project-level CLAUDE.md that the user's global CLAUDE.md references
The user's existing `~/.agents/sync.sh` must not be disrupted.
**Warning signs:** Running project sync.sh breaks existing skills.

### Pitfall 6: Schema Validation Counting Errors
**What goes wrong:** Schema validation tool miscounts select options because it doesn't account for nested blocks, commented-out options, or non-standard JSON formatting.
**Why it happens:** .liquid schema sections are JSON embedded in Liquid templates with potential whitespace and comment variations.
**How to avoid:** Extract the `{% schema %}...{% endschema %}` block, parse as JSON, then count `options` arrays programmatically. Don't use regex to count options.
**Warning signs:** Tool reports wrong counts on valid Gold Standard sections.

## Code Examples

### CLI Tool: Brand Compliance Check (CLI-02)

```javascript
// tools/brand-compliance.cjs
// Source: Architecture derived from user decisions (zero-dependency Node.js, structured JSON output)
const fs = require('node:fs');
const path = require('node:path');

const rulesPath = path.join(__dirname, 'rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const SEVERITY = { error: 81, warning: 51, info: 21, hint: 1 };

function getSeverity(weight) {
  if (weight >= 81) return 'error';
  if (weight >= 51) return 'warning';
  if (weight >= 21) return 'info';
  return 'hint';
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  // Check hex colors
  lines.forEach((line, i) => {
    const hexMatches = line.matchAll(/#[0-9a-fA-F]{3,8}\b/g);
    for (const match of hexMatches) {
      const hex = match[0].toLowerCase();
      // Normalize 3-digit to 6-digit
      const normalized = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
      if (!rules.colors.allowed_hex.map(c => c.toLowerCase()).includes(normalized)) {
        violations.push({
          file: filePath,
          line: i + 1,
          column: match.index + 1,
          rule: 'brand-color',
          severity: getSeverity(90),
          weight: 90,
          message: `Non-brand hex color "${match[0]}". Allowed: ${rules.colors.allowed_hex.join(', ')}`
        });
      }
    }
  });

  // Check font families
  lines.forEach((line, i) => {
    const fontMatch = line.match(/font-family:\s*['"]?([^'";,}]+)/);
    if (fontMatch) {
      const font = fontMatch[1].trim();
      if (!rules.fonts.allowed_families.some(f => font.includes(f))) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: 'brand-font',
          severity: getSeverity(85),
          weight: 85,
          message: `Non-brand font family "${font}". Allowed: ${rules.fonts.allowed_families.join(', ')}`
        });
      }
    }
  });

  return violations;
}

// Entry point
const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: node brand-compliance.cjs <file>');
  process.exit(1);
}

const violations = checkFile(targetFile);

// Structured JSON output
console.log(JSON.stringify({ file: targetFile, violations, total: violations.length }, null, 2));

// Human-readable summary
if (violations.length > 0) {
  console.error(`\n--- Brand Compliance: ${violations.length} issue(s) ---`);
  violations.forEach(v => {
    console.error(`  ${v.severity.toUpperCase()} [${v.rule}] ${v.file}:${v.line} - ${v.message}`);
  });
  // Exit with error if any violations are severity 'error'
  if (violations.some(v => v.severity === 'error')) process.exit(1);
}
```

### CLI Tool: Schema Validation (CLI-01)

```javascript
// tools/schema-validation.cjs
// Source: GOLD_STANDARD_WORKFLOW.md requirements
const fs = require('node:fs');

function extractSchema(content) {
  const match = content.match(/\{%[-\s]*schema\s*[-\s]*%\}([\s\S]*?)\{%[-\s]*endschema\s*[-\s]*%\}/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function countSelectOptions(settings, namePattern) {
  const setting = settings.find(s => s.id && s.id.match(namePattern) && s.type === 'select');
  return setting ? (setting.options || []).length : 0;
}

function validateSchema(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const schema = extractSchema(content);
  const issues = [];

  if (!schema) {
    issues.push({ rule: 'schema-exists', severity: 'error', message: 'No valid schema section found' });
    return issues;
  }

  const settings = schema.settings || [];

  // Check font size counts (should be 13 each for mobile and desktop)
  settings.filter(s => s.id && s.id.includes('font_size') && s.type === 'select').forEach(s => {
    const count = (s.options || []).length;
    if (count !== 13) {
      issues.push({
        rule: 'font-size-count',
        severity: 'error',
        weight: 95,
        message: `Setting "${s.id}" has ${count} font size options, expected 13`
      });
    }
  });

  // Check color counts (should be 13)
  settings.filter(s => s.id && s.id.includes('color') && s.type === 'select').forEach(s => {
    const count = (s.options || []).length;
    if (count !== 13 && count !== 14) { // 14 for container (13 + transparent)
      issues.push({
        rule: 'color-count',
        severity: 'error',
        weight: 95,
        message: `Setting "${s.id}" has ${count} color options, expected 13 (or 14 for container)`
      });
    }
  });

  // Check font weight counts (should be 5)
  settings.filter(s => s.id && s.id.includes('font_weight') && s.type === 'select').forEach(s => {
    const count = (s.options || []).length;
    if (count !== 5) {
      issues.push({
        rule: 'weight-count',
        severity: 'error',
        weight: 95,
        message: `Setting "${s.id}" has ${count} font weight options, expected 5`
      });
    }
  });

  return issues;
}
```

### sync.sh Pattern for Project Distribution

```bash
#!/bin/bash
# sync.sh -- Distribute Fluid Creative OS to Claude Code and Cursor
# Usage: bash /path/to/fluid-creative-os/sync.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
CURSOR_DIR="$HOME/.cursor"

echo "=== Fluid Creative OS Sync ==="

# 1. Symlink project skills into Claude Code
echo "--- Claude Code Skills ---"
mkdir -p "$CLAUDE_DIR/skills"
for skill_dir in "$SCRIPT_DIR/skills"/*/; do
  skill_name="fluid-$(basename "$skill_dir")"
  ln -sfn "$skill_dir" "$CLAUDE_DIR/skills/$skill_name"
  echo "  Linked: $skill_name"
done

# 2. Copy skills to Cursor
echo "--- Cursor Skills ---"
mkdir -p "$CURSOR_DIR/skills"
for skill_dir in "$SCRIPT_DIR/skills"/*/; do
  skill_name="fluid-$(basename "$skill_dir")"
  dest="$CURSOR_DIR/skills/$skill_name"
  mkdir -p "$dest"
  cp -r "$skill_dir"* "$dest/"
  echo "  Copied: $skill_name"
done

# 3. Configure hooks (Claude Code only)
# Note: hooks are defined in .claude/settings.json within the project repo
# They activate automatically when the repo is opened in Claude Code

echo ""
echo "=== Sync Complete ==="
echo "Skills installed: $(ls -d "$SCRIPT_DIR/skills"/*/ 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "To use in Claude Code: claude --add-dir $SCRIPT_DIR"
echo "To use in Cursor: open the project in Cursor"
```

## Brand Source Content Analysis

### Source Document Inventory and Decomposition Map

| Source | Size | Target Role File(s) | Content Type |
|--------|------|---------------------|--------------|
| social-post-design-guide.md | 9.6K | design-tokens.md, voice-rules.md, layout-archetypes.md, social-post-specs.md, asset-usage.md | Colors, fonts, copy principles, layouts, brushstroke/circle rules |
| fluid-website-build-prompt.md | 43.2K | design-tokens.md (website colors/fonts), website-section-specs.md | Website-specific colors, typography, visual elements, page structure |
| GOLD_STANDARD_WORKFLOW.md | 10.9K | website-section-specs.md | Schema rules, validation checklist, button system |
| Manifesto.txt | 6.8K | voice-rules.md | Brand messaging, "Every Transaction Matters" narrative |
| What-Fluid-is.txt | 7.3K | voice-rules.md | Extended brand narrative, pain-point examples |
| 7 feature-specific copy docs | ~15K total | voice-rules.md (principles only), messaging reference | Feature-specific copy (secondary reference) |
| building-systematized-claude-skills.md | 29.4K | Skills architecture reference (informs skill design, not decomposed into brand doc) | Skill patterns, distribution, orchestration |

### Identified Source Conflicts to Resolve

| Topic | Source A | Source B | Resolution |
|-------|----------|----------|------------|
| Orange accent color | `#FF8B58` (social-post-design-guide) | `#FF5500` (fluid-website-build-prompt) | Both valid; context-tagged in design-tokens.md |
| Blue accent color | `#42b1ff` (social guide) | `#00AAFF` (website prompt) | Both valid; context-tagged |
| Green accent color | `#44b574` (social guide) | `#00E87A` (website prompt) | Both valid; context-tagged |
| Background color | `#000` pure black (social guide) | `#050505` / `#0a0a0a` (website prompt) | Social = `#000`; Website = `#050505`. Different contexts. |
| Body font | Inter as NeueHaas proxy (templates) | DM Sans (website prompt) | Templates use Inter/NeueHaas for social; Website uses DM Sans for body. Context-tagged. |
| Display font | NeueHaasDisplay (social guide) | Syne ExtraBold (website prompt) | Social = NeueHaas; Website = Syne. Different design systems. |
| Headline weight | 900 Black (social guide) | 800 ExtraBold (website prompt) | Context-specific; both documented |

### Asset Rename Mapping

| Current Name | Descriptive Name | Notes |
|-------------|-----------------|-------|
| brushstroke01.png | brushstroke-diagonal-sweep.png | Diagonal sweep, dynamic upward motion |
| brushstroke02.png | brushstroke-compact-burst.png | Compact burst, tight accent energy |
| brushstroke03.png | brushstroke-tall-vertical-a.png | Tall vertical, dramatic edge framing |
| brushstroke04.png | brushstroke-tall-vertical-b.png | Tall vertical variant |
| brushstroke05.png | brushstroke-wide-horizontal-a.png | Wide horizontal, grounding feel |
| brushstroke06.png | brushstroke-wide-horizontal-b.png | Wide horizontal variant |
| brushstroke07.png | brushstroke-diagonal-dynamic.png | Diagonal, dynamic motion |
| circle sketch 1.png | circle-sketch-emphasis.png | Primary emphasis circle |
| circle sketch 2.png | circle-sketch-emphasis-alt.png | Alternative emphasis circle |
| Frame 3.png | fluid-dots-mark.png | Fluid dots logo mark |
| We-Commerce Built.png | wecommerce-built-badge.png | "Built on We-Commerce" badge |
| We-Commerce Flags.png | wecommerce-flags-icon.png | Flag icon for footer |
| We-Commerce Logos.png | wecommerce-wordmark.png | We-Commerce wordmark |

**Note:** Actual brushstroke characteristics should be verified visually during implementation. The descriptions above are based on the design guide's categorization, not visual inspection.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` only | `.claude/skills/` with supporting files | Claude Code 2.0 (late 2025) | Skills can have subdirectories, supporting files, frontmatter control |
| Manual skill loading | `skills` field on agents preloads content | Claude Code 2.0 | Subagents receive full skill content at startup; no discovery needed |
| Global permission prompts | `allowed-tools` in skill frontmatter | Claude Code 2.0 | Skills can grant tool access without per-use approval |
| No hook system | `PreToolUse`/`PostToolUse` hooks | Claude Code 2.0 | File-write validation can be automatic, not manual |
| `invoke: slash/always/trigger` in ~/.agents | `name`/`description`/`disable-model-invocation`/`user-invocable` in .claude/skills | Claude Code 2.0 | More granular control; hot reload; no sync needed for project skills |

**Deprecated/outdated:**
- The `invoke` field from `~/.agents/` SKILL.md format still works (sync.sh handles it) but `.claude/skills/` format uses different frontmatter. Both can coexist.
- `~/.agents/sync.sh` remains the authoritative distribution tool for USER-LEVEL skills. Project-level skills use `.claude/skills/` directly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:assert` + shell scripts |
| Config file | None needed -- tests are standalone Node.js scripts |
| Quick run command | `node tools/brand-compliance.cjs test/sample-bad.html` |
| Full suite command | `bash tools/test-all.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | Subagent loads 3-6 focused docs | manual (verify doc count per role) | N/A -- structural review | Wave 0 |
| BRAND-02 | Design tokens have all 7 colors, 4 fonts, spacing | unit | `node tools/compile-rules.cjs --validate` | Wave 0 |
| BRAND-03 | Voice rules contain all 6 principles | unit | `grep -c "Weight:" brand/voice-rules.md` | Wave 0 |
| BRAND-04 | Layout archetypes contain all 6 types | unit | `grep -c "^###" brand/layout-archetypes.md` | Wave 0 |
| BRAND-05 | Asset index lists all 13 assets | unit | `node tools/validate-asset-index.cjs` | Wave 0 |
| BRAND-06 | Pattern Library renders without errors | smoke | `open patterns/index.html` (manual browser check) | Wave 0 |
| BRAND-07 | Wiki links resolve to existing files | unit | `node tools/check-links.cjs brand/` | Wave 0 |
| BRAND-08 | Every rule has a numeric weight | unit | `node tools/compile-rules.cjs --validate` | Wave 0 |
| CLI-01 | Schema validation reports missing options | unit | `node tools/schema-validation.cjs test/sample-bad.liquid` | Wave 0 |
| CLI-02 | Brand compliance reports violations | unit | `node tools/brand-compliance.cjs test/sample-bad.html` | Wave 0 |
| CLI-03 | Dimension check reports mismatches | unit | `node tools/dimension-check.cjs test/sample-wrong-size.html` | Wave 0 |
| CLI-04 | Scaffold generates valid Gold Standard skeleton | unit | `node tools/scaffold.cjs test-section && node tools/schema-validation.cjs test-section/index.liquid` | Wave 0 |
| DIST-01 | Repo has all required directories | smoke | `ls brand/ assets/ tools/ skills/ patterns/ templates/ feedback/` | Wave 0 |
| DIST-02 | Install instructions are machine-readable | manual | Agent follows install.md end-to-end | Wave 0 |
| DIST-03 | sync.sh installs to both platforms | integration | `bash sync.sh && ls ~/.claude/skills/fluid-*` | Wave 0 |
| META-03 | Skills 2.0 patterns documented | manual | Research doc reviewed (this file) | Done |
| META-04 | Superpowers patterns documented | manual | Research doc reviewed (this file) | Done |

### Sampling Rate
- **Per task commit:** `node tools/brand-compliance.cjs test/sample-bad.html && node tools/schema-validation.cjs test/sample-bad.liquid`
- **Per wave merge:** `bash tools/test-all.sh`
- **Phase gate:** Full suite green + manual verification of success criteria 1-5

### Wave 0 Gaps
- [ ] `test/sample-bad.html` -- HTML file with intentional brand violations (wrong colors, wrong fonts)
- [ ] `test/sample-bad.liquid` -- .liquid file with incomplete schema (missing font sizes, colors, weights)
- [ ] `test/sample-wrong-size.html` -- HTML file with wrong dimensions
- [ ] `test/sample-good.html` -- HTML file that passes all checks (golden file)
- [ ] `test/sample-good.liquid` -- .liquid file that passes schema validation
- [ ] `tools/test-all.sh` -- Runner script that executes all validation tools against test fixtures
- [ ] `tools/check-links.cjs` -- Wiki link validator for brand/ directory
- [ ] `tools/validate-asset-index.cjs` -- Asset index completeness checker

## Open Questions

1. **NeueHaasDisplay font licensing**
   - What we know: Templates use Inter as a proxy for NeueHaasDisplay. The actual NeueHaas font files are not in the repo.
   - What's unclear: Should design-tokens.md reference NeueHaasDisplay as the canonical font (for production) with Inter as the development proxy? Or should it reference Inter directly?
   - Recommendation: Document both with a note: "Production: NeueHaasDisplay; Development/templates: Inter Variable (same weight scale)"

2. **Pattern Library scope for Phase 1**
   - What we know: Must render every building block at multiple sizes with code snippets.
   - What's unclear: Should it include website-specific elements (buttons, section layouts) or only social post elements (brushstrokes, circles, footer)?
   - Recommendation: Phase 1 focuses on shared brand elements (brushstrokes, circles, FLFont, footer, color swatches, typography scale). Website-specific patterns (button system, section layouts) added in Phase 3.

3. **Cursor distribution mechanism**
   - What we know: sync.sh copies skill files to `~/.cursor/skills/` and generates `.mdc` rules in `~/.cursor/rules/`
   - What's unclear: Does Cursor support `--add-dir` equivalent for automatic skill discovery?
   - Recommendation: Use sync.sh for Cursor (copy files), and document `--add-dir` as the Claude Code-specific path. Test both during implementation.

## Sources

### Primary (HIGH confidence)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Full frontmatter reference, skill directory structure, invocation control, hook integration
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Custom agent definitions, skills preloading, permission modes, memory
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - PostToolUse events, hook configuration in settings.json and frontmatter
- Existing `~/.agents/sync.sh` (413 lines) - Proven distribution pipeline; directly inspected
- `Reference/Brand reference material/Design Guides/social-post-design-guide.md` - Primary brand token source
- `Reference/Brand reference material/Website/Gold Standard/GOLD_STANDARD_WORKFLOW.md` - Schema validation requirements
- `Reference/Brand reference material/Website/fluid-website-build-prompt.md` - Website-specific brand tokens

### Secondary (MEDIUM confidence)
- [Superpowers GitHub Repository](https://github.com/obra/superpowers) - Methodology patterns; applicable but not installed
- [Claude Code Agent Skills 2.0 - Medium article](https://medium.com/@richardhightower/claude-code-agent-skills-2-0-from-custom-instructions-to-programmable-agents-ab6e4563c176) - Feature overview; verified against official docs
- `Reference/Skills reference material/building-systematized-claude-skills.md` - Skill architecture patterns from GSD reverse-engineering

### Tertiary (LOW confidence)
- Asset descriptive names (brushstroke categorization) - Based on design guide text descriptions, not visual inspection of actual PNG files. Should be verified visually during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - User decisions locked; Node.js zero-dependency, markdown, bash are all proven
- Architecture: HIGH - Skill file format verified against official docs; sync.sh pattern directly inspected
- Brand decomposition: HIGH - All source docs read; conflicts identified and resolution strategy documented
- CLI tools: HIGH - Gold Standard doc provides exact validation requirements; code patterns straightforward
- Pitfalls: MEDIUM - Some pitfalls (font confusion, color conflicts) verified from source analysis; others (schema counting edge cases) based on experience
- Distribution: MEDIUM - Claude Code --add-dir verified in docs; Cursor equivalent not confirmed

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain; brand docs don't change frequently)
