/**
 * Database API layer for the Campaign > Asset > Frame > Iteration hierarchy.
 * All functions are synchronous (better-sqlite3 sync API).
 * Server-only module — never import from React components.
 *
 * Channels and JSON fields (slotSchema, aiBaseline, userState) are serialized
 * to/from JSON when reading/writing to SQLite.
 */

import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';
import type { Campaign, Asset, Frame, Iteration, CampaignAnnotation } from '../lib/campaign-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deserialize a Campaign row from SQLite (channels is JSON string). */
function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    title: row.title as string,
    channels: JSON.parse(row.channels as string) as string[],
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

/** Deserialize an Asset row from SQLite. */
function rowToAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    title: row.title as string,
    assetType: row.asset_type as string,
    frameCount: row.frame_count as number,
    createdAt: row.created_at as number,
  };
}

/** Deserialize a Frame row from SQLite. */
function rowToFrame(row: Record<string, unknown>): Frame {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    frameIndex: row.frame_index as number,
    createdAt: row.created_at as number,
  };
}

/** Deserialize an Iteration row from SQLite (JSON fields parsed). */
function rowToIteration(row: Record<string, unknown>): Iteration {
  return {
    id: row.id as string,
    frameId: row.frame_id as string,
    iterationIndex: row.iteration_index as number,
    htmlPath: row.html_path as string,
    slotSchema: row.slot_schema ? JSON.parse(row.slot_schema as string) : null,
    aiBaseline: row.ai_baseline ? JSON.parse(row.ai_baseline as string) : null,
    userState: row.user_state ? JSON.parse(row.user_state as string) : null,
    status: row.status as Iteration['status'],
    source: row.source as Iteration['source'],
    templateId: (row.template_id as string | null) ?? null,
    generationStatus: (row.generation_status as Iteration['generationStatus']) ?? 'complete',
    createdAt: row.created_at as number,
  };
}

/** Deserialize a CampaignAnnotation row from SQLite. */
function rowToAnnotation(row: Record<string, unknown>): CampaignAnnotation {
  return {
    id: row.id as string,
    iterationId: row.iteration_id as string,
    type: row.type as CampaignAnnotation['type'],
    author: row.author as string,
    text: row.text as string,
    x: row.x != null ? (row.x as number) : undefined,
    y: row.y != null ? (row.y as number) : undefined,
    createdAt: row.created_at as number,
  };
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export function createCampaign(input: { title: string; channels: string[] }): Campaign {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.title, JSON.stringify(input.channels), now, now);
  return { id, title: input.title, channels: input.channels, createdAt: now, updatedAt: now };
}

export function getCampaigns(): Campaign[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM campaigns ORDER BY created_at DESC'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToCampaign(row) : undefined;
}

// ─── Asset ───────────────────────────────────────────────────────────────────

export function createAsset(input: {
  campaignId: string;
  title: string;
  assetType: string;
  frameCount: number;
}): Asset {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO assets (id, campaign_id, title, asset_type, frame_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.campaignId, input.title, input.assetType, input.frameCount, now);
  return {
    id,
    campaignId: input.campaignId,
    title: input.title,
    assetType: input.assetType,
    frameCount: input.frameCount,
    createdAt: now,
  };
}

export function getAssets(campaignId: string): Asset[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM assets WHERE campaign_id = ? ORDER BY created_at ASC'
  ).all(campaignId) as Record<string, unknown>[];
  return rows.map(rowToAsset);
}

// ─── Frame ───────────────────────────────────────────────────────────────────

export function createFrame(input: { assetId: string; frameIndex: number }): Frame {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO frames (id, asset_id, frame_index, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, input.assetId, input.frameIndex, now);
  return { id, assetId: input.assetId, frameIndex: input.frameIndex, createdAt: now };
}

export function getFrames(assetId: string): Frame[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM frames WHERE asset_id = ? ORDER BY frame_index ASC'
  ).all(assetId) as Record<string, unknown>[];
  return rows.map(rowToFrame);
}

// ─── Iteration ────────────────────────────────────────────────────────────────

