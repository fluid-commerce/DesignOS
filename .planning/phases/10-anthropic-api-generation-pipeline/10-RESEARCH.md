# Phase 11: Anthropic API Generation Pipeline - Research

**Researched:** 2026-03-16
**Domain:** Anthropic SDK (Node.js), server-side agentic pipeline, SSE streaming, tool use
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full pipeline: copy → layout → styling → spec-check → fix loop (max 3 iterations), all via Anthropic API
- Each stage is a separate API call with its own system prompt derived from the existing skill .md files
- Per-stage model selection: haiku for layout (mechanical/template matching), sonnet for creative stages (copy, styling, spec-check)
- Server orchestrates the pipeline — not the LLM chaining via Agent tool
- `@anthropic-ai/sdk` (Node.js) integrated into the Vite server middleware
- Reads `ANTHROPIC_API_KEY` from environment (user confirms key is in local env)
- Streaming API responses forwarded to chat sidebar via existing SSE infrastructure
- API agents get tool definitions for: reading brand docs, reading patterns, writing HTML output, running brand-compliance validation, reading/writing working files
- Server implements tool executor that handles tool calls and returns results
- Existing skill .md files (copy-agent, layout-agent, styling-agent, spec-check-agent) become system prompts for API calls — same files, different loading mechanism
- Designed so Phase 14 (DB-backed brand intelligence) can swap the read path to DB queries later
- Old `claude -p` code preserved but gated behind explicit flag (`?engine=cli` or similar)
- Default is always API — must be clear during testing when API isn't working
- Not a graceful auto-fallback; deliberate opt-in only

### Claude's Discretion
- Exact tool schema definitions and naming
- How skill .md files are parsed/transformed into system prompts (full content vs. extracted sections)
- SSE event format for streaming API responses (can reuse existing format or adapt)
- Error handling, retry logic, timeout configuration
- How the orchestrator tracks pipeline state between stages
- File output paths and working directory structure (may reuse existing .fluid/working/ pattern)

### Deferred Ideas (OUT OF SCOPE)
- DB-backed brand intelligence (Phases 11-15 in memory — would become Phases 12-16 or later)
- Auto-fallback to CLI on API failure (user explicitly wants hard failure so issues are visible)
- Multi-model routing optimization (start with simple per-stage assignment, optimize later)
- Cost tracking / token usage monitoring
- Caching of brand doc reads between pipeline stages
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | Install and configure `@anthropic-ai/sdk` in the Vite server | SDK install pattern, env var loading via `process.loadEnvFile` |
| API-02 | Implement server-side pipeline orchestrator for the 4-stage pipeline | Anthropic Messages API call pattern, multi-turn messages accumulation |
| API-03 | Define tool schemas for brand doc reading, file write, brand-compliance validation | Tool use `input_schema` format, tool result injection into message history |
| API-04 | Implement tool executor that handles tool calls and returns results | Tool use agentic loop pattern: detect `stop_reason: 'tool_use'`, execute, append `tool_result` |
| API-05 | Forward streaming API responses to chat sidebar via existing SSE infrastructure | `client.messages.stream()` with `.on('text')`, translate to existing SSE frame format |
| API-06 | Gate `claude -p` path behind `?engine=cli` query param; default to API path | Existing spawn path refactoring, flag detection in POST body |
| API-07 | Map skill .md files to system prompts for each pipeline stage | File read from disk (`fs.readFile`), inject as `system` param in API call |
</phase_requirements>

---

## Summary

Phase 11 replaces the current `spawn('claude', ['-p', ...])` generation with direct `@anthropic-ai/sdk` calls from inside the existing Vite middleware (`watcher.ts`). The key architectural shift: the orchestrator logic moves from Claude-as-agent (the spawned CLI process decides what to do) to server-as-orchestrator (the Vite server drives the pipeline stage by stage, making one API call per stage).

