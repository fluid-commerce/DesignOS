# Phase 4: Canvas + Iteration - Research

**Researched:** 2026-03-10
**Domain:** React canvas app + MCP server for asset iteration workflow
**Confidence:** HIGH

## Summary

Phase 4 builds a self-contained React app (`canvas/`) that displays generated HTML assets side-by-side in sandboxed iframes, supports spatial and sidebar annotations, visualizes iteration trajectory as a branching timeline, and exposes an MCP server so agents can push assets, read annotations, and receive iteration requests. The entire system watches `.fluid/working/` for filesystem changes and auto-refreshes.

The technical surface is well-understood: Vite + React for the UI, `@modelcontextprotocol/sdk` for the MCP server (stdio transport), chokidar for filesystem watching, and a JSON-file-based persistence model (annotations.json alongside existing lineage.json). No database, no authentication, no real-time collaboration -- this is a local-first tool for a small team.

**Primary recommendation:** Build the canvas as a Vite/React app in `canvas/` with its own package.json. The MCP server runs as a separate stdio process (registered via `claude mcp add`), NOT embedded in the Vite dev server. The MCP server writes to `.fluid/working/` and the canvas watches for changes -- they communicate through the filesystem, not through each other.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Local Vite/React dev server in `canvas/` directory at repo root, self-contained with its own package.json
- Started via `/fluid-design-OS` slash command -- starts the dev server and opens in Claude Desktop's built-in browser
- Server runs persistently through a work session (start once, generate assets throughout the day, stop when done)
- `/fluid-design-OS stop` shuts down the server
- Repo is a standalone clone (e.g. `~/fluid-creative-os/`), not inside `~/.agents/skills/` -- it's a full project, not a lightweight skill
- Skill source in `.claude/skills/fluid-design-os/SKILL.md`, distributed via `sync.sh` (same pattern as existing skills)
- Canvas watches `.fluid/working/` directory inside the local repo clone (gitignored, never pushed to GitHub)
- All generation commands write to `Fluid Marketing Master Skills/.fluid/working/` regardless of where invoked
- All local sessions visible in a history sidebar (current + past sessions from `.fluid/working/`)
- Assets render in isolated iframes at native dimensions (1080x1080, 1200x627, etc.), scaled down visually for side-by-side comparison
- Both sidebar notes AND Figma-style spatial pin annotations (modeled after Figma's comment system -- click to pin, thread replies, numbered markers)
- Stored as `annotations.json` alongside assets in each session directory
- Both humans and agents can annotate -- each annotation tagged with author and type (human vs agent)
- Variations have structured statuses: round winner (best of batch), rejected, final (shipped/done), or unmarked (not reviewed)
- Branching tree that collapses: fans out when variations are generated, forces picking a winner before next round
- Shape is always: one in -> fan out -> pick one -> one in -> fan out -> pick one -> final
- Canvas enforces winner selection -- can't start a new refinement round until a winner is marked
- Liked parts of rejected variations captured via regular annotations (no special feature), agent reads all annotations when iterating
- Prompts and refinement instructions shown collapsed at each round step, click to reveal
- Full revision history accessible so agent never repeats rejected patterns
- Triggerable from both canvas UI and Claude Desktop
- Canvas UI: type plain feedback, click Iterate -- canvas bundles full context (winner, session, annotations, rejection history) and sends to agent via MCP
- Claude Desktop: type a prompt with /fluid-social or similar -- agent writes to .fluid/working/, canvas detects and displays
- Canvas UI refinements appear in Claude Desktop too, so conversation can continue there
- MCP server runs as part of the canvas dev server (single process, single start/stop)
- Agent capabilities via MCP: push new assets, read annotations, read variation statuses, receive iteration requests, access full revision history
- Agent pulls annotation data on demand (no real-time push/websocket needed)
- Canvas detects new files via filesystem watcher (chokidar/fs.watch) -- instant UI refresh when agent writes

### Claude's Discretion
- React framework choices (component library, state management, routing)
- MCP protocol implementation details
- Exact filesystem watcher implementation
- Canvas UI layout and styling
- How context bundling works internally when sending iteration requests
- Port selection and dev server configuration

### Deferred Ideas (OUT OF SCOPE)
- Shared team workspace / centralized asset library -- multi-user access, shared storage, curated finals vs drafts. Own phase.
- Per-user feedback branches -- each user's documented feedback saved to their own git branch, regularly pushed to remote, merged together for batch ingestion in Phase 5.
- Auto-update mechanism (DIST-04) -- how the team stays current when the repo updates.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANV-01 | Bare MVP canvas tool -- React app that displays multiple HTML asset variations side-by-side on one page | Vite + React with iframe srcDoc rendering, CSS transform scaling for side-by-side layout |
| CANV-02 | Canvas supports text annotations/comments on each variation | annotations.json format with sidebar notes + spatial pin annotations, persisted per session |
| CANV-03 | Canvas documents iteration trajectory (initial -> variations -> selected winner -> further iterations -> final) | Extends lineage.json with round/status tracking, branching timeline UI component |
| CANV-04 | MCP server so agents can push generated assets to canvas and receive annotations back | @modelcontextprotocol/sdk stdio server with tools for push/read/iterate operations |
| CANV-05 | Variation generation -- skill that produces multiple variations of an asset for comparison in canvas | Existing `--variations N` flag in fluid-social skill; canvas auto-detects multi-variation sessions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | User decision locked. Industry standard for this kind of interactive tool |
| Vite | 6.x | Dev server + bundler | User decision locked. Fast HMR, built-in React support |
| @modelcontextprotocol/sdk | latest | MCP server implementation | Official TypeScript SDK for Model Context Protocol |
| zod | 3.x | MCP input schema validation | Required companion to MCP SDK for tool input schemas |
| chokidar | 4.x | Filesystem watching | Industry standard, used internally by Vite itself |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | 5.x | Type safety | Entire canvas app and MCP server |
| zustand | 5.x | State management | Lightweight store for canvas state (sessions, selections, annotations). Simpler than Redux for this scope |
| nanoid | 5.x | ID generation | Annotation IDs, pin IDs. Tiny, no dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand | React context + useReducer | Sufficient for small state; zustand scales better as annotation model grows |
| chokidar | Node.js fs.watch | fs.watch is unreliable across platforms; chokidar handles edge cases |
| Separate MCP process | Embedded in Vite dev server | CONTEXT.md says "single process" but MCP stdio transport requires its own process; reconcile via a launcher script |

**Installation:**
```bash
cd canvas && npm init -y
npm install react react-dom @modelcontextprotocol/sdk zod chokidar zustand nanoid
npm install -D typescript @types/react @types/react-dom @types/node vite @vitejs/plugin-react
```

## Architecture Patterns

### Recommended Project Structure
```
canvas/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with sidebar + canvas layout
│   ├── store/
│   │   ├── sessions.ts           # zustand store: session list, active session
│   │   └── annotations.ts       # zustand store: annotations for active session
│   ├── components/
│   │   ├── SessionSidebar.tsx    # History sidebar listing all sessions
│   │   ├── VariationGrid.tsx     # Side-by-side iframe grid
│   │   ├── AssetFrame.tsx        # Individual iframe with scaling + overlay
│   │   ├── AnnotationPin.tsx     # Spatial pin marker (Figma-style)
│   │   ├── AnnotationThread.tsx  # Thread panel for a pin
│   │   ├── SidebarNotes.tsx      # Sidebar annotation panel
│   │   ├── StatusBadge.tsx       # Winner/rejected/final/unmarked badge
│   │   ├── Timeline.tsx          # Branching iteration timeline
│   │   ├── TimelineNode.tsx      # Single round node in timeline
│   │   ├── IteratePanel.tsx      # Feedback input + Iterate button
│   │   └── PromptReveal.tsx      # Collapsible prompt/instruction display
│   ├── hooks/
│   │   ├── useFileWatcher.ts     # WebSocket hook for fs change events
│   │   └── useAnnotations.ts    # Load/save annotations.json
│   ├── lib/
│   │   ├── types.ts              # Shared type definitions
│   │   ├── sessions.ts           # Session discovery + loading logic
│   │   └── context-bundler.ts    # Bundle context for iteration requests
│   └── server/
│       ├── watcher.ts            # Express middleware: chokidar -> WebSocket events
│       └── api.ts                # Express routes: read/write annotations, sessions
├── mcp/
│   ├── server.ts                 # MCP stdio server entry point
│   ├── tools/
│   │   ├── push-asset.ts         # Tool: push new asset to .fluid/working/
│   │   ├── read-annotations.ts   # Tool: read annotations for a session
│   │   ├── read-statuses.ts      # Tool: read variation statuses
│   │   ├── read-history.ts       # Tool: full revision history
│   │   └── iterate.ts           # Tool: receive iteration request from canvas
│   └── types.ts                  # MCP-specific type definitions
└── scripts/
    ├── start.sh                  # Launches both Vite dev server + MCP server
    └── stop.sh                   # Kills both processes
```

### Pattern 1: iframe srcDoc with CSS Transform Scaling
**What:** Render each HTML asset in an isolated iframe using `srcDoc`, then CSS transform the iframe container to fit the comparison grid.
**When to use:** Always -- every asset variation renders this way.
**Example:**
```typescript
// Source: React iframe best practices + MDN srcDoc
interface AssetFrameProps {
  html: string;
  nativeWidth: number;   // e.g. 1080
  nativeHeight: number;  // e.g. 1080
  displayWidth: number;  // e.g. 400 (grid column width)
}

function AssetFrame({ html, nativeWidth, nativeHeight, displayWidth }: AssetFrameProps) {
  const scale = displayWidth / nativeWidth;
  const displayHeight = nativeHeight * scale;

  return (
    <div style={{ width: displayWidth, height: displayHeight, overflow: 'hidden', position: 'relative' }}>
      <iframe
        srcDoc={html}
        sandbox="allow-same-origin"
        style={{
          width: nativeWidth,
          height: nativeHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          border: 'none',
          pointerEvents: 'none', // prevent interaction with asset content
        }}
      />
      {/* Annotation overlay sits on top of the scaled iframe */}
      <div
        style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
        onClick={handlePinClick}
      />
    </div>
  );
}
```

### Pattern 2: Filesystem Watcher to WebSocket Bridge
**What:** Vite dev server custom plugin or Express middleware that watches `.fluid/working/` with chokidar and pushes change events to the browser via WebSocket.
**When to use:** For instant UI refresh when agent writes new files.
**Example:**
```typescript
// Source: Vite plugin API + chokidar docs
import { watch } from 'chokidar';
import type { Plugin } from 'vite';

export function fluidWatcherPlugin(workingDir: string): Plugin {
  return {
    name: 'fluid-watcher',
    configureServer(server) {
      const watcher = watch(workingDir, {
        ignoreInitial: true,
        depth: 3,
      });

      watcher.on('all', (event, path) => {
        // Send custom HMR event to browser
        server.ws.send({
          type: 'custom',
          event: 'fluid:file-change',
          data: { event, path },
        });
      });
    },
  };
}

// In browser:
if (import.meta.hot) {
  import.meta.hot.on('fluid:file-change', (data) => {
    // Refresh session list or reload active session
    refreshSessions();
  });
}
```

### Pattern 3: MCP Stdio Server (Separate Process)
**What:** The MCP server is a standalone Node.js process using stdio transport, registered in Claude Code/Desktop config. It reads/writes the same `.fluid/working/` directory.
**When to use:** For all agent-to-canvas communication.
**Example:**
```typescript
// Source: https://modelcontextprotocol.io/docs/develop/build-server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "fluid-canvas",
  version: "1.0.0",
});

server.registerTool(
  "read_annotations",
  {
    description: "Read all annotations for a session",
    inputSchema: {
      sessionId: z.string().describe("Session ID (e.g. 20260310-143022)"),
    },
  },
  async ({ sessionId }) => {
    const annotationsPath = path.join(WORKING_DIR, sessionId, 'annotations.json');
    const data = await fs.readFile(annotationsPath, 'utf-8').catch(() => '{"annotations":[]}');
    return { content: [{ type: "text", text: data }] };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 4: Annotation Data Model
**What:** `annotations.json` sits alongside assets in each session directory, storing both sidebar notes and spatial pins.
**When to use:** Every session that has annotations.
**Example:**
```typescript
// annotations.json schema
interface AnnotationFile {
  sessionId: string;
  annotations: Annotation[];
  statuses: Record<string, VariationStatus>; // keyed by variation path
}

interface Annotation {
  id: string;
  type: 'sidebar' | 'pin';
  author: string;           // human name or "agent"
  authorType: 'human' | 'agent';
  variationPath: string;    // which variation this annotates
  text: string;
  createdAt: string;        // ISO 8601
  // Pin-specific (only when type === 'pin')
  x?: number;               // percentage 0-100 (relative to asset)
  y?: number;               // percentage 0-100
  pinNumber?: number;        // sequential marker number
  replies?: AnnotationReply[];
}

interface AnnotationReply {
  id: string;
  author: string;
  authorType: 'human' | 'agent';
  text: string;
  createdAt: string;
}

type VariationStatus = 'winner' | 'rejected' | 'final' | 'unmarked';
```

### Pattern 5: Extended Lineage for Iteration Trajectory
**What:** Extend the existing `lineage.json` to track multi-round iteration with winner/rejection history.
**When to use:** Every session that goes through iteration.
**Example:**
```typescript
// Extended lineage.json structure (builds on Phase 2 format)
interface Lineage {
  sessionId: string;
  created: string;
  platform: string;
  product: string | null;
  template: string | null;
  rounds: Round[];          // NEW: replaces flat entries[] for iteration
}

interface Round {
  roundNumber: number;
  prompt: string;           // prompt or refinement instruction for this round
  variations: Variation[];
  winnerId: string | null;  // path of winner, null if not yet selected
  timestamp: string;
}

interface Variation {
  id: string;               // e.g. "v1", "v2"
  path: string;             // relative path to styled.html
  status: VariationStatus;
  specCheck: 'pass' | 'fail' | 'draft';
}
```

### Anti-Patterns to Avoid
- **Embedding MCP in the Vite process:** CONTEXT.md says "single process" but MCP stdio transport fundamentally requires a separate process (stdin/stdout are the communication channel). Resolve with a launcher script that starts both. The canvas and MCP server share the filesystem, not a process.
- **Using localStorage for annotations:** Annotations must be file-based (annotations.json) so the MCP server can read them. Browser-only storage is invisible to agents.
- **Polling for file changes:** Use chokidar's event-driven watching, not setInterval polling. Vite's WebSocket channel delivers events to the browser in real-time.
- **Rendering HTML with dangerouslySetInnerHTML:** Always use iframe srcDoc for asset rendering. Assets may contain conflicting CSS/JS. Iframes provide full isolation.
- **Trying to make the canvas a full design tool:** This is a review and iteration coordination tool, not Figma. Keep interactions simple: view, annotate, set status, iterate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol implementation | Custom JSON-RPC over stdio | `@modelcontextprotocol/sdk` | Protocol has many edge cases (initialization, capability negotiation, error handling) |
| Filesystem watching | Custom fs.watch wrapper | chokidar v4 | Cross-platform reliability, debouncing, recursive watching |
| State management | Custom pub/sub or context hell | zustand | Minimal API, works outside React components (MCP server integration), devtools |
| ID generation | `Math.random().toString(36)` | nanoid | Collision resistance, URL-safe, tiny |
| WebSocket to browser | Custom WS server | Vite's built-in HMR WebSocket | Already running, supports custom events, reconnects automatically |

**Key insight:** The canvas app is a coordination layer, not a rendering engine. The hard parts (asset generation, brand compliance, orchestration) are already solved in Phases 1-3. Keep the canvas thin and focused on viewing, annotating, and triggering iteration.

## Common Pitfalls

### Pitfall 1: iframe Scaling vs Click Coordinates
**What goes wrong:** When CSS transform scales an iframe down, click coordinates on the overlay don't match the visual position within the asset.
**Why it happens:** The overlay div is at display size but the iframe content is at native size. Mouse coordinates need to be mapped from display space to asset space.
**How to avoid:** Store pin positions as percentages (0-100) of the native asset dimensions. Convert click coordinates: `pinX = (clickX / displayWidth) * 100`, `pinY = (clickY / displayHeight) * 100`. Render pins using the same percentage positioning on the overlay.
**Warning signs:** Pins appear offset from where the user clicked.

### Pitfall 2: MCP Server stdout Contamination
**What goes wrong:** MCP stdio transport uses stdout for JSON-RPC messages. Any `console.log()` in the MCP server corrupts the protocol stream.
**Why it happens:** Developers habit of using console.log for debugging.
**How to avoid:** Use `console.error()` exclusively in MCP server code. Set up a linter rule or use a logger that writes to stderr.
**Warning signs:** "Parse error" or connection failures when Claude tries to use MCP tools.

### Pitfall 3: Race Condition on File Writes
**What goes wrong:** Agent writes multiple files rapidly (e.g., v1/styled.html, v2/styled.html, lineage.json). Chokidar fires events for each, triggering multiple UI refreshes that read partially-written files.
**Why it happens:** Filesystem writes are not atomic; watcher fires on each write.
**How to avoid:** Debounce the watcher callback (200-300ms). When refreshing a session, validate that expected files exist before rendering. Use a "ready" sentinel (e.g., check lineage.json last since it's written last in the pipeline).
**Warning signs:** Empty iframes, partial renders, JSON parse errors in the console.

### Pitfall 4: lineage.json Schema Evolution
**What goes wrong:** Phase 2's `lineage.json` has a flat `entries[]` array. Phase 4 needs a `rounds[]` structure with winner tracking. Existing sessions break if the schema changes without migration.
**Why it happens:** New features require new data shapes.
**How to avoid:** Make the canvas read both formats. Detect format by checking for `rounds` vs `entries` key. Convert old format to new on read (don't rewrite the file -- keep backward compatibility).
**Warning signs:** Old sessions don't display in the canvas.

### Pitfall 5: "Single Process" Misinterpretation
**What goes wrong:** Trying to embed MCP stdio server inside the Vite dev server. This is technically impossible -- stdio transport requires owning stdin/stdout of the process.
**Why it happens:** CONTEXT.md says "MCP server runs as part of the canvas dev server (single process, single start/stop)."
**How to avoid:** Interpret as "single start/stop" not "single OS process." The `/fluid-design-OS` skill starts both processes. The `/fluid-design-OS stop` skill kills both. From the user's perspective, it's one command. Under the hood, two processes.
**Warning signs:** MCP server silently fails or Vite dev server output corrupts MCP protocol.

## Code Examples

### MCP Registration in Claude Code
```bash
# Register the MCP server for the project (stdio transport)
claude mcp add --transport stdio --scope local fluid-canvas \
  -- node /path/to/fluid-creative-os/canvas/mcp/server.js
```

### Claude Desktop Config (alternative)
```json
{
  "mcpServers": {
    "fluid-canvas": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/fluid-creative-os/canvas/mcp/server.js"]
    }
  }
}
```

### Vite Config with Watcher Plugin
```typescript
// canvas/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fluidWatcherPlugin } from './src/server/watcher';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    fluidWatcherPlugin(path.resolve(__dirname, '../.fluid/working')),
  ],
  server: {
    port: 5174,  // avoid conflict with other Vite projects
    open: false, // skill opens browser, not Vite
  },
});
```

### Session Discovery
```typescript
// canvas/src/lib/sessions.ts
import fs from 'fs';
import path from 'path';

