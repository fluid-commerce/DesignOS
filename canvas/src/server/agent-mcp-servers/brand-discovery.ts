/**
 * brand-discovery.ts — SDK MCP server for brand knowledge read tools.
 *
 * Exposes: list_voice_guide, read_voice_guide, list_patterns, read_pattern,
 *          list_assets, list_templates, read_template, search_brand_images,
 *          read_skill
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  listVoiceGuide,
  readVoiceGuide,
  listPatterns,
  readPattern,
  listAssets,
  listTemplates,
  readTemplate,
  searchBrandImages,
  readSkillTool,
} from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';

export function createBrandDiscoveryMcpServer(dispatchCtx: DispatchContext) {
  return createSdkMcpServer({
    name: 'brandDiscovery',
    version: '1.0.0',
    tools: [
      tool(
        'list_voice_guide',
        'List all voice guide documents with slug, title, and short description.',
        {},
        async () => {
          const result = await dispatchTool(
            'list_voice_guide',
            {},
            dispatchCtx,
            () => Promise.resolve(listVoiceGuide()),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'read_voice_guide',
        'Read the full content of a voice guide document by slug.',
        {
          slug: z.string().describe('Voice guide slug'),
        },
        async (args) => {
          const result = await dispatchTool(
            'read_voice_guide',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(readVoiceGuide(args.slug)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'list_patterns',
        'List brand patterns, optionally filtered by category (logos, colors, typography, images, decorations, archetypes).',
        {
          category: z.string().optional().describe('Optional category filter'),
        },
        async (args) => {
          const result = await dispatchTool(
            'list_patterns',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(listPatterns(args.category)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'read_pattern',
        'Read the full content of a brand pattern by slug.',
        {
          slug: z.string().describe('Pattern slug'),
        },
        async (args) => {
          const result = await dispatchTool(
            'read_pattern',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(readPattern(args.slug)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'list_assets',
        'List brand assets (fonts, images, logos, decorations). Optionally filter by category.',
        {
          category: z.string().optional().describe('Optional category filter'),
        },
        async (args) => {
          const result = await dispatchTool(
            'list_assets',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(listAssets(args.category)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'list_templates',
        'List all available templates with id, name, type, and description.',
        {},
        async () => {
          const result = await dispatchTool(
            'list_templates',
            {},
            dispatchCtx,
            () => Promise.resolve(listTemplates()),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'read_template',
        'Read a template by its numeric ID, including design rules.',
        {
          id: z.number().describe('Template ID'),
        },
        async (args) => {
          const result = await dispatchTool(
            'read_template',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(readTemplate(args.id)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'search_brand_images',
        "Search the brand's image library before requesting image generation. Returns existing brand images ranked by query match. Always call this first — use existing assets rather than generating new ones when a suitable match exists.",
        {
          query: z.string().describe('Search query — keywords describing the image you need'),
          category: z
            .enum(['images', 'decorations', 'logos'])
            .optional()
            .describe('Optional category filter: images, decorations, or logos'),
          limit: z.number().optional().describe('Max results to return (default 10, max 25)'),
        },
        async (args) => {
          const result = await dispatchTool(
            'search_brand_images',
            args as Record<string, unknown>,
            dispatchCtx,
            () =>
              Promise.resolve(
                searchBrandImages({
                  query: args.query,
                  category: args.category,
                  limit: args.limit,
                }),
              ),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'read_skill',
        'Read a whitelisted agent skill file to guide your work. Available skills:\n- "social-media-taste": platform psychology + taste rules for social content\n- "gemini-social-image": prompt architecture for image generation',
        {
          name: z
            .enum(['social-media-taste', 'gemini-social-image'])
            .describe('Skill name to read'),
        },
        async (args) => {
          const result = await dispatchTool(
            'read_skill',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(readSkillTool(args.name)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),
    ],
  });
}
