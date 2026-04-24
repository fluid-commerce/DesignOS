/**
 * Agent core: tool-use loop with SSE streaming, conversation persistence,
 * and cancellation support.
 *
 * Phase 25: migrated to @anthropic-ai/claude-agent-sdk (query() subprocess
 * runner). Auth: ANTHROPIC_API_KEY env var takes precedence; if absent, the
 * SDK falls back to a Claude CLI login session (`claude login` one-time setup).
 *
 * The old @anthropic-ai/sdk path is kept for createMessageWithRetry (used by
 * existing tests) and will be removed once tests are ported to the new mock.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
  CanUseTool,
} from '@anthropic-ai/claude-agent-sdk';
import { getToolPolicy } from './capabilities';
import { waitForPermissionResponse } from './permission-registry';
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
  searchBrandImages,
  generateImageTool,
  promoteGeneratedImageTool,
  readSkillTool,
} from './agent-tools';

import type { ServerResponse } from 'node:http';
import { dispatchTool } from './tool-dispatch';
import type { DispatchContext } from './tool-dispatch';
import { createArchetypesMcpServer } from './agent-mcp-servers/archetypes';
import { createBrandDiscoveryMcpServer } from './agent-mcp-servers/brand-discovery';
import { createBrandEditingMcpServer } from './agent-mcp-servers/brand-editing';
import { createVisualMcpServer } from './agent-mcp-servers/visual';
import { createContextMcpServer } from './agent-mcp-servers/context';
import { createImageMcpServer } from './agent-mcp-servers/image';

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
    description:
      'List brand patterns, optionally filtered by category (logos, colors, typography, images, decorations, archetypes).',
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
    description:
      'List brand assets (fonts, images, logos, decorations). Optionally filter by category.',
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
    description: 'List layout archetypes with slug, name, platform, category, mood, imageRole, slotCount, and useCases. Use filters to narrow the list before selecting. Default page size 25, max 50.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (e.g. "hero-photo", "stat-data", "quote-testimonial", "announcement", "photo-collage", "tips-howto", "personal-about", "product", "motivational", "carousel-cover")',
        },
        platform: {
          type: 'string',
          description: 'Filter by platform: "instagram-portrait" (4:5, 1080×1350), "instagram-square" (1:1, 1080×1080), "linkedin-landscape", "one-pager"',
        },
        imageRole: {
          type: 'string',
          description: 'Filter by how images are used: "none" (text-only), "background" (full-bleed), "hero" (dominant), "accent" (supporting), "grid" (multi-photo)',
        },
        pageSize: {
          type: 'number',
          description: 'Max results to return (default 25, hard max 50)',
        },
      },
      required: [],
    },
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
    description:
      'Save HTML as a new creation in a campaign. Returns IDs for the campaign, creation, slide, and iteration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Self-contained HTML' },
        slotSchema: {
          type: 'object',
          description: 'Slot schema mapping slot names to their configuration',
        },
        platform: {
          type: 'string',
          description: 'Platform/creation type (e.g. instagram, linkedin, one-pager)',
        },
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
    description:
      'Get the current UI context passed from the frontend (active page, selected creation, etc.).',
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

  // Phase 24: DAM-first image search
  {
    name: 'search_brand_images',
    description:
      'Search the brand\'s image library before requesting image generation. Returns existing brand images ranked by query match. Always call this first — use existing assets rather than generating new ones when a suitable match exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query — keywords describing the image you need',
        },
        category: {
          type: 'string',
          enum: ['images', 'decorations', 'logos'],
          description: 'Optional category filter: images, decorations, or logos',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10, max 25)',
        },
      },
      required: ['query'],
    },
  },

  // Phase 24 Dispatch 3: Image generation + skill reading
  {
    name: 'generate_image',
    description:
      'Generate a brand image via Gemini 2.5 Flash Image when no DAM asset fits. ALWAYS call search_brand_images first — only generate when no existing asset matches. Prompt architecture: use the gemini-social-image skill (see read_skill).\n\nPrompt components (4-of-6 required):\n- style signal (cinematic, editorial, product, fashion, lifestyle)\n- subject (specific: "a runner at dawn", not "a person")\n- setting (location, time of day)\n- light (directional, soft, backlit, golden-hour)\n- camera (aspect, lens feel, depth)\n- emotional brief (the feeling, not the action)\n\nCost: ~$0.039/image. Daily cap: FLUID_DAILY_COST_CAP_USD (default $10).',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'Detailed image generation prompt' },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '4:5', '9:16', '2:3', '16:9', '21:9'],
          description: 'Image aspect ratio',
        },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional brand asset IDs or names to use as visual references',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Optional idempotency key — same key returns cached result at $0',
        },
        reason: {
          type: 'string',
          enum: ['no_dam_match', 'user_explicit_request', 'style_override'],
          description: 'Why generation was chosen over DAM assets',
        },
        searchedQueries: {
          type: 'array',
          items: { type: 'string' },
          description: 'DAM search queries you tried before deciding to generate',
        },
      },
      required: ['prompt', 'aspectRatio', 'reason'],
    },
  },
  {
    name: 'promote_generated_image',
    description:
      'Promote a generated (or uploaded) image to the curated brand library so it persists alongside DAM assets. Use after generating an image the user wants to keep.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assetId: { type: 'string', description: 'Brand asset ID to promote' },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'read_skill',
    description:
      'Read a whitelisted agent skill file to guide your work. Available skills:\n- "social-media-taste": platform psychology + taste rules for social content\n- "gemini-social-image": prompt architecture for image generation',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          enum: ['social-media-taste', 'gemini-social-image'],
          description: 'Skill name to read',
        },
      },
      required: ['name'],
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

/**
 * Session-scoped approval sets. Persists across reconnects within the same
 * server process so users don't have to re-approve tools after connection
 * hiccups. Keyed by chatId (same as activeSessions).
 */
