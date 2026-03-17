# Phase 4: Canvas + Iteration - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

React app for viewing, comparing, annotating, and documenting the full iteration path of generated assets. Includes an MCP agent bridge so agents can push assets, read annotations, and receive iteration requests without manual file copying. Does NOT include shared team workspace, centralized asset library, or auto-update distribution — those are future work.

</domain>

<decisions>
## Implementation Decisions

### Canvas app access
- Local Vite/React dev server in `canvas/` directory at repo root, self-contained with its own package.json
- Started via `/fluid-design-OS` slash command — starts the dev server and opens in Claude Desktop's built-in browser
- Server runs persistently through a work session (start once, generate assets throughout the day, stop when done)
- `/fluid-design-OS stop` shuts down the server
- Repo is a standalone clone (e.g. `~/fluid-creative-os/`), not inside `~/.agents/skills/` — it's a full project, not a lightweight skill
- Skill source in `.claude/skills/fluid-design-os/SKILL.md`, distributed via `sync.sh` (same pattern as existing skills)

### Asset loading
- Canvas watches `.fluid/working/` directory inside the local repo clone (gitignored, never pushed to GitHub)
- All generation commands write to `Fluid Marketing Master Skills/.fluid/working/` regardless of where invoked
- All local sessions visible in a history sidebar (current + past sessions from `.fluid/working/`)
- Assets render in isolated iframes at native dimensions (1080x1080, 1200x627, etc.), scaled down visually for side-by-side comparison

### Annotation model
- Both sidebar notes AND Figma-style spatial pin annotations (modeled after Figma's comment system — click to pin, thread replies, numbered markers)
- Stored as `annotations.json` alongside assets in each session directory
- Both humans and agents can annotate — each annotation tagged with author and type (human vs agent)
- Variations have structured statuses: round winner (best of batch), rejected, final (shipped/done), or unmarked (not reviewed)

### Iteration timeline
- Branching tree that collapses: fans out when variations are generated, forces picking a winner before next round
- Shape is always: one in → fan out → pick one → one in → fan out → pick one → final
- Canvas enforces winner selection — can't start a new refinement round until a winner is marked
- Liked parts of rejected variations captured via regular annotations (no special feature), agent reads all annotations when iterating
- Prompts and refinement instructions shown collapsed at each round step, click to reveal
- Full revision history accessible so agent never repeats rejected patterns

### Iteration triggering
- Triggerable from both canvas UI and Claude Desktop
- Canvas UI: type plain feedback, click Iterate — canvas bundles full context (winner, session, annotations, rejection history) and sends to agent via MCP
- Claude Desktop: type a prompt with /fluid-social or similar — agent writes to .fluid/working/, canvas detects and displays
- Canvas UI refinements appear in Claude Desktop too, so conversation can continue there

### MCP agent bridge
- MCP server runs as part of the canvas dev server (single process, single start/stop)
- Agent capabilities via MCP:
  - Push new assets (write to .fluid/working/, canvas auto-detects)
  - Read annotations back (pull annotations.json on demand)
  - Read variation statuses (winner, rejected, final)
  - Receive iteration requests from canvas UI (context-bundled refinement prompts)
  - Access full revision history (all rounds, all annotations, all rejections) so it never repeats rejected patterns
- Agent pulls annotation data on demand (no real-time push/websocket needed)
- Canvas detects new files via filesystem watcher (chokidar/fs.watch) — instant UI refresh when agent writes

### Claude's Discretion
- React framework choices (component library, state management, routing)
- MCP protocol implementation details
- Exact filesystem watcher implementation
- Canvas UI layout and styling
- How context bundling works internally when sending iteration requests
- Port selection and dev server configuration

</decisions>

<specifics>
## Specific Ideas

- "I maybe see this as a team shared workspace where we can see our whole body of work" — deferred to future phase, but the local history sidebar is the MVP stepping stone toward this
- "When they just give the feedback in the UI, does that also input the prompt into Claude Desktop?" — yes, canvas-to-agent flow sends context-bundled prompts that appear in Claude Desktop
- Spatial annotations modeled after Figma's comment system (click to pin, thread replies on each pin, numbered markers)
- "Agent has access to the whole revision history so that it knows not to go back to a pattern that the user already explicitly said they didn't like" — full trajectory context is critical
- `/fluid-design-OS` as the single entry point: boots canvas server + opens in Claude Desktop's built-in browser — the whole iteration workflow lives inside the tool you're already in

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lineage.json`: Already tracks prompt → archetype → accent color → platform → template → output path per session (Phase 2). Extends naturally to multi-round trajectory data.
- `.fluid/working/{sessionId}/` pattern: Session-based working directory already established. Canvas watches this directory.
- `.claude/skills/fluid-social/SKILL.md`: Orchestrator pattern with `--variations N` flag. Canvas iteration flow mirrors this.
- `feedback/README.md`: Structured feedback format (YAML frontmatter) already defined for Phase 5 ingestion.

### Established Patterns
- Orchestrator-subagent pipeline: copy → layout → styling → spec-check → fix loop (proven across social, sections, one-pagers)
- Session-based working directory with lineage.json for traceability
- CLI tools output dual format (JSON stdout + human stderr) — annotations.json follows same JSON-first approach
- Skills distributed via sync.sh to ~/.claude/commands/ and ~/.cursor/skills/

### Integration Points
- `.fluid/working/` moves from current-directory-relative to repo-root-relative — orchestrator skills need updating
- `/fluid-design-OS` skill triggers canvas server start — new skill type (process management, not generation)
- MCP server needs to be registered in Claude Desktop's MCP config (settings.json or similar)
- `annotations.json` is a new file format that spec-check agent and orchestrator need to read
- Canvas app requires `npm install` in `canvas/` — new install step beyond sync.sh

</code_context>

<deferred>
## Deferred Ideas

- **Shared team workspace / centralized asset library** — multi-user access, shared storage, curated finals vs drafts. Natural evolution of the local history sidebar but requires real infrastructure (database, hosted server, access controls). Own phase.
- **Per-user feedback branches** — each user's documented feedback saved to their own git branch, regularly pushed to remote, merged together for batch ingestion in Phase 5. Elegant collection mechanism for the learning loop.
- **Auto-update mechanism (DIST-04)** — how the team stays current when the repo updates. Already tracked as v2 requirement.

</deferred>

---

*Phase: 04-canvas-iteration*
*Context gathered: 2026-03-10*