interface SessionSummary {
  id: string;
  created: string;
  platform: string;
  variationCount: number;
  hasAnnotations: boolean;
  latestRound: number;
}

export function discoverSessions(workingDir: string): SessionSummary[] {
  const entries = fs.readdirSync(workingDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && /^\d{8}-\d{6}$/.test(e.name))
    .map(e => {
      const sessionDir = path.join(workingDir, e.name);
      const lineagePath = path.join(sessionDir, 'lineage.json');
      const annotationsPath = path.join(sessionDir, 'annotations.json');
      const lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf-8'));
      return {
        id: e.name,
        created: lineage.created,
        platform: lineage.platform,
        variationCount: countVariations(sessionDir),
        hasAnnotations: fs.existsSync(annotationsPath),
        latestRound: lineage.rounds?.length ?? lineage.entries?.length ?? 1,
      };
    })
    .sort((a, b) => b.created.localeCompare(a.created)); // newest first
}
```

### Fluid-Design-OS Skill Pattern
```markdown
---
name: fluid-design-os
description: "Start/stop the Fluid Design OS canvas for viewing, annotating, and iterating on generated assets."
context: fork
argument-hint: '[stop]'
allowed-tools: Bash, Read
---

# If $ARGUMENTS contains "stop":
Run: kill $(cat /path/to/fluid-creative-os/canvas/.pid) 2>/dev/null
Print: "Canvas stopped."

