/**
 * Agent core: tool-use loop with SSE streaming, conversation persistence,
 * and cancellation support.
 */

import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import * as path from 'path';
import { getDb } from '../lib/db';

// Load .env from repo root so ANTHROPIC_API_KEY is available
const envPaths = [
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];
for (const envPath of envPaths) {
  try {
    // @ts-ignore — process.loadEnvFile is Node 22.9+
    (process as any).loadEnvFile(envPath);
    break;
  } catch {}
}
import { buildSystemPrompt } from './agent-system-prompt';
import { buildBrandBrief } from './brand-brief';
import { withAgentContext, logChatEvent } from './observability';
import {
  listVoiceGuide,
  readVoiceGuide,
  listPatterns,
  readPattern,
  listAssets,
  listTemplates,
  readTemplate,
  listArchetypes,
  readArchetype,
  updatePattern,
  createPattern,
  deletePattern,
  updateVoiceGuide,
  createVoiceGuide,
  renderPreviewTool,
  saveCreation,
  editCreation,
  saveAsTemplate,
  getCreation,
  getCampaign,
} from './agent-tools';

import type { ServerResponse } from 'node:http';

// ─── Tool Definitions ───

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // Brand Discovery
  {
    name: 'list_voice_guide',
    description: 'List all voice guide documents with slug, title, and short description.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_voice_guide',
    description: 'Read the full content of a voice guide document by slug.',
    input_schema: {
      type: 'object' as const,
      properties: { slug: { type: 'string', description: 'Voice guide slug' } },
      required: ['slug'],
    },
  },
  {
    name: 'list_patterns',
    description: 'List brand patterns, optionally filtered by category (logos, colors, typography, images, decorations, archetypes).',
    input_schema: {
      type: 'object' as const,
      properties: { category: { type: 'string', description: 'Optional category filter' } },
      required: [],
    },
  },
  {
    name: 'read_pattern',
    description: 'Read the full content of a brand pattern by slug.',
    input_schema: {
      type: 'object' as const,
      properties: { slug: { type: 'string', description: 'Pattern slug' } },
      required: ['slug'],
    },
  },
  {
    name: 'list_assets',
    description: 'List brand assets (fonts, images, logos, decorations). Optionally filter by category.',
    input_schema: {
      type: 'object' as const,
      properties: { category: { type: 'string', description: 'Optional category filter' } },
      required: [],
    },
  },
  {
    name: 'list_templates',
    description: 'List all available templates with id, name, type, and description.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_template',
    description: 'Read a template by its numeric ID, including design rules.',
    input_schema: {
      type: 'object' as const,
      properties: { id: { type: 'number', description: 'Template ID' } },
      required: ['id'],
    },
  },
  {
    name: 'list_archetypes',
    description: 'List layout archetypes with slug, name, and slot labels.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_archetype',
    description: 'Read an archetype layout by slug, including HTML, schema, and notes.',
    input_schema: {
      type: 'object' as const,
      properties: { slug: { type: 'string', description: 'Archetype slug' } },
      required: ['slug'],
    },
  },

  // Brand Editing
  {
    name: 'update_pattern',
    description: 'Update the content of an existing brand pattern by slug.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Pattern slug' },
        content: { type: 'string', description: 'New markdown content' },
      },
      required: ['slug', 'content'],
    },
  },
  {
    name: 'create_pattern',
    description: 'Create a new brand pattern in a category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Pattern category' },
        name: { type: 'string', description: 'Pattern display name' },
        content: { type: 'string', description: 'Markdown content' },
      },
      required: ['category', 'name', 'content'],
    },
  },
  {
    name: 'delete_pattern',
    description: 'Delete a brand pattern by slug.',
    input_schema: {
      type: 'object' as const,
      properties: { slug: { type: 'string', description: 'Pattern slug' } },
      required: ['slug'],
    },
  },
  {
    name: 'update_voice_guide',
    description: 'Update the content of an existing voice guide document by slug.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Voice guide slug' },
        content: { type: 'string', description: 'New markdown content' },
      },
      required: ['slug', 'content'],
    },
  },
  {
    name: 'create_voice_guide',
    description: 'Create a new voice guide document.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Markdown content' },
      },
      required: ['title', 'content'],
    },
  },

  // Visual
  {
    name: 'render_preview',
    description: 'Render HTML to a screenshot image. Use this to check your work visually.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Self-contained HTML to render' },
        width: { type: 'number', description: 'Viewport width in pixels' },
        height: { type: 'number', description: 'Viewport height in pixels' },
      },
      required: ['html', 'width', 'height'],
    },
  },
  {
    name: 'save_creation',
    description: 'Save HTML as a new creation in a campaign. Returns IDs for the campaign, creation, slide, and iteration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Self-contained HTML' },
        slotSchema: { type: 'object', description: 'Slot schema mapping slot names to their configuration' },
        platform: { type: 'string', description: 'Platform/creation type (e.g. instagram, linkedin, one-pager)' },
        campaignId: { type: 'string', description: 'Optional existing campaign ID to add to' },
      },
      required: ['html', 'platform'],
    },
  },
  {
    name: 'edit_creation',
    description: 'Update the HTML of an existing iteration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        iterationId: { type: 'string', description: 'Iteration ID to edit' },
        html: { type: 'string', description: 'Updated HTML' },
        slotSchema: { type: 'object', description: 'Optional updated slot schema' },
      },
      required: ['iterationId', 'html'],
    },
  },
  {
    name: 'save_as_template',
    description: 'Save an existing iteration as a reusable template.',
    input_schema: {
      type: 'object' as const,
      properties: {
        iterationId: { type: 'string', description: 'Source iteration ID' },
        name: { type: 'string', description: 'Template name' },
        category: { type: 'string', description: 'Template category' },
      },
      required: ['iterationId', 'name', 'category'],
    },
  },

  // Context
  {
    name: 'get_ui_context',
    description: 'Get the current UI context passed from the frontend (active page, selected creation, etc.).',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_creation',
    description: 'Get full details of a creation iteration including slot schema and merged state.',
    input_schema: {
      type: 'object' as const,
      properties: { iterationId: { type: 'string', description: 'Iteration ID' } },
      required: ['iterationId'],
    },
  },
  {
    name: 'get_campaign',
    description: 'Get campaign details including all its creations.',
    input_schema: {
      type: 'object' as const,
      properties: { campaignId: { type: 'string', description: 'Campaign ID' } },
      required: ['campaignId'],
    },
  },
];