The existing SSE infrastructure is well-suited for this. The client (`useGenerationStream.ts`) reads a raw ReadableStream from the `/api/generate` response, parses SSE frames (`event: X\ndata: {...}\n\n`), and routes to the Zustand store. The stream-parser already handles `text_delta` events, `tool_use` starts, and `tool_result` completions. The server just needs to produce the same SSE frame format while pumping events from the Anthropic streaming response.

The pipeline design is sequential-within-a-creation: copy → layout → styling → spec-check → fix loop. The multi-creation parallel structure (one per channel) is retained from Phase 8. Instead of N child processes, there will be N concurrent `async` pipeline runners — one per creation — all sharing the same SSE connection for the campaign.

**Primary recommendation:** Build a `runApiPipeline(creation, prompt, res)` async function in a new `src/server/api-pipeline.ts` file, called in parallel for each creation from within the existing `/api/generate` handler, with the CLI path gated behind a `body.engine === 'cli'` check.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 (latest) | Anthropic Messages API client | Official SDK, streaming helpers, TypeScript types |
| Node.js built-ins (`fs`, `path`) | Node 24 (project) | File I/O for brand doc loading, HTML output | Already used throughout watcher.ts |

### Already Present (no install needed)
| Library | Version | Purpose |
|---------|---------|---------|
| `chokidar` | ^4.0.0 | File watching (unchanged) |
| `nanoid` | ^5.0.0 | ID generation (unchanged) |
| `better-sqlite3` | ^12.6.2 | DB operations (unchanged) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `@anthropic-ai/sdk` | Vercel AI SDK (`ai`) | AI SDK abstracts provider but adds a dependency layer; direct SDK gives full control over streaming event types |
| Manual tool loop | `anthropic.beta.messages.toolRunner()` | `toolRunner()` auto-loops but hides control flow — server needs to intercept tool calls to stream progress; manual loop is better |

**Installation:**
```bash
cd canvas && npm install @anthropic-ai/sdk
```

---

## Current Architecture (What Exists)

### Generation Endpoint (`/api/generate` in `watcher.ts`)

Two modes today:
1. **Iterate mode** (single-creation, legacy): detected by `body.sessionId && body.iterationContext`. Spawns one `claude -p` child process. SSE events: `data: {stream-json line}`, `event: stderr`, `event: done`.
2. **Campaign mode** (multi-creation): default. Pre-creates Campaign + N Creations + Slides + Iterations in SQLite. Spawns N parallel `claude` children. Each child's stdout is multiplexed onto the SSE connection with `creationId` field. `event: done` fires after all N children close.

The SSE frames the client reads:
```
data: {"type":"session","campaignId":"...","creationCount":7}\n\n   // first event
data: {"creationId":"...","line":"<NDJSON from claude stdout>"}\n\n  // per-child stdout
event: stderr\ndata: {"creationId":"...","text":"..."}\n\n            // per-child stderr
event: done\ndata: {"code":0,"campaignId":"..."}\n\n                  // final event
```

### Client SSE Consumption (`useGenerationStream.ts`)

Uses `fetch` + `response.body.getReader()` (not `EventSource`). Parses SSE frames manually. Routes:
- `eventType === 'done'` → `completeGeneration()`
- `parsed.type === 'session'` → `setSessionId()`, `setCampaignId()`
- `parsed.campaignId && parsed.line` → `parseStreamEvent(JSON.parse(parsed.line), undefined)`
- `eventType === 'stderr'` → `parseStreamEvent(parsed, 'stderr')`

### Stream Parser (`stream-parser.ts`)

Parses Claude CLI NDJSON format:
- `event.type === 'stream_event'` with inner `content_block_delta.delta.type === 'text_delta'` → `text` UI message
- `event.type === 'stream_event'` with inner `content_block_start.content_block.type === 'tool_use'` → `tool-start` UI message
- `event.type === 'tool_result'` → `tool-done` UI message
- `event.type === 'result'` → `status` UI message (generation complete)

### Skill Files (System Prompts)

