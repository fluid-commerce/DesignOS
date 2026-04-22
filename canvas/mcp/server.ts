#!/usr/bin/env node
/**
 * Fluid Canvas MCP Server
 *
 * Stdio MCP server that agents use to push generated HTML into the canvas.
 *
 * CRITICAL: Never use console.log() -- it corrupts the stdio protocol.
 * Use console.error() for all diagnostic output.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pushAsset, handleLegacyPushAsset } from './tools/push-asset.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .fluid/ directory (two levels up from canvas/mcp/)
const FLUID_DIR = path.resolve(__dirname, '../../.fluid');

// API base URL (override via MCP_API_BASE env for dev/test)
const API_BASE = process.env.MCP_API_BASE ?? 'http://localhost:5174';

const server = new McpServer({
  name: 'fluid-canvas',
  version: '2.0.0',
});

server.tool(
  'push_asset',
  'Push a newly generated HTML asset into the campaign hierarchy. Creates an Iteration record in SQLite.',
  {
    campaignId: z.string().optional().describe('Campaign ID (cmp_xxx)'),
    assetId: z.string().optional().describe('Asset ID within the campaign'),
    frameId: z.string().optional().describe('Frame ID (frm_xxx) — required'),
    html: z.string().describe('Full HTML content of the asset'),
    iterationIndex: z.number().int().optional().describe('Iteration index (auto if omitted)'),
    slotSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Slot schema JSON for content editor'),
    source: z
      .enum(['ai', 'template'])
      .optional()
      .describe('How the asset was created (default: ai)'),
    templateId: z.string().optional().describe('Template ID if source=template'),
    platform: z.string().optional().describe('Platform hint (e.g. instagram-square)'),
    // V1 legacy params — accepted only to emit a useful deprecation error
    sessionId: z.string().optional().describe('[DEPRECATED] Use frameId instead'),
    variationId: z.string().optional().describe('[DEPRECATED] Use the V2 campaign params instead'),
  },
  async (params) => {
    try {
      if ((params.sessionId || params.variationId) && !params.frameId) {
        handleLegacyPushAsset({
          sessionId: params.sessionId ?? 'unknown',
          variationId: params.variationId ?? 'unknown',
          html: params.html,
          platform: params.platform,
        });
      }

      if (!params.frameId) {
        throw new Error(
          'push_asset: frameId is required. Provide campaignId, assetId, and frameId.',
        );
      }

      const result = await pushAsset(
        FLUID_DIR,
        {
          campaignId: params.campaignId ?? 'default',
          assetId: params.assetId ?? 'default',
          frameId: params.frameId,
          html: params.html,
          iterationIndex: params.iterationIndex,
          slotSchema: params.slotSchema as object | undefined,
          source: params.source,
          templateId: params.templateId,
          platform: params.platform,
        },
        API_BASE,
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[push_asset] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  },
);

async function main() {
  console.error('[fluid-canvas] Starting MCP server v2 (SQLite/campaign-hierarchy)...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[fluid-canvas] MCP server connected via stdio');
}

main().catch((err) => {
  console.error('[fluid-canvas] Fatal error:', err);
  process.exit(1);
});