// ─── SSE Helper ───

export function sendSSE(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Cancellation ───
//
// A single chat can have multiple in-flight runAgent calls if the user double-sends.
// Track them as a Set<AbortController> so we don't lose the cancel handle for
// earlier sessions when a newer one registers under the same chatId. Abort
// propagates natively into anthropic.messages.create (via options.signal) and
// into signal-aware tool helpers (render_preview).

const activeSessions = new Map<string, Set<AbortController>>();

export function cancelChat(chatId: string): void {
  const controllers = activeSessions.get(chatId);
  if (!controllers) return;
  for (const c of controllers) {
    if (!c.signal.aborted) c.abort(new DOMException('Chat cancelled', 'AbortError'));
  }
}

// ─── Test hooks ─── (underscore-prefixed, not part of the public API)
export function __registerSessionForTests(chatId: string, ctrl: AbortController): void {
  let set = activeSessions.get(chatId);
  if (!set) {
    set = new Set();
    activeSessions.set(chatId, set);
  }
  set.add(ctrl);
}
export function __getActiveSessionCount(chatId: string): number {
  return activeSessions.get(chatId)?.size ?? 0;
}
export function __clearActiveSessionsForTests(): void {
  activeSessions.clear();
}

// ─── Tool Executor ───

function requireString(input: Record<string, any>, key: string): string {
  const v = input[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Tool input '${key}' must be a non-empty string`);
  }
  return v;
}

function requireNumber(input: Record<string, any>, key: string): number {
  const v = input[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Tool input '${key}' must be a finite number`);
  }
  return v;
}