The orchestrator skill (`fluid-social.md` at `~/.claude/commands/fluid-social.md`) drives the pipeline. It uses the Agent tool to delegate to copy, layout, styling, and spec-check agents. These agents do NOT exist as separate files — they are implicit in the delegation messages. For Phase 11, each stage's delegation message BECOMES the `system` prompt for a separate API call. The brand doc loading instructions (e.g., "read `brand/voice-rules.md`") become tool calls within each stage's API call.

### Brand Docs Location
All brand docs are flat files in `/Users/cheyrasmussen/Fluid-DesignOS/brand/`:
- `voice-rules.md` — copy agent context
- `social-post-specs.md` — copy + layout + styling
- `layout-archetypes.md` — layout agent context
- `design-tokens.md` — styling agent context
- `asset-usage.md` — styling agent context
- `asset-index.md` — optional supplementary

### Env Var Availability

The `.env` file lives at repo root. The Vite `envDir` config points to the parent directory, making `VITE_*` vars available as `import.meta.env` on the client. However, `process.env` in Vite server middleware does NOT automatically get `.env` values — Vite only exposes them to the client bundle. Node 24 provides `process.loadEnvFile()` as a native solution. The `ANTHROPIC_API_KEY` IS already in the `.env` file (`sk-ant-api03-...`).

---

## Architecture Patterns

### Recommended New File Structure

```
canvas/src/server/
├── watcher.ts          # existing — modify /api/generate to route on engine
├── db-api.ts           # existing — unchanged
└── api-pipeline.ts     # NEW — Anthropic API pipeline orchestrator
```

### Pattern 1: Per-Stage API Call with Tool Use

Each pipeline stage is an independent API call with:
- `system`: the stage's instruction prompt (derived from `fluid-social.md` delegation messages)
- `messages`: the user turn with the task prompt
- `tools`: the tool definitions for that stage
- `model`: stage-specific (`claude-haiku-4-5` or `claude-sonnet-4-5`)
- `stream: true` or `.stream()` for streaming

The tool executor runs synchronously between turns. When Claude returns `stop_reason: 'tool_use'`, the server:
1. Extracts the tool use blocks from `response.content`
2. Executes each tool (read file, write file, run bash command)
3. Appends the assistant message and a `tool_result` user message to the conversation
4. Calls the API again with the accumulated messages

This loop continues until `stop_reason: 'end_turn'`.

```typescript
// Source: Anthropic official tool use docs
// Pattern for manual agentic loop (server-controlled, not toolRunner)
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runStageWithTools(
  system: string,
  userPrompt: string,
  tools: Anthropic.Tool[],
  model: string,
  onText: (text: string) => void,
  onToolStart: (name: string) => void,
  onToolDone: (name: string) => void,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt }
  ];

  let finalOutput = '';

  while (true) {
    const response = await client.messages.create({
      model,
      system,
      max_tokens: 8192,
      tools,
      messages,
      stream: false, // non-streaming per stage for simplicity; stream text deltas separately
    });

    // Accumulate text for return value
    for (const block of response.content) {
      if (block.type === 'text') {
        finalOutput += block.text;
        onText(block.text);
      }
      if (block.type === 'tool_use') {
        onToolStart(block.name);
      }
    }

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      // Execute tools, collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
          onToolDone(block.name);
        }
      }
      // Append assistant turn and tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    } else {
      break; // unexpected stop_reason
    }
  }

  return finalOutput;
}
```

### Pattern 2: SSE Event Emission from API Pipeline

The API pipeline emits SSE events matching the format the client already understands. No changes to `useGenerationStream.ts` or `stream-parser.ts`.

```typescript
// Emit a text chunk (matches existing stream-json NDJSON format client parses)
function emitText(res: ServerResponse, creationId: string, text: string) {
  const ndjson = JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    },
  });
  res.write(`data: ${JSON.stringify({ creationId, line: ndjson })}\n\n`);
}

// Emit tool start
function emitToolStart(res: ServerResponse, creationId: string, name: string) {
  const ndjson = JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      content_block: { type: 'tool_use', name },
    },
  });
  res.write(`data: ${JSON.stringify({ creationId, line: ndjson })}\n\n`);
}

// Emit tool done
function emitToolDone(res: ServerResponse, creationId: string, name: string) {
  const ndjson = JSON.stringify({ type: 'tool_result', tool_name: name });
  res.write(`data: ${JSON.stringify({ creationId, line: ndjson })}\n\n`);
}

// Emit a stage status update (will render as 'status' UI message)
function emitStage(res: ServerResponse, creationId: string, stage: string) {
  const ndjson = JSON.stringify({ type: 'result', content: stage });
  res.write(`data: ${JSON.stringify({ creationId, line: ndjson })}\n\n`);
}
```