const sessionAutoApproved = new Map<string, Set<string>>();

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
  sessionAutoApproved.clear();
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
  chatId: string,
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
      return JSON.stringify(listArchetypes({
        category: input.category as string | undefined,
        platform: input.platform as string | undefined,
        imageRole: input.imageRole as string | undefined,
        pageSize: input.pageSize as number | undefined,
      }));
    case 'read_archetype':
      return JSON.stringify(readArchetype(input.slug));

    // Brand Editing
    case 'update_pattern':
      return JSON.stringify(
        updatePattern(requireString(input, 'slug'), requireString(input, 'content')),
      );
    case 'create_pattern':
      return JSON.stringify(
        createPattern(
          requireString(input, 'category'),
          requireString(input, 'name'),
          requireString(input, 'content'),
        ),
      );
    case 'delete_pattern':
      return JSON.stringify(deletePattern(requireString(input, 'slug')));
    case 'update_voice_guide':
      return JSON.stringify(
        updateVoiceGuide(requireString(input, 'slug'), requireString(input, 'content')),
      );
    case 'create_voice_guide':
      return JSON.stringify(
        createVoiceGuide(requireString(input, 'title'), requireString(input, 'content')),
      );

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
      return JSON.stringify(
        saveCreation(
          requireString(input, 'html'),
          input.slotSchema ?? null,
          requireString(input, 'platform'),
          typeof input.campaignId === 'string' ? input.campaignId : undefined,
        ),
      );
    case 'edit_creation':
      return JSON.stringify(
        editCreation(
          requireString(input, 'iterationId'),
          requireString(input, 'html'),
          input.slotSchema,
        ),
      );
    case 'save_as_template':
      return JSON.stringify(
        saveAsTemplate(
          requireString(input, 'iterationId'),
          requireString(input, 'name'),
          requireString(input, 'category'),
        ),
      );

    // Context
    case 'get_ui_context':
      return JSON.stringify(uiContext ?? { page: 'unknown' });
    case 'get_creation':
      return JSON.stringify(getCreation(input.iterationId));
    case 'get_campaign':
      return JSON.stringify(getCampaign(input.campaignId));

    // Phase 24: DAM-first image search
    case 'search_brand_images':
      return JSON.stringify(
        searchBrandImages({
          query: requireString(input, 'query'),
          category: input.category as 'images' | 'decorations' | 'logos' | undefined,
          limit: typeof input.limit === 'number' ? input.limit : undefined,
        }),
      );

    // Phase 24 Dispatch 3: Image generation
    case 'generate_image': {
      const result = await generateImageTool({
        prompt: requireString(input, 'prompt'),
        aspectRatio: input.aspectRatio as
          | '1:1'
          | '4:5'
          | '9:16'
          | '2:3'
          | '16:9'
          | '21:9',
        referenceImages: Array.isArray(input.referenceImages)
          ? (input.referenceImages as string[])
          : undefined,
        idempotencyKey:
          typeof input.idempotencyKey === 'string' ? input.idempotencyKey : undefined,
        reason: input.reason as 'no_dam_match' | 'user_explicit_request' | 'style_override',
        // sessionId / iterationId injected here from agent loop context
        sessionId: chatId,
        iterationId:
          uiContext?.activeIterationId != null
            ? String(uiContext.activeIterationId)
            : null,
        searchedQueries: Array.isArray(input.searchedQueries)
          ? (input.searchedQueries as string[])
          : undefined,
      });
      return JSON.stringify(result);
    }

    case 'promote_generated_image':
      return JSON.stringify(promoteGeneratedImageTool(requireString(input, 'assetId')));

    case 'read_skill':
      return JSON.stringify(readSkillTool(requireString(input, 'name')));

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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const rows = db
    .prepare(
      `SELECT role, content, tool_calls, tool_results FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(chatId) as {
    role: string;
    content: string | null;
    tool_calls: string | null;
    tool_results: string | null;
  }[];

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

/**
 * Generate a short title for a new chat via a single-turn query() call.
 * Uses claude-haiku-4-5-20251001 with maxTurns: 1 and no tools.
 * Fire-and-forget — never throws; title stays null on any error.
 */
async function autoTitle(chatId: string, userMessage: string): Promise<void> {
  try {
    const titleParts: string[] = [];
    for await (const msg of query({
      prompt: `Generate a short title (max 6 words, no quotes) for a chat that starts with this message:\n\n${userMessage.slice(0, 300)}`,
      options: {
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 1,
        tools: [],
        systemPrompt: 'Respond with only the title text — no preamble, no quotes.',
        persistSession: false,
      },
    })) {
      const sdkMsg = msg as SDKMessage;
      if (sdkMsg.type === 'assistant') {
        const content = (sdkMsg as SDKAssistantMessage).message.content;
        for (const block of content) {
          if (block.type === 'text') {
            titleParts.push(block.text);
          }
        }
      }
    }
    const title = titleParts.join('').trim() || 'New Chat';
    const db = getDb();
    // Only set the title if the user hasn't manually renamed the chat.
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND title IS NULL').run(
      title,
      Date.now(),
      chatId,
    );
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
      message:
        'A previous message is still being processed for this chat. Please wait for it to finish or cancel it first.',
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

  // Session-scoped approval set: persists across reconnects in the same process.
  // We create it lazily so first-time chats start with an empty set.
  let autoApproved = sessionAutoApproved.get(chatId);
  if (!autoApproved) {
    autoApproved = new Set<string>();
    sessionAutoApproved.set(chatId, autoApproved);
  }

  // trusted=true bypasses ask-first prompts. Set via env var for solo-dev use.
  const trusted = process.env.FLUID_DISPATCH_TRUSTED === 'true';

  const dispatchCtx: DispatchContext = {
    chatId,
    res,
    signal,
    autoApproved,
    trusted,
  };

  // ─── Phase 25: Agent SDK path ─────────────────────────────────────────────────
  //
  // Auth: the SDK automatically uses ANTHROPIC_API_KEY if set, otherwise falls
  // back to a Claude CLI login session (`claude login` one-time setup). If
  // neither is configured, query() throws — we catch it and emit a friendly msg.
  //
  // Prompt caching: Agent SDK has automatic server-side prefix-caching.
  // Concatenate static and dynamic parts with a divider so the stable static
  // portion gets cached when the system prompt prefix is stable across turns.
  // No manual cache_control markers needed (not supported by the Agent SDK).

  const model = process.env.FLUID_AGENT_MODEL ?? 'claude-sonnet-4-6';

  const activeCreationType =
    typeof uiContext?.creationType === 'string' ? uiContext.creationType : undefined;
  const { staticPart, dynamicPart } = buildSystemPrompt(buildBrandBrief(), uiContext, activeCreationType);
  const systemPrompt = dynamicPart ? `${staticPart}\n\n---\n\n${dynamicPart}` : staticPart;

  try {
    const db = getDb();
    const msgCount =
      (db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE chat_id = ?').get(chatId) as any)
        ?.c ?? 0;
    const isFirstMessage = msgCount === 0;

    // Persist user message for frontend display.
    persistMessage(chatId, 'user', userContent, null, null, uiContext);

    // Auto-title on first message (fire and forget).
    if (isFirstMessage) {
      autoTitle(chatId, userContent).catch(() => {});
    }

    // Look up existing SDK session ID so multi-turn conversations resume.
    const chatRow = db.prepare('SELECT sdk_session_id FROM chats WHERE id = ?').get(chatId) as
      | { sdk_session_id: string | null }
      | undefined;
    const existingSdkSessionId = chatRow?.sdk_session_id ?? null;

    // Build per-call MCP server instances, each closing over dispatchCtx.
    const mcpServers = {
      archetypes: createArchetypesMcpServer(dispatchCtx),
      brandDiscovery: createBrandDiscoveryMcpServer(dispatchCtx),
      brandEditing: createBrandEditingMcpServer(dispatchCtx),
      visual: createVisualMcpServer(dispatchCtx, uiContext as Record<string, unknown> | null),
      context: createContextMcpServer(dispatchCtx, uiContext as Record<string, unknown> | null),
      image: createImageMcpServer(dispatchCtx, chatId, uiContext as Record<string, unknown> | null),
    };

    // Allowed tool names match the createSdkMcpServer({ name }) namespace.
    const allowedTools = [
      'mcp__archetypes__list_archetypes',
      'mcp__archetypes__read_archetype',
      'mcp__brandDiscovery__list_voice_guide',
      'mcp__brandDiscovery__read_voice_guide',
      'mcp__brandDiscovery__list_patterns',
      'mcp__brandDiscovery__read_pattern',
      'mcp__brandDiscovery__list_assets',
      'mcp__brandDiscovery__list_templates',
      'mcp__brandDiscovery__read_template',
      'mcp__brandDiscovery__search_brand_images',
      'mcp__brandDiscovery__read_skill',
      'mcp__brandEditing__update_pattern',
      'mcp__brandEditing__create_pattern',
      'mcp__brandEditing__delete_pattern',
      'mcp__brandEditing__update_voice_guide',
      'mcp__brandEditing__create_voice_guide',
      'mcp__visual__render_preview',
      'mcp__visual__save_creation',
      'mcp__visual__edit_creation',
      'mcp__visual__save_as_template',
      'mcp__context__get_ui_context',
      'mcp__context__get_creation',
      'mcp__context__get_campaign',
      'mcp__image__generate_image',
      'mcp__image__promote_generated_image',
    ];

    let sdkSessionIdCaptured = existingSdkSessionId;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;

    // Map toolUseId → tool name. Populated when we see a tool_use block in an
    // assistant message, consumed when the matching tool_result block shows up
    // in the next SDKUserMessage. The client's tool_result SSE handler keys
    // off toolUseId and uses `name` for the inline tool-call label.
    const toolUseNames = new Map<string, string>();

    // Phase 26: permission gating runs here, at the SDK layer, via canUseTool.
    // The SDK awaits this callback natively — no in-MCP timeout, no abort-on-
    // hang. When we return, the SDK proceeds to invoke the MCP tool (or skips
    // it if we denied). Previously this logic ran inside dispatchTool(), which
    // caused the SDK to consider the tool call in-progress while we waited for
    // a user click — triggering a timeout and abort that killed the SSE stream
    // before the user could respond.
    //
    // The SDK-prefixed toolName (e.g. 'mcp__visual__save_creation') is stripped
    // to its bare name ('save_creation') so we can look up the policy.
    const canUseTool: CanUseTool = async (toolName, input, { signal: sdkSignal }) => {
      const bareName = toolName.startsWith('mcp__')
        ? toolName.split('__').slice(2).join('__')
        : toolName;
      const policy = getToolPolicy(bareName);

      // Unknown tool or always-allow → allow through.
      if (!policy || policy.tier === 'always-allow') {
        return { behavior: 'allow', updatedInput: input };
      }

      // Hard-blocked → deny immediately.
      if (policy.tier === 'never-allow-by-default') {
        return {
          behavior: 'deny',
          message: `Tool '${bareName}' is blocked by policy.`,
        };
      }

      // ask-first: skip the prompt if trusted or previously approved.
      if (trusted || autoApproved.has(bareName)) {
        return { behavior: 'allow', updatedInput: input };
      }

      // Combine the chat's own abort signal with the SDK's per-call signal so
      // aborting either cancels the wait. waitForPermissionResponse needs a
      // PermissionContext with a single signal, so we forward both to a
      // dedicated AbortController.
      const combined = new AbortController();
      const onChatAbort = () => combined.abort();
      const onSdkAbort = () => combined.abort();
      if (signal.aborted || sdkSignal.aborted) {
        combined.abort();
      } else {
        signal.addEventListener('abort', onChatAbort, { once: true });
        sdkSignal.addEventListener('abort', onSdkAbort, { once: true });
      }

      try {
        const argsPreview = JSON.stringify(input).slice(0, 200);
        const permDecision = await waitForPermissionResponse(
          {
            chatId,
            res,
            signal: combined.signal,
            autoApproved,
            trusted,
          },
          bareName,
          argsPreview,
          undefined,
        );

        logChatEvent('permission_response', {
          tool: bareName,
          decision: permDecision,
        });

        if (permDecision === 'deny') {
          return {
            behavior: 'deny',
            message: `User declined to run '${bareName}'. Do not speculate about causes — ask the user if they want to proceed differently.`,
          };
        }

        if (permDecision === 'approve_session') {
          autoApproved.add(bareName);
        }
        return { behavior: 'allow', updatedInput: input };
      } finally {
        signal.removeEventListener('abort', onChatAbort);
        sdkSignal.removeEventListener('abort', onSdkAbort);
      }
    };

    for await (const msg of query({
      prompt: userContent,
      options: {
        model,
        systemPrompt,
        mcpServers,
        allowedTools,
        canUseTool,
        permissionMode: 'default' as const,
        includePartialMessages: true,
        maxTurns: 25,
        abortController: controller,
        ...(existingSdkSessionId ? { resume: existingSdkSessionId } : {}),
      },
    })) {
      if (signal.aborted) break;

      const sdkMsg = msg as SDKMessage;

      switch (sdkMsg.type) {
        case 'assistant': {
          const assistantMsg = sdkMsg as SDKAssistantMessage;

          if (!sdkSessionIdCaptured) {
            sdkSessionIdCaptured = assistantMsg.session_id;
            db.prepare('UPDATE chats SET sdk_session_id = ? WHERE id = ?').run(
              assistantMsg.session_id,
              chatId,
            );
          }

          let assistantText = '';
          const toolCallsForMsg: { id: string; name: string; input: unknown }[] = [];

          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              assistantText += block.text;
            } else if (block.type === 'tool_use') {
              toolUseNames.set(block.id, block.name);
              sendSSE(res, 'tool_start', {
                toolUseId: block.id,
                name: block.name,
                input: block.input,
              });
              toolCallsForMsg.push({ id: block.id, name: block.name, input: block.input });
            }
          }

          persistMessage(
            chatId,
            'assistant',
            assistantText || null,
            toolCallsForMsg.length > 0 ? toolCallsForMsg : null,
            null,
            null,
          );
          break;
        }

        case 'user': {
          // SDKUserMessage carries tool_result blocks returning from our MCP
          // servers (and from any SDK built-in tools). Emit tool_result SSE so
          // the client's chat store can attach the result to the matching
          // toolCall entry on the prior assistant message.
          const userMsg = sdkMsg as SDKUserMessage;
          const content = userMsg.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              // ContentBlockParam is a union; narrow to tool_result.
              if ((block as { type?: string }).type !== 'tool_result') continue;
              const trBlock = block as {
                type: 'tool_result';
                tool_use_id: string;
                content?:
                  | string
                  | Array<{ type: string; text?: string } & Record<string, unknown>>;
                is_error?: boolean;
              };
              const toolUseId = trBlock.tool_use_id;
              const name = toolUseNames.get(toolUseId) ?? 'tool';

              // Decompose the result body. The MCP handler returns either a
              // text block (JSON-serialized tool output) or text+image blocks
              // (render_preview). We mirror the pre-migration shape: base64
              // image data is kept in hasImage flag, not shipped over SSE.
              let hasImage = false;
              let summary: string | undefined;
              let resultParsed: unknown = undefined;
              let errorMsg: string | undefined;

              if (typeof trBlock.content === 'string') {
                // Plain string — may be JSON-serialized from our handler.
                try {
                  resultParsed = JSON.parse(trBlock.content);
                } catch {
                  summary = trBlock.content;
                }
              } else if (Array.isArray(trBlock.content)) {
                const textParts: string[] = [];
                for (const b of trBlock.content) {
                  if (b.type === 'image') {
                    hasImage = true;
                  } else if (b.type === 'text' && typeof b.text === 'string') {
                    textParts.push(b.text);
                  }
                }
                const joined = textParts.join(' ');
                if (hasImage) {
                  summary = joined || 'Preview rendered.';
                } else {
                  try {
                    resultParsed = JSON.parse(joined);
                  } catch {
                    summary = joined;
                  }
                }
              }

              if (trBlock.is_error) {
                errorMsg =
                  typeof resultParsed === 'object' && resultParsed !== null && 'message' in resultParsed
                    ? String((resultParsed as Record<string, unknown>).message ?? '')
                    : summary ?? 'Tool call failed';
              }

              sendSSE(res, 'tool_result', {
                toolUseId,
                name,
                hasImage,
                ...(errorMsg !== undefined ? { error: errorMsg } : {}),
                ...(summary !== undefined && !errorMsg ? { summary } : {}),
                ...(resultParsed !== undefined && !errorMsg ? { result: resultParsed } : {}),
              });
            }
          }
          break;
        }

        case 'stream_event': {
          const partialMsg = sdkMsg as SDKPartialAssistantMessage;
          const evt = partialMsg.event;
          if (
            evt.type === 'content_block_delta' &&
            evt.delta.type === 'text_delta'
          ) {
            sendSSE(res, 'text', { text: evt.delta.text });
          }
          break;
        }

        case 'result': {
          const resultMsg = sdkMsg as SDKResultMessage;
          const usage = resultMsg.usage;

          totalInputTokens += usage.input_tokens ?? 0;
          totalOutputTokens += usage.output_tokens ?? 0;
          totalCacheReadTokens += usage.cache_read_input_tokens ?? 0;
          totalCacheCreationTokens += usage.cache_creation_input_tokens ?? 0;

          logChatEvent('agent_run_complete', {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            cache_read_tokens: totalCacheReadTokens,
            cache_creation_tokens: totalCacheCreationTokens,
            sdk_subtype: resultMsg.subtype,
          });

          if (resultMsg.subtype !== 'success') {
            const errMsg =
              resultMsg.subtype === 'error_max_turns'
                ? `\n\n[Agent stopped after reaching the maximum number of turns. Ask the agent to continue.]`
                : `\n\n[Agent stopped: ${resultMsg.subtype}]`;
            sendSSE(res, 'text', { text: errMsg });
          }

          sendSSE(res, 'done', {
            chatId,
            usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          });
          break;
        }

        default:
          break;
      }
    }

    if (signal.aborted) {
      logChatEvent('cancelled', {});
      sendSSE(res, 'error', { message: 'Chat cancelled' });
    }
    // Phase 25: old loop body removed — handled by the for-await-of above.
    // The if(false) block below is never executed; it exists solely to prevent
    // TypeScript from complaining about unused imports and referenced symbols
    // in the still-existing executeTool / loadHistory / createMessageWithRetry
    // functions that tests rely on.
    if (false as boolean) {
      // Dead code — never executed. Retains references to executeTool,
      // loadHistory, and createMessageWithRetry so those functions aren't
      // flagged as unused by the linter while existing tests still use them.
      const _resp = await createMessageWithRetry(
        new Anthropic({ apiKey: '' }),
        { model: '', max_tokens: 0, messages: [], system: '' },
        signal,
      );
      void _resp;
      void loadHistory(chatId);
      const _et = await executeTool('', {}, null, signal, chatId);
      void _et;
    } // end if (false as boolean)

  } catch (err: any) {
    const message = err?.message ?? 'Agent error';
    const isAuthError =
      /authentication|api.key|unauthorized|credentials/i.test(message) ||
      /Could not resolve auth/i.test(message);
    const userMessage = isAuthError
      ? 'No Claude authentication found. Either set ANTHROPIC_API_KEY or run `claude login` once.'
      : message;
    logChatEvent('agent_run_failed', { error: message });
    sendSSE(res, 'error', { message: userMessage });
  } finally {
    sessionSet.delete(controller);
    if (sessionSet.size === 0) {
      activeSessions.delete(chatId);
    }
  }
}