export function createIteration(input: {
  frameId: string;
  iterationIndex: number;
  htmlPath: string;
  slotSchema?: object | null;
  aiBaseline?: object | null;
  source: 'ai' | 'template';
  templateId?: string | null;
  generationStatus?: 'pending' | 'generating' | 'complete';
}): Iteration {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const generationStatus = input.generationStatus ?? 'complete';
  db.prepare(
    `INSERT INTO iterations
      (id, frame_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, template_id, generation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.frameId,
    input.iterationIndex,
    input.htmlPath,
    input.slotSchema ? JSON.stringify(input.slotSchema) : null,
    input.aiBaseline ? JSON.stringify(input.aiBaseline) : null,
    null,                    // userState starts as null
    'unmarked',              // default status
    input.source,
    input.templateId ?? null,
    generationStatus,
    now
  );
  return {
    id,
    frameId: input.frameId,
    iterationIndex: input.iterationIndex,
    htmlPath: input.htmlPath,
    slotSchema: input.slotSchema ?? null,
    aiBaseline: input.aiBaseline ?? null,
    userState: null,
    status: 'unmarked',
    source: input.source,
    templateId: input.templateId ?? null,
    generationStatus,
    createdAt: now,
  };
}

export function getIterations(frameId: string): Iteration[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM iterations WHERE frame_id = ? ORDER BY iteration_index ASC'
  ).all(frameId) as Record<string, unknown>[];
  return rows.map(rowToIteration);
}

export function updateIterationStatus(id: string, status: Iteration['status']): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET status = ? WHERE id = ?').run(status, id);
}

export function updateIterationUserState(id: string, userState: object): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET user_state = ? WHERE id = ?').run(JSON.stringify(userState), id);
}

export function updateIterationGenerationStatus(
  id: string,
  status: 'pending' | 'generating' | 'complete'
): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET generation_status = ? WHERE id = ?').run(status, id);
}

export function getLatestIterationByFrame(frameId: string): Iteration | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM iterations WHERE frame_id = ? ORDER BY iteration_index DESC LIMIT 1'
  ).get(frameId) as Record<string, unknown> | undefined;
  return row ? rowToIteration(row) : undefined;
}

// ─── Asset (additional helpers) ───────────────────────────────────────────────

export function updateAsset(id: string, input: { title?: string }): void {
  const db = getDb();
  if (input.title !== undefined) {
    db.prepare('UPDATE assets SET title = ? WHERE id = ?').run(input.title, id);
  }
}

// ─── Annotation ──────────────────────────────────────────────────────────────

export function createAnnotation(input: {
  iterationId: string;
  type: 'pin' | 'sidebar';
  author: string;
  text: string;
  x?: number;
  y?: number;
}): CampaignAnnotation {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO annotations (id, iteration_id, type, author, text, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.iterationId, input.type, input.author, input.text, input.x ?? null, input.y ?? null, now);
  return {
    id,
    iterationId: input.iterationId,
    type: input.type,
    author: input.author,
    text: input.text,
    x: input.x,
    y: input.y,
    createdAt: now,
  };
}

export function getAnnotations(iterationId: string): CampaignAnnotation[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM annotations WHERE iteration_id = ? ORDER BY created_at ASC'
  ).all(iterationId) as Record<string, unknown>[];
  return rows.map(rowToAnnotation);
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * Atomically creates a campaign and its initial assets.
 * Rolls back everything if any insert fails (FK violation, null constraint, etc.).
 */
export function createCampaignWithAssets(
  campaignInput: { title: string; channels: string[] },
  assetsInput: Array<{ title: string; assetType: string; frameCount: number }>
): { campaign: Campaign; assets: Asset[] } {
  const db = getDb();

  const campaignId = nanoid();
  const now = Date.now();

  const insertCampaign = db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAsset = db.prepare(
    'INSERT INTO assets (id, campaign_id, title, asset_type, frame_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const campaign: Campaign = {
    id: campaignId,
    title: campaignInput.title,
    channels: campaignInput.channels,
    createdAt: now,
    updatedAt: now,
  };

  const assets: Asset[] = assetsInput.map((a) => ({
    id: nanoid(),
    campaignId,
    title: a.title,
    assetType: a.assetType,
    frameCount: a.frameCount,
    createdAt: now,
  }));

  const transaction = db.transaction(() => {
    insertCampaign.run(
      campaignId,
      campaignInput.title,
      JSON.stringify(campaignInput.channels),
      now,
      now
    );
    for (const asset of assets) {
      insertAsset.run(asset.id, campaignId, asset.title, asset.assetType, asset.frameCount, now);
    }
  });

  transaction();
  return { campaign, assets };
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Returns up to 4 preview entries for a campaign — one per asset (latest iteration).
 * Joins assets -> frames -> iterations using a subquery to get max iteration_index per frame.
 */
export function getCampaignPreviewUrls(
  campaignId: string
): Array<{ iterationId: string; htmlPath: string; assetType: string }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      i.id          AS iteration_id,
      i.html_path   AS html_path,
      a.asset_type  AS asset_type
    FROM assets a
    JOIN frames f ON f.asset_id = a.id
    JOIN iterations i ON i.frame_id = f.id
    INNER JOIN (
      SELECT frame_id, MAX(iteration_index) AS max_idx
      FROM iterations
      GROUP BY frame_id
    ) latest ON latest.frame_id = i.frame_id AND i.iteration_index = latest.max_idx
    WHERE a.campaign_id = ?
    GROUP BY a.id
    ORDER BY a.created_at ASC
    LIMIT 4
  `).all(campaignId) as Array<{ iteration_id: string; html_path: string; asset_type: string }>;

  return rows.map((row) => ({
    iterationId: row.iteration_id,
    htmlPath: row.html_path,
    assetType: row.asset_type,
  }));
}