async function executeTool(
  name: string,
  input: Record<string, any>,
  uiContext: Record<string, any> | null,
  signal: AbortSignal,
): Promise<Anthropic.ToolResultBlockParam['content']> {
  if (!input || typeof input !== 'object') {
    throw new Error(`Tool '${name}' called with invalid input`);
  }
  if (signal.aborted) throw new Error('Chat cancelled');
  switch (name) {
    // Brand Discovery
    case 'list_voice_guide':
      return JSON.stringify(listVoiceGuide());
    case 'read_voice_guide':
      return JSON.stringify(readVoiceGuide(input.slug));
    case 'list_patterns':
      return JSON.stringify(listPatterns(input.category));
    case 'read_pattern':
      return JSON.stringify(readPattern(input.slug));
    case 'list_assets':
      return JSON.stringify(listAssets(input.category));
    case 'list_templates':
      return JSON.stringify(listTemplates());
    case 'read_template':
      return JSON.stringify(readTemplate(input.id));
    case 'list_archetypes':
      return JSON.stringify(listArchetypes());
    case 'read_archetype':
      return JSON.stringify(readArchetype(input.slug));

    // Brand Editing
    case 'update_pattern':
      return JSON.stringify(updatePattern(requireString(input, 'slug'), requireString(input, 'content')));
    case 'create_pattern':
      return JSON.stringify(createPattern(requireString(input, 'category'), requireString(input, 'name'), requireString(input, 'content')));
    case 'delete_pattern':
      return JSON.stringify(deletePattern(requireString(input, 'slug')));
    case 'update_voice_guide':
      return JSON.stringify(updateVoiceGuide(requireString(input, 'slug'), requireString(input, 'content')));
    case 'create_voice_guide':
      return JSON.stringify(createVoiceGuide(requireString(input, 'title'), requireString(input, 'content')));

    // Visual
    case 'render_preview': {
      const result = await renderPreviewTool(
        requireString(input, 'html'),
        requireNumber(input, 'width'),
        requireNumber(input, 'height'),
        signal,
      );
      return [
        { type: 'text', text: 'Preview rendered successfully.' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: result.base64,
          },
        },
      ];
    }
    case 'save_creation':
      return JSON.stringify(saveCreation(
        requireString(input, 'html'),
        input.slotSchema ?? null,
        requireString(input, 'platform'),
        typeof input.campaignId === 'string' ? input.campaignId : undefined,
      ));
    case 'edit_creation':
      return JSON.stringify(editCreation(
        requireString(input, 'iterationId'),
        requireString(input, 'html'),
        input.slotSchema,
      ));
    case 'save_as_template':
      return JSON.stringify(saveAsTemplate(
        requireString(input, 'iterationId'),
        requireString(input, 'name'),
        requireString(input, 'category'),
      ));

    // Context
    case 'get_ui_context':
      return JSON.stringify(uiContext ?? { page: 'unknown' });
    case 'get_creation':
      return JSON.stringify(getCreation(input.iterationId));
    case 'get_campaign':
      return JSON.stringify(getCampaign(input.campaignId));

    default:
      // Throw so the outer catch classifies this as `tool_error` in the event
      // log, instead of silently returning an error payload the agent might
      // mistake for valid tool output.
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Message Persistence ───

function persistMessage(
  chatId: string,
  role: string,
  content: string | null,
  toolCalls: any[] | null,
  toolResults: any[] | null,
  uiContext: Record<string, any> | null,
): string {
  const db = getDb();
  const id = nanoid();
  db.prepare(
    `INSERT INTO chat_messages (id, chat_id, role, content, tool_calls, tool_results, ui_context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    chatId,
    role,
    content,
    toolCalls ? JSON.stringify(toolCalls) : null,
    toolResults ? JSON.stringify(toolResults) : null,
    uiContext ? JSON.stringify(uiContext) : null,
    Date.now(),
  );
  return id;
}

function loadHistory(chatId: string): Anthropic.MessageParam[] {
  const db = getDb();
  // ORDER BY created_at ASC, rowid ASC: same-millisecond inserts (common in the
  // tool loop) must fall back to SQLite's monotonic insertion order, otherwise
  // tool_use/tool_result pairs can swap and the API rejects the conversation.
  const rows = db.prepare(
    `SELECT role, content, tool_calls, tool_results FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC`
  ).all(chatId) as { role: string; content: string | null; tool_calls: string | null; tool_results: string | null }[];

  const messages: Anthropic.MessageParam[] = [];

  for (const row of rows) {
    if (row.role === 'user') {
      // User messages store plain text in content
      if (row.content) {
        messages.push({ role: 'user', content: row.content });
      }
      // User messages with tool_results are tool result blocks
      if (row.tool_results) {
        const results = JSON.parse(row.tool_results) as any[];
        messages.push({
          role: 'user',
          content: results.map((r: any) => ({
            type: 'tool_result' as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
          })),
        });
      }
    } else if (row.role === 'assistant') {
      const blocks: Anthropic.ContentBlock[] = [];
      if (row.content) {
        blocks.push({ type: 'text', text: row.content } as Anthropic.ContentBlock);
      }
      if (row.tool_calls) {
        const calls = JSON.parse(row.tool_calls) as any[];
        for (const call of calls) {
          blocks.push({
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.input,
          } as Anthropic.ContentBlock);
        }
      }
      if (blocks.length > 0) {
        messages.push({ role: 'assistant', content: blocks });
      }
    }
  }

  return messages;
}

// ─── Auto-Title ───

async function autoTitle(client: Anthropic, chatId: string, userMessage: string): Promise<void> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      messages: [
        {
          role: 'user',
          content: `Generate a short title (max 6 words, no quotes) for a chat that starts with this message:\n\n${userMessage.slice(0, 300)}`,
        },
      ],
    });
    const title = response.content[0]?.type === 'text' ? response.content[0].text.trim() : 'New Chat';
    const db = getDb();
    // Only set the title if the user hasn't manually renamed the chat in the
    // ~500ms between the POST and the Haiku call returning. Without this guard,
    // the fire-and-forget auto-title clobbers user renames.
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND title IS NULL').run(title, Date.now(), chatId);
  } catch {
    // Non-critical — leave title as null
  }
}

// ─── Retry Helper ───

/**
 * Call client.messages.create with bounded retries on transient errors
 * (429 rate-limited, 5xx server errors). Uses exponential backoff.
 * Non-retriable errors (4xx other than 429, schema mismatches) throw immediately.
 *
 * Cancellation: the provided AbortSignal is forwarded to the SDK and also
 * aborts the backoff sleep between retries, so pressing Stop during a delay
 * doesn't have to wait for the delay to elapse.
 */
export async function createMessageWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  signal: AbortSignal,
): Promise<Anthropic.Message> {
  const MAX_ATTEMPTS = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw new Error('Chat cancelled');
    try {
      return await client.messages.create(params, { signal });
    } catch (err: any) {
      lastErr = err;
      // AbortError from the SDK propagates immediately regardless of status.
      if (err?.name === 'AbortError' || signal.aborted) throw err;
      const status = err?.status ?? err?.response?.status;
      const retriable = status === 429 || (typeof status === 'number' && status >= 500);
      if (!retriable || attempt === MAX_ATTEMPTS) {
        if (!retriable) {
          logChatEvent('api_error_nonretriable', {
            status: status ?? null,
            message: err?.message ?? String(err),
          });
        }
        throw err;
      }
      const delay = 500 * Math.pow(2, attempt - 1);
      logChatEvent('api_retry', { attempt, status: status ?? null, delay_ms: delay });
      await sleepOrAbort(delay, signal);
    }
  }
  throw lastErr;
}

/**
 * Resolve after `ms` or reject immediately if the signal fires.
 */
function sleepOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Chat cancelled'));
      return;
    }
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('Chat cancelled'));
    };
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── Main Agent Loop ───

export async function runAgent(
  chatId: string,
  userContent: string,
  uiContext: Record<string, any> | null,
  res: ServerResponse,
): Promise<void> {
  // All observability inside this call attributes to `chatId` via
  // AsyncLocalStorage — no need to thread it through every tool helper.
  return withAgentContext(chatId, () => runAgentImpl(chatId, userContent, uiContext, res));
}

async function runAgentImpl(
  chatId: string,
  userContent: string,
  uiContext: Record<string, any> | null,
  res: ServerResponse,
): Promise<void> {
  // Refuse to start a second concurrent run on the same chatId. Two parallel
  // runAgent calls race on chat_messages inserts: both read loadHistory before
  // either persists, then interleave their tool_use / tool_result rows, which
  // can land in an order the Anthropic API rejects on the next turn.
  // Tracking cancel handles as a Set was not enough — we also need to serialize.
  const existing = activeSessions.get(chatId);
  if (existing && existing.size > 0) {
    logChatEvent('tool_error', { phase: 'concurrent_session_blocked' });
    sendSSE(res, 'error', {
      message: 'A previous message is still being processed for this chat. Please wait for it to finish or cancel it first.',
    });
    return;
  }

  const controller = new AbortController();
  const signal = controller.signal;
  let sessionSet = activeSessions.get(chatId);
  if (!sessionSet) {
    sessionSet = new Set();
    activeSessions.set(chatId, sessionSet);
  }
  sessionSet.add(controller);

  // Validate API key before attempting anything — the SDK lazily validates on the
  // first request and the error message ("Could not resolve authentication method")
  // is not user-friendly.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendSSE(res, 'error', {
      message: 'ANTHROPIC_API_KEY is not set. Add it to your .env file and restart the dev server.',
    });
    sessionSet.delete(controller);
    if (sessionSet.size === 0) activeSessions.delete(chatId);
    return;
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.FLUID_AGENT_MODEL ?? 'claude-sonnet-4-6';

  // Hoist the system prompt: Brand Brief and UI context are fixed for the duration
  // of this runAgent call. Rebuilding per loop iteration is wasted DB work.
  //
  // Prompt caching: the static portion (Tier 1 rules + Brand Brief) is stable
  // across requests, so we mark it ephemeral and skip caching the volatile UI
  // context block. Caching the whole thing (as round 3 did) silently busted the
  // cache every time the user clicked into a different campaign or creation.
  const { staticPart, dynamicPart } = buildSystemPrompt(buildBrandBrief(), uiContext);
  const systemPrompt: Anthropic.TextBlockParam[] = [
    { type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } },
  ];
  if (dynamicPart) {
    systemPrompt.push({ type: 'text', text: dynamicPart });
  }

  try {
    // Check if this is the first message (for auto-title)
    const db = getDb();
    const msgCount = (db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE chat_id = ?').get(chatId) as any)?.c ?? 0;
    const isFirstMessage = msgCount === 0;

    // Persist user message
    persistMessage(chatId, 'user', userContent, null, null, uiContext);

    // Load full conversation history
    const messages = loadHistory(chatId);

    // Auto-title on first message (fire and forget)
    if (isFirstMessage) {
      autoTitle(client, chatId, userContent).catch(() => {});
    }

    // Cost tracking (per user message, not per chat — these reset on every
    // runAgent call). If you want a conversation-level cap, persist the totals
    // on the chats row and check them here.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let renderCount = 0;
    // Max tokens a single user message's tool loop can consume before we stop
    // and tell the user to start fresh.
    const CHAT_TOKEN_BUDGET = 500_000;
    // Hard guard against context-window overflow. Claude Sonnet/Haiku 4.x default
    // to 200K input tokens. Stop early if a single request crosses this so we don't
    // 4xx on the NEXT turn.
    const CONTEXT_WINDOW_GUARD = 180_000;
    // Max renders per user message. Prevents the agent from burning image
    // tokens on "let me check again" loops without making progress.
    const MAX_RENDERS_PER_PASS = 3;

    // Tool-use loop
    let currentMessages = messages;
    let loopCount = 0;
    const maxLoops = 25;

    while (loopCount < maxLoops) {
      if (signal.aborted) {
        logChatEvent('cancelled', { loop_count: loopCount });
        sendSSE(res, 'error', { message: 'Chat cancelled' });
        break;
      }

      loopCount++;

      const response = await createMessageWithRetry(
        client,
        {
          model,
          max_tokens: 16384,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          messages: currentMessages,
        },
        signal,
      );

      // Track token usage
      if (response.usage) {
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
        totalCacheReadTokens += (response.usage as any).cache_read_input_tokens ?? 0;
        totalCacheCreationTokens += (response.usage as any).cache_creation_input_tokens ?? 0;
      }

      // Context window guard — if THIS request already crossed the limit, the
      // next turn will 4xx. Warn and stop instead of hitting an API error.
      if (response.usage && response.usage.input_tokens >= CONTEXT_WINDOW_GUARD) {
        logChatEvent('budget_trip_context', {
          input_tokens: response.usage.input_tokens,
          guard: CONTEXT_WINDOW_GUARD,
          loop_count: loopCount,
        });
        sendSSE(res, 'text', {
          text: '\n\n[Context window limit approaching. Please start a new chat to continue.]',
        });
        break;
      }

      // Budget enforcement
      const totalTokens = totalInputTokens + totalOutputTokens;
      if (totalTokens >= CHAT_TOKEN_BUDGET) {
        logChatEvent('budget_trip_token', {
          total_tokens: totalTokens,
          budget: CHAT_TOKEN_BUDGET,
          loop_count: loopCount,
        });
        sendSSE(res, 'text', {
          text: '\n\n[Token budget reached. Please start a new chat to continue.]',
        });
        break;
      }

      // Collect text and tool_use blocks from response
      let textContent = '';
      const toolCalls: { id: string; name: string; input: any }[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
          sendSSE(res, 'text', { text: block.text });
        } else if (block.type === 'tool_use') {
          toolCalls.push({ id: block.id, name: block.name, input: block.input });
          sendSSE(res, 'tool_start', { toolUseId: block.id, name: block.name, input: block.input });
        }
      }

      // If no tool calls, persist assistant message and we're done.
      if (response.stop_reason === 'end_turn' || toolCalls.length === 0) {
        persistMessage(
          chatId,
          'assistant',
          textContent || null,
          toolCalls.length > 0 ? toolCalls : null,
          null,
          null,
        );
        break;
      }

      // Execute tools and collect results. The assistant row (which contains
      // tool_use blocks) and the paired tool_results row MUST both land or
      // neither — otherwise the next loadHistory produces a malformed
      // conversation the Anthropic API rejects. We defer the assistant-row
      // insert until after the try/finally, so it only persists alongside a
      // guaranteed matching tool_results row.
      const toolResults: { tool_use_id: string; content: any }[] = [];
      try {
      for (const call of toolCalls) {
        if (signal.aborted) break;

        // Render budget enforcement
        if (call.name === 'render_preview') {
          renderCount++;
          if (renderCount > MAX_RENDERS_PER_PASS) {
            logChatEvent('budget_trip_render', {
              render_count: renderCount,
              budget: MAX_RENDERS_PER_PASS,
            });
            toolResults.push({
              tool_use_id: call.id,
              content: JSON.stringify({
                error: `Render budget exceeded (max ${MAX_RENDERS_PER_PASS} per creation). Save the creation and the system will validate it.`,
              }),
            });
            sendSSE(res, 'tool_result', {
              toolUseId: call.id,
              name: call.name,
              hasImage: false,
              error: 'Render budget exceeded',
            });
            continue;
          }
        }

        const toolStart = Date.now();
        try {
          const result = await executeTool(call.name, call.input, uiContext, signal);

          toolResults.push({ tool_use_id: call.id, content: result });
          logChatEvent('tool_exec_metric', {
            tool: call.name,
            duration_ms: Date.now() - toolStart,
            ok: true,
          });

          // Send SSE summary (skip image data to avoid bloating the stream)
          if (Array.isArray(result)) {
            const hasImage = result.some((b: any) => b.type === 'image');
            const textParts = result.filter((b: any) => b.type === 'text').map((b: any) => b.text);
            sendSSE(res, 'tool_result', {
              toolUseId: call.id,
              name: call.name,
              hasImage,
              summary: textParts.join(' '),
            });
          } else {
            // result is a JSON string
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            sendSSE(res, 'tool_result', {
              toolUseId: call.id,
              name: call.name,
              hasImage: false,
              result: parsed,
            });

            // Emit creation_ready and validation_result SSE events
            if (call.name === 'save_creation' || call.name === 'edit_creation') {
              if (parsed.iterationId || parsed.creationId) {
                sendSSE(res, 'creation_ready', {
                  campaignId: parsed.campaignId,
                  creationId: parsed.creationId,
                  iterationId: parsed.iterationId,
                  htmlPath: parsed.htmlPath,
                });
              }
              if (parsed.validation) {
                sendSSE(res, 'validation_result', {
                  iterationId: parsed.iterationId,
                  result: parsed.validation,
                });
              }
            }
          }
        } catch (err: any) {
          const errorMsg = err?.message ?? 'Tool execution failed';
          // Classify input-shape errors separately so they can be filtered
          // from real tool crashes during post-mortem analysis.
          const isInputError = /^Tool input '[^']+' must be/.test(errorMsg) ||
            /^Tool '[^']+' called with invalid input/.test(errorMsg);
          logChatEvent(isInputError ? 'tool_input_rejected' : 'tool_error', {
            tool: call.name,
            duration_ms: Date.now() - toolStart,
            error: errorMsg,
          });
          toolResults.push({
            tool_use_id: call.id,
            content: JSON.stringify({ error: errorMsg }),
          });
          sendSSE(res, 'tool_result', {
            toolUseId: call.id,
            name: call.name,
            hasImage: false,
            error: errorMsg,
          });
        }
      }

      } finally {
        // Guarantee every tool_use has a matching tool_result, even if the
        // loop threw partway through or was cancelled. Then persist both the
        // assistant row (with tool_use blocks) and the tool_results row in
        // sequence so loadHistory always sees a well-formed pair.
        const completedIds = new Set(toolResults.map((r) => r.tool_use_id));
        for (const call of toolCalls) {
          if (!completedIds.has(call.id)) {
            toolResults.push({
              tool_use_id: call.id,
              content: JSON.stringify({ error: 'Tool call did not complete (cancelled or aborted)' }),
            });
          }
        }

        // Persist assistant row (with tool_use blocks) first.
        persistMessage(
          chatId,
          'assistant',
          textContent || null,
          toolCalls.length > 0 ? toolCalls : null,
          null,
          null,
        );

        // Persist tool results as a user message.
        // Strip base64 image payloads from persisted copy: they're only needed
        // for the current turn, not for conversation history — otherwise the
        // DB and the reloaded context explode on every subsequent message.
        const persistableResults = toolResults.map((r) => {
          if (Array.isArray(r.content)) {
            return {
              tool_use_id: r.tool_use_id,
              content: r.content.map((b: any) => {
                if (b?.type === 'image') {
                  return { type: 'text', text: '[image omitted from history]' };
                }
                return b;
              }),
            };
          }
          return r;
        });
        persistMessage(chatId, 'user', null, null, persistableResults, null);
      }

      // Build next messages array: previous + assistant response + tool results
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        {
          role: 'user' as const,
          content: toolResults.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
          })),
        },
      ];
    }

    // If the tool loop hit its ceiling, tell the user instead of silently
    // stopping mid-conversation. Without this, the chat UI shows "done" with
    // no explanation after 25 back-and-forth iterations.
    if (loopCount >= maxLoops) {
      logChatEvent('loop_ceiling', { max_loops: maxLoops });
      const msg = `\n\n[Agent stopped after ${maxLoops} tool iterations. If the work is unfinished, ask the agent to continue.]`;
      sendSSE(res, 'text', { text: msg });
      persistMessage(chatId, 'assistant', msg, null, null, null);
    }

    logChatEvent('agent_run_complete', {
      loop_count: loopCount,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cache_read_tokens: totalCacheReadTokens,
      cache_creation_tokens: totalCacheCreationTokens,
      render_count: renderCount,
    });

    sendSSE(res, 'done', {
      chatId,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    });
  } catch (err: any) {
    const message = err?.message ?? 'Agent error';
    logChatEvent('agent_run_failed', { error: message });
    sendSSE(res, 'error', { message });
  } finally {
    sessionSet.delete(controller);
    if (sessionSet.size === 0) {
      activeSessions.delete(chatId);
    }
  }
}
