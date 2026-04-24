/**
 * health-route.ts
 *
 * GET /api/health — subsystem status for ops visibility.
 *
 * Returns JSON:
 * {
 *   anthropic: 'ok' | 'api_key_missing' | 'claude_login_stale' | 'unreachable',
 *   gemini: 'ok' | 'api_key_missing' | 'unreachable' | 'over_cap',
 *   dam: 'ok' | 'token_missing' | 'sync_stale',
 *   archetypes: { total: number, by_platform: Record<string, number> },
 *   skills: string[],
 *   daily_spend_usd: number,
 *   daily_cap_usd: number
 * }
 *
 * Never hits the LLM/image APIs — checks for credentials + cached state only.
 * `claude_login_stale` check: deferred to Phase 25 (Agent SDK migration).
 */

import type { IncomingMessage, ServerResponse } from 'http';
import fsSync from 'node:fs';
import path from 'node:path';
import { dailySpendUsd } from './db-api';
import { listArchetypes } from './agent-tools';

type AnthropicStatus = 'ok' | 'api_key_missing' | 'claude_login_stale' | 'unreachable';
type GeminiStatus = 'ok' | 'api_key_missing' | 'unreachable' | 'over_cap';
type DamStatus = 'ok' | 'token_missing' | 'sync_stale';

interface HealthResponse {
  anthropic: AnthropicStatus;
  gemini: GeminiStatus;
  dam: DamStatus;
  archetypes: { total: number; by_platform: Record<string, number> };
  skills: string[];
  daily_spend_usd: number;
  daily_cap_usd: number;
}

export function handleHealthRoute(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' || !req.url?.startsWith('/api/health')) return false;
  const pathname = req.url.split('?')[0];
  if (pathname !== '/api/health') return false;

  const dailyCapUsd = parseFloat(process.env.FLUID_DAILY_COST_CAP_USD ?? '10.00');
  const spendToday = dailySpendUsd();

  // ── anthropic ────────────────────────────────────────────────────────────────
  const anthropicStatus: AnthropicStatus = process.env.ANTHROPIC_API_KEY ? 'ok' : 'api_key_missing';

  // ── gemini ───────────────────────────────────────────────────────────────────
  let geminiStatus: GeminiStatus;
  if (!process.env.GEMINI_API_KEY) {
    geminiStatus = 'api_key_missing';
  } else if (spendToday >= dailyCapUsd) {
    geminiStatus = 'over_cap';
  } else {
    geminiStatus = 'ok';
  }

  // ── dam ──────────────────────────────────────────────────────────────────────
  const damStatus: DamStatus = process.env.VITE_FLUID_DAM_TOKEN ? 'ok' : 'token_missing';
  // sync_stale deferred — no sync timestamp currently tracked

  // ── archetypes ───────────────────────────────────────────────────────────────
  const allArchetypes = listArchetypes({ pageSize: 50 });
  const byPlatform: Record<string, number> = {};
  for (const a of allArchetypes) {
    byPlatform[a.platform] = (byPlatform[a.platform] ?? 0) + 1;
  }

  // ── skills ───────────────────────────────────────────────────────────────────
  const skillsDir = path.join(path.dirname(__filename), 'skills');
  let skills: string[] = [];
  try {
    skills = fsSync
      .readdirSync(skillsDir)
      .filter((f) => f.endsWith('-skill.md'))
      .map((f) => f.replace(/-skill\.md$/, ''));
  } catch {
    // skills dir not found — return empty list
  }

  const payload: HealthResponse = {
    anthropic: anthropicStatus,
    gemini: geminiStatus,
    dam: damStatus,
    archetypes: { total: allArchetypes.length, by_platform: byPlatform },
    skills,
    daily_spend_usd: spendToday,
    daily_cap_usd: dailyCapUsd,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
  return true;
}
