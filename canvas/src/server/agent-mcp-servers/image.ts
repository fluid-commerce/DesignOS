/**
 * image.ts — SDK MCP server for image generation tools.
 *
 * Exposes: generate_image, promote_generated_image
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { generateImageTool, promoteGeneratedImageTool } from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';

// Cost estimate for a single Gemini 2.5 Flash image generation.
const GENERATE_IMAGE_COST_USD = 0.039;
const GENERATE_IMAGE_DURATION_SEC = 8;

export function createImageMcpServer(
  dispatchCtx: DispatchContext,
  chatId: string,
  uiContext: Record<string, unknown> | null,
) {
  return createSdkMcpServer({
    name: 'image',
    version: '1.0.0',
    tools: [
      tool(
        'generate_image',
        'Generate a brand image via Gemini 2.5 Flash Image when no DAM asset fits. ALWAYS call search_brand_images first — only generate when no existing asset matches.\n\nPrompt components (4-of-6 required):\n- style signal (cinematic, editorial, product, fashion, lifestyle)\n- subject (specific: "a runner at dawn", not "a person")\n- setting (location, time of day)\n- light (directional, soft, backlit, golden-hour)\n- camera (aspect, lens feel, depth)\n- emotional brief (the feeling, not the action)\n\nCost: ~$0.039/image. Daily cap: FLUID_DAILY_COST_CAP_USD (default $10).',
        {
          prompt: z.string().describe('Detailed image generation prompt'),
          aspectRatio: z
            .enum(['1:1', '4:5', '9:16', '2:3', '16:9', '21:9'])
            .describe('Image aspect ratio'),
          referenceImages: z
            .array(z.string())
            .optional()
            .describe('Optional brand asset IDs or names to use as visual references'),
          idempotencyKey: z
            .string()
            .optional()
            .describe('Optional idempotency key — same key returns cached result at $0'),
          reason: z
            .enum(['no_dam_match', 'user_explicit_request', 'style_override'])
            .describe('Why generation was chosen over DAM assets'),
          searchedQueries: z
            .array(z.string())
            .optional()
            .describe('DAM search queries you tried before deciding to generate'),
        },
        async (args) => {
          const result = await dispatchTool(
            'generate_image',
            args as Record<string, unknown>,
            dispatchCtx,
            async () => {
              const generated = await generateImageTool({
                prompt: args.prompt,
                aspectRatio: args.aspectRatio,
                referenceImages: args.referenceImages,
                idempotencyKey: args.idempotencyKey,
                reason: args.reason,
                sessionId: chatId,
                iterationId:
                  uiContext?.activeIterationId != null
                    ? String(uiContext.activeIterationId)
                    : null,
                searchedQueries: args.searchedQueries,
              });
              return generated;
            },
            { estCostUsd: GENERATE_IMAGE_COST_USD, estDurationSec: GENERATE_IMAGE_DURATION_SEC },
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
        'promote_generated_image',
        'Promote a generated (or uploaded) image to the curated brand library so it persists alongside DAM assets. Use after generating an image the user wants to keep.',
        {
          assetId: z.string().describe('Brand asset ID to promote'),
        },
        async (args) => {
          const result = await dispatchTool(
            'promote_generated_image',
            args as Record<string, unknown>,
            dispatchCtx,
            () => Promise.resolve(promoteGeneratedImageTool(args.assetId)),
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