### Pattern 3: Engine Routing in `/api/generate`

Gate the CLI path behind `body.engine === 'cli'`. The existing campaign mode code becomes the `else` branch that is never hit by default.

```typescript
// In the /api/generate handler:
const engine = body.engine ?? 'api'; // default to API

if (engine === 'cli') {
  // ... existing spawn('claude', ...) code, unchanged
  return;
}

// API path: new campaign mode with Anthropic SDK
if (activeCampaignGeneration !== null) { /* 409 */ }
// ... pre-create Campaign/Creation/Slide/Iteration records (same as now)
// ... spawn N parallel runApiPipeline() calls
```

### Pattern 4: Skill .md Files as System Prompts

The orchestrator skill (`fluid-social.md`) contains delegation messages for each subagent. These delegation messages become the `user` prompt for each stage's API call. The system prompt for each stage is a condensed role description extracted from the delegation context.

For example, the copy stage system prompt is extracted from the copy-agent role:
```typescript
const COPY_AGENT_SYSTEM = `You are a Fluid brand copywriter. You generate marketing copy for social posts.
Your output is a structured .md file containing: headline, subtext, accent color choice, and archetype selection.
Load brand/voice-rules.md and brand/social-post-specs.md via the read_file tool to understand Fluid brand voice.
Write output to the path specified in your task.`;
```

Tools give agents dynamic doc loading — they call `read_file` to load the brand docs they need rather than having all docs stuffed into the system prompt upfront.

### Pattern 5: Tool Definitions for Agents

Each stage receives a curated subset of tools. All stages share a base set; some stages get additional write tools.

```typescript
// Source: Anthropic tool use format docs
const READ_FILE_TOOL: Anthropic.Tool = {
  name: 'read_file',
  description: 'Read a file from disk. Use to load brand docs, layouts, or HTML files.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or project-relative file path' },
    },
    required: ['path'],
  },
};

const WRITE_FILE_TOOL: Anthropic.Tool = {
  name: 'write_file',
  description: 'Write content to a file. Use to save generated copy, layouts, and styled HTML.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute file path to write' },
      content: { type: 'string', description: 'Full file content' },
    },
    required: ['path', 'content'],
  },
};

const RUN_CLI_TOOL: Anthropic.Tool = {
  name: 'run_brand_check',
  description: 'Run brand-compliance CLI validation on an HTML file. Returns JSON result.',
  input_schema: {
    type: 'object',
    properties: {
      html_path: { type: 'string', description: 'Path to the HTML file to validate' },
    },
    required: ['html_path'],
  },
};

const LIST_FILES_TOOL: Anthropic.Tool = {
  name: 'list_files',
  description: 'List files in a directory. Use to discover brand assets or template files.',
  input_schema: {
    type: 'object',
    properties: {
      directory: { type: 'string', description: 'Directory path to list' },
      pattern: { type: 'string', description: 'Optional glob pattern filter' },
    },
    required: ['directory'],
  },
};
```

Tool stage assignments:
- **Copy agent**: `read_file`, `write_file`, `list_files`
- **Layout agent**: `read_file`, `write_file`, `list_files`
- **Styling agent**: `read_file`, `write_file`, `list_files`
- **Spec-check agent**: `read_file`, `write_file`, `run_brand_check`
- **Fix agents**: same as the stage being fixed

### Anti-Patterns to Avoid

