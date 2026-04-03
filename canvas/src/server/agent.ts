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
import { SYSTEM_PROMPT } from './agent-system-prompt';
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

const activeSessions = new Map<string, { cancelled: boolean }>();

export function cancelChat(chatId: string): void {
  const session = activeSessions.get(chatId);
  if (session) session.cancelled = true;
}

// ─── Tool Executor ───

async function executeTool(
  name: string,
  input: Record<string, any>,
  uiContext: Record<string, any> | null,
): Promise<Anthropic.ToolResultBlockParam['content']> {
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
      return JSON.stringify(updatePattern(input.slug, input.content));
    case 'create_pattern':
      return JSON.stringify(createPattern(input.category, input.name, input.content));
    case 'delete_pattern':
      return JSON.stringify(deletePattern(input.slug));
    case 'update_voice_guide':
      return JSON.stringify(updateVoiceGuide(input.slug, input.content));
    case 'create_voice_guide':
      return JSON.stringify(createVoiceGuide(input.title, input.content));

    // Visual
    case 'render_preview': {
      const result = await renderPreviewTool(input.html, input.width, input.height);
      return [
        { type: 'text', text: 'Preview rendered successfully.' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: result.base64,
          },
        },
      ];
    }
    case 'save_creation':
      return JSON.stringify(saveCreation(input.html, input.slotSchema ?? null, input.platform, input.campaignId));
    case 'edit_creation':
      return JSON.stringify(editCreation(input.iterationId, input.html, input.slotSchema));
    case 'save_as_template':
      return JSON.stringify(saveAsTemplate(input.iterationId, input.name, input.category));

    // Context
    case 'get_ui_context':
      return JSON.stringify(uiContext ?? { page: 'unknown' });
    case 'get_creation':
      return JSON.stringify(getCreation(input.iterationId));
    case 'get_campaign':
      return JSON.stringify(getCampaign(input.campaignId));

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
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
  const rows = db.prepare(
    `SELECT role, content, tool_calls, tool_results FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`
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
      model: 'claude-haiku-4-5-20250514',
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
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(title, Date.now(), chatId);
  } catch {
    // Non-critical — leave title as null
  }
}

// ─── Main Agent Loop ───

export async function runAgent(
  chatId: string,
  userContent: string,
  uiContext: Record<string, any> | null,
  res: ServerResponse,
): Promise<void> {
  const session = { cancelled: false };
  activeSessions.set(chatId, session);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.FLUID_AGENT_MODEL ?? 'claude-sonnet-4-6';

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

    // Tool-use loop
    let currentMessages = messages;
    let loopCount = 0;
    const maxLoops = 25;

    while (loopCount < maxLoops) {
      if (session.cancelled) {
        sendSSE(res, 'error', { message: 'Chat cancelled' });
        break;
      }

      loopCount++;

      const response = await client.messages.create({
        model,
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: currentMessages,
      });

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

      // Persist assistant message
      persistMessage(
        chatId,
        'assistant',
        textContent || null,
        toolCalls.length > 0 ? toolCalls : null,
        null,
        null,
      );

      // If no tool calls, we're done
      if (response.stop_reason === 'end_turn' || toolCalls.length === 0) {
        break;
      }

      // Execute tools and collect results
      const toolResults: { tool_use_id: string; content: any }[] = [];
      for (const call of toolCalls) {
        if (session.cancelled) break;

        try {
          const result = await executeTool(call.name, call.input, uiContext);

          toolResults.push({ tool_use_id: call.id, content: result });

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
          }
        } catch (err: any) {
          const errorMsg = err?.message ?? 'Tool execution failed';
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

      // Persist tool results as a user message
      persistMessage(chatId, 'user', null, null, toolResults, null);

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

    sendSSE(res, 'done', { chatId });
  } catch (err: any) {
    const message = err?.message ?? 'Agent error';
    sendSSE(res, 'error', { message });
  } finally {
    activeSessions.delete(chatId);
  }
}
