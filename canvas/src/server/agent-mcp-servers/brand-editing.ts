/**
 * brand-editing.ts — SDK MCP server for brand knowledge write tools.
 *
 * Exposes: create_pattern, update_pattern, delete_pattern,
 *          create_voice_guide, update_voice_guide
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  createPattern,
  updatePattern,
  deletePattern,
  createVoiceGuide,
  updateVoiceGuide,
} from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';

export function createBrandEditingMcpServer(dispatchCtx: DispatchContext) {
  return createSdkMcpServer({
    name: 'brandEditing',
    version: '1.0.0',
    tools: [
      tool(
        'update_pattern',
        'Update the content of an existing brand pattern by slug.',
        {
          slug: z.string().describe('Pattern slug'),
          content: z.string().describe('New markdown content'),
        },
        async (args) => {
          const result = await dispatchTool(
            'update_pattern',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(updatePattern(args.slug, args.content)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'create_pattern',
        'Create a new brand pattern in a category.',
        {
          category: z.string().describe('Pattern category'),
          name: z.string().describe('Pattern display name'),
          content: z.string().describe('Markdown content'),
        },
        async (args) => {
          const result = await dispatchTool(
            'create_pattern',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(createPattern(args.category, args.name, args.content)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'delete_pattern',
        'Delete a brand pattern by slug.',
        {
          slug: z.string().describe('Pattern slug'),
        },
        async (args) => {
          const result = await dispatchTool(
            'delete_pattern',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(deletePattern(args.slug)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'update_voice_guide',
        'Update the content of an existing voice guide document by slug.',
        {
          slug: z.string().describe('Voice guide slug'),
          content: z.string().describe('New markdown content'),
        },
        async (args) => {
          const result = await dispatchTool(
            'update_voice_guide',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(updateVoiceGuide(args.slug, args.content)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'create_voice_guide',
        'Create a new voice guide document.',
        {
          title: z.string().describe('Document title'),
          content: z.string().describe('Markdown content'),
        },
        async (args) => {
          const result = await dispatchTool(
            'create_voice_guide',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(createVoiceGuide(args.title, args.content)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),
    ],
  });
}
