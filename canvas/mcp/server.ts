#!/usr/bin/env node
/**
 * Fluid Canvas MCP Server
 *
 * Standalone stdio MCP server that agents use to interact with the canvas:
 * - push_asset: Push generated HTML into the campaign hierarchy (SQLite)
 * - read_annotations: Read annotations for an iteration from SQLite
 * - read_statuses: Read iteration statuses for a frame from SQLite
 * - read_history: Read full iteration chain for a frame from SQLite
 * - iterate_request: Signal next-round iteration intent via SQLite API
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
import { readAnnotations } from './tools/read-annotations.js';
import { readStatuses } from './tools/read-statuses.js';
import { readHistory } from './tools/read-history.js';
import { iterateRequest } from './tools/iterate-request.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .fluid/ directory (two levels up from canvas/mcp/)
const FLUID_DIR = path.resolve(__dirname, '../../.fluid');

// API base URL (override via MCP_API_BASE env for dev/test)
const API_BASE = process.env.MCP_API_BASE ?? 'http://localhost:5174';

const server = new McpServer({
  name: 'fluid-canvas',
  version: '2.0.0',
});

// --- Tool: push_asset (V2 — campaign-aware) ---
server.tool(
  'push_asset',
  'Push a newly generated HTML asset into the campaign hierarchy. Creates an Iteration record in SQLite.',
  {
    // V2 params
    campaignId: z.string().optional().describe('Campaign ID (cmp_xxx)'),
    assetId: z.string().optional().describe('Asset ID within the campaign'),
    frameId: z.string().optional().describe('Frame ID (frm_xxx) — required for V2'),
    html: z.string().describe('Full HTML content of the asset'),
    iterationIndex: z.number().int().optional().describe('Iteration index (auto if omitted)'),
    slotSchema: z.record(z.unknown()).optional().describe('Slot schema JSON for content editor'),
    source: z.enum(['ai', 'template']).optional().describe('How the asset was created (default: ai)'),
    templateId: z.string().optional().describe('Template ID if source=template'),
    platform: z.string().optional().describe('Platform hint (e.g. instagram-square)'),
    // V1 legacy params (deprecated)
    sessionId: z.string().optional().describe('[DEPRECATED] Use frameId instead'),
    variationId: z.string().optional().describe('[DEPRECATED] Use the V2 campaign params instead'),
  },
  async (params) => {
    try {
      // Detect legacy V1 call
      if (params.sessionId || params.variationId) {
        if (!params.frameId) {
          // Pure legacy call — return deprecation error
          console.error('[push_asset] DEPRECATED call detected (sessionId/variationId). Use V2 campaign params.');
          handleLegacyPushAsset({
            sessionId: params.sessionId ?? 'unknown',
            variationId: params.variationId ?? 'unknown',
            html: params.html,
            platform: params.platform,
          });
        }
      }

      // V2 call — frameId is required
      if (!params.frameId) {
        throw new Error('push_asset: frameId is required. Provide campaignId, assetId, and frameId.');
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
        API_BASE
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
  }
);

// --- Tool: read_annotations ---
server.tool(
  'read_annotations',
  'Read all annotations for a specific iteration from SQLite',
  {
    iterationId: z.string().describe('Iteration ID (itr_xxx)'),
  },
  async ({ iterationId }) => {
    try {
      const result = await readAnnotations(iterationId, API_BASE);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[read_annotations] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// --- Tool: read_statuses ---
server.tool(
  'read_statuses',
  'Read variation statuses (winner/rejected/final/unmarked) for all iterations in a frame',
  {
    frameId: z.string().describe('Frame ID (frm_xxx)'),
  },
  async ({ frameId }) => {
    try {
      const result = await readStatuses(frameId, API_BASE);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[read_statuses] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// --- Tool: read_history ---
server.tool(
  'read_history',
  'Read full iteration chain for a frame, including all annotations across all iterations',
  {
    frameId: z.string().describe('Frame ID (frm_xxx)'),
  },
  async ({ frameId }) => {
    try {
      const result = await readHistory(frameId, API_BASE);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[read_history] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// --- Tool: iterate_request ---
server.tool(
  'iterate_request',
  'Signal that the next iteration round should begin, specifying the winner and feedback',
  {
    frameId: z.string().describe('Frame ID to iterate on'),
    feedback: z.string().describe('Human feedback for the next generation round'),
    winnerId: z.string().describe('ID of the winning iteration to base the next round on'),
  },
  async ({ frameId, feedback, winnerId }) => {
    try {
      const result = await iterateRequest(frameId, feedback, winnerId, API_BASE);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[iterate_request] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// --- Start server ---
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
