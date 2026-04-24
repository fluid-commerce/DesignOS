/**
 * archetypes.ts — SDK MCP server for archetype discovery tools.
 *
 * Exposes: list_archetypes, read_archetype
 * Every tool body is wrapped with dispatchTool so permission/cost-cap/audit
 * still runs exactly as it does in the legacy agent loop.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { listArchetypes, readArchetype } from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';

export function createArchetypesMcpServer(dispatchCtx: DispatchContext) {
  return createSdkMcpServer({
    name: 'archetypes',
    version: '1.0.0',
    tools: [
      tool(
        'list_archetypes',
        'List layout archetypes with slug, name, platform, category, mood, imageRole, slotCount, and useCases. Use filters to narrow the list before selecting. Default page size 25, max 50.',
        {
          category: z.string().optional().describe(
            'Filter by category (e.g. "hero-photo", "stat-data", "quote-testimonial", "announcement", "photo-collage", "tips-howto", "personal-about", "product", "motivational", "carousel-cover")',
          ),
          platform: z.string().optional().describe(
            'Filter by platform: "instagram-portrait" (4:5, 1080×1350), "instagram-square" (1:1, 1080×1080), "linkedin-landscape", "one-pager"',
          ),
          imageRole: z.string().optional().describe(
            'Filter by how images are used: "none" (text-only), "background" (full-bleed), "hero" (dominant), "accent" (supporting), "grid" (multi-photo)',
          ),
          pageSize: z.number().optional().describe('Max results to return (default 25, hard max 50)'),
        },
        async (args) => {
          const result = await dispatchTool(
            'list_archetypes',
            args as Record<string, unknown>,
            dispatchCtx,
            () =>
              Promise.resolve(
                listArchetypes({
                  category: args.category,
                  platform: args.platform,
                  imageRole: args.imageRole,
                  pageSize: args.pageSize,
                }),
              ),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }),
              },
            ],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        'read_archetype',
        'Read an archetype layout by slug, including HTML, schema, and notes.',
        {
          slug: z.string().describe('Archetype slug'),
        },
        async (args) => {
          const result = await dispatchTool(
            'read_archetype',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(readArchetype(args.slug)),
          );
          if (result.outcome === 'ok') {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }),
              },
            ],
            isError: true,
          };
        },
        { annotations: { readOnlyHint: true } },
      ),
    ],
  });
}
