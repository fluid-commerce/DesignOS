#!/usr/bin/env node
/**
 * Fluid Canvas MCP Server
 *
 * Standalone stdio MCP server that agents use to interact with the canvas:
 * - push_asset: Push generated HTML to .fluid/working/
 * - read_annotations: Read annotations for a session
 * - read_statuses: Read variation statuses (winner/rejected/final)
 * - read_history: Access full revision history
 * - read_iteration_request: Receive iteration requests from canvas UI
 *
 * CRITICAL: Never use console.log() -- it corrupts the stdio protocol.
 * Use console.error() for all diagnostic output.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pushAsset } from './tools/push-asset.js';
import { readAnnotations } from './tools/read-annotations.js';
import { readStatuses } from './tools/read-statuses.js';
import { readHistory } from './tools/read-history.js';
import { readIterationRequest } from './tools/iterate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKING_DIR = path.resolve(__dirname, '../../.fluid/working');

const server = new McpServer({
  name: 'fluid-canvas',
  version: '1.0.0',
});

// --- Tool: push_asset ---
server.tool(
  'push_asset',
  'Push a newly generated HTML asset to the canvas working directory',
  {
    sessionId: z.string().describe('Session ID (e.g. 20260310-143022)'),
    variationId: z.string().describe('Variation ID (e.g. v1, v2)'),
    html: z.string().describe('Full HTML content of the asset'),
    platform: z.string().optional().describe('Platform (e.g. instagram-square, linkedin-landscape)'),
  },
  async ({ sessionId, variationId, html, platform }) => {
    try {
      const result = await pushAsset(WORKING_DIR, { sessionId, variationId, html, platform });
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
  'Read all annotations and statuses for a session',
  {
    sessionId: z.string().describe('Session ID (e.g. 20260310-143022)'),
  },
  async ({ sessionId }) => {
    try {
      const result = await readAnnotations(WORKING_DIR, sessionId);
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
  'Read variation statuses (winner/rejected/final/unmarked) for a session',
  {
    sessionId: z.string().describe('Session ID (e.g. 20260310-143022)'),
  },
  async ({ sessionId }) => {
    try {
      const result = await readStatuses(WORKING_DIR, sessionId);
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
  'Read full revision history including all rounds, variations, and annotations',
  {
    sessionId: z.string().describe('Session ID (e.g. 20260310-143022)'),
  },
  async ({ sessionId }) => {
    try {
      const result = await readHistory(WORKING_DIR, sessionId);
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

// --- Tool: read_iteration_request ---
server.tool(
  'read_iteration_request',
  'Read a pending iteration request from the canvas UI (returns null if none pending)',
  {
    sessionId: z.string().describe('Session ID (e.g. 20260310-143022)'),
  },
  async ({ sessionId }) => {
    try {
      const result = await readIterationRequest(WORKING_DIR, sessionId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[read_iteration_request] Error: ${message}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// --- Start server ---
async function main() {
  console.error('[fluid-canvas] Starting MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[fluid-canvas] MCP server connected via stdio');
}

main().catch((err) => {
  console.error('[fluid-canvas] Fatal error:', err);
  process.exit(1);
});