- **Do not use `anthropic.beta.messages.toolRunner()`** — it auto-loops without letting the server intercept events for SSE streaming.
- **Do not stuff all brand docs into the system prompt upfront** — tool use for dynamic loading is the design intent.
- **Do not create a new `Anthropic` client per request** — instantiate once at module load or plugin init.
- **Do not use `client.messages.stream()` for the pipeline stages** — streaming text deltas within a stage is a nice-to-have but adds complexity. Start with non-streaming per stage (accumulate and emit), then stream if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Anthropic API | Custom fetch wrapper | `@anthropic-ai/sdk` | Retry logic, streaming, TypeScript types, error handling all built in |
| SSE streaming | `EventSource` on server | `response.body.getReader()` pattern (already in use) | Client already implements this correctly |
| Tool schema validation | Custom JSON schema | SDK accepts plain object with `input_schema` field | SDK validates and types the response |
| Env loading | Custom parser | `process.loadEnvFile(path)` (Node 20+, project is on Node 24) | Single line, no dependency |

**Key insight:** The tool executor (reading files, writing HTML, running brand checks) is simple synchronous Node.js code — `fs.readFile`, `fs.writeFile`, `child_process.execSync` calling the existing CLI tools. Don't over-engineer the executor.

---

## Common Pitfalls

### Pitfall 1: `ANTHROPIC_API_KEY` not in `process.env` at Server Middleware Time

**What goes wrong:** Vite's `envDir` config makes `.env` vars available as `import.meta.env` for the client bundle, but does NOT inject them into `process.env` for server middleware code.
**Why it happens:** Vite deliberately defers env loading until after config resolution, and server-side code runs in the Node.js process where only shell-exported env vars exist.
**How to avoid:** At the top of `watcher.ts` (or `api-pipeline.ts`), call `process.loadEnvFile(path.resolve(__dirname, '../../.env'))`. Node 24 supports this natively. Alternatively, users can export the key in their shell session (`export ANTHROPIC_API_KEY=...`).
**Warning signs:** `AuthenticationError: 401 - {"type":"error","error":{"type":"authentication_error"...}}` on first API call.

### Pitfall 2: Multi-Turn Message Accumulation in Agentic Loop

**What goes wrong:** After Claude calls a tool, you must append BOTH the assistant's message (with the `tool_use` block) AND the `tool_result` user message before the next API call. Missing the assistant turn causes a 400 error.
**Why it happens:** The Anthropic API requires alternating user/assistant turns. The assistant's tool-use response must be included before the tool result.
**How to avoid:** Always `messages.push({ role: 'assistant', content: response.content })` before pushing the tool results.
**Warning signs:** `400 Bad Request: messages: roles must alternate between "user" and "assistant"`.

### Pitfall 3: Parallel Pipeline Runners Sharing a Closed Response Stream

**What goes wrong:** If one creation's pipeline throws an error and the response stream is ended, other parallel pipeline runners' `res.write()` calls throw `Error: write after end`.
**Why it happens:** The current campaign mode uses a shared `res` object. If any child triggers `res.end()` early, others fail.
**How to avoid:** Wrap all `res.write()` calls in try/catch; track a `streamEnded` flag on the shared response context. The existing campaign code already does this pattern — replicate it.

### Pitfall 4: Stage Output Path Injection

**What goes wrong:** The styling agent writes to the wrong path, or the spec-check agent reads stale HTML.
**Why it happens:** In the CLI path, Claude decides where to write files. With the API, the server must inject exact paths into the user prompt for each stage.
**How to avoid:** Each stage prompt must explicitly include the working file paths. E.g., `"Write your output to: /abs/path/to/{iterationId}/copy.md"`. The tool executor for `write_file` must validate the path is within the allowed working directory.

### Pitfall 5: Fix Loop Cascade Rule Ignored

**What goes wrong:** Spec-check finds a copy issue, copy is fixed, but layout and styling still use old copy — output looks inconsistent.
**Why it happens:** Easy to short-circuit the cascade — only re-run agents that have direct issues.
**How to avoid:** Implement the cascade rule from `fluid-social.md` Section 4: "If any copy fixes were applied, re-run layout-agent and styling-agent afterward." Track which fix_targets were touched in each iteration.

