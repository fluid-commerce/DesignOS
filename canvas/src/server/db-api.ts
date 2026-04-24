/**
 * Database API layer for the Campaign > Creation > Slide > Iteration hierarchy.
 * All functions are synchronous (better-sqlite3 sync API).
 * Server-only module — never import from React components.
 *
 * Channels and JSON fields (slotSchema, aiBaseline, userState) are serialized
 * to/from JSON when reading/writing to SQLite.
 */

import { nanoid } from 'nanoid';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getDb } from '../lib/db';
import { slugify } from '../lib/slugify';
import type {
  Campaign,
  Creation,
  Slide,
  Iteration,
  CampaignAnnotation,
} from '../lib/campaign-types';
import { resolveSlotSchemaForIteration } from '../lib/template-configs';

// Project root for resolving relative html_path values. Mirrors the computation
// used by agent-tools.saveCreation and the watcher, so cleanup resolves exactly
// the same paths the runtime writes/serves from.
const DB_API_PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

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

/** Deserialize a Creation row from SQLite. */
function rowToCreation(row: Record<string, unknown>): Creation {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    title: row.title as string,
    creationType: row.creation_type as string,
    slideCount: row.slide_count as number,
    createdAt: row.created_at as number,
  };
}

/** Deserialize a Slide row from SQLite. */
function rowToSlide(row: Record<string, unknown>): Slide {
  return {
    id: row.id as string,
    creationId: row.creation_id as string,
    slideIndex: row.slide_index as number,
    createdAt: row.created_at as number,
  };
}

/** Safe JSON parse for optional DB columns (handles invalid or legacy data). */
function safeJsonParse(value: unknown): object | null {
  if (value == null || value === '') return null;
  try {
    const parsed = JSON.parse(value as string);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Deserialize an Iteration row from SQLite (JSON fields parsed). Tolerates missing generation_status (legacy DB). */
function rowToIteration(row: Record<string, unknown>): Iteration {
  const storedSlotSchema = row.slot_schema ? JSON.parse(row.slot_schema as string) : null;
  return {
    id: row.id as string,
    slideId: row.slide_id as string,
    iterationIndex: Number(row.iteration_index) || 0,
    htmlPath: row.html_path as string,
    slotSchema: resolveSlotSchemaForIteration(
      storedSlotSchema,
      (row.template_id as string | null) ?? null,
      row.html_path as string,
    ),
    aiBaseline: safeJsonParse(row.ai_baseline),
    userState: safeJsonParse(row.user_state),
    status: (row.status as Iteration['status']) ?? 'unmarked',
    source: (row.source as Iteration['source']) ?? 'ai',
    templateId: (row.template_id as string | null) ?? null,
    generationStatus: (row.generation_status as Iteration['generationStatus']) ?? 'complete',
    createdAt: Number(row.created_at) || 0,
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
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, input.title, JSON.stringify(input.channels), now, now);
  return { id, title: input.title, channels: input.channels, createdAt: now, updatedAt: now };
}

export function getCampaigns(): Campaign[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCampaign(row) : undefined;
}

/**
 * Sentinel title for the singleton standalone campaign. Standalone creations
 * (single-asset saves without an explicit campaign) are filed under this
 * campaign so they satisfy the `creations.campaign_id` NOT NULL constraint
 * while remaining grouped together for the Creations tab UI.
 */
export const STANDALONE_CAMPAIGN_TITLE = '__standalone__';

/**
 * Returns the ID of the singleton "__standalone__" sentinel campaign, creating
 * it on first call. Idempotent — subsequent calls always return the same ID.
 *
 * Used by:
 *   - agent-tools.saveCreation, to route campaignless saves to a single bucket
 *     instead of spawning a fresh "Agent Campaign ..." row per save.
 *   - watcher / UI flows that need to attach standalone creations to a known
 *     campaign before the user has picked one.
 */
export function getOrCreateStandaloneCampaignId(): string {
  const db = getDb();
  const row = db.prepare('SELECT id FROM campaigns WHERE title = ?').get(
    STANDALONE_CAMPAIGN_TITLE,
  ) as { id: string } | undefined;
  if (row) return row.id;
  const campaign = createCampaign({
    title: STANDALONE_CAMPAIGN_TITLE,
    channels: ['standalone'],
  });
  return campaign.id;
}

// ─── Creation ───────────────────────────────────────────────────────────────

export function createCreation(input: {
  campaignId: string;
  title: string;
  creationType: string;
  slideCount: number;
}): Creation {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, input.campaignId, input.title, input.creationType, input.slideCount, now);
  return {
    id,
    campaignId: input.campaignId,
    title: input.title,
    creationType: input.creationType,
    slideCount: input.slideCount,
    createdAt: now,
  };
}

export function getCreations(campaignId: string): Creation[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM creations WHERE campaign_id = ? ORDER BY created_at DESC')
    .all(campaignId) as Record<string, unknown>[];
  return rows.map(rowToCreation);
}

// ─── Slide ──────────────────────────────────────────────────────────────────

export function createSlide(input: { creationId: string; slideIndex: number }): Slide {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, input.creationId, input.slideIndex, now);
  return { id, creationId: input.creationId, slideIndex: input.slideIndex, createdAt: now };
}

export function getSlides(creationId: string): Slide[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM slides WHERE creation_id = ? ORDER BY slide_index ASC')
    .all(creationId) as Record<string, unknown>[];
  return rows.map(rowToSlide);
}

export function getSlideById(slideId: string): Slide | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM slides WHERE id = ?').get(slideId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSlide(row) : undefined;
}

// ─── Iteration ────────────────────────────────────────────────────────────────