# Otherwise (start):
1. Check if already running: test -f canvas/.pid && kill -0 $(cat canvas/.pid) 2>/dev/null
2. If running: print "Canvas already running at http://localhost:5174"
3. If not running:
   - cd canvas && npm run dev > /dev/null 2>&1 & echo $! > .pid
   - Wait 2 seconds for server startup
   - Print "Canvas running at http://localhost:5174"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP SSE transport | MCP stdio (local) or Streamable HTTP (remote) | 2025 | SSE is deprecated; use stdio for local servers |
| Chokidar v3 (CJS) | Chokidar v4 (ESM-only, Node 20+) | Nov 2025 | Must use ESM imports, requires Node 20+ |
| Create React App | Vite | 2023+ | CRA is unmaintained; Vite is the standard |

**Deprecated/outdated:**
- MCP SSE transport: Deprecated in favor of Streamable HTTP for remote servers. Use stdio for local.
- `console.log()` in MCP servers: Corrupts stdio protocol. Use `console.error()`.

## Open Questions

1. **How does canvas-to-agent iteration work mechanically?**
   - What we know: User types feedback in canvas, clicks Iterate, canvas bundles context and sends to agent via MCP. Agent reads the iteration request and generates new variations.
   - What's unclear: MCP tools are agent-initiated (agent calls tools), not server-push. The canvas can't "send" to the agent. The pattern must be: agent periodically checks for pending iteration requests, OR the canvas writes a request file that the orchestrator skill picks up.
   - Recommendation: Use a "pending iteration request" file (`.fluid/working/{sessionId}/iterate-request.json`). When user clicks Iterate, canvas writes this file. The `/fluid-design-OS` skill or a polling mechanism in Claude Desktop detects it. Agent reads via `read_iteration_request` MCP tool.