### Pitfall 6: `max_tokens` Budget Exhausted Mid-Generation

**What goes wrong:** Styling agent truncates mid-HTML because the token budget runs out.
**Why it happens:** Social post HTML with inline styles and base64 assets can exceed small token budgets.
**How to avoid:** Use `max_tokens: 8192` for all stages. Spec-check and fix stages may need up to 4096. Monitor `response.stop_reason === 'max_tokens'` and treat it as a failure with a clear error message.

---

## Code Examples

Verified patterns from official sources:

### Anthropic Client Initialization (Node.js Server Context)
```typescript
// Source: @anthropic-ai/sdk official docs, github.com/anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env file into process.env — Node 24 native, no dotenv needed
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../.env'));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // or just omit — SDK reads ANTHROPIC_API_KEY automatically
});
```

### Non-Streaming API Call with Tool Use (Per Stage)
```typescript
// Source: platform.claude.com/docs/en/build-with-claude/tool-use/overview
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20251022', // or 'claude-haiku-4-5-20251022' for layout
  system: stageSystemPrompt,
  max_tokens: 8192,
  tools: stageTools,
  messages,
});
// response.stop_reason: 'end_turn' | 'tool_use' | 'max_tokens'
// response.content: Array<TextBlock | ToolUseBlock>
```

### Tool Result Injection
```typescript
// Source: platform.claude.com/docs/en/build-with-claude/tool-use/overview
// After executing tool, append to messages:
messages.push({ role: 'assistant', content: response.content }); // required: include assistant turn
messages.push({
  role: 'user',
  content: toolUseBlocks.map((block) => ({
    type: 'tool_result' as const,
    tool_use_id: block.id,
    content: toolResult, // string or array of content blocks
  })),
});
```

### SSE Frame Emission Pattern (Compatible with Existing Client)
```typescript
// Source: watcher.ts existing implementation — maintain same format
// The client's stream-parser.ts handles these exact formats
function emitLine(res: ServerResponse, creationId: string, ndjson: string) {
  try {
    res.write(`data: ${JSON.stringify({ creationId, line: ndjson })}\n\n`);
  } catch { /* client disconnected */ }
}
```

### Pipeline Stage Progress SSE Events
```typescript
// Emit stage start (status message visible in chat sidebar)
function emitStageStart(res: ServerResponse, creationId: string, stage: string) {
  emitLine(res, creationId, JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: `[${stage}] Starting...\n` } }
  }));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude -p` spawn | Direct `@anthropic-ai/sdk` Messages API | Phase 11 | Full control over pipeline, no CLI startup overhead (~2s per spawn), structured tool use |
| Agent-driven orchestration (LLM decides steps) | Server-driven orchestration (code drives stages) | Phase 11 | Deterministic pipeline, easier debugging, clear stage boundaries |
| All brand docs in system prompt | Tool-based dynamic loading | Phase 11 | Smaller prompts, agents load only what they need |

**SDK version note:** `@anthropic-ai/sdk` 0.78.0 is current as of research date. The TypeScript SDK supports `client.messages.create()` with `tools`, `stream`, and multi-turn message arrays. The `toolRunner()` beta helper is available but NOT recommended for this use case (see Anti-Patterns).

**Model IDs confirmed current (March 2026):**
- `claude-sonnet-4-5-20251022` — creative stages (copy, styling, spec-check)
- `claude-haiku-4-5-20251022` — mechanical stage (layout)

---

## Open Questions

1. **Does `api-pipeline.ts` need to run in a Worker thread?**
   - What we know: The pipeline is async (awaiting API calls), not CPU-bound. Node.js event loop handles this fine for single-user dev tool.
   - What's unclear: Whether multiple parallel long-running API calls (7 creations × 4 stages) would starve other Vite requests.
   - Recommendation: Start on main thread. If latency issues arise, move to worker threads in a follow-up.