export function createIteration(input: {
  id?: string;
  slideId: string;
  iterationIndex: number;
  htmlPath: string;
  slotSchema?: object | null;
  aiBaseline?: object | null;
  source: 'ai' | 'template';
  templateId?: string | null;
  generationStatus?: 'pending' | 'generating' | 'complete';
}): Iteration {
  const db = getDb();
  const id = input.id ?? nanoid();
  const now = Date.now();
  const generationStatus = input.generationStatus ?? 'complete';
  db.prepare(
    `INSERT INTO iterations
      (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, template_id, generation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.slideId,
    input.iterationIndex,
    input.htmlPath,
    input.slotSchema ? JSON.stringify(input.slotSchema) : null,
    input.aiBaseline ? JSON.stringify(input.aiBaseline) : null,
    null, // userState starts as null
    'unmarked', // default status
    input.source,
    input.templateId ?? null,
    generationStatus,
    now,
  );
  return {
    id,
    slideId: input.slideId,
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

export function getIterations(slideId: string): Iteration[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM iterations WHERE slide_id = ? ORDER BY iteration_index ASC')
    .all(slideId) as Record<string, unknown>[];
  return rows.map(rowToIteration);
}

export function updateIterationStatus(id: string, status: Iteration['status']): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET status = ? WHERE id = ?').run(status, id);
}

export function updateIterationUserState(id: string, userState: object): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET user_state = ? WHERE id = ?').run(
    JSON.stringify(userState),
    id,
  );
}

export function updateIterationGenerationStatus(
  id: string,
  status: 'pending' | 'generating' | 'complete',
): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET generation_status = ? WHERE id = ?').run(status, id);
}

export function updateIterationSlotSchema(id: string, slotSchema: object): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET slot_schema = ? WHERE id = ?').run(
    JSON.stringify(slotSchema),
    id,
  );
}

export function getLatestIterationBySlide(slideId: string): Iteration | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM iterations WHERE slide_id = ? ORDER BY iteration_index DESC LIMIT 1')
    .get(slideId) as Record<string, unknown> | undefined;
  return row ? rowToIteration(row) : undefined;
}

// ─── Creation (additional helpers) ──────────────────────────────────────────

export function updateCreation(id: string, input: { title?: string }): void {
  const db = getDb();
  if (input.title !== undefined) {
    db.prepare('UPDATE creations SET title = ? WHERE id = ?').run(input.title, id);
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
    'INSERT INTO annotations (id, iteration_id, type, author, text, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.iterationId,
    input.type,
    input.author,
    input.text,
    input.x ?? null,
    input.y ?? null,
    now,
  );
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
  const rows = db
    .prepare('SELECT * FROM annotations WHERE iteration_id = ? ORDER BY created_at ASC')
    .all(iterationId) as Record<string, unknown>[];
  return rows.map(rowToAnnotation);
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * Atomically creates a campaign and its initial creations.
 * Rolls back everything if any insert fails (FK violation, null constraint, etc.).
 */
export function createCampaignWithCreations(
  campaignInput: { title: string; channels: string[] },
  creationsInput: Array<{ title: string; creationType: string; slideCount: number }>,
): { campaign: Campaign; creations: Creation[] } {
  const db = getDb();

  const campaignId = nanoid();
  const now = Date.now();

  const insertCampaign = db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertCreation = db.prepare(
    'INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );

  const campaign: Campaign = {
    id: campaignId,
    title: campaignInput.title,
    channels: campaignInput.channels,
    createdAt: now,
    updatedAt: now,
  };

  const creations: Creation[] = creationsInput.map((a) => ({
    id: nanoid(),
    campaignId,
    title: a.title,
    creationType: a.creationType,
    slideCount: a.slideCount,
    createdAt: now,
  }));

  const transaction = db.transaction(() => {
    insertCampaign.run(
      campaignId,
      campaignInput.title,
      JSON.stringify(campaignInput.channels),
      now,
      now,
    );
    for (const creation of creations) {
      insertCreation.run(
        creation.id,
        campaignId,
        creation.title,
        creation.creationType,
        creation.slideCount,
        now,
      );
    }
  });

  transaction();
  return { campaign, creations };
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Returns up to 4 preview entries for a campaign — one per creation (latest iteration).
 * Joins creations -> slides -> iterations using a subquery to get max iteration_index per slide.
 */
export function getCampaignPreviewUrls(
  campaignId: string,
): Array<{ iterationId: string; htmlPath: string; creationType: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT
      i.id              AS iteration_id,
      i.html_path       AS html_path,
      c.creation_type   AS creation_type
    FROM creations c
    JOIN slides s ON s.creation_id = c.id
    JOIN iterations i ON i.slide_id = s.id
    INNER JOIN (
      SELECT slide_id, MAX(iteration_index) AS max_idx
      FROM iterations
      GROUP BY slide_id
    ) latest ON latest.slide_id = i.slide_id AND i.iteration_index = latest.max_idx
    WHERE c.campaign_id = ?
    GROUP BY c.id
    ORDER BY c.created_at ASC
    LIMIT 4
  `,
    )
    .all(campaignId) as Array<{ iteration_id: string; html_path: string; creation_type: string }>;

  return rows.map((row) => ({
    iterationId: row.iteration_id,
    htmlPath: row.html_path,
    creationType: row.creation_type,
  }));
}

// ─── Brand assets (catalog of shared assets served via /fluid-assets/) ──────

export interface BrandAsset {
  id: string;
  name: string;
  category: string;
  url: string; // /api/brand-assets/serve/{name} (DB-backed serving)
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  source: string; // 'local' | 'dam'
  damDeleted: boolean; // true if soft-deleted from DAM
  description: string | null;
}

function rowToBrandAsset(row: Record<string, unknown>): BrandAsset {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    url: `/api/brand-assets/serve/${encodeURIComponent(row.name as string)}`,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    tags: JSON.parse(row.tags as string),
    source: (row.source as string) ?? 'local',
    damDeleted: (row.dam_deleted as number) === 1,
    description: (row.description as string | null) ?? null,
  };
}

export function getBrandAssets(category?: string): BrandAsset[] {
  const db = getDb();
  if (category) {
    return (
      db
        .prepare(
          'SELECT * FROM brand_assets WHERE category = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY name ASC',
        )
        .all(category) as Record<string, unknown>[]
    ).map(rowToBrandAsset);
  }
  return (
    db
      .prepare(
        'SELECT * FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY category ASC, name ASC',
      )
      .all() as Record<string, unknown>[]
  ).map(rowToBrandAsset);
}

/** Look up a single brand asset by name (first match). Returns raw row with file_path and mime_type. */
export function getBrandAssetByName(
  name: string,
): { file_path: string; mime_type: string } | undefined {
  const db = getDb();
  return db
    .prepare(
      'SELECT file_path, mime_type FROM brand_assets WHERE name = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) LIMIT 1',
    )
    .get(name) as { file_path: string; mime_type: string } | undefined;
}

/** Look up a single brand asset by file_path. Returns raw row with file_path and mime_type. */
export function getBrandAssetByFilePath(
  filePath: string,
): { file_path: string; mime_type: string; name: string } | undefined {
  const db = getDb();
  return db
    .prepare(
      'SELECT file_path, mime_type, name FROM brand_assets WHERE file_path = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) LIMIT 1',
    )
    .get(filePath) as { file_path: string; mime_type: string; name: string } | undefined;
}

