/**
 * context.ts — SDK MCP server for UI context and campaign read tools.
 *
 * Exposes: get_ui_context, get_creation, get_campaign
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getCreation, getCampaign } from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';

export function createContextMcpServer(
  dispatchCtx: DispatchContext,
  uiContext: Record<string, unknown> | null,
) {
  return createSdkMcpServer({
    name: 'context',
    version: '1.0.0',
    tools: [
      tool(
        'get_ui_context',
        'Get the current UI context passed from the frontend (active page, selected creation, etc.).',
        {},
        async () => {
          const result = await dispatchTool(
            'get_ui_context',
            {},
            dispatchCtx,
            () => Promise.resolve(uiContext ?? { page: 'unknown' }),
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
        'get_creation',
        'Get full details of a creation iteration including slot schema and merged state.',
        {
          iterationId: z.string().describe('Iteration ID'),
        },
        async (args) => {
          const result = await dispatchTool(
            'get_creation',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(getCreation(args.iterationId)),
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
        'get_campaign',
        'Get campaign details including all its creations.',
        {
          campaignId: z.string().describe('Campaign ID'),
        },
        async (args) => {
          const result = await dispatchTool(
            'get_campaign',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(getCampaign(args.campaignId)),
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