2. **Streaming text deltas within a stage vs. emitting only on stage completion**
   - What we know: The client already handles `text_delta` SSE events and shows them in real time. Non-streaming per stage means users see nothing until the stage is done.
   - What's unclear: Whether UX requires within-stage streaming or per-stage status updates are sufficient.
   - Recommendation: Start non-streaming (simpler, easier to debug). Emit a `[copy] Starting...` status at stage start and `[copy] Done` at stage end. Add within-stage streaming in a follow-up if UX requires it.

3. **Absolute path safety for the `write_file` tool**
   - What we know: The tool executor receives paths from Claude. Claude is given a working directory in the user prompt.
   - What's unclear: Whether Claude will stay within bounds or attempt to write outside the working dir.
   - Recommendation: Validate in the tool executor that the resolved path starts with the allowed `workingDir`. Throw a tool error if not. This is a security boundary.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `canvas/vitest.config.ts` |
| Quick run command | `cd canvas && npm test` |
| Full suite command | `cd canvas && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | SDK instantiates without error when ANTHROPIC_API_KEY is set | unit | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |
| API-02 | Pipeline orchestrator calls each stage in order, passes outputs between stages | unit (mock SDK) | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |
| API-03 | Tool schemas are valid JSON Schema objects with required fields | unit | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |
| API-04 | Tool executor handles `read_file`, `write_file`, `run_brand_check`, `list_files` | unit | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |
| API-05 | SSE events emitted by pipeline match format that stream-parser can parse | unit | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |
| API-06 | `?engine=cli` body param routes to spawn path; default routes to API path | unit | `cd canvas && npm test -- generate-endpoint` | ✅ existing (extend) |
| API-07 | System prompt for each stage contains correct brand doc loading instructions | unit | `cd canvas && npm test -- api-pipeline` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd canvas && npm test`
- **Per wave merge:** `cd canvas && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `canvas/src/__tests__/api-pipeline.test.ts` — covers API-01 through API-07
  - Mock `@anthropic-ai/sdk` client to avoid real API calls in tests
  - Test tool executor functions independently (pure functions → easy to test)
  - Test SSE emission format matches stream-parser expectations
- [ ] `canvas/src/server/api-pipeline.ts` — the implementation file itself
- [ ] SDK install: `cd canvas && npm install @anthropic-ai/sdk`

*(No framework changes needed — Vitest already configured for Node context via `environmentMatchGlobs`)*

---

## Sources

### Primary (HIGH confidence)
- Official Anthropic TypeScript SDK repo — `github.com/anthropics/anthropic-sdk-typescript` — streaming, tool use, agentic loop patterns
- `platform.claude.com/docs/en/build-with-claude/tool-use/overview` — tool use request/response format, TypeScript examples, multi-turn message accumulation
- `platform.claude.com/docs/en/api/messages-streaming` — SSE event types, streaming SDK usage
- `platform.claude.com/docs/en/api/client-sdks` — installation, quick start, TypeScript requirements

### Secondary (MEDIUM confidence)
- Codebase inspection: `canvas/src/server/watcher.ts` — existing SSE format, spawn pattern, route structure (direct read, HIGH confidence for this codebase)
- Codebase inspection: `canvas/src/hooks/useGenerationStream.ts` — SSE consumption pattern (direct read)
- Codebase inspection: `canvas/src/lib/stream-parser.ts` — NDJSON event types the client understands (direct read)
- Codebase inspection: `~/.claude/commands/fluid-social.md` — pipeline stage logic, delegation messages, fix loop rules (direct read)

### Tertiary (LOW confidence)
- npm search result stating `@anthropic-ai/sdk` 0.78.0 is latest — marked LOW, verify at install time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK is official, versions confirmed from search + docs
- Architecture: HIGH — based on direct codebase inspection + official API docs
- Pitfalls: HIGH — pitfalls 1-3 verified against current code patterns; pitfalls 4-6 from the orchestrator skill file logic
- SSE format compatibility: HIGH — stream-parser.ts directly inspected and mapped

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (SDK is stable; model IDs may update)