/** Returns ALL brand assets including soft-deleted DAM assets. Used by the UI to show "Removed from DAM" state. */
export function getAllBrandAssets(category?: string): BrandAsset[] {
  const db = getDb();
  if (category) {
    return (
      db
        .prepare('SELECT * FROM brand_assets WHERE category = ? ORDER BY name ASC')
        .all(category) as Record<string, unknown>[]
    ).map(rowToBrandAsset);
  }
  return (
    db.prepare('SELECT * FROM brand_assets ORDER BY category ASC, name ASC').all() as Record<
      string,
      unknown
    >[]
  ).map(rowToBrandAsset);
}

/** Update mutable metadata fields (category, description) on a brand asset. */
export function updateBrandAsset(
  id: string,
  updates: { category?: string; description?: string },
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (updates.category !== undefined) {
    sets.push('category = ?');
    vals.push(updates.category);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    vals.push(updates.description);
  }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE brand_assets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/**
 * Insert a user-uploaded image as a brand asset with source='upload'.
 * One-off uploads persist permanently so creation links never break.
 * Users can later promote uploads to the curated library by updating the source.
 */
export function insertUploadedAsset(params: {
  id: string;
  name: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
}): BrandAsset {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO brand_assets (id, name, category, file_path, mime_type, size_bytes, tags, description, source, dam_deleted)
    VALUES (?, ?, 'images', ?, ?, ?, '[]', ?, 'upload', 0)
  `,
  ).run(
    params.id,
    params.name,
    params.filePath,
    params.mimeType,
    params.sizeBytes,
    params.description ?? null,
  );

  return {
    id: params.id,
    name: params.name,
    category: 'images',
    url: `/api/brand-assets/serve/${encodeURIComponent(params.name)}`,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    tags: [],
    source: 'upload',
    damDeleted: false,
    description: params.description ?? null,
  };
}

/**
 * Promote a one-off upload to the curated brand library.
 * Changes source from 'upload' to 'local' so it appears alongside DAM assets.
 */
export function promoteUploadToLibrary(assetId: string): void {
  const db = getDb();
  db.prepare("UPDATE brand_assets SET source = 'local' WHERE id = ? AND source = 'upload'").run(
    assetId,
  );
}

// ─── DAM asset sync ──────────────────────────────────────────────────────────

export interface DamAssetRow {
  damId: string;
  name: string;
  category: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  damUrl: string;
  damModifiedAt: string;
}

/**
 * Insert a new DAM asset or update an existing one if it has been modified.
 *
 * - If no existing row: INSERT with source='dam'
 * - If existing row with same dam_modified_at: skip (no change)
 * - If existing row with older dam_modified_at: UPDATE fields + clear dam_deleted
 */
export function upsertDamAsset(row: DamAssetRow): void {
  const db = getDb();
  const existing = db
    .prepare('SELECT id, dam_modified_at, last_synced_at FROM brand_assets WHERE dam_asset_id = ?')
    .get(row.damId) as { id: string; dam_modified_at: string; last_synced_at: number } | undefined;

  if (existing) {
    // Skip if not newer (ISO datetime string comparison works lexicographically)
    if (existing.dam_modified_at >= row.damModifiedAt) return;
    db.prepare(
      `
      UPDATE brand_assets SET
        name = ?, file_path = ?, mime_type = ?, size_bytes = ?,
        dam_asset_url = ?, dam_modified_at = ?, last_synced_at = ?, dam_deleted = 0
      WHERE dam_asset_id = ?
    `,
    ).run(
      row.name,
      row.filePath,
      row.mimeType,
      row.sizeBytes,
      row.damUrl,
      row.damModifiedAt,
      Date.now(),
      row.damId,
    );
  } else {
    db.prepare(
      `
      INSERT INTO brand_assets
        (id, name, category, file_path, mime_type, size_bytes, tags,
         source, dam_asset_id, dam_asset_url, dam_modified_at, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'dam', ?, ?, ?, ?, ?)
    `,
    ).run(
      nanoid(),
      row.name,
      row.category,
      row.filePath,
      row.mimeType,
      row.sizeBytes,
      '[]',
      row.damId,
      row.damUrl,
      row.damModifiedAt,
      Date.now(),
      Date.now(),
    );
  }
}

/**
 * Mark DAM assets that are no longer in the DAM folder as soft-deleted.
 *
 * Selects all non-deleted DAM assets from the DB and marks any whose dam_asset_id
 * is NOT in currentDamIds with dam_deleted=1. Returns the count of soft-deleted rows.
 */
export function softDeleteRemovedDamAssets(currentDamIds: Set<string>): number {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, dam_asset_id FROM brand_assets WHERE source = 'dam' AND dam_deleted = 0")
    .all() as Array<{ id: string; dam_asset_id: string }>;

  let count = 0;
  for (const row of rows) {
    if (!currentDamIds.has(row.dam_asset_id)) {
      db.prepare('UPDATE brand_assets SET dam_deleted = 1 WHERE id = ?').run(row.id);
      count++;
    }
  }
  return count;
}

// ─── Saved assets (user library: add/save assets from DAM or upload) ─────────

export interface SavedAsset {
  id: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  source: 'dam' | 'upload';
  createdAt: number;
}

function rowToSavedAsset(row: Record<string, unknown>): SavedAsset {
  return {
    id: row.id as string,
    url: row.url as string,
    name: (row.name as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    source: (row.source as 'dam' | 'upload') || 'dam',
    createdAt: row.created_at as number,
  };
}

export function getSavedAssets(): SavedAsset[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM saved_assets ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToSavedAsset);
}

export function createSavedAsset(input: {
  url: string;
  name?: string | null;
  mimeType?: string | null;
  source?: 'dam' | 'upload';
}): SavedAsset {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const source = input.source ?? 'dam';
  db.prepare(
    'INSERT INTO saved_assets (id, url, name, mime_type, source, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, input.url, input.name ?? null, input.mimeType ?? null, source, now);
  return {
    id,
    url: input.url,
    name: input.name ?? null,
    mimeType: input.mimeType ?? null,
    source,
    createdAt: now,
  };
}

export function deleteSavedAsset(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM saved_assets WHERE id = ?');
  stmt.run(id);
}

// ─── Voice Guide ─────────────────────────────────────────────────────────────

export interface VoiceGuideDoc {
  id: string;
  slug: string;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToVoiceGuideDoc(row: Record<string, unknown>): VoiceGuideDoc {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getVoiceGuideDocs(): VoiceGuideDoc[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM voice_guide_docs ORDER BY sort_order').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToVoiceGuideDoc);
}

export function getVoiceGuideDoc(slug: string): VoiceGuideDoc | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM voice_guide_docs WHERE slug = ?').get(slug) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToVoiceGuideDoc(row) : undefined;
}

export function updateVoiceGuideDoc(slug: string, content: string): void {
  const db = getDb();
  db.prepare('UPDATE voice_guide_docs SET content = ?, updated_at = ? WHERE slug = ?').run(
    content,
    Date.now(),
    slug,
  );
}

// ─── Brand Patterns ──────────────────────────────────────────────────────────

export interface BrandPattern {
  id: string;
  slug: string;
  label: string;
  category: string;
  content: string;
  weight: number;
  isCore: boolean;
  sortOrder: number;
  updatedAt: number;
}

function rowToBrandPattern(row: Record<string, unknown>): BrandPattern {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    category: row.category as string,
    content: row.content as string,
    weight: (row.weight as number) ?? 50,
    isCore: (row.is_core as number) === 1,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getBrandPatterns(category?: string): BrandPattern[] {
  const db = getDb();
  const rows = (
    category
      ? db
          .prepare('SELECT * FROM brand_patterns WHERE category = ? ORDER BY sort_order')
          .all(category)
      : db.prepare('SELECT * FROM brand_patterns ORDER BY sort_order').all()
  ) as Record<string, unknown>[];
  return rows.map(rowToBrandPattern);
}

export function getBrandPatternBySlug(slug: string): BrandPattern | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM brand_patterns WHERE slug = ?').get(slug) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToBrandPattern(row) : undefined;
}

export function updateBrandPattern(
  slug: string,
  updates: { content?: string; weight?: number; label?: string },
): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.content !== undefined) {
    sets.push('content = ?');
    params.push(updates.content);
  }
  if (updates.weight !== undefined) {
    sets.push('weight = ?');
    params.push(updates.weight);
  }
  if (updates.label !== undefined) {
    sets.push('label = ?');
    params.push(updates.label);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(slug);
  db.prepare(`UPDATE brand_patterns SET ${sets.join(', ')} WHERE slug = ?`).run(...params);
}

export function createBrandPattern(input: {
  label: string;
  category: string;
  content: string;
  weight?: number;
}): BrandPattern {
  const db = getDb();
  const id = nanoid();
  const slug = slugify(input.label);
  const now = Date.now();
  const maxOrder =
    (
      db
        .prepare('SELECT MAX(sort_order) as m FROM brand_patterns WHERE category = ?')
        .get(input.category) as { m: number | null }
    )?.m ?? 0;
  db.prepare(
    'INSERT INTO brand_patterns (id, slug, label, category, content, weight, is_core, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
  ).run(
    id,
    slug,
    input.label,
    input.category,
    input.content,
    input.weight ?? 50,
    maxOrder + 1,
    now,
  );
  return {
    id,
    slug,
    label: input.label,
    category: input.category,
    content: input.content,
    weight: input.weight ?? 50,
    isCore: false,
    sortOrder: maxOrder + 1,
    updatedAt: now,
  };
}

export function deleteBrandPattern(slug: string): 'deleted' | 'is_core' | 'not_found' {
  const db = getDb();
  const row = db.prepare('SELECT is_core FROM brand_patterns WHERE slug = ?').get(slug) as
    | { is_core: number }
    | undefined;
  if (!row) return 'not_found';
  if (row.is_core === 1) return 'is_core';
  db.prepare('DELETE FROM brand_patterns WHERE slug = ?').run(slug);
  return 'deleted';
}

// ─── Design Rules (template_design_rules) ────────────────────────────────────

export interface DesignRule {
  id: string;
  scope: string;
  platform: string | null;
  archetypeSlug: string | null;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToDesignRule(row: Record<string, unknown>): DesignRule {
  return {
    id: row.id as string,
    scope: row.scope as string,
    platform: (row.platform as string | null) ?? null,
    archetypeSlug: (row.archetype_slug as string | null) ?? null,
    label: row.label as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getDesignRules(scope?: string, platform?: string): DesignRule[] {
  const db = getDb();
  if (scope && platform) {
    return (
      db
        .prepare(
          'SELECT * FROM template_design_rules WHERE scope = ? AND platform = ? ORDER BY sort_order',
        )
        .all(scope, platform) as Record<string, unknown>[]
    ).map(rowToDesignRule);
  }
  if (scope) {
    return (
      db
        .prepare('SELECT * FROM template_design_rules WHERE scope = ? ORDER BY sort_order')
        .all(scope) as Record<string, unknown>[]
    ).map(rowToDesignRule);
  }
  if (platform) {
    return (
      db
        .prepare('SELECT * FROM template_design_rules WHERE platform = ? ORDER BY sort_order')
        .all(platform) as Record<string, unknown>[]
    ).map(rowToDesignRule);
  }
  return (
    db.prepare('SELECT * FROM template_design_rules ORDER BY sort_order').all() as Record<
      string,
      unknown
    >[]
  ).map(rowToDesignRule);
}

export function getDesignRule(id: string): DesignRule | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM template_design_rules WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToDesignRule(row) : undefined;
}

export function getDesignRulesByArchetype(archetypeSlug: string, platform?: string): DesignRule[] {
  const db = getDb();
  if (platform) {
    return (
      db
        .prepare(
          'SELECT * FROM template_design_rules WHERE archetype_slug = ? AND platform = ? ORDER BY sort_order',
        )
        .all(archetypeSlug, platform) as Record<string, unknown>[]
    ).map(rowToDesignRule);
  }
  return (
    db
      .prepare('SELECT * FROM template_design_rules WHERE archetype_slug = ? ORDER BY sort_order')
      .all(archetypeSlug) as Record<string, unknown>[]
  ).map(rowToDesignRule);
}

export function updateDesignRule(id: string, content: string): void {
  const db = getDb();
  db.prepare('UPDATE template_design_rules SET content = ?, updated_at = ? WHERE id = ?').run(
    content,
    Date.now(),
    id,
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  type: string;
  num: string;
  name: string;
  file: string;
  layout: string;
  dims: string | null;
  description: string;
  contentSlots: Array<{ slot: string; spec: string; color: string | null }>;
  extraTables: Array<{ label: string; headers: string[] | null; rows: string[][] }> | null;
  previewPath: string;
  sortOrder: number;
  updatedAt: number;
  contentType: string | null;
  tags: string[];
}

export interface AgentTemplateSummary {
  id: string;
  name: string;
  platform: string;
  contentType: string | null;
  description: string;
  tags: string[];
  dims: string | null;
}

function rowToTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    type: row.type as string,
    num: row.num as string,
    name: row.name as string,
    file: row.file as string,
    layout: row.layout as string,
    dims: (row.dims as string | null) ?? null,
    description: row.description as string,
    contentSlots: JSON.parse(row.content_slots as string),
    extraTables: row.extra_tables ? JSON.parse(row.extra_tables as string) : null,
    previewPath: row.preview_path as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
    contentType: (row.content_type as string | null) ?? null,
    tags: JSON.parse((row.tags as string) ?? '[]'),
  };
}

export function getTemplates(type?: string): Template[] {
  const db = getDb();
  if (type) {
    return (
      db.prepare('SELECT * FROM templates WHERE type = ? ORDER BY sort_order').all(type) as Record<
        string,
        unknown
      >[]
    ).map(rowToTemplate);
  }
  return (
    db.prepare('SELECT * FROM templates ORDER BY sort_order').all() as Record<string, unknown>[]
  ).map(rowToTemplate);
}

export function getTemplate(id: string): Template | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToTemplate(row) : undefined;
}

export function updateTemplate(
  id: string,
  fields: Partial<Pick<Template, 'description' | 'contentSlots' | 'extraTables'>>,
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.description !== undefined) {
    sets.push('description = ?');
    vals.push(fields.description);
  }
  if (fields.contentSlots !== undefined) {
    sets.push('content_slots = ?');
    vals.push(JSON.stringify(fields.contentSlots));
  }
  if (fields.extraTables !== undefined) {
    sets.push('extra_tables = ?');
    vals.push(fields.extraTables ? JSON.stringify(fields.extraTables) : null);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/** Seed content_type and tags routing metadata for the 8 built-in templates. Idempotent. */
export function seedTemplateRoutingMetadata(): void {
  const db = getDb();
  const ROUTING_METADATA: Record<string, { content_type: string; tags: string[] }> = {
    't1-quote': { content_type: 'testimonial', tags: ['quote', 'client', 'portrait'] },
    't2-app-highlight': { content_type: 'feature-highlight', tags: ['product', 'app', 'mockup'] },
    't3-partner-alert': { content_type: 'announcement', tags: ['partner', 'alert', 'landscape'] },
    't4-fluid-ad': { content_type: 'feature-highlight', tags: ['capabilities', 'features', 'ad'] },
    't5-partner-announcement': {
      content_type: 'announcement',
      tags: ['partner', 'person', 'landscape'],
    },
    't6-employee-spotlight': {
      content_type: 'spotlight',
      tags: ['employee', 'person', 'portrait'],
    },
    't7-carousel': {
      content_type: 'carousel-insights',
      tags: ['carousel', 'insights', 'multi-slide'],
    },
    't8-quarterly-stats': {
      content_type: 'carousel-stats',
      tags: ['carousel', 'stats', 'data', 'quarterly'],
    },
  };

  const stmt = db.prepare('UPDATE templates SET content_type = ?, tags = ? WHERE id = ?');
  for (const [id, meta] of Object.entries(ROUTING_METADATA)) {
    stmt.run(meta.content_type, JSON.stringify(meta.tags), id);
  }
}

/** Return lightweight template summaries for agent routing decisions. */
export function getAgentTemplates(platform?: string): AgentTemplateSummary[] {
  const db = getDb();
  const query = platform
    ? 'SELECT id, name, type, dims, description, content_type, tags FROM templates WHERE type = ? ORDER BY sort_order'
    : 'SELECT id, name, type, dims, description, content_type, tags FROM templates ORDER BY sort_order';
  const rows = (platform ? db.prepare(query).all(platform) : db.prepare(query).all()) as Record<
    string,
    unknown
  >[];
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    platform: (row.type as string) ?? 'unknown',
    contentType: (row.content_type as string) ?? null,
    description: row.description as string,
    tags: JSON.parse((row.tags as string) ?? '[]'),
    dims: (row.dims as string) ?? null,
  }));
}

/**
 * Load all Design DNA relevant to a pipeline generation context.
 * Returns: global visual style, social general rules, platform-specific rules,
 * and matched archetype rules — ready to inject into agent system prompts.
 */
export function getDesignDnaForPipeline(
  creationType: string,
  archetypeSlug?: string,
): { globalStyle: string; socialGeneral: string; platformRules: string; archetypeNotes: string } {
  // Map creationType to platform
  const platform = creationType === 'linkedin' ? 'linkedin' : 'instagram';

  // Global visual style from brand_patterns
  const visualStyle = getBrandPatternBySlug('visual-compositor-contract');
  const globalStyle = visualStyle ? visualStyle.content : '';

  // Social general rules
  const generalRules = getDesignRules('global-social');
  const socialGeneral = generalRules.map((r) => r.content).join('\n\n');

  // Platform-specific rules
  const platformRules = getDesignRules('platform', platform);
  const platformText = platformRules.map((r) => `## ${r.label}\n${r.content}`).join('\n\n');

  // Archetype-specific notes
  let archetypeNotes = '';
  if (archetypeSlug) {
    const archetypeRules = getDesignRulesByArchetype(archetypeSlug);
    archetypeNotes = archetypeRules.map((r) => `## ${r.label}\n${r.content}`).join('\n\n');
  }

  return { globalStyle, socialGeneral, platformRules: platformText, archetypeNotes };
}

// ─── Context Map ──────────────────────────────────────────────────────────────

export interface ContextMapEntry {
  id: string;
  creationType: string;
  stage: string;
  page: string;
  sections: string[];
  priority: number;
  maxTokens: number | null;
  sortOrder: number;
  updatedAt: number;
}

function rowToContextMapEntry(row: Record<string, unknown>): ContextMapEntry {
  return {
    id: row.id as string,
    creationType: row.creation_type as string,
    stage: row.stage as string,
    page: (row.page as string) ?? 'patterns',
    sections: JSON.parse(row.sections as string) as string[],
    priority: row.priority as number,
    maxTokens: (row.max_tokens as number | null) ?? null,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getContextMap(): ContextMapEntry[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM context_map ORDER BY sort_order, creation_type, stage')
    .all() as Record<string, unknown>[];
  return rows.map(rowToContextMapEntry);
}

export function upsertContextMapEntry(input: {
  id?: string;
  creationType: string;
  stage: string;
  page?: string;
  sections: string[];
  priority?: number;
  maxTokens?: number | null;
}): ContextMapEntry {
  const db = getDb();
  const now = Date.now();

  if (input.id) {
    // UPDATE existing row
    db.prepare(
      'UPDATE context_map SET sections = ?, priority = ?, max_tokens = ?, page = ?, updated_at = ? WHERE id = ?',
    ).run(
      JSON.stringify(input.sections),
      input.priority ?? 50,
      input.maxTokens ?? null,
      input.page ?? 'patterns',
      now,
      input.id,
    );
    const row = db.prepare('SELECT * FROM context_map WHERE id = ?').get(input.id) as Record<
      string,
      unknown
    >;
    return rowToContextMapEntry(row);
  } else {
    // INSERT new row
    const id = nanoid();
    db.prepare(
      'INSERT INTO context_map (id, creation_type, stage, page, sections, priority, max_tokens, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      input.creationType,
      input.stage,
      input.page ?? 'patterns',
      JSON.stringify(input.sections),
      input.priority ?? 50,
      input.maxTokens ?? null,
      0,
      now,
    );
    const row = db.prepare('SELECT * FROM context_map WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    return rowToContextMapEntry(row);
  }
}

export function deleteContextMapEntry(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM context_map WHERE id = ?').run(id);
  return (result.changes ?? 0) > 0;
}

// ─── Context Log ──────────────────────────────────────────────────────────────

export interface ContextLogEntry {
  id: string;
  generationId: string;
  creationType: string;
  stage: string;
  injectedSections: string[];
  tokenEstimate: number;
  gapToolCalls: Array<{ tool: string; input: Record<string, unknown>; timestamp: number }>;
  createdAt: number;
}

function rowToContextLogEntry(row: Record<string, unknown>): ContextLogEntry {
  return {
    id: row.id as string,
    generationId: row.generation_id as string,
    creationType: row.creation_type as string,
    stage: row.stage as string,
    injectedSections: JSON.parse(row.injected_sections as string) as string[],
    tokenEstimate: row.token_estimate as number,
    gapToolCalls: JSON.parse(row.gap_tool_calls as string),
    createdAt: row.created_at as number,
  };
}

export function insertContextLog(input: {
  generationId: string;
  creationType: string;
  stage: string;
  injectedSections: string[];
  tokenEstimate: number;
  gapToolCalls?: Array<{ tool: string; input: Record<string, unknown>; timestamp: number }>;
}): ContextLogEntry {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO context_log (id, generation_id, creation_type, stage, injected_sections, token_estimate, gap_tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.generationId,
    input.creationType,
    input.stage,
    JSON.stringify(input.injectedSections),
    input.tokenEstimate,
    JSON.stringify(input.gapToolCalls ?? []),
    now,
  );
  const row = db.prepare('SELECT * FROM context_log WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  return rowToContextLogEntry(row);
}

/**
 * Load the full context map from DB, keyed by "creationType:stage".
 * Called once at pipeline start, cached for entire run.
 */
export function loadContextMap(): Map<
  string,
  Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>
> {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT creation_type, stage, page, sections, priority, max_tokens FROM context_map ORDER BY priority DESC',
    )
    .all() as Array<{
    creation_type: string;
    stage: string;
    page: string;
    sections: string;
    priority: number;
    max_tokens: number | null;
  }>;

  const map = new Map<
    string,
    Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>
  >();
  for (const row of rows) {
    const key = `${row.creation_type}:${row.stage}`;
    const entry = {
      page: row.page ?? 'patterns',
      sections: JSON.parse(row.sections),
      priority: row.priority,
      maxTokens: row.max_tokens,
    };
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}

export function getContextLogs(filters?: {
  creationType?: string;
  stage?: string;
  limit?: number;
}): ContextLogEntry[] {
  const db = getDb();
  const limit = filters?.limit ?? 50;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.creationType) {
    conditions.push('creation_type = ?');
    params.push(filters.creationType);
  }
  if (filters?.stage) {
    conditions.push('stage = ?');
    params.push(filters.stage);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const rows = db
    .prepare(`SELECT * FROM context_log ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params) as Record<string, unknown>[];

  return rows.map(rowToContextLogEntry);
}

// ─── Brand Styles (CSS Layer System) ─────────────────────────────────────────

export interface BrandStyle {
  id: string;
  scope: string;
  cssContent: string;
  updatedAt: number;
}

function rowToBrandStyle(row: Record<string, unknown>): BrandStyle {
  return {
    id: row.id as string,
    scope: row.scope as string,
    cssContent: row.css_content as string,
    updatedAt: row.updated_at as number,
  };
}

/** List all brand style entries. */
export function getBrandStyles(): BrandStyle[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM brand_styles ORDER BY scope').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToBrandStyle);
}

/** Get CSS for a specific scope. */
export function getBrandStyleByScope(scope: string): BrandStyle | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM brand_styles WHERE scope = ?').get(scope) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToBrandStyle(row) : null;
}

/** Update CSS content for a scope. Creates if not exists. */
export function upsertBrandStyle(scope: string, cssContent: string): BrandStyle {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM brand_styles WHERE scope = ?').get(scope) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare('UPDATE brand_styles SET css_content = ?, updated_at = ? WHERE scope = ?').run(
      cssContent,
      now,
      scope,
    );
    return getBrandStyleByScope(scope)!;
  }

  const id = `bs_${scope}`;
  db.prepare(
    'INSERT INTO brand_styles (id, scope, css_content, updated_at) VALUES (?, ?, ?, ?)',
  ).run(id, scope, cssContent, now);
  return getBrandStyleByScope(scope)!;
}

/** Delete brand override for a scope (resets to empty). */
export function deleteBrandStyle(scope: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE brand_styles SET css_content = '', updated_at = ? WHERE scope = ?")
    .run(Date.now(), scope);
  return result.changes > 0;
}

// ─── Phase 24: Generated assets + tool audit helpers ──────────────────────────

/**
 * Insert a Gemini-generated image as a brand asset with source='generated'.
 * metadata JSON captures prompt, model, aspect_ratio, idempotency_key, etc.
 */
export function insertGeneratedAsset(params: {
  id: string;
  name: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
}): BrandAsset {
  const db = getDb();
  db.prepare(
    `INSERT INTO brand_assets (id, name, category, file_path, mime_type, size_bytes, tags, description, source, dam_deleted, metadata, created_at)
     VALUES (?, ?, 'images', ?, ?, ?, '[]', NULL, 'generated', 0, ?, ?)`,
  ).run(
    params.id,
    params.name,
    params.filePath,
    params.mimeType,
    params.sizeBytes,
    JSON.stringify(params.metadata),
    Date.now(),
  );

  return {
    id: params.id,
    name: params.name,
    category: 'images',
    url: `/api/brand-assets/serve/${encodeURIComponent(params.name)}`,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    tags: [],
    source: 'generated',
    damDeleted: false,
    description: null,
  };
}

/**
 * Look up a generated brand asset by idempotency key stored in its metadata JSON.
 * Uses SQLite's native json_extract with a bound parameter (injection-safe).
 * Returns a minimal shape sufficient for the idempotency hit-path in generateImageTool.
 */
export function findAssetByIdempotencyKey(
  key: string,
): { id: string; name: string; url: string; filePath: string; mimeType: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, name, file_path, mime_type FROM brand_assets WHERE json_extract(metadata, '$.idempotency_key') = ? LIMIT 1",
    )
    .get(key) as { id: string; name: string; file_path: string; mime_type: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: `/api/brand-assets/serve/${encodeURIComponent(row.name)}`,
    filePath: row.file_path,
    mimeType: row.mime_type,
  };
}

/**
 * Promote a generated (or uploaded) asset to the curated brand library.
 * Changes source from 'generated' or 'upload' to 'local' so it appears
 * alongside DAM assets in searches.
 *
 * Preferred over modifying promoteUploadToLibrary — that function has
 * explicit 'upload'-only semantics. This helper has the broader predicate.
 */
export function promoteAssetToLibrary(assetId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE brand_assets SET source = 'local' WHERE id = ? AND source IN ('upload', 'generated')",
  ).run(assetId);
}

export interface BrandAssetSearchResult {
  id: string;
  name: string;
  category: string;
  filePath: string;
  mimeType: string;
  description: string | null;
  score: number;
  url: string;
}

/**
 * Text-score search over brand_assets name, description, and tags.
 * Scoring per query token:
 *   +3 if token matches name (case-insensitive)
 *   +2 if token matches description
 *   +1 if token matches tags JSON string
 *   +1 if category matches category filter
 * Returns score-sorted descending, capped at limit (default 10, max 25).
 */
export function searchBrandAssets(
  query: string,
  category?: string,
  limit: number = 10,
): BrandAssetSearchResult[] {
  const db = getDb();
  const effectiveLimit = Math.min(limit, 25);
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return [];

  // Fetch candidate rows (filtered by category when provided, excluding deleted)
  const rows = (
    category
      ? (db
          .prepare(
            'SELECT id, name, category, file_path, mime_type, description, tags FROM brand_assets WHERE category = ? AND (dam_deleted = 0 OR dam_deleted IS NULL)',
          )
          .all(category) as Record<string, unknown>[])
      : (db
          .prepare(
            'SELECT id, name, category, file_path, mime_type, description, tags FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL)',
          )
          .all() as Record<string, unknown>[])
  );

  const scored: BrandAssetSearchResult[] = [];

  for (const row of rows) {
    const nameLower = (row.name as string).toLowerCase();
    const descLower = ((row.description as string | null) ?? '').toLowerCase();
    const tagsLower = (row.tags as string).toLowerCase();
    const catLower = (row.category as string).toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (nameLower.includes(token)) score += 3;
      if (descLower.includes(token)) score += 2;
      if (tagsLower.includes(token)) score += 1;
    }
    if (category && catLower === category.toLowerCase()) score += 1;

    if (score > 0) {
      scored.push({
        id: row.id as string,
        name: row.name as string,
        category: row.category as string,
        filePath: row.file_path as string,
        mimeType: row.mime_type as string,
        description: (row.description as string | null) ?? null,
        score,
        url: `/api/brand-assets/serve/${encodeURIComponent(row.name as string)}`,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, effectiveLimit);
}

export interface ToolAuditLogEntry {
  sessionId: string | null;
  tool: string;
  argsHash: string;
  tier: string;
  decision: string;
  costUsdEst?: number;
  outcome?: string;
  detailJson?: string;
}

/**
 * Insert a row into tool_audit_log. Used by the tool-dispatch wrapper (Phase 24+).
 * id is auto-generated via nanoid, timestamp is Date.now().
 */
export function writeToolAuditLog(entry: ToolAuditLogEntry): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO tool_audit_log (id, session_id, tool, args_hash, tier, decision, cost_usd_est, outcome, timestamp, detail_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    entry.sessionId,
    entry.tool,
    entry.argsHash,
    entry.tier,
    entry.decision,
    entry.costUsdEst ?? 0,
    entry.outcome ?? null,
    Date.now(),
    entry.detailJson ?? null,
  );
}

/**
 * Sum cost_usd_est from tool_audit_log for the current UTC day (midnight to now).
 * Pass sinceTs (Unix ms) to override the start timestamp.
 * Used by later dispatches to enforce daily spend caps.
 */
export function dailySpendUsd(sinceTs?: number): number {
  const db = getDb();
  const startOfDay = sinceTs ?? (() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  })();
  const result = db
    .prepare(
      'SELECT COALESCE(SUM(cost_usd_est), 0) as total FROM tool_audit_log WHERE timestamp >= ?',
    )
    .get(startOfDay) as { total: number };
  return result.total;
}

// ─── Stale iteration cleanup ────────────────────────────────────────────────

/**
 * Resolve an iteration's html_path to an on-disk file, trying the canonical
 * strategies the watcher uses to serve HTML. Returns the first resolved
 * absolute path, or null if none of the strategies locate the file.
 *
 * The watcher (canvas/src/server/watcher.ts, /api/iterations/:id/html) tries
 * 7 fallback strategies for historical/legacy shape reasons. For cleanup
 * purposes we check the four that map to canonical on-disk shapes actual
 * rows are written with today:
 *   1. html_path resolved against PROJECT_ROOT (default agent-tools shape)
 *   2. html_path resolved against .fluid/ (legacy writers)
 *   3. canonical `.fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html`
 *   7. slide-less shape: `.fluid/campaigns/{cId}/{creationId}/{iterId}.html`
 * Strategies 5/6 are duplicates of 1/2 with .fluid/ stripping. Strategy 4
 * (templates/social by basename) is for template rows which wouldn't exist in
 * iterations in the abandoned-save state we're targeting. Skipping them here
 * keeps cleanup conservative — a file found by any skipped strategy would
 * mean we'd incorrectly mark a valid iteration stale.
 */
export function resolveIterationHtmlPath(
  row: { id: string; html_path: string; slide_id?: string | null },
  projectRoot: string = DB_API_PROJECT_ROOT,
): string | null {
  if (!row.html_path) return null;
  const fluidDir = path.resolve(projectRoot, '.fluid');

  // Strategy 1: resolve against project root
  const stored = path.resolve(projectRoot, row.html_path);
  if (fs.existsSync(stored)) return stored;

  // Strategy 2: resolve against .fluid/
  const fluidPath = path.resolve(fluidDir, row.html_path);
  if (fs.existsSync(fluidPath)) return fluidPath;

  // Look up full hierarchy for strategies 3 and 7
  const db = getDb();
  const hierarchy = db
    .prepare(
      `
      SELECT c.campaign_id, s.creation_id, i.slide_id
      FROM iterations i
      JOIN slides s ON s.id = i.slide_id
      JOIN creations c ON c.id = s.creation_id
      WHERE i.id = ?
      `,
    )
    .get(row.id) as
    | { campaign_id: string; creation_id: string; slide_id: string }
    | undefined;

  if (hierarchy) {
    // Strategy 3: canonical .fluid/campaigns/{cId}/{creationId}/{slideId}/{iterId}.html
    const canonical = path.join(
      fluidDir,
      'campaigns',
      hierarchy.campaign_id,
      hierarchy.creation_id,
      hierarchy.slide_id,
      `${row.id}.html`,
    );
    if (fs.existsSync(canonical)) return canonical;

    // Strategy 7: slide-less shape
    const noSlide = path.join(
      fluidDir,
      'campaigns',
      hierarchy.campaign_id,
      hierarchy.creation_id,
      `${row.id}.html`,
    );
    if (fs.existsSync(noSlide)) return noSlide;
  }

  return null;
}

/**
 * Delete iteration rows whose `html_path` points to a file that no longer
 * exists on disk, then cascade-delete now-empty slides/creations/campaigns.
 *
 * Why: saveCreation is only semi-atomic. A file write is done before the DB
 * transaction. Historically, abandoned test runs, crashed saves, or hand-wired
 * test fixtures have left iteration rows pointing to files that were never
 * created or were cleaned up out of band. The Campaigns view then renders
 * cards that load "HTML file not found on disk" in place of the preview.
 *
 * Safety:
 *   - `minAgeMs` (default 10 minutes) protects rows mid-save. saveCreation
 *     writes the file before the DB transaction, but validation / image
 *     generation can keep a row in an "in-flight" state for several seconds.
 *     Anything younger than `minAgeMs` is left alone.
 *   - The singleton `__standalone__` sentinel campaign is never deleted, even
 *     if all of its child creations are cleaned up. It's a logical bucket
 *     used by campaignless saves; a re-created sentinel would get a new ID
 *     and break any UI currently filtered to the old one.
 *   - Resolution uses the same four strategies the watcher uses to serve
 *     HTML (see resolveIterationHtmlPath). An iteration is only flagged stale
 *     when ALL strategies fail.
 *   - When `dryRun`, the function reports what would be deleted and performs
 *     no mutations.
 */
export function cleanupStaleIterations(opts?: {
  dryRun?: boolean;
  minAgeMs?: number;
}): {
  iterationsDeleted: number;
  slidesDeleted: number;
  creationsDeleted: number;
  campaignsDeleted: number;
  details: Array<{ id: string; html_path: string; age_ms: number }>;
} {
  const dryRun = opts?.dryRun ?? false;
  const minAgeMs = opts?.minAgeMs ?? 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, html_path, slide_id, created_at FROM iterations WHERE html_path IS NOT NULL',
    )
    .all() as Array<{
    id: string;
    html_path: string;
    slide_id: string | null;
    created_at: number;
  }>;

  const staleDetails: Array<{ id: string; html_path: string; age_ms: number }> = [];
  for (const row of rows) {
    const resolved = resolveIterationHtmlPath(row);
    if (resolved !== null) continue; // file found — not stale
    const age = now - (row.created_at ?? 0);
    if (age <= minAgeMs) continue; // too young — may be an in-flight save
    staleDetails.push({ id: row.id, html_path: row.html_path, age_ms: age });
  }

  if (staleDetails.length === 0 || dryRun) {
    return {
      iterationsDeleted: 0,
      slidesDeleted: 0,
      creationsDeleted: 0,
      campaignsDeleted: 0,
      details: staleDetails,
    };
  }

  const staleIds = staleDetails.map((s) => s.id);

  let iterationsDeleted = 0;
  let slidesDeleted = 0;
  let creationsDeleted = 0;
  let campaignsDeleted = 0;

  const tx = db.transaction(() => {
    // Find affected parents BEFORE deleting the iterations so we can scope
    // the cascade checks.
    const placeholders = staleIds.map(() => '?').join(',');
    const affectedSlides = db
      .prepare(`SELECT DISTINCT slide_id FROM iterations WHERE id IN (${placeholders})`)
      .all(...staleIds) as Array<{ slide_id: string }>;
    const slideIds = affectedSlides.map((r) => r.slide_id).filter(Boolean);

    const iterDelete = db
      .prepare(`DELETE FROM iterations WHERE id IN (${placeholders})`)
      .run(...staleIds);
    iterationsDeleted = iterDelete.changes;

    // Cascade: delete annotations attached to the deleted iterations.
    db.prepare(`DELETE FROM annotations WHERE iteration_id IN (${placeholders})`).run(
      ...staleIds,
    );

    // Slides with zero surviving iterations → delete.
    const affectedCreationIds = new Set<string>();
    for (const slideId of slideIds) {
      const remaining = db
        .prepare('SELECT COUNT(*) as c FROM iterations WHERE slide_id = ?')
        .get(slideId) as { c: number };
      if (remaining.c === 0) {
        const slide = db
          .prepare('SELECT creation_id FROM slides WHERE id = ?')
          .get(slideId) as { creation_id: string } | undefined;
        if (slide) affectedCreationIds.add(slide.creation_id);
        db.prepare('DELETE FROM slides WHERE id = ?').run(slideId);
        slidesDeleted += 1;
      }
    }

    // Creations with zero surviving slides → delete.
    const affectedCampaignIds = new Set<string>();
    for (const creationId of affectedCreationIds) {
      const remaining = db
        .prepare('SELECT COUNT(*) as c FROM slides WHERE creation_id = ?')
        .get(creationId) as { c: number };
      if (remaining.c === 0) {
        const creation = db
          .prepare('SELECT campaign_id FROM creations WHERE id = ?')
          .get(creationId) as { campaign_id: string } | undefined;
        if (creation) affectedCampaignIds.add(creation.campaign_id);
        db.prepare('DELETE FROM creations WHERE id = ?').run(creationId);
        creationsDeleted += 1;
      }
    }

    // Campaigns with zero surviving creations → delete, EXCEPT the singleton
    // __standalone__ sentinel which must persist.
    for (const campaignId of affectedCampaignIds) {
      const campaign = db
        .prepare('SELECT title FROM campaigns WHERE id = ?')
        .get(campaignId) as { title: string } | undefined;
      if (!campaign) continue;
      if (campaign.title === STANDALONE_CAMPAIGN_TITLE) continue;
      const remaining = db
        .prepare('SELECT COUNT(*) as c FROM creations WHERE campaign_id = ?')
        .get(campaignId) as { c: number };
      if (remaining.c === 0) {
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId);
        campaignsDeleted += 1;
      }
    }
  });
  tx();

  return {
    iterationsDeleted,
    slidesDeleted,
    creationsDeleted,
    campaignsDeleted,
    details: staleDetails,
  };
}