2. **Port collision handling**
   - What we know: Vite dev server needs a stable port.
   - What's unclear: User may have other Vite projects running.
   - Recommendation: Use port 5174 (Vite defaults to 5173). Add `strictPort: false` so Vite auto-increments if taken. Store actual port in `.pid` file or similar.

3. **lineage.json format migration**
   - What we know: Phase 2 established `entries[]` format. Phase 4 needs `rounds[]` with winner tracking.
   - What's unclear: Whether to migrate in-place or maintain two formats.
   - Recommendation: Read both formats, write new format for new sessions. Never rewrite old sessions' lineage.json.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (ships with Vite, zero-config for Vite projects) |
| Config file | `canvas/vitest.config.ts` -- Wave 0 |
| Quick run command | `cd canvas && npx vitest run --reporter=verbose` |
| Full suite command | `cd canvas && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANV-01 | Multiple HTML variations render in iframes side-by-side | unit | `cd canvas && npx vitest run src/__tests__/VariationGrid.test.tsx -x` | -- Wave 0 |
| CANV-02 | Annotations persist across page reloads | unit | `cd canvas && npx vitest run src/__tests__/annotations.test.ts -x` | -- Wave 0 |
| CANV-03 | Iteration timeline shows full trajectory | unit | `cd canvas && npx vitest run src/__tests__/Timeline.test.tsx -x` | -- Wave 0 |
| CANV-04 | MCP server tools respond correctly | unit | `cd canvas && npx vitest run mcp/__tests__/tools.test.ts -x` | -- Wave 0 |
| CANV-05 | Multi-variation sessions detected and displayed | unit | `cd canvas && npx vitest run src/__tests__/sessions.test.ts -x` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd canvas && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd canvas && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `canvas/vitest.config.ts` -- Vitest configuration
- [ ] `canvas/src/__tests__/VariationGrid.test.tsx` -- covers CANV-01
- [ ] `canvas/src/__tests__/annotations.test.ts` -- covers CANV-02
- [ ] `canvas/src/__tests__/Timeline.test.tsx` -- covers CANV-03
- [ ] `canvas/mcp/__tests__/tools.test.ts` -- covers CANV-04
- [ ] `canvas/src/__tests__/sessions.test.ts` -- covers CANV-05
- [ ] Framework install: `cd canvas && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [MCP Official Build Server Tutorial](https://modelcontextprotocol.io/docs/develop/build-server) -- TypeScript MCP server pattern with McpServer, StdioServerTransport, registerTool
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp) -- `claude mcp add` command, stdio/http transport options, scope levels, `.mcp.json` project config
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- Package installation, version

### Secondary (MEDIUM confidence)
- [Vite Server Options](https://vite.dev/config/server-options) -- Chokidar integration in Vite, custom HMR events
- [Chokidar GitHub](https://github.com/paulmillr/chokidar) -- v4 ESM-only, Node 20+ requirement
- [Figma Comment Performance Blog](https://www.figma.com/blog/improving-scrolling-comments-in-figma/) -- Spatial comment pin rendering strategy (overlay container + CSS translate)
- [React iframe Best Practices](https://blog.logrocket.com/best-practices-react-iframes/) -- srcDoc usage, sandbox attribute, isolation

### Tertiary (LOW confidence)
- Canvas-to-agent iteration flow mechanics -- inferred from MCP protocol constraints (tools are agent-initiated). Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official MCP SDK docs verified, Vite/React well-established
- Architecture: HIGH - Filesystem-based communication is simple and proven. MCP stdio pattern is well-documented.
- Pitfalls: HIGH - Known from MCP docs (stdout contamination) and general web dev (iframe scaling, race conditions)
- Canvas-to-agent flow: MEDIUM - MCP protocol is agent-pull, not server-push. Iteration request mechanism is inferred but reasonable.

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days -- stable technologies, MCP SDK is mature)
