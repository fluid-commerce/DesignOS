/**
 * visual.ts — SDK MCP server for visual output tools.
 *
 * Exposes: render_preview, save_creation, edit_creation, save_as_template
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  renderPreviewTool,
  saveCreation,
  editCreation,
  saveAsTemplate,
} from '../agent-tools';
import { dispatchTool } from '../tool-dispatch';
import type { DispatchContext } from '../tool-dispatch';
import { sendSSE } from '../agent';

export function createVisualMcpServer(
  dispatchCtx: DispatchContext,
  uiContext: Record<string, unknown> | null,
) {
  return createSdkMcpServer({
    name: 'visual',
    version: '1.0.0',
    tools: [
      tool(
        'render_preview',
        'Render HTML to a screenshot image. Use this to check your work visually.',
        {
          html: z.string().describe('Self-contained HTML to render'),
          width: z.number().describe('Viewport width in pixels'),
          height: z.number().describe('Viewport height in pixels'),
        },
        async (args) => {
          const result = await dispatchTool(
            'render_preview',
            args as Record<string, unknown>,
            dispatchCtx,
            async () => {
              const rendered = await renderPreviewTool(
                args.html,
                args.width,
                args.height,
                dispatchCtx.signal,
              );
              return rendered;
            },
            { estDurationSec: 4 },
          );
          if (result.outcome === 'ok') {
            const rendered = result.result!;
            return {
              content: [
                { type: 'text' as const, text: 'Preview rendered successfully.' },
                {
                  type: 'image' as const,
                  data: rendered.base64,
                  mimeType: 'image/jpeg',
                },
              ],
            };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'save_creation',
        "Save HTML as a creation. Omit campaignId for a standalone creation (appears in the Creations tab). Only include campaignId when the UI context indicates an active campaign or the user asked to save into a specific campaign.",
        {
          html: z.string().describe('Self-contained HTML'),
          slotSchema: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Slot schema mapping slot names to their configuration'),
          platform: z
            .string()
            .describe('Platform/creation type (e.g. instagram, linkedin, one-pager)'),
          campaignId: z
            .string()
            .optional()
            .describe(
              "Existing campaign ID to save into. Omit for a standalone creation — it will be filed under the Creations tab. Only set when the UI's active campaign is a real campaign or the user explicitly named a campaign.",
            ),
        },
        async (args) => {
          const result = await dispatchTool(
            'save_creation',
            args as Record<string, unknown>,
            dispatchCtx,
            () =>
              Promise.resolve(
                saveCreation(
                  args.html,
                  args.slotSchema ?? null,
                  args.platform,
                  args.campaignId,
                ),
              ),
          );
          if (result.outcome === 'ok') {
            // Emit creation_ready so the frontend refreshes the campaign view
            // without waiting on the file-watcher. Shape matches the
            // pre-migration emission in agent.ts exactly.
            const parsed = result.result as {
              campaignId?: string;
              creationId?: string;
              iterationId?: string;
              htmlPath?: string;
              validation?: string;
            };
            if (parsed?.iterationId || parsed?.creationId) {
              sendSSE(dispatchCtx.res, 'creation_ready', {
                campaignId: parsed.campaignId,
                creationId: parsed.creationId,
                iterationId: parsed.iterationId,
                htmlPath: parsed.htmlPath,
              });
            }
            if (parsed?.validation) {
              sendSSE(dispatchCtx.res, 'validation_result', {
                iterationId: parsed.iterationId,
                result: parsed.validation,
              });
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'edit_creation',
        'Update the HTML of an existing iteration.',
        {
          iterationId: z.string().describe('Iteration ID to edit'),
          html: z.string().describe('Updated HTML'),
          slotSchema: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Optional updated slot schema'),
        },
        async (args) => {
          const result = await dispatchTool(
            'edit_creation',
            args as Record<string, unknown>,
            dispatchCtx,
            () =>
              Promise.resolve(
                editCreation(args.iterationId, args.html, args.slotSchema),
              ),
          );
          if (result.outcome === 'ok') {
            // Emit validation_result on edits (matches pre-migration shape).
            // Note: editCreation returns { success, validation? } — no campaign/
            // creation ids, so creation_ready cannot be emitted with the same
            // shape. Pre-migration had the same limitation.
            const parsed = result.result as { success?: boolean; validation?: string };
            if (parsed?.validation) {
              sendSSE(dispatchCtx.res, 'validation_result', {
                iterationId: args.iterationId,
                result: parsed.validation,
              });
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify(result.result) }] };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: result.outcome, message: result.error?.message ?? null }) }],
            isError: true,
          };
        },
      ),

      tool(
        'save_as_template',
        'Save an existing iteration as a reusable template.',
        {
          iterationId: z.string().describe('Source iteration ID'),
          name: z.string().describe('Template name'),
          category: z.string().describe('Template category'),
        },
        async (args) => {
          const result = await dispatchTool(
            'save_as_template',
            args as Record<string, unknown>,
            dispatchCtx,
            () =>
              Promise.resolve(saveAsTemplate(args.iterationId, args.name, args.category)),
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
